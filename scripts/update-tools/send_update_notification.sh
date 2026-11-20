#!/bin/bash

# ======================================
# 发送更新完成通知（年度更新子工具）
# ======================================
#
# 功能说明：
#   1. 生成更新报告（Markdown格式）
#   2. 发送到企业微信群（如已配置Webhook）
#   3. 输出详细的更新摘要到日志
#   4. 适用所有引入本系统的公司，通过配置公司特别假政策即可使用
#
# 使用方式：
#   bash scripts/update-tools/send_update_notification.sh <年份> <节假日状态> <公司特别假> <月份状态> <webhook_url>
#   bash scripts/update-tools/send_update_notification.sh 2026 "✅ 成功" "" "✅ 成功" "https://..."
#
# 作者：智能提醒系统
# 更新：2026-03-10
# ======================================

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_SELF_DIR="$SCRIPT_DIR"

# 加载项目路径配置
source "${SCRIPT_DIR}/../project_config.sh"

# 加载统一配置（包含 WECOM_WEBHOOK 等环境变量）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

# 设置日志文件
if [ -z "$LOG_FILE" ]; then
    LOG_FILE="${_SELF_DIR}/send_update_notification.log"
fi

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# 引入模板工具
source "${PROJECT_DIR}/template_utils.sh"
# 参数：
#   $1 - 年份
#   $2 - 节假日配置状态
#   $3 - 特别假日期（可选）
#   $4 - 月份配置状态
#   $5 - 企业微信Webhook URL（可选）
# 返回：
#   成功：返回0
#   失败：返回1
send_update_notification() {
    local year="$1"
    local holiday_status="$2"
    local special_holiday="$3"
    local month_status="$4"

    log_info "📊 生成 ${year} 年更新报告..."

    # 构建特别假详情
    local special_holiday_detail
    if [ -n "$special_holiday" ]; then
        special_holiday_detail="   - 日期：${special_holiday}\n   - 比国务院提前1天放假"
    else
        special_holiday_detail="   - 待国务院发布通知"
    fi

    # 使用模板渲染报告
    local report
    report=$(get_message "update_report" "${MESSAGE_STYLE:-default}" \
        "year=${year}" \
        "date_time=$(date '+%Y年%m月%d日 %H:%M:%S')" \
        "holiday_status=${holiday_status:-未执行}" \
        "special_holiday_detail=${special_holiday_detail}" \
        "month_status=${month_status:-未执行}"
    )

    if [ $? -ne 0 ] || [ -z "$report" ]; then
        log_error "模板渲染失败"
        return 1
    fi
    
    # 输出报告到日志
    log_info ""
    log_info "======================================"
    log_info "📊 更新报告摘要"
    log_info "======================================"
    log_info "1. 节假日配置: ${holiday_status:-未执行}"
    log_info "2. 公司特别假: $([ -n "$special_holiday" ] && echo "$special_holiday" || echo "待确认")"
    log_info "3. 月份配置更新: ${month_status:-未执行}"
    log_info "======================================"
    
    # 发送企业微信通知
    log_info "📤 发送企业微信通知..."
    send_wecom_message "$report"

    return 0
}

# 主函数：处理命令行参数
main() {
    if [ $# -lt 4 ]; then
        log_error "用法: $0 <年份> <节假日状态> <特别假日期> <月份状态>"
        log_info "示例: $0 2026 '✅ 成功' '2026-01-31' '✅ 成功'"
        log_info "示例: $0 2026 '❌ 失败' '' '✅ 成功'"
        exit 1
    fi

    local year="$1"
    local holiday_status="$2"
    local special_holiday="$3"
    local month_status="$4"

    log_info "======================================"
    log_info "🚀 年度数据更新通知脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    # 调用发送通知函数
    if send_update_notification "$year" "$holiday_status" "$special_holiday" "$month_status"; then
        log_success "脚本执行完成"
        log_info "======================================"
        exit 0
    else
        log_error "更新通知发送失败"
        log_info "======================================"
        exit 1
    fi
}

# 如果直接运行此脚本，则执行主函数
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi