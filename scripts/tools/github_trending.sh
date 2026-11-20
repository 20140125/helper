#!/bin/bash
# ======================================
# GitHub Trending Top10
# ======================================
#
# 功能说明：
#   1. 获取GitHub近7天最热门的开源项目
#   2. 展示项目名称、星标数和编程语言
#   3. 生成GitHub Trending卡片
#
# 使用方式：
#   bash scripts/tools/scripts/github_trending.sh
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

OUTPUT_FILE="${CARD_OUTPUT_DIR}/github_trending_card.png"
SVG_FILE="/tmp/github_trending_card.svg"

fetch_data() {
    local week_ago
    week_ago=$(date -d '-7 day' +%Y-%m-%d)
    local url="https://api.github.com/search/repositories?q=created:>${week_ago}&sort=stars&order=desc&per_page=15"
    
    # 日内缓存：GitHub 搜索按天即可，顺带规避未鉴权搜索接口的限流
    local result
    result=$(fetch_url_cached githubtrending "" "$url")
    if [ -z "$result" ]; then
        log_error "GitHub数据获取失败"
        return 1
    fi
    
    local count
    count=$(echo "$result" | jq '.items | length' 2>/dev/null)
    if [ "$count" = "0" ] || [ -z "$count" ]; then
        log_error "GitHub返回数据为空"
        return 1
    fi
    
    local items_json
    items_json=$(echo "$result" | jq '[.items[:15][] | {repo: .full_name, stars: .stargazers_count, lang: (.language // "N/A")}]')
    
    echo "$items_json"
}

generate_card() {
    local items_json="$1"
    local date_str="$2"

    local rows_json
    rows_json=$(node -e "
const items = JSON.parse(process.argv[1]);
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : (s || ''); }
const out = items.map((item, i) => ({
    num: String(i + 1).padStart(2, '0'),
    repo: trunc(item.repo, 26),
    stars: item.stars >= 1000 ? (item.stars / 1000).toFixed(1) + 'k' : String(item.stars),
    lang: trunc(item.lang, 10),
}));
console.log(JSON.stringify(out));
" "$items_json")

    local count; count=$(echo "$rows_json" | jq 'length')
    local row_h=78 row_gap=14 start_y=195
    local h=$(( start_y + count * (row_h + row_gap) + 70 ))

    {
        svg_header "$h" "#0D1117" "#161B22" "GitHub Trending Top15" "${date_str}  近7天最热"

        local i=0 y=$start_y
        while [ "$i" -lt "$count" ]; do
            local num repo stars lang text_y
            num=$(echo "$rows_json"   | jq -r ".[$i].num")
            repo=$(echo "$rows_json"  | jq -r ".[$i].repo")
            stars=$(echo "$rows_json" | jq -r ".[$i].stars")
            lang=$(echo "$rows_json"  | jq -r ".[$i].lang")
            # stars 作为右侧主文字（金色）
            svg_list_row "$num" "$y" "$repo" "$stars" "#FFD700"
            # 额外追加第二个右侧文字（语言，绿色），位于 stars 左侧
            text_y=$((y + 48))
            echo "  <text x=\"750\" y=\"${text_y}\" font-family=\"${CARD_FONT}\" font-size=\"20\" fill=\"#4CAF50\" text-anchor=\"end\">${lang}</text>"
            y=$((y + row_h + row_gap))
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：GitHub"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "GitHub Trending卡片生成启动"
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
