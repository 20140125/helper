#!/bin/bash
# ======================================
# AI 新闻 Top10
# ======================================
#
# 功能说明：
#   1. 抓取 Hacker News AI 相关热门新闻 Top10
#   2. 生成卡片（与 tencent_hot 等模板保持同款风格）
#
# 使用方式：
#   bash scripts/tools/ai_news_card_gen.sh
#
# 作者：智能提醒系统
# 更新：2026-04-27
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/ai_news_card.png"
SVG_FILE="/tmp/ai_news_card.svg"

# 1) 抓取数据（HN AI 新闻 Top15）
fetch_data() {
    local raw
    raw=$(fetch_hn_ai_news_top 15)
    if [ -z "$raw" ]; then
        log_error "Hacker News AI 新闻获取失败"
        return 1
    fi
    # 原始输出模式（data / json）：HN 抓取结果为 "score|title|url" 行文本
    emit_raw "$raw" text
    echo "$raw"
}

# 2) 解析数据 → JSON 数组
parse_data() {
    local raw="$1"
    local items_json
    items_json=$(echo "$raw" | node -e "
const fs = require('fs');
const lines = fs.readFileSync(0, 'utf8').split('\n').filter(Boolean);
const items = lines.slice(0, 15).map(l => {
    const [score, title] = l.split('|');
    return { title: (title || '').trim(), score: (score || '0').trim() };
});
console.log(JSON.stringify(items));
")

    if [ -z "$items_json" ] || [ "$items_json" = "[]" ]; then
        log_error "HN 数据解析失败"
        return 1
    fi
    echo "$items_json"
}

# 3) 生成卡片
generate_card() {
    local items_json="$1" date_str="$2"

    local rows_json
    rows_json=$(node -e "
const items = JSON.parse(process.argv[1]);
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : (s || ''); }
const out = items.map((item, i) => ({
    num: String(i + 1).padStart(2, '0'),
    title: trunc(item.title, 36),
    score: (item.score || '0') + ' pts',
}));
console.log(JSON.stringify(out));
" "$items_json")

    local count; count=$(echo "$rows_json" | jq 'length')
    local row_h=78 row_gap=14 start_y=195
    local h=$(( start_y + count * (row_h + row_gap) + 70 ))

    {
        svg_header "$h" "#1A1A2E" "#16213E" "AI 早报" "${date_str}  Top15"

        local i=0 y=$start_y
        while [ "$i" -lt "$count" ]; do
            local num title score
            num=$(echo "$rows_json"   | jq -r ".[$i].num")
            title=$(echo "$rows_json" | jq -r ".[$i].title")
            score=$(echo "$rows_json" | jq -r ".[$i].score")
            svg_list_row "$num" "$y" "$title" "$score" "#FF6B6B"
            y=$((y + row_h + row_gap))
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：Hacker News"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "AI 新闻 Top15 卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    # 1. 日期
    local date_str
    date_str=$(get_date_str)
    log_info "生成日期: $date_str"

    # 2. 抓取
    local raw
    raw=$(fetch_data) || exit 1
    log_info "数据获取成功"

    # 3. 解析
    local items_json
    items_json=$(parse_data "$raw") || exit 1
    log_info "数据解析完成"

    # 4. 生成
    generate_card "$items_json" "$date_str"
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"

    echo "$OUTPUT_FILE"
}

main "$@"
