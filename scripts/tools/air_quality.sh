#!/bin/bash
# ======================================
# 空气质量监测卡片（支持指定城市）
# ======================================
#
# 功能说明：
#   1. 获取指定城市实时空气质量数据（AQI、PM2.5、PM10）
#   2. 根据 AQI 等级生成健康建议
#   3. 生成空气质量卡片
#
# 入参：
#   $1  城市名，可选；留空 = 深圳。
#       中文（上海/北京/深圳）/拼音/英文均可，由 WAQI 自动解析。
#       入参会先经 normalize_city_slug 归一化（小写、空格转 -、去"市/县/区/省"后缀、
#       中文转拼音），归一化值只作缓存 key；URL 仍用入参原样，避免拼音录错打错地址。
#
# 数据源：
#   WAQI（World Air Quality Index）。token 读 .env 的 WAQI_TOKEN，未配置时用官方
#   demo token —— demo token 对任何城市都返回同一个站点的数据，需自备 token 才准确。
#
# 使用方式：
#   bash scripts/tools/air_quality.sh                # 默认深圳
#   bash scripts/tools/air_quality.sh 上海           # 指定中文城市
#   bash scripts/tools/air_quality.sh "New York"   # 含空格英文城市
#
# 作者：智能提醒系统
# 更新：2026-10-14
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/air_quality_card.png"
SVG_FILE="/tmp/air_quality_card.svg"

