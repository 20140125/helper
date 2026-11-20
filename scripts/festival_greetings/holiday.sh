#!/bin/bash

# ======================================
# 节假日祝福模块
# ======================================
#
# 功能说明：
#   1. 检查今天/明天是否为节假日
#   2. 构建节假日祝福消息并发送
#
# 依赖：
#   - holiday_config.sh（节假日配置）
#   - greetings_loader.sh（祝福语加载器）
#   - template_utils.sh（消息模板工具）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 检查是否为节假日并发送祝福
# 参数：$1 - 检查日期（YYYY-MM-DD），$2 - 是否为提前提醒（true/false）
_check_holiday_greeting() {
    local check_date="$1"
    local is_advance="${2:-false}"
    
    local current_year=$(date '+%Y')
    local found=false
    local holiday_name=""
    local holiday_type=""
    
    local holiday_info=""
    local holidays_var="HOLIDAYS_${current_year}"
    
    if declare -p "HOLIDAYS_${current_year}" &>/dev/null; then
        eval "holiday_info=\"\${HOLIDAYS_${current_year}[\$check_date]:-}\""
    fi
    
    if [ -n "$holiday_info" ]; then
        holiday_name=$(echo "$holiday_info" | cut -d'|' -f1)
        holiday_type=$(echo "$holiday_info" | cut -d'|' -f2)
        
        if [ "$holiday_type" = "2" ]; then
            found=true
        fi
    fi
    
    if [ "$found" = true ]; then
        log_info "🎉 检测到节假日: $holiday_name ($check_date)"
        
        local greeting_content=$(get_holiday_greeting "$holiday_name")
        
        # 清明节/中元节不宜说"快乐"，使用"安康"
        local holiday_display_name
        case "$holiday_name" in
            *清明*|*中元*)
                holiday_display_name="${holiday_name}安康"
                ;;
            *)
                holiday_display_name="${holiday_name}快乐"
                ;;
        esac
        
        local holiday_tips=""
        if [ "$is_advance" = "true" ]; then
            case "$holiday_name" in
                *清明*|*中元*)
                    holiday_tips="✅ 提前安排好工作交接"$'\n'"✅ 规划假期行程"$'\n'"✅ 提前祝大家${holiday_name}安康！"
                    ;;
                *)
                    holiday_tips="✅ 提前安排好工作交接"$'\n'"✅ 规划假期行程"$'\n'"✅ 提前祝大家${holiday_name}快乐！"
                    ;;
            esac
        else
            case "$holiday_name" in
                *清明*)
                    holiday_tips="✅ 文明祭扫，注意防火"$'\n'"✅ 缅怀先人，珍惜当下"$'\n'"✅ 踏青养生，注意安全"
                    ;;
                *)
                    holiday_tips="✅ 享受假期，放松身心"$'\n'"✅ 注意出行安全"$'\n'"✅ 合理安排假期时间"
                    ;;
            esac
        fi
        
        local message=""
        if [ "$is_advance" = "true" ]; then
            message=$(get_message "holiday" "${MESSAGE_STYLE:-default}" \
                "holiday_name=📅 明天是${holiday_display_name}" \
                "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
                "greeting=${greeting_content}" \
                "holiday_tips=${holiday_tips}"
            )
        else
            message=$(get_message "holiday" "${MESSAGE_STYLE:-default}" \
                "holiday_name=${holiday_display_name}" \
                "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
                "greeting=${greeting_content}" \
                "holiday_tips=${holiday_tips}"
            )
        fi
        
        send_wecom_message "$message"
    else
        log_info "$check_date 不是节假日"
    fi
}

cmd_holiday() {
    LOG_FILE="${PROJECT_DIR}/festival_greetings.log"
    source "${PROJECT_DIR}/log_utils.sh"

    log_info "======================================"
    log_info "🚀 节假日祝福检查启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    log_debug "检查今天: $TODAY"
    _check_holiday_greeting "$TODAY" false

    log_debug "检查明天: $TOMORROW"
    _check_holiday_greeting "$TOMORROW" true

    log_success "节假日祝福检查完成"
    log_info "======================================"
}
