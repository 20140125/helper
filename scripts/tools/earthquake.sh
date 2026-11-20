#!/bin/bash
# ======================================
# 全球地震速报卡片
# ======================================
#
# 功能说明：
#   1. 获取 USGS 近 24 小时地震事件（免费公开接口，无需 API Key）
#   2. 展示震级、地点、发震时刻（北京时间）
#   3. 支持与其它卡片脚本一致的输出模式（card / data / json）
#
# 数据源：https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
#
# 使用方式：
#   bash scripts/tools/earthquake.sh
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

OUTPUT_FILE="${CARD_OUTPUT_DIR}/earthquake_card.png"
SVG_FILE="/tmp/earthquake_card.svg"

fetch_data() {
    local url="https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
    local cache_file
    cache_file=$(api_cache_path earthquake)

    local result
    result=$(API_ARCHIVE_SLOT=hour cached_curl "${cache_file}" -s --max-time 15 "$url" 2>/dev/null)

    if [ -z "$result" ]; then
        log_error "地震数据获取失败"
        return 1
    fi
    echo "$result"
}

parse_data() {
    local data="$1"
    echo "$data" | python3 -c '
import json, sys
from datetime import datetime, timezone, timedelta

try:
    doc = json.load(sys.stdin)
except Exception:
    print("[]")
    sys.exit(0)

features = doc.get("features", []) if isinstance(doc, dict) else []
tz = timezone(timedelta(hours=8))

rows = []
for f in features:
    p = f.get("properties") or {}
    mag = p.get("mag")
    place = p.get("place") or "-"
    ts = p.get("time")
    if ts is None:
        continue
    t = datetime.fromtimestamp(ts / 1000, tz).strftime("%m-%d %H:%M")
    rows.append({"mag": mag if mag is not None else 0.0, "place": place, "time": t})

# 按震级降序，取前 10 条
rows.sort(key=lambda r: r["mag"], reverse=True)
print(json.dumps(rows[:10], ensure_ascii=False))
'
}

generate_card() {
    local items_json="$1"
    local date_str="$2"

    local count
    count=$(echo "$items_json" | jq 'length')
    if [ "$count" = "0" ]; then
        # 无地震也是有效结果：出一张"暂无记录"的卡片，而不是失败
        count=1
        local empty=1
    fi

    local row_h=72
    local row_gap=10
    local start_y=195
    local h=$(( start_y + count * (row_h + row_gap) + 70 ))

    {
        svg_header "$h" "#455A64" "#101820" "全球地震速报" "${date_str}  近 24 小时"

        if [ -n "${empty:-}" ]; then
            svg_list_row "--" "$start_y" "近 24 小时无显著地震记录" "" "#ffffff99" "#ffffff08" "#ffffff99" "$row_h" "#ffffff12"
        else
            local i=0 y=$start_y
            while [ "$i" -lt "$count" ]; do
                local mag place time color
                mag=$(echo "$items_json"   | jq -r ".[$i].mag")
                place=$(echo "$items_json" | jq -r ".[$i].place")
                time=$(echo "$items_json"  | jq -r ".[$i].time")

                # 震级配色：>=6 红、>=4.5 橙、其余绿
                local is_big
                is_big=$(python3 -c "print('1' if $mag >= 6 else ('2' if $mag >= 4.5 else '3'))")
                case "$is_big" in
                    1) color="#FF5252" ;;
                    2) color="#FF9800" ;;
                    *) color="#4CAF50" ;;
                esac

                svg_list_row "M${mag}" "$y" "$place" "$time" "$color" "#ffffff08" "#ffffffdd" "$row_h" "#ffffff12"
                y=$((y + row_h + row_gap))
                i=$((i + 1))
            done
        fi

        svg_footer "$h" "数据来源：USGS（美国地质调查局）"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "全球地震速报卡片生成启动"
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
