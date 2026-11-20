#!/bin/bash
# ======================================
# 油价卡片（92/95/98 · 广东）
# ======================================
#
# 功能说明：
#   1. 抓取 qiyoujiage.com 广东地区 92/95/98 汽油价格
#   2. 与本地缓存对比，展示涨跌幅
#   3. 抓取最新调价信息
#   4. 生成卡片
#
# 使用方式：
#   bash scripts/tools/oil_price_card_gen.sh
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

OUTPUT_FILE="${CARD_OUTPUT_DIR}/oil_price_card.png"
SVG_FILE="/tmp/oil_price_card.svg"
CACHE_FILE="${SCRIPT_DIR}/.oil_price_cache_v2"

# 1) 抓取数据：当前油价 + 缓存价格 + 调价信息 → JSON
fetch_data() {
    local page
    page=$(curl -s "http://www.qiyoujiage.com/guangdong.shtml" 2>/dev/null)

    local p92 p95 p98
    p92=$(echo "$page" | grep -A1 '92#汽油' | grep -oP '[0-9]+\.[0-9]+' | head -1)
    p95=$(echo "$page" | grep -A1 '95#汽油' | grep -oP '[0-9]+\.[0-9]+' | head -1)
    p98=$(echo "$page" | grep -A1 '98#汽油' | grep -oP '[0-9]+\.[0-9]+' | head -1)

    if [ -z "$p92" ] || [ -z "$p95" ] || [ -z "$p98" ]; then
        log_error "油价数据抓取失败"
        return 1
    fi

    # 缓存读取
    local lp92="$p92" lp95="$p95" lp98="$p98"
    if [ -f "$CACHE_FILE" ]; then
        lp92=$(sed -n '1p' "$CACHE_FILE" 2>/dev/null); [ -z "$lp92" ] && lp92="$p92"
        lp95=$(sed -n '2p' "$CACHE_FILE" 2>/dev/null); [ -z "$lp95" ] && lp95="$p95"
        lp98=$(sed -n '3p' "$CACHE_FILE" 2>/dev/null); [ -z "$lp98" ] && lp98="$p98"
    fi
    # 更新缓存
    printf '%s\n%s\n%s\n' "$p92" "$p95" "$p98" > "$CACHE_FILE"

    # 调价信息
    local home adjust_date adjust_change adjust_info
    home=$(curl -s "http://www.qiyoujiage.com/" 2>/dev/null)
    adjust_date=$(echo "$home" | grep -oP '油价\d+月\d+日24时调整' | head -1 || true)
    adjust_change=$(echo "$home" | grep -oP '(下跌|上涨)[0-9.]+元/升[^<()）]*' | head -1 || true)
    if [ -n "$adjust_date" ]; then
        adjust_info="$adjust_date"
        [ -n "$adjust_change" ] && adjust_info="${adjust_info}，${adjust_change}"
    else
        adjust_info="暂无最新调价信息"
    fi

    local out
    out=$(jq -n \
      --arg p92 "$p92"   --arg p95 "$p95"   --arg p98 "$p98" \
      --arg lp92 "$lp92" --arg lp95 "$lp95" --arg lp98 "$lp98" \
      --arg adjust "$adjust_info" \
      '{p92:$p92,p95:$p95,p98:$p98,lp92:$lp92,lp95:$lp95,lp98:$lp98,adjust:$adjust}')
    # 原始输出模式（data / json）：本脚本 fetch 产出的就是结构化 JSON
    emit_raw "$out"
    echo "$out"
}

# 2) 解析数据（本脚本 fetch 已直接产出 JSON，此处原样回传以保持模板一致）
parse_data() {
    echo "$1"
}

