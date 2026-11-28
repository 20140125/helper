#!/bin/bash

# ======================================
# 每周总结报告脚本
# ======================================
# 
# 功能说明：
#   1. 每周最后一个工作日晚上18:30发送本周工作总结（放假周不推送）
#   2. 统计本周实际工作日天数（排除节假日）
#   3. 展示本周星座运势
#   4. 提供下周展望和周末寄语
#   5. 从JSON文件动态加载周末祝福语
#   6. 自动检测放假周并跳过报告推送
# 
# 触发条件：
#   - 每周最后一个工作日 18:30（含调休上班日）
#   - 仅在工作周推送（放假周自动跳过）
# 
# 数据来源：
#   - 节假日配置：holiday_config.sh
#   - 周末寄语：reminder_quotes.json 对应的已有业务表（weekend 分类，98条寄语库）
#   - 星座运势：daily_data_YYYY-MM-DD.json 对应的已有业务表
# 
# 作者：智能提醒系统
# 更新：2026-02-13
# ======================================

# ======================================
# 加载配置文件
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 加载统一配置（包含 TZ 和 WECOM_WEBHOOK）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

# ======================================
# 配置参数
# ======================================

# 加载节假日配置（现代化方式，替代TXT文件）
source "${PROJECT_DIR}/holiday_config.sh" 2>/dev/null

# 设置日志文件
LOG_FILE="${PROJECT_DIR}/weekly_summary.log"

# 引入统一日志工具（必须在 holiday/weather 之后、其他业务配置之前）
source "${PROJECT_DIR}/log_utils.sh"

# 引入消息模板工具
source "${PROJECT_DIR}/template_utils.sh"

# 引入通用语录读取工具
source "${PROJECT_DIR}/inspirational_quotes.sh"

# 引入周报数据计算公共模块（get_this_monday / calculate_workdays / get_week_summary 等）
source "${PROJECT_DIR}/weekly_data.sh"

# ======================================
# 寄语生成函数
# ======================================

# 生成鼓励语
# 返回：输出单条周末寄语
# 说明：与消息模板中 {greeting} 占位符的单行设计保持一致，避免两条寄语黏连
get_weekly_encouragement() {
    get_quote_daily "weekend.messages"
}

# 主函数
main() {
    # 记录脚本启动
    log_info "======================================"
    log_info "🚀 每周总结报告脚本启动"
    log_info "📅 当前日期: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    # 检查今天是否为本周最后一个工作日
    if ! is_last_workday_of_week; then
        log_info "今天不是本周最后一个工作日，跳过每周总结"
        log_info "======================================"
        exit 0
    fi

    # 检查本周是否为放假周（周一到周五全部是放假日）
    if check_holiday_week; then
        log_info "📅 本周是放假周（周一到周五全部是放假日），跳过周报告推送"
        log_info "======================================"
        exit 0
    fi

    # ======================================
    # 生成并发送周报
    # ======================================

    # 计算本周数据（复用 weekly_data.sh 公共模块）
    local WORKDAY_COUNT=$(calculate_workdays)
    local ENCOURAGEMENT=$(get_weekly_encouragement)
    local NEXT_WEEK=$(get_next_week_preview)
    local WEEK_START=$(get_week_start)
    local WEEK_END=$(get_week_end)
    local WEEK_SUMMARY=$(get_week_summary)
    local DATE_TIME=$(date '+%Y年%m月%d日 %H:%M')

    # 下周提醒（独立占位符）
    local NEXT_MONDAY_REMINDER=$(get_next_monday_reminder)

    # 使用模板渲染消息
    log_info "📝 正在渲染周报消息模板..."
    local MESSAGE=$(get_message "weekend" "${MESSAGE_STYLE:-default}" \
      "week_start=${WEEK_START}" \
      "week_end=${WEEK_END}" \
      "date_time=${DATE_TIME}" \
      "week_summary=${WEEK_SUMMARY}" \
      "next_week_preview=${NEXT_WEEK}" \
      "greeting=${ENCOURAGEMENT}" \
      "next_monday_reminder=${NEXT_MONDAY_REMINDER}"
    )

    if [ $? -ne 0 ] || [ -z "$MESSAGE" ]; then
      log_error "消息模板渲染失败，跳过发送"
      log_info "======================================"
      exit 1
    fi

    # 发送总结报告
    log_info "📤 正在发送每周总结报告..."
    send_wecom_message "$MESSAGE"

    log_success "每周总结报告处理完成（工作日${WORKDAY_COUNT}天）"
    log_info "======================================"
}

main "$@"
