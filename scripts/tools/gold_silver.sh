#!/bin/bash
# ======================================
# 黄金白银行情卡片
# ======================================
#
# 功能说明：
#   1. 获取纽约金/纽约银实时行情
#   2. 展示价格、涨跌额、涨跌幅及高低价
#   3. 生成黄金白银行情卡片
#
# 使用方式：
#   bash scripts/tools/scripts/gold_silver.sh
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

OUTPUT_FILE="${CARD_OUTPUT_DIR}/gold_silver_card.png"
SVG_FILE="/tmp/gold_silver_card.svg"

fetch_data() {
    # 走共享取数：一次请求拉全市场代码，分钟级缓存复用（见 card_utils/quote.sh）
    local result
    result=$(fetch_gtimg_quotes hf_GC hf_SI)
    if [ -z "$result" ]; then
        log_error "黄金白银数据获取失败"
        return 1
    fi
    # 原始输出模式（data / json）：腾讯返回为 GBK 文本，按 text 原样吐出
    emit_raw "$result" text
    echo "$result"
}

parse_metal() {
    local raw="$1"
    local symbol="$2"
    local line
    line=$(echo "$raw" | grep "$symbol" | sed 's/.*="\(.*\)";/\1/')
    
    local price
    price=$(echo "$line" | cut -d',' -f1)
    local pct
    pct=$(echo "$line" | cut -d',' -f2)
    local high
    high=$(echo "$line" | cut -d',' -f5)
    local low
    low=$(echo "$line" | cut -d',' -f6)
    local yesterday
    yesterday=$(echo "$line" | cut -d',' -f8)
    local open
    open=$(echo "$line" | cut -d',' -f9)
    local name
    name=$(echo "$line" | cut -d',' -f14)
    
    local change
    change=$(echo "scale=2; $price - $yesterday" | bc 2>/dev/null)
    
    echo "${name}|${price}|${change}|${pct}|${high}|${low}|${yesterday}|${open}"
}

generate_card() {
    local gold="$1"
    local silver="$2"
    local date_str="$3"

    local gold_change first_char bg1 bg2
    gold_change=$(echo "$gold" | cut -d'|' -f3)
    first_char=$(echo "$gold_change" | head -c1)
    if [ "$first_char" = "-" ]; then
        bg1="#1B3A2A"; bg2="#0D2818"
    else
        bg1="#3A2E0A"; bg2="#281E05"
    fi

    local body card_h
    body=$(node -e "
const metals = process.argv.slice(1, 3).map(s => {
  const [name, price, change, pct, high, low, yesterday, open] = s.split('|');
  return { name, price, change: parseFloat(change), pct: parseFloat(pct), high, low, yesterday, open };
});

const units = ['美元/盎司', '美元/盎司'];
let y = 195;
let rows = '';
metals.forEach((m, i) => {
  const isUp = m.change >= 0;
  const arrow = isUp ? '+' : '';
  const color = isUp ? '#FF5252' : '#4CAF50';
  const pctStr = arrow + m.pct.toFixed(2) + '%';
  const changeStr = arrow + m.change.toFixed(2);
  rows += \`
  <rect x=\"50\" y=\"\${y}\" width=\"980\" height=\"170\" fill=\"#ffffff08\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
  <text x=\"85\" y=\"\${y+35}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"26\" font-weight=\"600\" fill=\"#ffffffcc\">\${m.name}</text>
  <text x=\"970\" y=\"\${y+35}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"20\" fill=\"#ffffff60\" text-anchor=\"end\">\${units[i]}</text>
  <text x=\"85\" y=\"\${y+95}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"56\" font-weight=\"700\" fill=\"\${color}\">\${m.price}</text>
  <text x=\"540\" y=\"\${y+60}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffff80\">涨跌额</text>
  <text x=\"540\" y=\"\${y+95}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"32\" font-weight=\"600\" fill=\"\${color}\">\${changeStr}</text>
  <text x=\"750\" y=\"\${y+60}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffff80\">涨跌幅</text>
  <text x=\"750\" y=\"\${y+95}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"32\" font-weight=\"600\" fill=\"\${color}\">\${pctStr}</text>
  <text x=\"85\" y=\"\${y+140}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"20\" fill=\"#ffffff60\">最高 \${m.high}  |  最低 \${m.low}  |  昨收 \${m.yesterday}  |  今开 \${m.open}</text>\`;
  y += 190;
});

const h = y + 70;
console.log(rows);
console.log('__H__' + h);
" "$gold" "$silver")

    card_h=$(echo "$body" | awk -F'__H__' '/^__H__/{print $2}')
    body=$(echo "$body" | grep -v '^__H__')

    {
        svg_header "$card_h" "$bg1" "$bg2" "黄金白银" "${date_str}  实时行情"
        echo "$body"
        svg_footer "$card_h" "数据来源：腾讯财经 (COMEX)"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "黄金白银卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"
    
    local date_str
    date_str=$(get_date_str)
    
    local raw_data
    raw_data=$(fetch_data) || exit 1
    
    local gold
    gold=$(parse_metal "$raw_data" "hf_GC")
    local silver
    silver=$(parse_metal "$raw_data" "hf_SI")
    
    generate_card "$gold" "$silver" "$date_str"
    
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
