#!/bin/bash

# ======================================
# 二十四节气提醒模块
# ======================================
#
# 功能说明：
#   1. 查询指定日期的节气
#   2. 发送节气提醒消息
#
# 依赖：
#   - date_utils.py（节气计算）
#   - greetings_loader.sh（祝福语加载器）
#   - template_utils.sh（消息模板工具）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 查询指定日期的节气（运行时动态计算）
# 参数: $1 - 日期 (格式: YYYY-MM-DD)
# 返回: 节气名称（stdout），成功返回0，非节气或异常返回1
#
# 注意：
#   - date_utils.py solar_term 的正常返回规则：
#       当天是节气 → stdout 输出节气名，exit 0
#       当天不是节气 → stdout 为空，exit 1（这是正常业务分支，不算错误）
#       Python 异常（如模块缺失、依赖问题）→ stderr 非空
#   - 本函数通过 stderr 非空来识别"真正的异常"并写入日志，避免静默失败
get_solar_term_date() {
    local check_date="${1:-$TODAY}"

    local term_name rc stderr_file stderr_content
    stderr_file=$(mktemp 2>/dev/null || echo "/tmp/solar_term_stderr.$$")
    term_name=$(python3 "${PROJECT_DIR}/date_utils.py" solar_term "$check_date" 2>"$stderr_file")
    rc=$?

    # 仅当 stderr 非空时才算异常（exit 1 但 stderr 为空属于"非节气日"的正常分支）
    if [ -s "$stderr_file" ]; then
        stderr_content=$(cat "$stderr_file")
        log_error "date_utils.py solar_term 调用异常 (date=${check_date}, exit=${rc})"
        # 将异常堆栈按行写入日志，便于排查
        while IFS= read -r line; do
            [ -n "$line" ] && log_error "    $line"
        done <<< "$stderr_content"
        log_error "提示：请检查 Python 依赖是否安装（pip3 install -r ${PROJECT_DIR}/requirements.txt）"
    fi
    rm -f "$stderr_file"

    if [ $rc -eq 0 ] && [ -n "$term_name" ]; then
        echo "$term_name"
        return 0
    fi
    return 1
}

_check_and_send_solar_term() {
    local check_date="$1"
    
    local term_name
    term_name=$(get_solar_term_date "$check_date")
    
    if [ $? -eq 0 ] && [ -n "$term_name" ]; then
        log_info "🎋 检测到节气: $term_name ($check_date)"
        log_info "📤 准备发送节气提醒..."
        
        local greeting_msg=$(get_solar_term_greeting "$term_name")
        
        if [ -z "$greeting_msg" ]; then
            log_warning "未找到 $term_name 的祝福语，使用兜底消息"
            greeting_msg="**${term_name}**节气到了，祝大家身体健康，万事如意！"
        fi
        
        local message
        message=$(get_message "solar_term" "${MESSAGE_STYLE:-default}" \
            "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
            "term_name=${term_name}" \
            "greeting=${greeting_msg}"
        )
        
        if [ $? -ne 0 ] || [ -z "$message" ]; then
            log_warning "模板渲染失败，使用祝福语直接发送"
            message="${greeting_msg}"
        fi
        
        send_wecom_message "$message"
    else
        log_info "$check_date 不是节气日"
        return 0
    fi
}

# 导出函数供其他脚本使用
export -f get_solar_term_date
check_and_send_solar_term() { _check_and_send_solar_term "$@"; }
export -f check_and_send_solar_term

cmd_solar_term() {
    LOG_FILE="${PROJECT_DIR}/festival_greetings.log"
    source "${PROJECT_DIR}/log_utils.sh"

    log_info "======================================"
    log_info "🚀 二十四节气提醒脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    log_debug "检查日期: $TODAY"
    _check_and_send_solar_term "$TODAY"

    log_success "脚本执行完成"
    log_info "======================================"
}
