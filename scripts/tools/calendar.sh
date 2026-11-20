#!/bin/bash
# ======================================
# 日历提醒卡片（入口）
# ======================================
#
# 功能说明：
#   1. 展示农历日期、节气信息
#   2. 显示年度进度和工作日状态
#   3. 展示即将到来的节假日倒计时
#   4. 复用 date_utils.py 获取农历/节气
#   5. 复用 holiday_config.sh 判断工作日和节假日数据
#
# 模块结构：
#   calendar.sh            入口，负责配置加载 + main 路由 + stdout 契约
#   calendar/data.sh       农历/节气/工作日状态抓取
#   calendar/holidays.sh   节假日倒计时计算（含 calc_days_until）
#   calendar/render.sh     SVG 卡片渲染（generate_card）
#
# 使用方式：
#   bash scripts/tools/calendar.sh
#
# 作者：智能提醒系统
# 更新：2026-04-30（拆分子模块重构）
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
source "${PROJECT_DIR}/holiday_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/calendar_card.png"
SVG_FILE="/tmp/calendar_card.svg"

# ========== 加载子模块 ==========
# 顺序说明：
#   data.sh     无模块内依赖
#   holidays.sh 无模块内依赖（calc_days_until 在同文件内定义在前）
#   render.sh   依赖 card_utils.sh 的 render_card、主脚本的 SVG_FILE/OUTPUT_FILE
source "${SCRIPT_DIR}/calendar/data.sh"
source "${SCRIPT_DIR}/calendar/holidays.sh"
source "${SCRIPT_DIR}/calendar/render.sh"

main() {
    log_info "======================================"
    log_info "日历提醒卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    # 1. 获取农历数据（系统 date_utils.py）
    local lunar_cn
    lunar_cn=$(fetch_lunar_data)
    log_info "农历: $lunar_cn"

    # 2. 获取节气（系统 date_utils.py）
    local solar_term
    solar_term=$(fetch_solar_term)
    if [ -n "$solar_term" ]; then
        log_info "今日节气: $solar_term"
    fi

    # 3. 工作日判断（系统 holiday_config.sh）
    local workday_info
    workday_info=$(get_workday_info)
    log_info "今日状态: $workday_info"

    # 4. 节日倒计时（从 holiday_config.sh 文件提取）
    local holidays
    holidays=$(calculate_holidays)
    log_info "节日倒计时数据获取完成"

    # 原始输出模式（data / json）：本脚本无外部接口，数据来自本地 date_utils / holiday_config，
    # 故输出聚合后的结构化数据而非接口原始返回
    if [ -n "$holidays" ] && command -v jq >/dev/null 2>&1; then
        local calendar_json
        calendar_json=$(jq -n \
            --arg lunar "$lunar_cn" --arg solar_term "$solar_term" --arg workday "$workday_info" \
            --argjson holidays "$(echo "$holidays" | jq -R -s 'split("\n") | map(select(length > 0))')" \
            '{lunar:$lunar, solar_term:$solar_term, workday:$workday, holidays:$holidays}') || calendar_json=""
        if [ -n "$calendar_json" ]; then
            emit_raw "$calendar_json"
        fi
    fi

    # 5. 生成卡片
    generate_card "$lunar_cn" "$solar_term" "$workday_info" "$holidays"

    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
