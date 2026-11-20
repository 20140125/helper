#!/bin/bash
# ======================================
# 通勤路况卡片（家 ↔ 公司，驾车）
# ======================================
#
# 功能说明：
#   1. 把 .env 里的 AMAP_HOME_ADDR / AMAP_WORK_ADDR 解析成坐标（结果缓存，不重复消耗额度）
#   2. 调高德驾车路径规划拿实时耗时与距离（duration 已含实时路况）
#   3. 调圆形区域交通态势拿起点周边的拥堵评价（畅通 / 缓行 / 拥堵）
#   4. 生成 1080x750 卡片 PNG，输出路径给调用方（推送由 card_skill / 规则 runner 负责）
#
# 卡片形态（已定，勿改）：纯文字 + 色块的 SVG，不嵌入任何地图图片
#   - 不调用静态地图 API，不下载/合成底图，不额外消耗额度，也不增加渲染耗时
#   - 需要"路线长什么样"时走文字版主要路段（steps）即可
#
# 当前 Key 的能力边界（实测）：
#   ✅ 驾车 / 步行 / 交通态势 / 地理编码 / 逆地理编码 / POI / 天气
#   ❌ 公交地铁（INSUFFICIENT_PRIVILEGES）、骑行（SERVICE_NOT_AVAILABLE）
#   所以通勤卡固定走「驾车」；换 Key 开通公交后可再加 transit 分支
#
# 入参（起终点一律走入参，不写死）：
#   --from <起点>   中文地址 / "经度,纬度" / "地名|经度,纬度"；也接受别名 home/家、work/公司
#   --to   <终点>   同上
#   --direction     方向 home2work / work2home；留空按当前时间判断（12:00 前算去公司）
#   位置参数简写：bash commute_card.sh <起点> <终点>
#   旧用法兼容：只给一个 home2work / work2home 时按方向处理（等价于 --direction）
#   起终点都没传 → 才回退 .env 的 AMAP_HOME_ADDR / AMAP_WORK_ADDR（家 ↔ 公司）
#
# 依赖配置（web/.env）：
#   AMAP_KEY         高德 Web 服务 Key（唯一必填）
#   AMAP_HOME_ADDR   家庭地址（别名"家"的取值，可留空）
#   AMAP_WORK_ADDR   公司地址（别名"公司"的取值，可留空）
#   最终起终点为空 → 只打日志并退出，不出卡片（不会报错打断主流程）
#
# 使用方式：
#   bash scripts/tools/commute_card.sh                          # 家↔公司，方向按时间
#   bash scripts/tools/commute_card.sh --from 家 --to 深圳宝安机场
#   bash scripts/tools/commute_card.sh "113.9,22.5" "114.0,22.6"
#   bash scripts/tools/commute_card.sh home2work                # 旧用法：强制家→公司
#
# 作者：智能提醒系统
# 更新：2026-10-22
# ======================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/commute_card.png"
SVG_FILE="/tmp/commute_card.svg"
GEOCODE_CACHE="${CACHE_DIR}/amap_geocode.json"

# 命令行解析结果（由 parse_args 填充：方向 / 起点输入 / 终点输入）
DIRECTION=""
FROM_IN=""
TO_IN=""

