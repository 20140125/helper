#!/bin/bash
# ======================================
# A股大盘行情卡片
# ======================================
#
# 功能说明：
#   1. 获取大盘指数（上证指数/深证成指/创业板指）实时行情
#   2. 获取科技板块指数（科创50/科创100/科创综指）实时行情
#   3. 支持与其它卡片脚本一致的输出模式开关（card / data / json）：
#        card（默认）渲染 PNG 卡片，stdout 仅一行图片路径
#        data         输出腾讯行情接口原始返回（GBK 已转 UTF-8）
#        json         同上，非 JSON 响应会包成 {"raw": "..."}
#
# 说明：
#   盘中实时行情不做日内缓存归档（缓存会展示凌晨的过期价格），
#   故本脚本始终打真实接口，不做预取：15:00 由自定义规则定时拉取当日行情。
#   模式开关由 card_utils.sh 公共库统一解析，data / json 模式不产生任何图片文件。
#
# 使用方式：
#   bash scripts/tools/stock_market.sh [data|json]
#
# 示例：
#   bash scripts/tools/stock_market.sh            # 出卡片
#   bash scripts/tools/stock_market.sh data       # 出接口原始数据
#
# 作者：智能提醒系统
# 更新：2026-10-10
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
# card_utils.sh 内部会解析首个位置参数 data / json 作为输出模式（默认 card 出图）
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/stock_market_card.png"
SVG_FILE="/tmp/stock_card.svg"

# 指数清单：前 3 个为大盘指数，后 3 个为科技板块（科创50 / 科创100 / 科创综指）
INDEX_SYMBOLS=(sh000001 sz399001 sz399006 sh000688 sh000698 sh000680)

# 用法说明（写 stderr，避免污染 data / json 模式的 stdout）
usage() {
    log_error "用法: bash scripts/tools/stock_market.sh [data|json]"
    log_error "  默认（不带参数）渲染 PNG 卡片并输出图片路径"
}

fetch_data() {
    # 走共享取数：一次请求拉全市场代码（含港股/美股/黄金），分钟级缓存复用，
    # 这里只从返回的原始文本里取 A 股那几行（见 card_utils/quote.sh）
    local result
    result=$(fetch_gtimg_quotes sh000001 sz399001 sz399006 sh000688 sh000698 sh000680)
    if [ -z "$result" ]; then
        log_error "A股数据获取失败"
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
    vol_yi=$(echo "scale=2; $volume_raw / 10000" | bc 2>/dev/null)
    
    echo "${name}|${price}|${change}|${change_pct}|${high}|${low}|${vol_yi}"
}

generate_card() {
    local sh="$1"
    local sz="$2"
    local cy="$3"
    local kc50="$4"
    local kc100="$5"
    local kczz="$6"
    local date_str="$7"

    local sh_change first_char bg1 bg2
    sh_change=$(echo "$sh" | cut -d'|' -f3)
    first_char=$(echo "$sh_change" | head -c1)
    if [ "$first_char" = "-" ]; then
        bg1="#1B3A2A"; bg2="#0D2818"
    else
        bg1="#3A1B1B"; bg2="#280D0D"
    fi

    # Node 输出 body + 高度
    local body card_h
    body=$(node -e "
const parse = s => {
  const [name, price, change, pct, high, low, vol] = s.split('|');
  return { name, price, change: parseFloat(change), pct: parseFloat(pct), high, low, vol };
};
// 前三个为大盘指数，后三个为科技板块
const groups = [
  { label: '大盘指数', items: process.argv.slice(1, 4).map(parse) },
  { label: '科技板块', items: process.argv.slice(4, 7).map(parse) },
];

let y = 195;
let rows = '';
groups.forEach((g) => {
  rows += \`
  <text x=\"60\" y=\"\${y}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"22\" fill=\"#ffffff60\">\${g.label}</text>\`;
  y += 20;
  g.items.forEach((idx) => {
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
  <text x=\"85\" y=\"\${y+125}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"20\" fill=\"#ffffff60\">最高 \${idx.high}  |  最低 \${idx.low}  |  成交额 \${idx.vol}亿</text>\`;
    y += 158;
  });
  y += 12;
});

const h = y + 60;
console.log(rows);
console.log('__H__' + h);
" "$sh" "$sz" "$cy" "$kc50" "$kc100" "$kczz")

    card_h=$(echo "$body" | awk -F'__H__' '/^__H__/{print $2}')
    body=$(echo "$body" | grep -v '^__H__')

    {
        svg_header "$card_h" "$bg1" "$bg2" "A股大盘" "${date_str}  收盘"
        echo "$body"
        svg_footer "$card_h" "数据来源：腾讯财经"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    # 合法模式参数（data / json）已被 card_utils.sh 解析并 shift，此处仍有参数即为非法
    if [ $# -gt 0 ]; then
        usage
        exit 1
    fi

    log_info "======================================"
    log_info "A股大盘卡片生成启动"
    log_info "当前时间: $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"
    
    local date_str
    date_str=$(get_date_str)
    
    local raw_data
    raw_data=$(fetch_data) || exit 1
    
    local sh
    sh=$(parse_index "$raw_data" "sh000001")
    local sz
    sz=$(parse_index "$raw_data" "sz399001")
    local cy
    cy=$(parse_index "$raw_data" "sz399006")
    local kc50
    kc50=$(parse_index "$raw_data" "sh000688")
    local kc100
    kc100=$(parse_index "$raw_data" "sh000698")
    local kczz
    kczz=$(parse_index "$raw_data" "sh000680")
    
    generate_card "$sh" "$sz" "$cy" "$kc50" "$kc100" "$kczz" "$date_str"
    
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
