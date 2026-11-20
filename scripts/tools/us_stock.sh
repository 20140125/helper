#!/bin/bash
# ======================================
# 美股大盘 - 纳斯达克/道琼斯/标普500
# ======================================
#
# 功能说明：
#   1. 抓取美股三大指数实时数据
#   2. 生成美股大盘卡片
#
# 使用方式：
#   bash scripts/tools/scripts/us_stock.sh
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

OUTPUT_FILE="${CARD_OUTPUT_DIR}/us_stock_card.png"
SVG_FILE="/tmp/us_stock_card.svg"

# 获取美股数据
fetch_data() {
    # 走共享取数：一次请求拉全市场代码，分钟级缓存复用（见 card_utils/quote.sh）
    local result
    result=$(fetch_gtimg_quotes usNDX usDJI usINX)
    if [ -z "$result" ]; then
        log_error "美股数据获取失败"
        return 1
    fi
    # 原始输出模式（data / json）：腾讯返回为 GBK 文本，按 text 原样吐出
    emit_raw "$result" text
    echo "$result"
}

# 解析单个指数
parse_index() {
    local raw="$1"
    local code="$2"
    local line
    line=$(echo "$raw" | grep "$code")
    
    local name price yesterday change change_pct high low volume_raw vol_yi
    name=$(echo "$line" | cut -d'~' -f2)
    price=$(echo "$line" | cut -d'~' -f4)
    yesterday=$(echo "$line" | cut -d'~' -f5)
    change=$(echo "$line" | cut -d'~' -f32)
    change_pct=$(echo "$line" | cut -d'~' -f33)
    high=$(echo "$line" | cut -d'~' -f34)
    low=$(echo "$line" | cut -d'~' -f35)
    volume_raw=$(echo "$line" | cut -d'~' -f38)
    vol_yi=$(echo "scale=2; $volume_raw / 100000000" | bc 2>/dev/null)
    
    echo "${name}|${price}|${change}|${change_pct}|${high}|${low}|${vol_yi}"
}

# 解析美股数据
parse_data() {
    local raw="$1"
    local ndx dji inx
    
    ndx=$(parse_index "$raw" "usNDX")
    dji=$(parse_index "$raw" "usDJI")
    inx=$(parse_index "$raw" "usINX")
    
    echo "${ndx}::${dji}::${inx}"
}

# 生成卡片 SVG
generate_card() {
    local data="$1"
    local date_str="$2"

    # 判断涨跌背景色
    local inx_change bg1 bg2 first_char
    inx_change=$(echo "$data" | cut -d'|' -f11)
    first_char=$(echo "$inx_change" | head -c1)
    if [ "$first_char" = "-" ]; then
        bg1="#1B3A2A"; bg2="#0D2818"
    else
        bg1="#1A1A3A"; bg2="#0D0D28"
    fi

    local ndx dji inx
    ndx=$(echo "$data" | awk -F'::' '{print $1}')
    dji=$(echo "$data" | awk -F'::' '{print $2}')
    inx=$(echo "$data" | awk -F'::' '{print $3}')

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
  <text x=\"85\" y=\"\${y+125}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"20\" fill=\"#ffffff60\">最高 \${idx.high}  |  最低 \${idx.low}  |  成交额 \${idx.vol}亿USD</text>\`;
    y += 158;
});

const h = y + 70;
console.log(rows);
console.log('__H__' + h);
" "$ndx" "$dji" "$inx")

    card_h=$(echo "$body" | awk -F'__H__' '/^__H__/{print $2}')
    body=$(echo "$body" | grep -v '^__H__')

    {
        svg_header "$card_h" "$bg1" "$bg2" "美股大盘" "${date_str}  收盘"
        echo "$body"
        svg_footer "$card_h" "数据来源：腾讯财经"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "美股大盘卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    # 1. 获取日期字符串
    local date_str
    date_str=$(get_date_str)
    log_info "生成日期: $date_str"

    # 2. 获取数据
    local raw
    raw=$(fetch_data) || exit 1
    log_info "数据获取成功"

    # 3. 解析数据
    local data
    data=$(parse_data "$raw")
    log_info "数据解析完成"

    # 4. 生成卡片
    generate_card "$data" "$date_str"
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"

    # 输出路径给调用方
    echo "$OUTPUT_FILE"
}

main "$@"