# 3) 生成卡片
generate_card() {
    local items_json="$1" date_str="$2"

    # Node 负责 body + 返回总高度（body 含 3 张圆角卡片行）
    local body card_h
    body=$(node -e "
const d = JSON.parse(process.argv[1]);

function diffInfo(cur, last) {
  const diff = parseFloat(cur) - parseFloat(last);
  if (Math.abs(diff) < 0.005) return { arrow: '-', label: '持平', color: '#888888', abs: '0.00' };
  if (diff > 0) return { arrow: '↑', label: '涨', color: '#FF5252', abs: diff.toFixed(2) };
  return { arrow: '↓', label: '跌', color: '#4CAF50', abs: Math.abs(diff).toFixed(2) };
}

const oils = [
  { label:'92#', price:d.p92, last:d.lp92, accent:'#5DADE2' },
  { label:'95#', price:d.p95, last:d.lp95, accent:'#FFD700' },
  { label:'98#', price:d.p98, last:d.lp98, accent:'#FF6B35' },
];

let rows = '';
let y = 210;
oils.forEach(o => {
  const di = diffInfo(o.price, o.last);
  const cardH = 150;
  rows += \`
  <rect x=\"50\" y=\"\${y}\" width=\"980\" height=\"\${cardH}\" rx=\"16\" fill=\"#ffffff08\" stroke=\"#ffffff12\" stroke-width=\"1\"/>
  <rect x=\"75\" y=\"\${y+25}\" width=\"100\" height=\"50\" rx=\"25\" fill=\"\${o.accent}30\" stroke=\"\${o.accent}60\" stroke-width=\"1\"/>
  <text x=\"125\" y=\"\${y+58}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" font-weight=\"700\" fill=\"\${o.accent}\" text-anchor=\"middle\">\${o.label}</text>
  <text x=\"80\" y=\"\${y+115}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"16\" fill=\"#ffffff50\">广东地区</text>
  <text x=\"260\" y=\"\${y+75}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"64\" font-weight=\"700\" fill=\"#ffffffee\">\${o.price}</text>
  <text x=\"470\" y=\"\${y+75}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"22\" fill=\"#ffffff50\">元/升</text>
  <text x=\"260\" y=\"\${y+115}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"18\" fill=\"#ffffff40\">上次: \${o.last} 元/升</text>
  <rect x=\"840\" y=\"\${y+30}\" width=\"160\" height=\"46\" rx=\"8\" fill=\"\${di.color}20\"/>
  <text x=\"920\" y=\"\${y+60}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" font-weight=\"700\" fill=\"\${di.color}\" text-anchor=\"middle\">\${di.arrow} \${di.label} \${di.abs}</text>\`;
  y += cardH + 16;
});

const h = y + 110;
console.log(rows);
console.log('__H__' + h);
" "$items_json")

    card_h=$(echo "$body" | awk -F'__H__' '/^__H__/{print $2}')
    body=$(echo "$body" | grep -v '^__H__')

    # 注：原脚本 header 有第三行文字（调价信息），svg_header 只支持 2 行 → 在 svg_header 之后追加一条 text
    local adjust
    adjust=$(echo "$items_json" | jq -r '.adjust')

    {
        svg_header "$card_h" "#0F0F2E" "#0a0a1a" "油价查询" "${date_str}  广东地区 · 92/95/98"
        # 调价信息（原版位置 y=175，字号 20，灰色）
        echo "  <text x=\"70\" y=\"175\" font-family=\"${CARD_FONT}\" font-size=\"20\" fill=\"#ffffff50\">${adjust}</text>"
        echo "$body"
        svg_footer "$card_h" "数据来源：qiyoujiage.com"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "油价卡片生成启动（92/95/98）"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    # 1. 日期
    local date_str
    date_str=$(get_date_str)

    # 2. 抓取
    local raw
    raw=$(fetch_data) || exit 1
    log_info "数据获取成功"

    # 3. 解析
    local items_json
    items_json=$(parse_data "$raw")
    log_info "数据解析完成"

    # 4. 生成
    generate_card "$items_json" "$date_str"
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"

    echo "$OUTPUT_FILE"
}

main "$@"
