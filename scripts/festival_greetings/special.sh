#!/bin/bash

# ======================================
# 特殊节日提醒模块
# ======================================
#
# 功能说明：
#   1. 检查今天/明天是否为特殊节日
#   2. 发送特殊节日祝福消息（情人节、妇女节等）
#
# 依赖：
#   - greetings_loader.sh（祝福语加载器）
#   - template_utils.sh（消息模板工具）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

_check_special_day() {
    local today=$(date '+%Y-%m-%d')
    local month_day=$(date '+%m-%d')

    log_info "🔍 检查特殊节日（${today}）"
    
    declare -A SPECIAL_DAYS
    SPECIAL_DAYS["02-14"]="情人节"
    SPECIAL_DAYS["03-08"]="妇女节"
    SPECIAL_DAYS["06-01"]="儿童节"
    SPECIAL_DAYS["09-10"]="教师节"
    SPECIAL_DAYS["10-24"]="程序员节"
    SPECIAL_DAYS["12-25"]="圣诞节"
    
    # 检查今天
    if [ -n "${SPECIAL_DAYS[$month_day]}" ]; then
        local day_name="${SPECIAL_DAYS[$month_day]}"
        log_info "🎉 今天是: $day_name"
        
        local greeting=$(get_special_day_greeting "$day_name")
        
        local message
        message=$(get_message "special_day" "${MESSAGE_STYLE:-default}" \
            "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
            "day_name=${day_name}" \
            "greeting=${greeting}"
        )

        if [ $? -ne 0 ] || [ -z "$message" ]; then
            log_error "模板渲染失败"
            return 1
        fi

        send_wecom_message "$message"
        return 0
    fi
    
    # 检查明天（提前提醒）
    local tomorrow=$(date -d '+1 day' '+%m-%d')
    if [ -n "${SPECIAL_DAYS[$tomorrow]}" ]; then
        local day_name="${SPECIAL_DAYS[$tomorrow]}"
        log_info "📅 明天是: $day_name（提前提醒）"
        
        local advance_message
        advance_message=$(get_message "special_day" "advance" \
            "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
            "day_name=${day_name}"
        )

        if [ $? -ne 0 ] || [ -z "$advance_message" ]; then
            log_warning "模板渲染失败，使用兜底消息"
            advance_message=$(printf '## 📅 节日提前提醒\n\n> **当前时间**: %s\n> **明天是**: %s\n\n🎉 提前祝大家 %s 快乐！\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 *此消息由智能提醒系统发送*' \
                "$(date '+%Y年%m月%d日 %H:%M')" "$day_name" "$day_name")
        fi

        send_wecom_message "$advance_message"
        return 0
    fi
    
    log_info "ℹ️  今天和明天都不是特殊节日"
    return 1
}

cmd_special() {
    LOG_FILE="${PROJECT_DIR}/festival_greetings.log"
    source "${PROJECT_DIR}/log_utils.sh"

    log_info "======================================"
    log_info "🚀 特殊节日提醒脚本启动"
    log_info "📅 当前日期: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    _check_special_day

    log_success "脚本执行完成"
    log_info "======================================"
}
