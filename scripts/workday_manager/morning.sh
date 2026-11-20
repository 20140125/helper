#!/bin/bash

# ======================================
# 工作日早安提醒模块
# ======================================
#
# 功能说明：
#   1. 判断工作日状态
#   2. 加载早安数据（天气、星座、黄历、历史、励志）
#   3. 构建并发送早安提醒消息
#
# 依赖：
#   - daily_data_manager.sh（早安数据获取）
#   - template_utils.sh（消息模板工具）
#   - workday_check.sh（工作日判断）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

cmd_morning() {
    LOG_FILE="${PROJECT_DIR}/workday_manager.log"
    source "${PROJECT_DIR}/log_utils.sh"

    log_info "======================================"
    log_info "🚀 工作日提醒脚本启动"
    log_info "📅 当前日期: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "📝 提醒类型: morning"
    log_info "======================================"

    log_info "🔍 开始判断工作日状态..."
    if ! _check_is_workday; then
        log_info "今天不是工作日，跳过提醒"
        log_success "脚本执行完成"
        log_info "======================================"
        return 0
    fi
    [ -n "$WORKDAY_NOTE" ] && log_success "今天是调休工作日 ($current_date)" || log_success "今天是正常工作日 (周$CURRENT_DAY)"

    log_info "🌅 开始准备早安提醒内容..."

    # 加载早安数据获取脚本
    log_info "📡 正在加载早安数据..."
    source "${PROJECT_DIR}/daily_data_manager.sh"
    get_morning_data
    
    # 映射变量名
    WEATHER_INFO="$MORNING_WEATHER_INFO"
    LUNAR_INFO="$MORNING_ALMANAC_INFO"
    HISTORY_INFO="$MORNING_HISTORY_INFO"
    HOROSCOPE_INFO="$MORNING_HOROSCOPE_INFO"
    DAILY_QUOTE="$MORNING_INSPIRATIONAL_QUOTE"
    
    [[ -n "$WEATHER_INFO" ]] && log_success '天气信息获取成功' || log_error '天气信息获取失败'
    [[ -n "$LUNAR_INFO" ]] && log_success '黄历信息获取成功' || log_error '黄历信息获取失败'
    [[ -n "$HISTORY_INFO" ]] && log_success '历史信息获取成功' || log_error '历史信息获取失败'
    [[ -n "$HOROSCOPE_INFO" ]] && log_success '星座运势获取成功' || log_error '星座运势获取失败'
    [[ -n "$DAILY_QUOTE" ]] && log_success '励志语录获取成功' || log_error '励志语录获取失败'

    MESSAGE=$(get_message "morning" "${MESSAGE_STYLE:-default}" \
        "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
        "week_day=$WEEK_DAY $WORKDAY_NOTE" \
        "city=${WEATHER_CITY_NAME:-}" \
        "weather=${WEATHER_INFO}" \
        "temperature=" \
        "horoscope_title=" \
        "horoscope_content=${HOROSCOPE_INFO}" \
        "almanac_title=" \
        "almanac_content=${LUNAR_INFO}" \
        "history_content=${HISTORY_INFO}" \
        "quote=${DAILY_QUOTE}"
    )
    
    log_info "📝 早安提醒内容准备完成"
    log_info "🌅 早晨提醒已触发 $WORKDAY_NOTE"

    log_info "📤 正在发送企业微信消息..."
    send_wecom_message "$MESSAGE"
    log_info "======================================"
}
