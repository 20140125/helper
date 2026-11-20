#!/bin/bash
# ======================================
# 今日汇率卡片（支持指定基准货币）
# ======================================
#
# 功能说明：
#   1. 获取实时汇率数据（基于指定基准货币，默认 USD）
#   2. 计算主要货币对人民币（或指定货币）的汇率
#   3. 生成今日汇率卡片
#
# 数据源：https://open.er-api.com/v6/latest/<BASE>（ExchangeRate-API v6 免费端点）
#   - 旧端点 api.exchangerate-api.com/v4 已返回 WARNING_UPGRADE_TO_V6，且只给 2 位有效小数
#   - v6 给 6 位小数，交叉汇率（EUR/GBP 兑 CNY）算出来更准
#
# 入参：
#   $1  基准货币代码（ISO 4217），可选；留空 = USD。
#       例如：USD/EUR/GBP/JPY/HKD/CNY 等。会自动转大写。
#
# 使用方式：
#   bash scripts/tools/exchange_rate.sh         # 默认 USD
#   bash scripts/tools/exchange_rate.sh EUR     # 以欧元为基准
#   bash scripts/tools/exchange_rate.sh cny     # 以人民币为基准（小写也兼容）
#
# 作者：智能提醒系统
# 更新：2026-10-14
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/exchange_rate_card.png"
SVG_FILE="/tmp/exchange_rate_card.svg"

# 入参: $1=基准货币代码（留空 = USD）
fetch_data() {
    local base="${1:-USD}"
    # 大写化兜底，让用户输入 usd/Usd/USD 都能命中
    base=$(echo "$base" | tr '[:lower:]' '[:upper:]')
    local url="https://open.er-api.com/v6/latest/${base}"
    # 日内缓存：汇率每日更新一次，按基准货币分槽位归档
    local result
    result=$(fetch_url_cached exchangerate "${base}" "$url")
    if [ -z "$result" ]; then
        log_error "汇率数据获取失败 (base=${base})"
        return 1
    fi

    # v6 契约校验：result 必须为 success 且 rates 为对象
    # 否则限流/错误页会被当正常数据缓存一整天，卡片刷出空汇率
    local api_result
    api_result=$(echo "$result" | jq -r '.result // empty')
    if [ "$api_result" != "success" ] || [ -z "$(echo "$result" | jq -r '.rates // empty')" ]; then
        log_error "汇率数据异常 (base=${base}, result=${api_result:-<空>})"
        return 1
    fi

    # 根据基准货币动态选择展示对：
    #   - 基准非 CNY → 展示 base→主流货币（CNY/HKD/JPY 等）+ 两个交叉对（EUR/GBP 兑 CNY）
    #   - 基准为 CNY → 展示 CNY→主流外币（USD/EUR/GBP/JPY/HKD）
    local items_json
    if [ "$base" = "CNY" ]; then
        items_json=$(echo "$result" | jq --arg base "$base" '{
            base: $base,
            rates: .rates,
            pairs: [
                {name: "CNY/USD", rate: .rates.USD},
                {name: "CNY/EUR", rate: .rates.EUR},
                {name: "CNY/GBP", rate: .rates.GBP},
                {name: "CNY/JPY", rate: .rates.JPY},
                {name: "CNY/HKD", rate: .rates.HKD}
            ]
        }')
    else
        items_json=$(echo "$result" | jq --arg base "$base" '{
            base: $base,
            rates: .rates,
            pairs: [
                {name: ($base + "/CNY"), rate: .rates.CNY},
                {name: ($base + "/HKD"), rate: .rates.HKD},
                {name: ($base + "/JPY"), rate: .rates.JPY},
                {name: "EUR/CNY", rate: (if .rates.EUR and .rates.EUR > 0 then (.rates.CNY / .rates.EUR) else null end)},
                {name: "GBP/CNY", rate: (if .rates.GBP and .rates.GBP > 0 then (.rates.CNY / .rates.GBP) else null end)}
            ]
        }')
    fi

    echo "$items_json"
}

generate_card() {
    local items_json="$1"
    local date_str="$2"
    local base="${3:-USD}"

    local rows_json
    rows_json=$(node -e "
const data = JSON.parse(process.argv[1]);
const items = data.pairs;
const out = items.map((item) => ({
    name: item.name,
    // rate 为 null（基准货币缺对应汇率）时展示 '—'，避免 NaN 刷屏
    rate: (item.rate == null) ? '—' : Number(item.rate).toFixed(4),
}));
console.log(JSON.stringify(out));
" "$items_json")

    local count; count=$(echo "$rows_json" | jq 'length')
    local row_h=78 row_gap=14 start_y=195
    local h=$(( start_y + count * (row_h + row_gap) + 70 ))

    {
        svg_header "$h" "#1A2840" "#0D1628" "今日汇率（基准 ${base}）" "${date_str}  实时汇率"

        local i=0 y=$start_y
        while [ "$i" -lt "$count" ]; do
            local name rate
            name=$(echo "$rows_json" | jq -r ".[$i].name")
            rate=$(echo "$rows_json" | jq -r ".[$i].rate")
            # 汇率卡：name 当标题（无序号）、rate 当右侧文字、绿色、字号在默认基础上无需调整
            svg_list_row "" "$y" "$name" "$rate" "#4CAF50"
            y=$((y + row_h + row_gap))
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：ExchangeRate-API v6"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "今日汇率卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    # 0. 解析入参（$1=基准货币，缺省 = USD）
    local base="${1:-}"
    base=$(echo "${base:-USD}" | tr '[:lower:]' '[:upper:]')
    log_info "基准货币: ${base}"

    local date_str
    date_str=$(get_date_str)

    local items_json
    items_json=$(fetch_data "$base") || exit 1

    generate_card "$items_json" "$date_str" "$base"

    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