# 地址 → 坐标（带本地缓存，地址不常变，没必要每次都打接口）
# 入参: $1=地址或坐标
# 输出: "经度,纬度"；失败输出空
geocode_addr() {
    local addr="${1:-}"
    [ -n "$addr" ] || return 0

    # 本身就是坐标
    if printf '%s' "$addr" | grep -qE '^[0-9]+(\.[0-9]+)?,[0-9]+(\.[0-9]+)?$'; then
        printf '%s' "$addr"
        return 0
    fi

    [ -f "$GEOCODE_CACHE" ] || echo '{}' > "$GEOCODE_CACHE"
    local cached
    cached=$(jq -r --arg k "$addr" '.[$k] // ""' "$GEOCODE_CACHE" 2>/dev/null)
    if [ -n "$cached" ]; then
        printf '%s' "$cached"
        return 0
    fi

    local resp coord
    resp=$(curl -s -m 10 -G "https://restapi.amap.com/v3/geocode/geo" \
        --data-urlencode "key=${AMAP_KEY}" \
        --data-urlencode "address=${addr}" 2>/dev/null)
    coord=$(echo "$resp" | jq -r '.geocodes[0].location // ""' 2>/dev/null)

    if [ -n "$coord" ]; then
        jq --arg k "$addr" --arg v "$coord" '.[$k]=$v' "$GEOCODE_CACHE" > "${GEOCODE_CACHE}.tmp" 2>/dev/null \
            && mv "${GEOCODE_CACHE}.tmp" "$GEOCODE_CACHE"
        log_info "📍 地理编码缓存已写入: ${addr} → ${coord}"
    else
        log_warning "⚠️  地址解析失败: ${addr}（$(echo "$resp" | jq -r '.info // "未知错误"' 2>/dev/null)）"
    fi

    printf '%s' "$coord"
}

# 圆形区域交通态势 → 拥堵评价
# 入参: $1=中心坐标
# 输出: 评价文案（畅通/缓行/拥堵/严重拥堵/未知）
traffic_status() {
    local location="${1:-}"
    [ -n "$location" ] || { echo "未知"; return 0; }

    local resp
    resp=$(curl -s -m 10 -G "https://restapi.amap.com/v3/traffic/status/circle" \
        --data-urlencode "key=${AMAP_KEY}" \
        --data-urlencode "location=${location}" \
        --data-urlencode "radius=2000" \
        --data-urlencode "level=5" 2>/dev/null)

    local status desc
    # 注意层级：高德返回 { trafficinfo: { evaluation: { status, description } } }
    status=$(echo "$resp" | jq -r '.trafficinfo.evaluation.status // ""' 2>/dev/null)
    desc=$(echo "$resp" | jq -r '.trafficinfo.evaluation.description // ""' 2>/dev/null)

    case "$status" in
        1) echo "畅通" ;;
        2) echo "缓行" ;;
        3) echo "拥堵" ;;
        4) echo "严重拥堵" ;;
        *) echo "${desc:-未知}" ;;
    esac
}

# 驾车路径规划
# 入参: $1=起点坐标 $2=终点坐标
# 输出: 原始 JSON
fetch_route() {
    local origin="$1"
    local destination="$2"

    curl -s -m 10 -G "https://restapi.amap.com/v3/direction/driving" \
        --data-urlencode "key=${AMAP_KEY}" \
        --data-urlencode "origin=${origin}" \
        --data-urlencode "destination=${destination}" \
        --data-urlencode "extensions=base" 2>/dev/null
}

# 解析成卡片数据
# 入参: $1=路径规划 JSON $2=方向 $3=起点名 $4=终点名 $5=路况
# 输出: items JSON
parse_data() {
    local data="$1"
    local direction="$2"
    local from_name="$3"
    local to_name="$4"
    local traffic="$5"

    local distance duration minutes km steps_json
    distance=$(echo "$data" | jq -r '.route.paths[0].distance // 0')
    duration=$(echo "$data" | jq -r '.route.paths[0].duration // 0')
    minutes=$(( (duration + 59) / 60 ))
    km=$(awk -v d="$distance" 'BEGIN { printf "%.1f", d / 1000 }')
    steps_json=$(echo "$data" | jq -c '[.route.paths[0].steps[0:2][] | .instruction]')

    # 颜色随路况变：畅通绿 / 缓行黄 / 拥堵橙 / 严重拥堵红
    local color="#4CAF50"
    case "$traffic" in
        缓行) color="#FFC107" ;;
        拥堵) color="#FF9800" ;;
        严重拥堵) color="#F44336" ;;
    esac

    jq -n \
        --arg direction "$direction" \
        --arg from "$from_name" \
        --arg to "$to_name" \
        --arg minutes "$minutes" \
        --arg km "$km" \
        --arg traffic "$traffic" \
        --arg color "$color" \
        --argjson steps "$steps_json" \
        '{direction: $direction, from: $from, to: $to, minutes: $minutes, km: $km, traffic: $traffic, color: $color, steps: $steps}'
}

