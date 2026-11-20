#!/bin/bash

# ======================================
# 调休上班提醒模块
# ======================================
#
# 功能说明：
#   1. 从 JSON 获取提前提醒寄语
#   2. 检查明天是否为调休上班日并发送提前一天预告
#
# 依赖：
#   - holiday_config.sh（调休日判断）
#   - template_utils.sh（消息模板工具）
#   - reminder_quotes.json（提醒寄语数据）
#
# 作者：智能提醒系统
# 更新：2026-09-18
# ======================================

# 从 JSON 获取提前提醒寄语
_get_advance_reminder_message() {
    source "${SCRIPT_DIR}/inspirational_quotes.sh" 2>/dev/null
    local result
    result=$(get_quote_daily "workday_adjust.advance_reminders")
    echo "${result:-虽然是周末，但明天需要上班哦！记得调闹钟，今晚早点休息 💤}"
}

# 检查"明天是否调休上班"并发送提前一天预告
# 仅当明天是周末（周六/周日）且被标记为调休上班日时才提醒
_check_tomorrow_adjust() {
    local holiday_name
    holiday_name=$(is_adjust_workday "$tomorrow")
    [ -z "$holiday_name" ] && return 1
    [ "$tomorrow_week" -ne 6 ] && [ "$tomorrow_week" -ne 7 ] && return 1

    log_warning "明天是调休上班日：${holiday_name}"

    local tips
    tips=$(_get_advance_reminder_message)
    local adjustment_date
    adjustment_date=$(date -d "$tomorrow" '+%Y年%m月%d日（%A）' | sed 's/Monday/周一/;s/Tuesday/周二/;s/Wednesday/周三/;s/Thursday/周四/;s/Friday/周五/;s/Saturday/周六/;s/Sunday/周日/')

    local msg
    msg=$(get_message "adjustment" "$MESSAGE_STYLE" \
      "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
      "adjustment_date=${adjustment_date}" \
      "reason=${holiday_name}" \
      "tips=${tips}"
    )

    send_wecom_message "$msg"
    return 0
}

# cmd_adjust
#   检查明天是否调休上班并发送提前一天预告（建议晚上 18:00 触发）。
#   「今天是补班日」的独立强提醒已停用，改为并入早上 08:00 的早安提醒。
cmd_adjust() {
    LOG_FILE="${PROJECT_DIR}/workday_manager.log"
    source "${PROJECT_DIR}/log_utils.sh"

    log_info "======================================"
    log_info "🚀 调休上班提醒脚本启动 (scope=tomorrow)"
    log_info "📅 当前日期: $(date '+%Y-%m-%d %H:%M:%S')"
    log_debug " 检查日期: 明天: ${tomorrow}"
    log_info "======================================"
    log_info "📋 从公司节假日配置读取调休信息..."

    local sent=false
    if _check_tomorrow_adjust; then
        sent=true
    fi

    if [ "$sent" != "true" ]; then
        log_info "明天不是调休上班日"
    fi

    log_success "调休上班提醒脚本执行完成"
    log_info "======================================"
}
