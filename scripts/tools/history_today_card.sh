#!/bin/bash
# ======================================
# 历史上的今天 卡片
# ======================================
#
# 功能说明：
#   1. 抓取维基百科「历史上的今天」事件（指定月日，默认今天）
#   2. 展示年份 + 事件摘要（去 HTML 标签），生成列表卡片
#   3. 支持与其它卡片脚本一致的输出模式（card / data / json）
#
# 说明：
#   与 scripts/history_today.sh 共用同一份归档缓存
#   （.cache/api_responses/historytoday_<MMDD>_<YYYY-MM>.json），
#   同一天不会重复请求维基百科。data / json 模式输出接口原始返回。
#
# 使用方式：
#   bash scripts/tools/history_today_card.sh            # 今天
#   bash scripts/tools/history_today_card.sh 10 1       # 10月1日
#
# 作者：智能提醒系统
# 更新：2026-10-10
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/history_today_card.png"
SVG_FILE="/tmp/history_today_card.svg"

fetch_data() {
    local month="${1:-$(TZ=Asia/Shanghai date '+%-m')}"
    local day="${2:-$(TZ=Asia/Shanghai date '+%-d')}"
    local mm dd
    mm=$(printf "%02d" "$month")
    dd=$(printf "%02d" "$day")

    local url="https://zh.wikipedia.org/api/rest_v1/feed/onthisday/events/${mm}/${dd}"
    # 与 history_today.sh 保持同一 cache key，命中归档时不发请求
    # 单日文件 historytoday-YYYY-MM-DD.json，文件名即日期，一眼可读
    local date_key
    date_key="$(TZ=Asia/Shanghai date '+%Y')-${mm}-${dd}"
    local cache_file
    cache_file=$(api_cache_daily_path historytoday "${date_key}")

    local result
    result=$(cached_curl "${cache_file}" -s --max-time 15 "$url" \
        -H "User-Agent: MorningReminder/1.0" 2>/dev/null)

    if [ -z "$result" ]; then
        log_error "历史上的今天数据获取失败"
        return 1
    fi
    echo "$result"
}

parse_data() {
    local data="$1"
    echo "$data" | python3 -c '
import json, re, sys
try:
    doc = json.load(sys.stdin)
except Exception:
    print("[]")
    sys.exit(0)
events = doc.get("events", []) if isinstance(doc, dict) else []
out = []
for ev in events:
    year = str(ev.get("year", "")).strip()
    text = re.sub(r"<[^>]+>", "", str(ev.get("text", "")).strip())
    if not year or not text:
        continue
    out.append({"year": year, "text": text})
    if len(out) >= 10:
        break
print(json.dumps(out, ensure_ascii=False))
'
}

generate_card() {
    local items_json="$1"
    local date_str="$2"

    local rows_json
    rows_json=$(node -e "
const items = JSON.parse(process.argv[1]);
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : (s || ''); }
const out = items.map((it) => ({ year: it.year, title: trunc(it.text, 30) }));
console.log(JSON.stringify(out));
" "$items_json")

    local count
    count=$(echo "$rows_json" | jq 'length')
    if [ "$count" = "0" ]; then
        log_error "历史上的今天没有可展示的事件"
        return 1
    fi

    local row_h=72
    local row_gap=10
    local start_y=195
    local h=$(( start_y + count * (row_h + row_gap) + 70 ))

    {
        svg_header "$h" "#37474F" "#101820" "历史上的今天" "${date_str}  维基百科"

        local i=0 y=$start_y
        while [ "$i" -lt "$count" ]; do
            local year title
            year=$(echo "$rows_json"  | jq -r ".[$i].year")
            title=$(echo "$rows_json" | jq -r ".[$i].title")
            svg_list_row "$year" "$y" "$title" "" "#FFB300" "#ffffff08" "#ffffffdd" "$row_h" "#ffffff12"
            y=$((y + row_h + row_gap))
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：维基百科"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "历史上的今天 卡片生成启动"
    log_info "当前时间: $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local date_str
    date_str=$(get_date_str)

    local data
    data=$(fetch_data "${1:-}" "${2:-}") || exit 1
    log_info "数据获取成功"

    local items_json
    items_json=$(parse_data "$data") || exit 1
    log_info "数据解析完成"

    generate_card "$items_json" "$date_str"
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"

    echo "$OUTPUT_FILE"
}

main "$@"