# 生成卡片 SVG → PNG
# 入参: $1=items_json $2=日期字符串
generate_card() {
    local items_json="$1"
    local date_str="$2"

    local body
    body=$(node -e "
const data = JSON.parse(process.argv[1]);
const steps = (data.steps || []).map((s) => String(s).replace(/[<>&]/g, '')).slice(0, 2);
const stepText = steps.map((s) => '· ' + (s.length > 34 ? s.slice(0, 34) + '…' : s)).join('\n');
const body = \`
  <rect x=\"50\" y=\"200\" width=\"980\" height=\"220\" fill=\"#ffffff0a\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
  <text x=\"540\" y=\"255\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"30\" fill=\"#ffffff99\" text-anchor=\"middle\">\${data.from} → \${data.to}</text>
  <text x=\"540\" y=\"350\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"84\" font-weight=\"700\" fill=\"\${data.color}\" text-anchor=\"middle\">\${data.minutes} 分钟</text>
  <text x=\"540\" y=\"395\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"30\" fill=\"#ffffffbb\" text-anchor=\"middle\">\${data.km} 公里 · 路况 \${data.traffic}</text>

  <rect x=\"50\" y=\"450\" width=\"980\" height=\"170\" fill=\"#ffffff08\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
  <text x=\"85\" y=\"490\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffff99\">主要路段</text>
  <text x=\"85\" y=\"530\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"22\" fill=\"#ffffffcc\">\${steps[0] || '—'}</text>
  <text x=\"85\" y=\"570\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"22\" fill=\"#ffffffcc\">\${steps[1] || ''}</text>\`;
console.log(body);
" "$items_json")

    local h=750
    local from to title
    from=$(echo "$items_json" | jq -r '.from')
    to=$(echo "$items_json" | jq -r '.to')
    title="${from} → ${to}"

    {
        svg_header "$h" "#0F1B2A" "#0A121E" "通勤路况" "${date_str}  驾车实时"
        echo "$body"
        svg_footer "$h" "数据来源：高德地图（驾车路径规划 + 交通态势）"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE" 1080 750
}

# 地点别名 → 实际地址
# 入参: $1=用户输入的地点（home/家 取 .env 家庭地址，work/公司 取公司地址）
# 输出: 实际地址或坐标；非别名原样返回
# 兼容前端地图选点的 "地名|经度,纬度" 格式：只取管道后的坐标，省掉一次地理编码
resolve_place() {
    local raw="${1:-}"
    case "$raw" in
        *"|"*)  printf '%s' "${raw##*|}" ;;
        home|家)            printf '%s' "${AMAP_HOME_ADDR:-}" ;;
        work|公司|company)  printf '%s' "${AMAP_WORK_ADDR:-}" ;;
        *)                  printf '%s' "$raw" ;;
    esac
}

# 卡片展示名：别名显示中文，长地址截断，避免撑破卡片
# 入参: $1=用户原始输入
# 输出: ≤12 字符的展示名
# "地名|经度,纬度" 只取地名部分，避免卡片上出现一长串坐标
label_of() {
    local raw="${1:-}"
    case "$raw" in
        home|家)           echo "家";  return 0 ;;
        work|公司|company) echo "公司"; return 0 ;;
    esac
    case "$raw" in
        *"|"*) raw="${raw%%|*}" ;;
    esac
    if [ "${#raw}" -gt 12 ]; then
        printf '%s…' "${raw:0:11}"
    else
        printf '%s' "$raw"
    fi
}

# 解析命令行参数
# 输出: 通过全局变量回传 DIRECTION / FROM_IN / TO_IN
parse_args() {
    DIRECTION=""; FROM_IN=""; TO_IN=""
    while [ "$#" -gt 0 ]; do
        case "$1" in
            --from)      FROM_IN="${2:-}"; shift 2 ;;
            --to)        TO_IN="${2:-}";   shift 2 ;;
            --direction|-d) DIRECTION="${2:-}"; shift 2 ;;
            home2work|work2home) DIRECTION="$1"; shift ;;   # 旧用法兼容
            -h|--help)
                echo "用法: bash commute_card.sh [--from 起点] [--to 终点] [--direction home2work|work2home]"
                echo "      起终点支持中文地址、\"经度,纬度\"，或别名 home/家、work/公司；都留空则用 .env 的家↔公司"
                return 1
                ;;
            *)
                if   [ -z "$FROM_IN" ]; then FROM_IN="$1"
                elif [ -z "$TO_IN" ];   then TO_IN="$1"
                else log_error "多余参数: $1"; return 1
                fi
                shift
                ;;
        esac
    done
    return 0
}

main() {
    log_info "======================================"
    log_info "🚗 通勤路况卡片启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    if [ -z "${AMAP_KEY:-}" ]; then
        log_warning "未配置 AMAP_KEY，跳过通勤卡片"
        return 0
    fi

    parse_args "$@" || return 1
    local direction="$DIRECTION"

    local from_addr to_addr
    from_addr=$(resolve_place "$FROM_IN")
    to_addr=$(resolve_place "$TO_IN")

    if [ -z "$from_addr" ] && [ -z "$to_addr" ]; then
        # 没传入参 → 回退 .env 的家 ↔ 公司，方向按时间判断
        if [ -z "${AMAP_HOME_ADDR:-}" ] || [ -z "${AMAP_WORK_ADDR:-}" ]; then
            log_warning "未传入起终点，也未配置 AMAP_HOME_ADDR / AMAP_WORK_ADDR（web/.env），跳过通勤卡片"
            return 0
        fi
        if [ -z "$direction" ]; then
            if [ "$(date '+%H')" -lt 12 ]; then direction="home2work"; else direction="work2home"; fi
        fi
        if [ "$direction" = "home2work" ]; then
            FROM_IN="home"; TO_IN="work"
        else
            FROM_IN="work"; TO_IN="home"
        fi
        from_addr=$(resolve_place "$FROM_IN")
        to_addr=$(resolve_place "$TO_IN")
    else
        # 传了就必须成对，单边没法规划路线
        if [ -z "$from_addr" ] || [ -z "$to_addr" ]; then
            log_error "起终点需成对传入（--from / --to），当前 from='${FROM_IN}' to='${TO_IN}'"
            return 1
        fi
    fi

    if [ -n "$direction" ]; then
        case "$direction" in
            home2work|work2home) ;;
            *) log_error "未知方向: ${direction}（应为 home2work 或 work2home）"; return 1 ;;
        esac
    fi

    local from_name to_name
    from_name=$(label_of "$FROM_IN")
    to_name=$(label_of "$TO_IN")

    local origin destination
    origin=$(geocode_addr "$from_addr")
    destination=$(geocode_addr "$to_addr")
    if [ -z "$origin" ] || [ -z "$destination" ]; then
        log_error "起终点解析失败（${from_name}=${from_addr} / ${to_name}=${to_addr}），不出卡片"
        return 1
    fi
    log_info "📍 ${from_name}(${origin}) → ${to_name}(${destination})"

    local data
    data=$(fetch_route "$origin" "$destination")
    if [ "$(echo "$data" | jq -r '.status // "0"' 2>/dev/null)" != "1" ]; then
        log_error "路径规划失败（info=$(echo "$data" | jq -r '.info // "未知"' 2>/dev/null)）"
        return 1
    fi

    local traffic
    traffic=$(traffic_status "$origin")
    log_info "🚦 起点周边路况: ${traffic}"

    local items_json date_str
    items_json=$(parse_data "$data" "$direction" "$from_name" "$to_name" "$traffic")
    date_str=$(get_date_str)

    generate_card "$items_json" "$date_str"
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"

    echo "$OUTPUT_FILE"
}

main "$@"
