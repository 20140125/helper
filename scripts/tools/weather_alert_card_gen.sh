#!/bin/bash
# ======================================
# 异常天气预警卡片（支持指定城市）
# ======================================
#
# 功能说明：
#   1. 复用 card_utils.sh 的预警规则集合，对指定城市跑全部 check_alert_*
#   2. 渲染成卡片（风格与 tencent_hot 等保持一致）
#   3. 无预警时兑底显示"今日无异常"
#   4. 静默跳过规则（仅限 cron 定时任务）：CRON_MODE=1 + 无异常天气
#      → 不生成卡片、stdout 不输出路径，避免工作日刷屏。
#      前端点击 / reminder 关键字触发等手动场景不受影响，照常生成卡片。
#
# 入参：
#   $1  城市名，可选；留空 = 深圳。中文（上海/北京/深圳）/拼音/英文均可。
#
# 环境变量：
#   CRON_MODE=1    标记当前调用来自 cron 定时任务，启用"无异常就不生成"规则
#                  （仅需在 crontab 条目里设置，前端/命令行不设）
#
# 使用方式：
#   bash scripts/tools/weather_alert_card_gen.sh                 # 默认深圳
#   bash scripts/tools/weather_alert_card_gen.sh 上海           # 指定城市
#   CRON_MODE=1 bash scripts/tools/weather_alert_card_gen.sh    # cron 模式
#
# 作者：智能提醒系统
# 更新：2026-05-28
# ======================================
set -euo pipefail

# 保存 cron / 调用方传入的推送开关，防止下游 source weather_config.sh / card_utils.sh
# 时通过 set -a + source .env 把同名变量覆盖回 .env 中的默认值（false）。
# 加载完配置后再 export 回原值，确保 cron 链路传入的开关真正生效。
_CRON_PUSH_CARD_IMAGE_OVERRIDE="${PUSH_CARD_IMAGE-}"
_CRON_SKILL_CARD_SEND_OVERRIDE="${SKILL_CARD_SEND_ON_WECHAT-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

# 配置加载完成后，恢复调用方显式传入的推送开关（仅当调用方传过才覆盖）
# 注：card_utils.sh 已统一做了同样的保护，这里保留是为了兼容直接 source weather_config.sh 的路径。
# 用 if 而非 `[ -n x ] && export`：本脚本开了 set -e，后者条件为假时返回 1 会直接打断脚本
if [ -n "${_CRON_PUSH_CARD_IMAGE_OVERRIDE}" ]; then
  export PUSH_CARD_IMAGE="${_CRON_PUSH_CARD_IMAGE_OVERRIDE}"
fi
if [ -n "${_CRON_SKILL_CARD_SEND_OVERRIDE}" ]; then
  export SKILL_CARD_SEND_ON_WECHAT="${_CRON_SKILL_CARD_SEND_OVERRIDE}"
fi
unset _CRON_PUSH_CARD_IMAGE_OVERRIDE _CRON_SKILL_CARD_SEND_OVERRIDE

OUTPUT_FILE="${CARD_OUTPUT_DIR}/weather_alert_card.png"
SVG_FILE="/tmp/weather_alert_card.svg"

# 注：ensure_node_in_path 已下沉到 card_utils.sh，source 时自动探测 PATH；
# 本脚本仅保留调用渲染前的最后一道显式检查，用于给出可读的降级错误。

# 1) 抓取数据
fetch_data() {
    fetch_weather_alerts || true
}

# 2) 解析数据 → JSON 数组
# 纯 bash 实现（去掉 node 依赖）：按行切分 + 非空过滤 + 取前 10 条 + jq 组装 JSON 数组
parse_data() {
    local raw="$1"
    # 空输入直接返回空数组，避免后续 jq 吃空串报错
    if [ -z "$raw" ]; then
        echo "[]"
        return 0
    fi
    # 用 jq -R -s -c 读 stdin → 按行切分 → 去空行 → 截前 10 条 → 紧凑 JSON 数组
    printf '%s' "$raw" | jq -R -s -c 'split("\n") | map(select(length > 0)) | .[0:10]'
}

