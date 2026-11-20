#!/bin/bash
# ======================================
# 公共假期列表卡片
# ======================================
#
# 功能说明：
#   1. 查询指定国家/地区、指定年份的公共假期（免费公开接口，无需 API Key）
#   2. 展示日期、当地名称与英文名
#   3. 支持与其它卡片脚本一致的输出模式（card / data / json）
#
# 数据源：https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}
# 说明：数据源覆盖 100+ 国家；中国法定节假日以项目内 holiday_config.sh 为准，
#       本卡片主要用于查询海外假期。
#
# 使用方式：
#   bash scripts/tools/holiday_nager.sh            # 今年 · 中国
#   bash scripts/tools/holiday_nager.sh US 2026
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

OUTPUT_FILE="${CARD_OUTPUT_DIR}/holiday_nager_card.png"
SVG_FILE="/tmp/holiday_nager_card.svg"

COUNTRY="${1:-CN}"
YEAR="${2:-$(TZ=Asia/Shanghai date '+%Y')}"

fetch_data() {
    local url="https://date.nager.at/api/v3/PublicHolidays/${YEAR}/${COUNTRY}"
    # 法定假日按「国家+年份」一份、全年有效 → 单次归档文件（无月份后缀），
    # 文件名形如 nagerholiday-CN-2026.json，避免月文件每年重复拉取 12 次
    local cache_file
    cache_file=$(api_cache_daily_path nagerholiday "$COUNTRY" "$YEAR")

    local result
    result=$(cached_curl "${cache_file}" -s --max-time 15 "$url" 2>/dev/null)
    if [ -z "$result" ]; then
        log_error "公共假期数据获取失败（${COUNTRY} ${YEAR}）"
        return 1
    fi
    echo "$result"
}

parse_data() {
    local data="$1"
    echo "$data" | python3 -c '
import json, sys

try:
    doc = json.load(sys.stdin)
except Exception:
    print("[]")
    sys.exit(0)

if not isinstance(doc, list):
    print("[]")
    sys.exit(0)

out = [
    {
        "date": h.get("date", ""),
        "local": h.get("localName", "") or h.get("name", ""),
        "name": h.get("name", ""),
    }
    for h in doc[:12]
]
print(json.dumps(out, ensure_ascii=False))
'
}

generate_card() {
    local items_json="$1"
    local date_str="$2"

    local count
    count=$(echo "$items_json" | jq 'length')
    if [ "$count" = "0" ]; then
        log_error "无假期数据（国家代码可能有误）"
        return 1
    fi

    local row_h=72
    local row_gap=10
    local start_y=195
    local h=$(( start_y + count * (row_h + row_gap) + 70 ))

    {
        svg_header "$h" "#8E24AA" "#2A0A33" "公共假期 · ${COUNTRY}" "${YEAR} 年 共 ${count} 天"

        local i=0 y=$start_y
        while [ "$i" -lt "$count" ]; do
            local d local_name
            d=$(echo "$items_json"          | jq -r ".[$i].date")
            local_name=$(echo "$items_json" | jq -r ".[$i].local")
            svg_list_row "$d" "$y" "$local_name" "" "#FFB300" "#ffffff08" "#ffffffdd" "$row_h" "#ffffff12"
            y=$((y + row_h + row_gap))
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：Nager.Date（免费公开接口）"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "公共假期卡片生成启动"
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