# 获取空气质量数据
# 入参: $1=城市（留空=shenzhen）
fetch_data() {
    local city="${1:-shenzhen}"
    # 缓存 key 走归一化（"深圳"/"深圳市"/"shenzhen" → shenzhen，避免同一城市各写一份缓存）
    local city_key
    city_key=$(normalize_city_slug "$city")
    # URL 用入参原样（仅小写 + 空格转 -）：归一化值只用来归档，不参与请求。
    # 这样即使某个城市的拼音没录准，也只是文件名不同，不会把请求打到错误的地址
    local city_slug
    city_slug=$(printf '%s' "$city" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
    # token 优先读 .env 的 WAQI_TOKEN；未配置时退回官方 demo token。
    # 注意：demo token 对任何城市都返回同一个站点（实测恒为上海）的数据，
    # 只有换成 aqicn.org 免费申请的 token 才能真正按城市区分。
    local token="${WAQI_TOKEN:-demo}"
    local url="https://api.waqi.info/feed/${city_slug}/?token=${token}"
    # 小时级缓存：AQI 一小时内会变，按小时分槽位归档（同一月文件内）
    local result
    result=$(API_ARCHIVE_SLOT=hour fetch_url_cached airquality "${city_key}" "$url" 15)

    if [ -z "$result" ] || [ "$(echo "$result" | jq -r '.status' 2>/dev/null)" != "ok" ]; then
        log_warning "WAQI API 请求失败 (city=${city_slug})，使用模拟数据"
        result='{"status":"ok","data":{"aqi":55,"iaqi":{"pm25":{"v":38},"pm10":{"v":55}}}}'
    fi

    echo "$result"
}

# 解析数据并计算等级
parse_data() {
    local data="$1"
    local aqi pm25 pm10
    
    aqi=$(echo "$data" | jq -r '.data.aqi // 55')
    pm25=$(echo "$data" | jq -r '.data.iaqi.pm25.v // 38')
    pm10=$(echo "$data" | jq -r '.data.iaqi.pm10.v // 55')
    
    local level color bg1 bg2 advice
    
    if [ "$aqi" -le 50 ]; then
        level="优"
        color="#4CAF50"
        bg1="#1B3A2A"
        bg2="#0D2818"
        advice="空气质量令人满意，各类人群可正常活动"
    elif [ "$aqi" -le 100 ]; then
        level="良"
        color="#8BC34A"
        bg1="#2A3A1B"
        bg2="#182810"
        advice="空气质量可接受，极少数人应减少户外活动"
    elif [ "$aqi" -le 150 ]; then
        level="轻度污染"
        color="#FF9800"
        bg1="#3A2A1B"
        bg2="#281810"
        advice="儿童、老年人及心脏病患者应减少长时间户外活动"
    elif [ "$aqi" -le 200 ]; then
        level="中度污染"
        color="#FF5722"
        bg1="#3A1B1B"
        bg2="#280D0D"
        advice="进一步加剧易感人群症状，应减少户外活动"
    else
        level="重度污染"
        color="#9C27B0"
        bg1="#2E1B3A"
        bg2="#1A0D28"
        advice="所有人群应避免户外活动，减少开窗通风"
    fi
    
    cat <<EOF
{
  "aqi": $aqi,
  "level": "$level",
  "pm25": $pm25,
  "pm10": $pm10,
  "color": "$color",
  "bg1": "$bg1",
  "bg2": "$bg2",
  "advice": "$advice"
}
EOF
}

# 生成卡片 SVG
# 入参: $1=items_json $2=date_str $3=城市展示名
generate_card() {
    local items_json="$1"
    local date_str="$2"
    local city_name="${3:-深圳}"

    # Node 负责 body：输出 2 行 AQI 大数 + 两个小格子 + 健康建议
    local body
    body=$(node -e "
const data = JSON.parse(process.argv[1]);
const body = \`
  <rect x=\"50\" y=\"200\" width=\"980\" height=\"180\" fill=\"#ffffff0a\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
  <text x=\"540\" y=\"260\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"36\" fill=\"#ffffff99\" text-anchor=\"middle\">空气质量指数 (AQI)</text>
  <text x=\"540\" y=\"330\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"72\" font-weight=\"700\" fill=\"\${data.color}\" text-anchor=\"middle\">\${data.aqi}</text>
  <text x=\"540\" y=\"365\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"32\" fill=\"\${data.color}\" text-anchor=\"middle\">\${data.level}</text>

  <rect x=\"50\" y=\"410\" width=\"480\" height=\"100\" fill=\"#ffffff0a\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
  <text x=\"290\" y=\"445\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffff99\" text-anchor=\"middle\">PM2.5</text>
  <text x=\"290\" y=\"485\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"36\" font-weight=\"600\" fill=\"#ffffffdd\" text-anchor=\"middle\">\${data.pm25} μg/m³</text>

  <rect x=\"550\" y=\"410\" width=\"480\" height=\"100\" fill=\"#ffffff0a\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
  <text x=\"790\" y=\"445\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffff99\" text-anchor=\"middle\">PM10</text>
  <text x=\"790\" y=\"485\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"36\" font-weight=\"600\" fill=\"#ffffffdd\" text-anchor=\"middle\">\${data.pm10} μg/m³</text>

  <rect x=\"50\" y=\"530\" width=\"980\" height=\"120\" fill=\"#ffffff08\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
  <text x=\"85\" y=\"565\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffff99\">健康建议</text>
  <text x=\"85\" y=\"605\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"22\" fill=\"#ffffffcc\">\${data.advice}</text>\`;
console.log(body);
" "$items_json")

    # 外框：高度固定 750
    local h=750
    local bg1 bg2
    bg1=$(echo "$items_json" | jq -r '.bg1')
    bg2=$(echo "$items_json" | jq -r '.bg2')

    {
        svg_header "$h" "$bg1" "$bg2" "${city_name}空气质量" "${date_str}  实时监测"
        echo "$body"
        svg_footer "$h" "数据来源：World Air Quality Index"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE" 1080 750
}

main() {
    log_info "======================================"
    log_info "空气质量卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    # 0. 解析入参（$1=城市，缺省 = 深圳）
    local city="${1:-}"
    local city_name="${city:-深圳}"
    log_info "目标城市: ${city:-深圳（默认）}"

    # 1. 获取日期字符串
    local date_str
    date_str=$(get_date_str)
    log_info "生成日期: $date_str"

    # 2. 获取数据
    local data
    data=$(fetch_data "$city")
    log_info "数据获取成功"

    # 3. 解析数据
    local items_json
    items_json=$(parse_data "$data")
    log_info "数据解析完成"

    # 4. 生成卡片
    generate_card "$items_json" "$date_str" "$city_name"
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"

    # 输出路径给调用方
    echo "$OUTPUT_FILE"
}

main "$@"
