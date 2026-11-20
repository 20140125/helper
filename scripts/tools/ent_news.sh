#!/bin/bash
# ======================================
# 娱乐新闻 Top10
# ======================================
#
# 功能说明：
#   1. 抓取今日头条娱乐热点 Top10
#   2. 生成娱乐新闻卡片
#
# 使用方式：
#   bash scripts/tools/scripts/ent_news.sh
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

OUTPUT_FILE="${CARD_OUTPUT_DIR}/ent_news_card.png"
SVG_FILE="/tmp/ent_news_card.svg"

# 获取今日头条热榜数据
fetch_data() {
    local url="https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc"
    # 日内缓存：与 intl_news.sh 共用 toutiaohot 归档，一天只抓一次
    local result
    result=$(API_ARCHIVE_SLOT=hour fetch_url_cached toutiaohot "" "$url" 20)
    if [ -z "$result" ]; then
        log_error "数据获取失败: $url"
        return 1
    fi
    echo "$result"
}

# 解析娱乐新闻数据
#   策略：娱乐分类条目优先，不足 15 条时从剩余条目按原顺序（即热度顺序）补齐，
#         保证卡片稳定输出 Top15。
parse_data() {
    local data="$1"
    local items_json

    items_json=$(echo "$data" | jq '
        def is_ent:
            (.InterestCategory // [] | any(. == "entertainment" or . == "star" or . == "movie" or . == "music" or . == "variety" or . == "tv_show"))
            or (.Title | test("明星|演员|导演|电影|综艺|歌手|选秀|恋情|离婚|结婚|出轨|官宣|热搜|粉丝|偶像|影帝|影后|歌曲|MV|演唱会|红毯|颁奖"));
        ([.data[] | select(is_ent)] + [.data[] | select(is_ent | not)])
        | unique_by(.Title)
        | .[:15]
        | map({title: .Title, hot: (.HotValue // "0")})
    ')

    local count
    count=$(echo "$items_json" | jq 'length')
    if [ "$count" = "0" ] || [ -z "$count" ]; then
        log_warning "未找到娱乐分类数据，使用通用Top15"
        items_json=$(echo "$data" | jq '[.data[:15][] | {title: .Title, hot: (.HotValue // "0")}]')
    fi

    echo "$items_json"
}

# 生成卡片 SVG
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
        svg_header "$h" "#2E1A3E" "#1A0E2E" "娱乐新闻 Top15" "${date_str}  头条热榜"

        local i=0 y=$start_y
        while [ "$i" -lt "$count" ]; do
            local num title hot
            num=$(echo "$rows_json"   | jq -r ".[$i].num")
            title=$(echo "$rows_json" | jq -r ".[$i].title")
            hot=$(echo "$rows_json"   | jq -r ".[$i].hot")
            svg_list_row "$num" "$y" "$title" "$hot" "#FF6B99"
            y=$((y + row_h + row_gap))
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：今日头条"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "娱乐新闻 Top15 卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    # 1. 获取日期字符串
    local date_str
    date_str=$(get_date_str)
    log_info "生成日期: $date_str"

    # 2. 获取数据
    local data
    data=$(fetch_data) || exit 1
    log_info "数据获取成功"

    # 3. 解析数据
    local items_json
    items_json=$(parse_data "$data")
    log_info "数据解析完成"

    # 4. 生成卡片
    generate_card "$items_json" "$date_str"
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"

    # 输出路径给调用方
    echo "$OUTPUT_FILE"
}

main "$@"
