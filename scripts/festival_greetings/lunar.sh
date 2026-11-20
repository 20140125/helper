#!/bin/bash

# ======================================
# 传统农历节日提醒模块
# ======================================
#
# 功能说明：
#   1. 农历节日日期转换（农历→公历）
#   2. 检查今天是否为农历节日
#   3. 发送农历节日祝福消息
#   4. 列出当年所有农历节日
#
# 依赖：
#   - date_utils.py（农历日期转换）
#   - greetings_loader.sh（祝福语加载器）
#   - template_utils.sh（消息模板工具）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 农历节日定义（JSON 格式，供 date_utils.py 批量转换）
LUNAR_FESTIVALS_JSON='{
    "12-08": "腊八节",
    "12-23": "小年",
    "01-15": "元宵节",
    "02-02": "龙抬头",
    "07-07": "七夕节",
    "07-15": "中元节",
    "09-09": "重阳节"
}'

declare -A LUNAR_FESTIVALS=()

_load_lunar_festivals() {
    log_info "🔄 正在转换农历节日为 ${CURRENT_YEAR} 年公历日期..."

    local output
    output=$(python3 "${PROJECT_DIR}/date_utils.py" lunar_festivals "$LUNAR_FESTIVALS_JSON" 2>/dev/null)

    if [ $? -ne 0 ] || [ -z "$output" ]; then
        log_error "❌ 农历节日日期转换失败"
        return 1
    fi

    local count=0
    while IFS='|' read -r mmdd festival_name; do
        if [ -n "$mmdd" ] && [ -n "$festival_name" ]; then
            LUNAR_FESTIVALS["$mmdd"]="$festival_name"
            ((count++))
        fi
    done <<< "$output"

    if [ $count -lt 6 ]; then
        log_warning "⚠️ 节日数据不完整（仅成功 ${count} 个）"
        return 1
    fi

    log_success "成功加载 ${count} 个农历节日"
    return 0
}

_check_lunar_festival() {
    log_info "🔍 检查传统农历节日（${CURRENT_YEAR}-${TODAY_MD}）"

    if ! _load_lunar_festivals; then
        log_error "无法检查农历节日：日期转换失败"
        return 1
    fi

    if [ -n "${LUNAR_FESTIVALS[$TODAY_MD]}" ]; then
        local festival_name="${LUNAR_FESTIVALS[$TODAY_MD]}"

        log_info "🎉 今天是：$festival_name"
        log_info "📤 准备发送祝福..."

        local greeting_msg=$(get_lunar_festival_greeting "$festival_name")

        local message
        message=$(get_message "lunar_festival" "${MESSAGE_STYLE:-default}" \
            "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
            "festival_name=${festival_name}" \
            "greeting=${greeting_msg}"
        )

        if [ $? -ne 0 ] || [ -z "$message" ]; then
            log_warning "模板渲染失败，使用祝福语直接发送"
            message="${greeting_msg}"
        fi

        send_wecom_message "$message"
    else
        log_info "今天不是农历节日"
        return 0
    fi
}

cmd_lunar() {
    LOG_FILE="${PROJECT_DIR}/festival_greetings.log"
    source "${PROJECT_DIR}/log_utils.sh"

    log_info "======================================"
    log_info "🚀 传统农历节日提醒脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    _check_lunar_festival

    log_success "脚本执行完成"
    log_info "======================================"
}

cmd_list_lunar() {
    LOG_FILE="${PROJECT_DIR}/festival_greetings.log"
    source "${PROJECT_DIR}/log_utils.sh"

    log_info "======================================"
    log_info "📅 传统农历节日列表（${CURRENT_YEAR}年）"
    log_info "======================================"

    if ! _load_lunar_festivals; then
        log_error "加载失败"
        log_info "======================================"
        exit 1
    fi

    for date in $(echo "${!LUNAR_FESTIVALS[@]}" | tr ' ' '\n' | sort); do
        festival_name="${LUNAR_FESTIVALS[$date]}"
        log_info "  ${date}  ${festival_name}"
    done

    log_success "脚本执行完成"
    log_info "======================================"
}