# 3) 生成卡片
generate_card() {
    local items_json="$1" date_str="$2"

    if ! ensure_node_in_path; then
        log_error "未找到 node 可执行文件，无法渲染天气预警卡片；请在 crontab PATH 中暴露 nvm 或 apt 安装 nodejs"
        return 1
    fi

    # Node 拆分 [tag] msg 结构 → JSON
    # 注：city_name 从全局环境变量取（main 中根据入参解析后赋值），用于"今日无异常"文案动态化
    local rows_json is_empty
    if [ "$items_json" = "[]" ]; then
        is_empty=1
        rows_json=$(jq -n --arg city "${CITY_NAME:-深圳}" \
          '[{num:"01", tag:"今日无异常", msg:("\($city)暂无异常天气预警，安心出行")}]')
    else
        is_empty=0
        rows_json=$(node -e "
const items = JSON.parse(process.argv[1]);
const out = items.map((a, i) => {
    const m = a.match(/^\[([^\]]+)\]\s*(.*)$/);
    const tag = m ? m[1] : '提醒';
    const msg = m ? m[2] : a;
    const msgTrunc = msg.length > 34 ? msg.slice(0, 34) + '...' : msg;
    return { num: String(i + 1).padStart(2, '0'), tag, msg: msgTrunc };
});
console.log(JSON.stringify(out));
" "$items_json")
    fi

    local count; count=$(echo "$rows_json" | jq 'length')
    local row_h=78 row_gap=14 start_y=195
    local h=$(( start_y + count * (row_h + row_gap) + 70 ))

    # 根据是否有预警切换配色
    local c1 c2 title
    if [ "$is_empty" = "1" ]; then
        c1="#2E7D32"; c2="#1B5E20"; title="${CITY_NAME:-深圳} · 天气预警（暂无）"
    else
        c1="#8B0000"; c2="#4A0000"; title="${CITY_NAME:-深圳} · 天气预警"
    fi

    {
        svg_header "$h" "$c1" "$c2" "$title" "${date_str}  请注意防范"

        local i=0 y=$start_y
        while [ "$i" -lt "$count" ]; do
            local num tag msg
            num=$(echo "$rows_json" | jq -r ".[$i].num")
            tag=$(echo "$rows_json" | jq -r ".[$i].tag")
            msg=$(echo "$rows_json" | jq -r ".[$i].msg")
            svg_list_row "$num" "$y" "$tag" "$msg" "#ffffffaa"
            y=$((y + row_h + row_gap))
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：wttr.in"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

# 输出 wttr 关键指标快照，便于在"无异常"时复盘当时的天气数值
# 入参：$1 = wttr.in 原始 JSON
log_weather_snapshot() {
    local w="$1"
    if [ -z "$w" ]; then
        log_warning "天气快照: 原始 JSON 为空（fetch_weather_shenzhen 返回空，可能 wttr.in 限流或网络异常）"
        return 0
    fi

    # JSON 合法性兜底：jq 解析失败时直接记一行 + 前 200 字节，避免后续 jq 报错刷屏
    if ! echo "$w" | jq empty >/dev/null 2>&1; then
        log_warning "天气快照: JSON 解析失败，原始内容前 200 字节: $(printf '%s' "$w" | head -c 200)"
        return 0
    fi

    local cur_temp today_max tomorrow_min uv humidity visibility desc_en
    cur_temp=$(echo "$w"     | jq -r '.current_condition[0].temp_C // "?"')
    today_max=$(echo "$w"    | jq -r '.weather[0].maxtempC // "?"')
    tomorrow_min=$(echo "$w" | jq -r '.weather[1].mintempC // "?"')
    uv=$(echo "$w"           | jq -r '.weather[0].uvIndex // "?"')
    humidity=$(echo "$w"     | jq -r '.current_condition[0].humidity // "?"')
    visibility=$(echo "$w"   | jq -r '.current_condition[0].visibility // "?"')
    desc_en=$(echo "$w"      | jq -r '.current_condition[0].weatherDesc[0].value // "?"')

    log_info "天气快照: 当前${cur_temp}°C / 今日最高${today_max}°C / 明日最低${tomorrow_min}°C | UV=${uv} | 湿度=${humidity}% | 能见度=${visibility}km | 天气=${desc_en}"

    # 今日 hourly 8 段（0/3/6/9/12/15/18/21 时）降雨概率 & 降雨量，一行紧凑输出
    local hourly_rain
    hourly_rain=$(echo "$w" | jq -r '.weather[0].hourly | map("\(.time|tonumber/100|floor):\(.chanceofrain)%/\(.precipMM)mm") | join(" ")')
    log_info "今日 hourly 降雨预报: ${hourly_rain}"
}

main() {
    log_info "======================================"
    log_info "天气预警卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "CRON_MODE=${CRON_MODE:-0} | PUSH_CARD_IMAGE=${PUSH_CARD_IMAGE:-0}"
    log_info "======================================"

    # 0. 解析入参（$1=城市，缺省 = 深圳）
    local city="${1:-}"
    # 卡片展示文案：用户传了用用户输入；否则统一为"深圳"（避免 wttr 的 areaName 把深圳解析成 Ma Tso Lung）
    export CITY_NAME="${city:-深圳}"
    log_info "目标城市: ${city:-深圳（默认）} | 卡片展示名: ${CITY_NAME}"

    # 1. 日期
    local date_str
    date_str=$(get_date_str)
    log_info "生成日期: $date_str"

    # 2. 抓取（这里同时落 wttr 关键指标快照，便于排查"无异常"实际是规则未命中还是数据为空）
    local raw weather_json
    weather_json=$(fetch_weather_for_city "$city" || true)
    if [ -z "$weather_json" ]; then
        log_warning "wttr.in 抓取失败或返回空（city=${city:-Shenzhen}, curl 超时=${CARD_CURL_TIMEOUT:-10}s），本轮无法判断预警"
    else
        log_info "wttr.in 抓取成功（${#weather_json} 字节）"
        log_weather_snapshot "$weather_json"
    fi

    # 直接复用已抓到的 weather_json 跑预警规则，避免重复请求 wttr 浪费配额
    if [ -n "$weather_json" ]; then
        raw=$({
            check_alert_high_temp     "$weather_json"
            check_alert_cold_wave     "$weather_json"
            check_alert_wind          "$weather_json"
            check_alert_rainstorm     "$weather_json"
            check_alert_thunder       "$weather_json"
            check_alert_fog           "$weather_json"
            check_alert_haze          "$weather_json"
            check_alert_imminent_rain "$weather_json"
            check_alert_drought       "$weather_json"
            check_alert_uv            "$weather_json"
        } | grep -v '^$' || true)
    else
        raw=""
    fi
    local rule_count
    rule_count=$(printf '%s' "$raw" | grep -c '^' || true)
    log_info "预警抓取完成（命中 ${rule_count} 条规则）"
    if [ "$rule_count" -gt 0 ]; then
        # 多行预警逐行打印，便于回看"哪条规则触发了"
        while IFS= read -r line; do
            [ -n "$line" ] && log_info "  ↳ $line"
        done <<< "$raw"
    fi

    # 3. 解析
    local items_json
    items_json=$(parse_data "$raw")
    log_info "预警解析完成（items_json 长度 ${#items_json}）"

    # 3.5 cron 定时任务且无异常 → 不生成、不推送（前端点击、命令行手动执行不受影响）
    # crontab 条目自己已用 is_cn_workday.sh 前置守卫，所以这里不必再判断工作日
    if [ "${CRON_MODE:-0}" = "1" ] && [ "$items_json" = "[]" ]; then
        log_info "🟢 [CRON_MODE] 无异常天气预警，跳过卡片生成与推送"
        log_info "======================================"
        exit 0
    fi

    # 4. 生成
    generate_card "$items_json" "$date_str"
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"

    echo "$OUTPUT_FILE"
}

main "$@"
