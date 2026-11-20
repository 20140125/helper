#!/bin/bash

# ======================================
# 工作日下班提醒模块
# ======================================
#
# 功能说明：
#   1. 判断工作日状态
#   2. 获取励志语录
#   3. 构建并发送下班提醒消息
#
# 依赖：
#   - template_utils.sh（消息模板工具）
#   - workday_check.sh（工作日判断）
#   - inspirational_quotes.sh（励志语录）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

cmd_evening() {
    LOG_FILE="${PROJECT_DIR}/workday_manager.log"
    source "${PROJECT_DIR}/log_utils.sh"

    log_info "======================================"
    log_info "🚀 工作日提醒脚本启动"
    log_info "📅 当前日期: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "📝 提醒类型: evening"
    log_info "======================================"

    log_info "🔍 开始判断工作日状态..."
    if ! _check_is_workday; then
        log_info "今天不是工作日，跳过提醒"
        log_success "脚本执行完成"
        log_info "======================================"
        return 0
    fi
    [ -n "$WORKDAY_NOTE" ] && log_success "今天是调休工作日 ($current_date)" || log_success "今天是正常工作日 (周$CURRENT_DAY)"

    log_info "🌆 开始准备下班提醒内容..."

    log_info "💪 正在获取励志语录..."
    EVENING_QUOTE=$(bash "${PROJECT_DIR}/inspirational_quotes.sh" random 2>/dev/null)
    if [ -z "$EVENING_QUOTE" ]; then
        EVENING_QUOTE="成功不是终点，失败也不是末日，唯有勇气才能永续。"
    fi
    [[ -n "$EVENING_QUOTE" ]] && log_info '励志语录获取成功' || log_info '励志语录获取失败'

    MESSAGE=$(get_message "evening" "${MESSAGE_STYLE:-default}" \
        "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
        "week_day=$WEEK_DAY $WORKDAY_NOTE" \
        "wish=辛苦了一天，该下班啦！" \
        "quote=${EVENING_QUOTE}" \
        "tomorrow_tips="
    )
    
    log_info "📝 下班提醒内容准备完成"
    log_info "🌆 下班提醒已触发 $WORKDAY_NOTE"

    log_info "📤 正在发送企业微信消息..."
    send_wecom_message "$MESSAGE"
    log_info "======================================"
}
