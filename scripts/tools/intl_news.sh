#!/bin/bash
# ======================================
# 国际新闻 Top10
# ======================================
#
# 功能说明：
#   1. 抓取今日头条国际热点新闻
#   2. 过滤国际相关内容
#   3. 生成国际新闻卡片
#
# 使用方式：
#   bash scripts/tools/scripts/intl_news.sh
#
# 作者：智能提醒系统
# 更新：2026-04-25
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/intl_news_card.png"
SVG_FILE="/tmp/intl_news_card.svg"

fetch_data() {
    local url="https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc"
    # 日内缓存：与 ent_news.sh 共用 toutiaohot 归档，一天只抓一次
    local result
    result=$(API_ARCHIVE_SLOT=hour fetch_url_cached toutiaohot "" "$url")
    if [ -z "$result" ]; then
        log_error "今日头条数据获取失败"
        return 1
    fi
    
    local items_json
    items_json=$(echo "$result" | jq '[
      [.data[] | select(
        (.InterestCategory // [] | any(. == "international" or . == "world" or . == "global" or . == "military"))
        or (.Title | test("美国|俄|乌克兰|日本|韩国|朝鲜|以色列|巴勒斯坦|欧洲|英国|法国|德国|印度|联合国|北约|外交|国际|全球|战争|制裁|峰会|总统|外长|大使|移民"))
      )][:15][] | {title: .Title, hot: (.HotValue // "0")}
    ]')
    
    local count
    count=$(echo "$items_json" | jq 'length')
    if [ "$count" = "0" ] || [ -z "$count" ]; then
        log_info "未找到国际新闻，使用通用热榜"
        items_json=$(echo "$result" | jq '[.data[:15][] | {title: .Title, hot: (.HotValue // "0")}]')
    fi
    
    echo "$items_json"
}

generate_card() {
    local items_json="$1"
    local date_str="$2"

    local rows_json
    rows_json=$(node -e "
const items = JSON.parse(process.argv[1]);
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : (s || ''); }
function fmtHot(v) { const n = parseInt(v, 10); if (isNaN(n) || n === 0) return ''; return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n); }
const out = items.map((item, i) => ({
    num: String(i + 1).padStart(2, '0'),
    title: trunc(item.title, 26),
    hot: fmtHot(item.hot) ? fmtHot(item.hot) + ' 热度' : '',
}));
console.log(JSON.stringify(out));
" "$items_json")

    local count; count=$(echo "$rows_json" | jq 'length')
    local row_h=78 row_gap=14 start_y=195
    local h=$(( start_y + count * (row_h + row_gap) + 70 ))

    {
        svg_header "$h" "#0A1628" "#162840" "国际新闻 Top15" "${date_str}  头条热榜"

        local i=0 y=$start_y
        while [ "$i" -lt "$count" ]; do
            local num title hot
            num=$(echo "$rows_json"   | jq -r ".[$i].num")
            title=$(echo "$rows_json" | jq -r ".[$i].title")
            hot=$(echo "$rows_json"   | jq -r ".[$i].hot")
            svg_list_row "$num" "$y" "$title" "$hot" "#5DADE2"
            y=$((y + row_h + row_gap))
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：今日头条"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "国际新闻卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"
    
    local date_str
    date_str=$(get_date_str)
    
    local items_json
    items_json=$(fetch_data) || exit 1
    
    generate_card "$items_json" "$date_str"
    
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
