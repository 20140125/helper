#!/bin/bash

# ======================================
# 月度提醒脚本
# ======================================
# 
# 功能说明：
#   1. 月初（每月1日）发送新月问候和本月提醒
#   2. 月底（每月最后一天）发送月度总结提醒
#   3. 提供月度工作计划和总结建议
#   4. 展望下个月的工作安排
#   5. 基于公司节假日安排统计工作日天数
# 
# 触发时机：
#   - 每月1日：月初问候
#   - 每月最后一天：月底总结
# 
# 数据来源：
#   - 节假日配置：holiday_config.sh
#   - 工作日判断：基于公司HR节假日安排
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

# 加载节假日配置
source "${PROJECT_DIR}/holiday_config.sh" 2>/dev/null

# 定义日志文件路径
LOG_FILE="${PROJECT_DIR}/monthly_reminder.log"

# 引入统一日志工具（必须在定义LOG_FILE之后）
source "${PROJECT_DIR}/log_utils.sh"

# 引入消息模板工具
source "${PROJECT_DIR}/template_utils.sh"

# ======================================
# 工具函数
# ======================================

# 计算当月基于公司节假日安排的实际上班天数
# 返回：输出工作日天数
calculate_monthly_workdays() {
    local year_month="$current_year-$current_month"
    local workday_count=0
    local holiday_count=0
    local weekend_count=0
    local adjust_workday_count=0
    
    log_info "📊 开始计算 ${current_year}年${current_month}月 工作日统计..."
    
    # 遍历当月的每一天（从1号到最后一天）
    for ((day=1; day<=last_day; day++)); do
        # 格式化日期（补零）
        if [ $day -lt 10 ]; then
            formatted_day="0$day"
        else
            formatted_day="$day"
        fi
        
        local check_date="${year_month}-${formatted_day}"
        
        # 使用公司节假日配置判断工作日状态
        if is_adjust_workday "$check_date" >/dev/null; then
            # 调休上班日（原本是周末但需要上班）
            adjust_workday_count=$((adjust_workday_count + 1))
            workday_count=$((workday_count + 1))
            log_info "📅 ${check_date}: 调休上班日（需要上班）"
        elif is_holiday "$check_date"; then
            # 法定节假日
            holiday_count=$((holiday_count + 1))
            log_info "🎉 ${check_date}: 法定节假日（休息）"
        elif is_workday "$check_date"; then
            # 普通工作日
            workday_count=$((workday_count + 1))
            log_info "💼 ${check_date}: 普通工作日（上班）"
        else
            # 周末休息日
            weekend_count=$((weekend_count + 1))
            log_info "🏖️  ${check_date}: 周末休息日（休息）"
        fi
    done
    
    # 生成详细的月度工作报告
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "📊 ${current_year}年${current_month}月 公司工作日统计报告"
    log_info "📅 总天数：$last_day 天"
    log_info "💼 实际上班天数：$workday_count 天"
    log_info "🎉 法定节假日：$holiday_count 天"
    log_info "🏖️  周末休息日：$weekend_count 天"
    log_info "🔄 调休上班日：$adjust_workday_count 天"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    echo $workday_count
}

# 从JSON配置读取月份信息并动态计算天数
# 参数：
#   $1 - 月份（01-12）
#   $2 - 年份（YYYY）
# 返回：设置全局变量 month_name 和 last_day
load_month_config() {
    local month="$1"
    local year="$2"
    
    # 检查JSON配置文件是否存在
    if [ ! -f "${CACHE_DIR}/month_config.json" ]; then
        log_error "月份配置文件不存在，使用默认配置"
        month_name="Unknown"
        last_day="30"
        return 1
    fi
    
    # 使用jq解析JSON配置
    local month_info=$(jq -r ".months.\"$month\"" "${CACHE_DIR}/month_config.json" 2>/dev/null)
    
    if [ "$month_info" = "null" ] || [ -z "$month_info" ]; then
        log_error "月份 $month 配置不存在，使用默认配置"
        month_name="Unknown"
        last_day="30"
        return 1
    fi
    
    # 提取月份名称
    month_name=$(echo "$month_info" | jq -r '.name')
    local name_cn=$(echo "$month_info" | jq -r '.name_cn')
    local days_config=$(echo "$month_info" | jq -r '.days')
    
    # 动态计算天数（特别是2月的闰年处理）
    if [ "$days_config" = "dynamic" ] && [ "$month" = "02" ]; then
        # 闰年判断：能被4整除但不能被100整除，或能被400整除
        if [ $((year % 4)) -eq 0 ] && [ $((year % 100)) -ne 0 ] || [ $((year % 400)) -eq 0 ]; then
            last_day="29"
            log_info "📅 ${year}年是闰年，2月有29天"
        else
            last_day="28"
            log_info "📅 ${year}年是平年，2月有28天"
        fi
    else
        last_day="$days_config"
    fi
    
    log_success "加载月份配置：${year}年${month}月（${name_cn}），共 ${last_day} 天"
    return 0
}

