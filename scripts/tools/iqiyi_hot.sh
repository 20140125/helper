#!/bin/bash
# ======================================
# 爱奇艺 热搜榜 Top15
# ======================================
#
# 数据源：爱奇艺推荐 API (mode=11)
#
# 使用方式：
#   bash scripts/tools/iqiyi_hot.sh
#
# 作者：智能提醒系统
# 更新：2026-04-30
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/iqiyi_hot_card.png"
SVG_FILE="/tmp/iqiyi_hot_card.svg"

fetch_data() {
    local url="https://pcw-api.iqiyi.com/search/recommend/list?channel_id=0&data_type=1&mode=11&page_id=1&ret_num=15"
    # 日内缓存：同一天只打一次远端接口
    local cache_file
    cache_file=$(api_cache_path iqiyihot)
    local result
    result=$(API_ARCHIVE_SLOT=hour cached_curl "${cache_file}" -s --max-time 10 "$url" \
        -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" 2>/dev/null)

    if [ -z "$result" ]; then
        log_error "爱奇艺热搜数据获取失败"
        return 1
    fi

    local count
    count=$(echo "$result" | jq '.data.list | length' 2>/dev/null)
    if [ "$count" = "0" ] || [ -z "$count" ]; then
        log_error "爱奇艺热搜数据为空"
        return 1
    fi

    echo "$result"
}

parse_data() {
    local data="$1"
    echo "$data" | jq -c '[.data.list[:15] | .[] | {title: .title, desc: "热搜"}]'
}

generate_card() {
    local items_json="$1"
    local date_str="$2"

    local rows_json
    rows_json=$(node -e "
const items = JSON.parse(process.argv[1]);
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : (s || ''); }
const out = items.slice(0, 15).map((item, i) => ({
    num: String(i + 1).padStart(2, '0'),
    title: trunc(item.title, 28),
    top3: i < 3,
}));
console.log(JSON.stringify(out));
" "$items_json")

    local count; count=$(echo "$rows_json" | jq 'length')
    local row_h=72 row_gap=10 start_y=195
    local h=$(( start_y + count * (row_h + row_gap) + 70 ))

    {
        svg_header "$h" "#1B5E20" "#0D2E10" "爱奇艺 热搜榜" "${date_str}  实时热搜 Top15"

        local i=0 y=$start_y
        while [ "$i" -lt "$count" ]; do
            local num title top3 title_color bg
            num=$(echo "$rows_json"   | jq -r ".[$i].num")
            title=$(echo "$rows_json" | jq -r ".[$i].title")
            top3=$(echo "$rows_json"  | jq -r ".[$i].top3")
            if [ "$top3" = "true" ]; then
                title_color="#ffffff"; bg="highlight"
            else
                title_color="#ffffff99"; bg="#ffffff08"
            fi
            svg_list_row "$num" "$y" "$title" "" "#ffffff99" "$bg" "$title_color" "$row_h" "#ffffff12"
            y=$((y + row_h + row_gap))
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：爱奇艺"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "爱奇艺 热搜榜 Top15 卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local date_str
    date_str=$(get_date_str)
    log_info "生成日期: $date_str"

    local data
    data=$(fetch_data) || exit 1
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
