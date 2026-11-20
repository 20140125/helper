#!/bin/bash

# ======================================
# 工作日午餐提醒模块
# ======================================
#
# 功能说明：
#   1. 从 JSON 获取午餐提示和营养建议
#   2. 判断工作日状态
#   3. 构建并发送午餐提醒消息
#
# 依赖：
#   - template_utils.sh（消息模板工具）
#   - workday_check.sh（工作日判断）
#   - inspirational_quotes.sh（reminder_quotes.json 通用读取工具）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 引入 reminder_quotes.json 通用读取工具
source "${SCRIPT_DIR}/../inspirational_quotes.sh" 2>/dev/null || source "${PROJECT_DIR}/inspirational_quotes.sh"

# 从 reminder_quotes.json 获取午餐提示和营养建议
# 输出：tip 与 nutrition_advice 用 TAB 分隔在同一行，便于 read 解析
_get_lunch_messages() {
    # 获取随机午餐提示
    local tip
    tip=$(get_quote_random "lunch.tips")
    tip="${tip:-🍜 中午了，记得吃午餐哦！工作再忙也要好好吃饭}"

    # 根据星期确定营养建议路径
    local day_map
    case "$(date '+%u')" in
        1) day_map="monday" ;;
        2) day_map="tuesday" ;;
        3) day_map="wednesday" ;;
        4) day_map="thursday" ;;
        5) day_map="friday" ;;
        *) day_map="weekend" ;;
    esac

    local advice
    advice=$(get_quote_random "lunch.nutrition_advice.${day_map}")
    advice="${advice:-注意营养均衡，荤素搭配}"

    echo -e "${tip}\t${advice}"
}

cmd_lunch() {
    LOG_FILE="${PROJECT_DIR}/workday_manager.log"
    source "${PROJECT_DIR}/log_utils.sh"

    log_info "======================================"
    log_info "🚀 工作日提醒脚本启动"
    log_info "📅 当前日期: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "📝 提醒类型: lunch"
    log_info "======================================"

    log_info "🔍 开始判断工作日状态..."
    if ! _check_is_workday; then
        log_info "今天不是工作日，跳过提醒"
        log_success "脚本执行完成"
        log_info "======================================"
        return 0
    fi
    [ -n "$WORKDAY_NOTE" ] && log_success "今天是调休工作日 ($current_date)" || log_success "今天是正常工作日 (周$CURRENT_DAY)"

    # 从 reminder_quotes.json 获取午餐提示和营养建议
    IFS=$'\t' read -r random_tip nutrition_advice <<< "$(_get_lunch_messages)"

    # 随机获取固定小贴士
    local fixed_tips
    fixed_tips=$(get_quote_random "lunch.tips")
    fixed_tips="${fixed_tips:-细嚼慢咽，不要吃太饱（7-8分饱最佳）}"

    MESSAGE=$(get_message "lunch" "${MESSAGE_STYLE:-default}" \
        "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
        "week_day=$WEEK_DAY $WORKDAY_NOTE" \
        "greeting=${random_tip}" \
        "lunch_suggestion=${nutrition_advice}" \
        "tips=${fixed_tips}"
    )
    
    log_info "📝 午餐提醒内容准备完成"
    log_info "🍽️ 午餐提醒已触发 $WORKDAY_NOTE"

    log_info "📤 正在发送企业微信消息..."
    send_wecom_message "$MESSAGE"
    log_info "======================================"
}
