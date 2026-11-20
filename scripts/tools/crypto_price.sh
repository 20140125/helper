#!/bin/bash
# ======================================
# 加密货币行情卡片
# ======================================
#
# 功能说明：
#   1. 获取主流币种（BTC/ETH/SOL/XRP/BNB/DOGE）的人民币与美元价格
#   2. 展示 24 小时涨跌幅，涨红跌绿
#   3. 支持与其它卡片脚本一致的输出模式（card / data / json）
#
# 数据源：CoinGecko 公开接口（免费、无需 API Key）
# 说明：价格随时变动，归档按小时分槽位，避免展示一小时前的旧价
#
# 使用方式：
#   bash scripts/tools/crypto_price.sh
#
# 作者：智能提醒系统
# 更新：2026-10-12
# ======================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/crypto_price_card.png"
SVG_FILE="/tmp/crypto_price_card.svg"

fetch_data() {
    local ids="bitcoin,ethereum,solana,ripple,binancecoin,dogecoin"
    local url="https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=cny,usd&include_24hr_change=true"
    local cache_file
    cache_file=$(api_cache_path cryptoprice)

    local result
    result=$(API_ARCHIVE_SLOT=hour cached_curl "${cache_file}" -s --max-time 15 "$url" \
        -H "Accept: application/json" 2>/dev/null)

    if [ -z "$result" ]; then
        log_error "加密货币行情获取失败"
        return 1
    fi
    echo "$result"
}

parse_data() {
    local data="$1"
    echo "$data" | python3 -c '
import json, sys

NAMES = [
    ("bitcoin", "比特币 BTC"),
    ("ethereum", "以太坊 ETH"),
    ("solana", "索拉纳 SOL"),
    ("ripple", "瑞波币 XRP"),
    ("binancecoin", "币安币 BNB"),
    ("dogecoin", "狗狗币 DOGE"),
]

try:
    doc = json.load(sys.stdin)
except Exception:
    print("[]")
    sys.exit(0)

out = []
for key, label in NAMES:
    v = doc.get(key)
    if not isinstance(v, dict):
        continue
    out.append({
        "name": label,
        "cny": v.get("cny"),
        "usd": v.get("usd"),
        "change": v.get("cny_24h_change"),
    })
print(json.dumps(out, ensure_ascii=False))
'
}

generate_card() {
    local items_json="$1"
    local date_str="$2"

    local rows_json
    rows_json=$(node -e "
const items = JSON.parse(process.argv[1]);
const fmt = (v) => {
  if (v == null) return '-';
  return v >= 1000
    ? Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })
    : Number(v).toFixed(2);
};
const out = items.map((it) => ({
  name: it.name,
  price: '¥' + fmt(it.cny) + '  /  $' + fmt(it.usd),
  change: it.change == null ? '' : (it.change >= 0 ? '+' : '') + Number(it.change).toFixed(2) + '%',
  up: it.change != null && it.change >= 0,
}));
console.log(JSON.stringify(out));
" "$items_json")

    local count
    count=$(echo "$rows_json" | jq 'length')
    if [ "$count" = "0" ]; then
        log_error "加密货币行情为空"
        return 1
    fi

    local row_h=72
    local row_gap=10
    local start_y=195
    local h=$(( start_y + count * (row_h + row_gap) + 70 ))

    {
        svg_header "$h" "#F7931A" "#3A2200" "加密货币行情" "${date_str}  24小时涨跌幅"

        local i=0 y=$start_y
        while [ "$i" -lt "$count" ]; do
            local name price change up color
            name=$(echo "$rows_json"   | jq -r ".[$i].name")
            price=$(echo "$rows_json"  | jq -r ".[$i].price")
            change=$(echo "$rows_json" | jq -r ".[$i].change")
            up=$(echo "$rows_json"     | jq -r ".[$i].up")
            if [ "$up" = "true" ]; then color="#FF5252"; else color="#4CAF50"; fi

            svg_list_row "$name" "$y" "$price" "$change" "$color" "#ffffff08" "#ffffffdd" "$row_h" "#ffffff12"
            y=$((y + row_h + row_gap))
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：CoinGecko（免费公开接口）"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "加密货币行情卡片生成启动"
    log_info "当前时间: $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local date_str
    date_str=$(get_date_str)

    local data
    data=$(fetch_data) || exit 1
    log_info "数据获取成功"

    local items_json
    items_json=$(parse_data "$data")
    log_info "数据解析完成"

    generate_card "$items_json" "$date_str"
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"

    echo "$OUTPUT_FILE"
}

main "$@"
