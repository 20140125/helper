#!/bin/bash
# ======================================
# 港股大盘行情卡片
# ======================================
#
# 功能说明：
#   1. 获取恒生指数/国企指数/恒生科技指数实时行情
#   2. 展示价格、涨跌额、涨跌幅及高低价、成交额
#   3. 生成港股大盘卡片
#
# 使用方式：
#   bash scripts/tools/scripts/hk_stock.sh
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

OUTPUT_FILE="${CARD_OUTPUT_DIR}/hk_stock_card.png"
SVG_FILE="/tmp/hk_stock_card.svg"

fetch_data() {
    # 走共享取数：一次请求拉全市场代码，分钟级缓存复用（见 card_utils/quote.sh）
    local result
    result=$(fetch_gtimg_quotes hkHSI hkHSCEI hkHSTECH)
    if [ -z "$result" ]; then
        log_error "港股数据获取失败"
        return 1
    fi
    # 原始输出模式（data / json）：腾讯返回为 GBK 文本，按 text 原样吐出
    emit_raw "$result" text
    echo "$result"
}

parse_index() {
    local raw="$1"
    local symbol="$2"
    local line
    line=$(echo "$raw" | grep "$symbol")
    
    local name
    name=$(echo "$line" | cut -d'~' -f2)
    local price
    price=$(echo "$line" | cut -d'~' -f4)
    local yesterday
    yesterday=$(echo "$line" | cut -d'~' -f5)
    local change
    change=$(echo "$line" | cut -d'~' -f32)
    local change_pct
    change_pct=$(echo "$line" | cut -d'~' -f33)
    local high
    high=$(echo "$line" | cut -d'~' -f34)
    local low
    low=$(echo "$line" | cut -d'~' -f35)
    local volume_raw
    volume_raw=$(echo "$line" | cut -d'~' -f38)
    
    local vol_yi
    vol_yi=$(echo "scale=2; $volume_raw / 100000000" | bc 2>/dev/null)
    
    echo "${name}|${price}|${change}|${change_pct}|${high}|${low}|${vol_yi}"
}

generate_card() {
    local hsi="$1"
    local hscei="$2"
    local hstech="$3"
    local date_str="$4"

    local hsi_change first_char bg1 bg2
    hsi_change=$(echo "$hsi" | cut -d'|' -f3)
    first_char=$(echo "$hsi_change" | head -c1)
    if [ "$first_char" = "-" ]; then
        bg1="#1B3A2A"; bg2="#0D2818"
    else
        bg1="#3A1B1B"; bg2="#280D0D"
    fi

    local body card_h
    body=$(node -e "
const indices = process.argv.slice(1, 4).map(s => {
  const [name, price, change, pct, high, low, vol] = s.split('|');
  return { name, price, change: parseFloat(change), pct: parseFloat(pct), high, low, vol };
});

let y = 195;
let rows = '';
indices.forEach((idx) => {
  const isUp = idx.change >= 0;
  const arrow = isUp ? '+' : '';
  const color = isUp ? '#FF5252' : '#4CAF50';
  const pctStr = arrow + idx.pct.toFixed(2) + '%';
  const changeStr = arrow + idx.change.toFixed(2);
  rows += \`
  <rect x=\"50\" y=\"\${y}\" width=\"980\" height=\"140\" fill=\"#ffffff08\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
  <text x=\"85\" y=\"\${y+35}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"26\" font-weight=\"600\" fill=\"#ffffffcc\">\${idx.name}</text>
  <text x=\"85\" y=\"\${y+90}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"52\" font-weight=\"700\" fill=\"\${color}\">\${idx.price}</text>
  <text x=\"540\" y=\"\${y+55}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffff80\">涨跌额</text>
  <text x=\"540\" y=\"\${y+90}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"32\" font-weight=\"600\" fill=\"\${color}\">\${changeStr}</text>
  <text x=\"750\" y=\"\${y+55}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffff80\">涨跌幅</text>
  <text x=\"750\" y=\"\${y+90}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"32\" font-weight=\"600\" fill=\"\${color}\">\${pctStr}</text>
  <text x=\"85\" y=\"\${y+125}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"20\" fill=\"#ffffff60\">最高 \${idx.high}  |  最低 \${idx.low}  |  成交额 \${idx.vol}亿HKD</text>\`;
  y += 158;
});

const h = y + 70;
console.log(rows);
console.log('__H__' + h);
" "$hsi" "$hscei" "$hstech")

    card_h=$(echo "$body" | awk -F'__H__' '/^__H__/{print $2}')
    body=$(echo "$body" | grep -v '^__H__')

    {
        svg_header "$card_h" "$bg1" "$bg2" "港股大盘" "${date_str}  收盘"
        echo "$body"
        svg_footer "$card_h" "数据来源：腾讯财经"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "港股大盘卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"
    
    local date_str
    date_str=$(get_date_str)
    
    local raw_data
    raw_data=$(fetch_data) || exit 1
    
    local hsi
    hsi=$(parse_index "$raw_data" "hkHSI")
    local hscei
    hscei=$(parse_index "$raw_data" "hkHSCEI")
    local hstech
    hstech=$(parse_index "$raw_data" "hkHSTECH")
    
    generate_card "$hsi" "$hscei" "$hstech" "$date_str"
    
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