# ======================================
# 全局变量
# ======================================

current_year=$(date +%Y)
current_month=$(date +%m)
current_day=$(date +%d)

# 主函数
main() {
    # 记录脚本启动日志
    log_info "======================================"
    log_info "🚀 月度提醒脚本启动"
    log_info "📅 当前日期: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    # 从JSON配置加载月份信息
    load_month_config "$current_month" "$current_year"

    log_info "📅 当前日期: ${current_year}-${current_month}-${current_day}，本月共 ${last_day} 天"

    # 月初提醒
    if [ "$current_day" = "01" ]; then
        log_info "📅 触发月初提醒"

        # 计算本月工作日天数
        MONTHLY_WORKDAYS=$(calculate_monthly_workdays)
        local local_rest_days=$((last_day - MONTHLY_WORKDAYS))
        local local_workday_ratio=$(echo "scale=1; $MONTHLY_WORKDAYS * 100 / $last_day" | bc)

        # 使用模板渲染月初消息
        msg=$(get_message "monthly_start" "$MESSAGE_STYLE" \
            "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
            "month_name=${month_name}" \
            "current_year=${current_year}" \
            "current_month=${current_month}" \
            "last_day=${last_day}" \
            "monthly_workdays=${MONTHLY_WORKDAYS}" \
            "rest_days=${local_rest_days}" \
            "workday_ratio=${local_workday_ratio}"
        )

        if [ $? -ne 0 ]; then
            log_error "月初消息模板渲染失败"
        else
            log_info "📤 正在发送月初提醒消息..."
            send_wecom_message "$msg"
        fi
    fi

    # 月底提醒
    if [ "$current_day" = "$last_day" ]; then
        log_info "📅 触发月底提醒"

        # 动态计算下个月信息
        local next_month
        case "$current_month" in
            "01") next_month="${current_year}年02月" ;;
            "02") next_month="${current_year}年03月" ;;
            "03") next_month="${current_year}年04月" ;;
            "04") next_month="${current_year}年05月" ;;
            "05") next_month="${current_year}年06月" ;;
            "06") next_month="${current_year}年07月" ;;
            "07") next_month="${current_year}年08月" ;;
            "08") next_month="${current_year}年09月" ;;
            "09") next_month="${current_year}年10月" ;;
            "10") next_month="${current_year}年11月" ;;
            "11") next_month="${current_year}年12月" ;;
            "12") next_month="$((current_year + 1))年01月" ;;
            *) next_month="${current_year}年${current_month}月" ;;
        esac

        # 计算本月工作日天数
        MONTHLY_WORKDAYS=$(calculate_monthly_workdays)

        # 使用模板渲染月底消息
        msg=$(get_message "monthly_end" "$MESSAGE_STYLE" \
            "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
            "current_year=${current_year}" \
            "current_month=${current_month}" \
            "last_day=${last_day}" \
            "monthly_workdays=${MONTHLY_WORKDAYS}" \
            "next_month=${next_month}"
        )

        if [ $? -ne 0 ]; then
            log_error "月底消息模板渲染失败"
        else
            log_info "📤 正在发送月底提醒消息..."
            send_wecom_message "$msg"
        fi
    fi

    # 只在非月初和月底时显示跳过提醒的信息
    if [ "$current_day" != "01" ] && [ "$current_day" != "$last_day" ]; then
        log_info "📊 今天不是月初(1号)也不是月底(${last_day}号)，跳过月度提醒"
    fi

    log_success "脚本执行完成"
    log_info "======================================"
}

main "$@"
