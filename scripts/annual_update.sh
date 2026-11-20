#!/bin/bash

# ======================================
# 年度自动更新脚本（增强版）
# ======================================
# 
# 功能说明：
#   1. 获取国务院节假日数据并保存到本地JSON文件
#   2. 生成公司定制版节假日配置文件（自动识别春节前调休日应用公司特别假政策）
#   3. 更新月份配置数据（动态计算闰年2月天数）
#   4. 发送企业微信更新通知
#
# 已无需年度更新的模块（运行时动态计算）：
#   - 24节气：使用 date_utils.py solar_term 天文算法
#   - 农历节日：使用 date_utils.py 本地工具动态转换
# 
# 数据存储：
#   - 节假日数据：.cache/holiday_data.json（每年覆盖）
#   - 月份配置：.cache/month_config.json（每年覆盖）
#   - 节假日配置：holiday_config.sh（追加新年份数据）
# 
# 注意事项：
#   - 农历生日无需年度更新（使用 lunar:MM-DD 格式永久有效）
#   - 建议每年12月运行，为下一年准备数据
#   - 如遇API失败，可手动保存JSON数据后重新运行
# 
# 作者：智能提醒系统
# 更新：2026-03-23
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 加载统一配置（包含 TZ 和 WECOM_WEBHOOK）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

# 日志文件
LOG_FILE="${PROJECT_DIR}/annual_update.log"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

log_info "======================================"
log_info "🚀 年度自动更新开始（增强版）"
log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "======================================"

# 获取当前年份和下一年
CURRENT_YEAR=$(date '+%Y')
NEXT_YEAR=$((CURRENT_YEAR + 1))

log_info "📅 当前年份: ${CURRENT_YEAR}"
log_info "📅 目标年份: ${NEXT_YEAR}"
log_info "🏢 放假标准: 公司员工福利政策"

# ======================================
# 功能1: 获取国务院节假日数据
# ======================================
# 说明：
#   - 调用独立工具文件获取节假日数据
#   - 优先使用已存在的本地JSON文件
#   - 如无本地文件，则从API获取
#   - 支持多个备用API，提高成功率
#   - 数据保存到 .cache/holiday_data.json
# ======================================

log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "【1️⃣  获取国务院节假日基础数据】"
log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 节假日数据文件路径（不带年份，每年覆盖最新数据）
HOLIDAY_JSON_FILE="${CACHE_DIR}/holiday_data.json"

# 调用独立工具文件获取节假日数据
log_info "🔧 调用独立工具获取节假日数据..."
if "${PROJECT_DIR}/update-tools/get_holidays.sh" "$NEXT_YEAR" "$HOLIDAY_JSON_FILE"; then
    holiday_api_data="$(cat /tmp/holiday_api_data.txt 2>/dev/null)"
    if [ -n "$holiday_api_data" ]; then
        holiday_data_status="成功"
        log_success "节假日数据获取成功"
    else
        holiday_data_status="数据为空"
        log_error "获取的节假日数据为空"
    fi
else
    holiday_data_status="获取失败"
    log_error "节假日数据获取失败"
fi

log_info "📊 节假日数据获取状态: $holiday_data_status"

# ======================================
# 功能2: 生成公司定制版节假日配置文件
# ======================================
# 说明：
#   - 调用独立工具文件生成节假日配置
#   - 解析JSON数据，提取节假日和调休日
#   - 自动识别春节前调休日并应用公司特别假政策
#   - 生成 holiday_config.sh 配置文件
#   - 如该年份数据已存在，则跳过更新
# ======================================

log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "【2️⃣  生成公司节假日配置文件】"
log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 调用独立工具文件生成节假日配置（自动识别公司特别假）
log_info "🔧 调用独立工具生成节假日配置..."
if "${PROJECT_DIR}/update-tools/generate_holiday_config.sh" "$NEXT_YEAR" "$HOLIDAY_JSON_FILE"; then
    holiday_config_status="成功"
    log_success "节假日配置生成成功"
else
    holiday_config_status="生成失败"
    log_error "节假日配置生成失败"
fi

log_info ""
log_success "节假日配置生成完成（状态: $holiday_config_status）"


# ======================================
# 功能3: 更新月份配置数据
# ======================================
# 说明：
#   - 调用独立工具文件更新月份配置数据
#   - 动态计算闰年2月天数
#   - 生成月份配置JSON文件
#   - 包含月份中英文名称、天数、描述
#   - 数据保存到 .cache/month_config.json
# ======================================

log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "【3️⃣  更新月份配置数据】"
log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 调用独立工具文件更新月份配置数据
log_info "🔧 调用独立工具更新月份配置数据..."
if "${PROJECT_DIR}/update-tools/update_month_config.sh" "$NEXT_YEAR"; then
    month_config_status="成功"
    log_success "月份配置数据更新成功"
else
    month_config_status="生成失败"
    log_error "月份配置数据更新失败"
fi

log_info ""
log_success "月份配置更新完成（状态: $month_config_status）"


# ======================================
# 功能4: 发送更新通知
# ======================================
# 说明：
#   - 调用独立工具文件发送更新通知
#   - 生成更新报告（Markdown格式）
#   - 发送到企业微信群（如已配置Webhook）
#   - 输出详细的更新摘要到日志
# ======================================

log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_info "【4️⃣  发送更新通知】"
log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 调用独立工具文件发送更新通知
log_info "🔧 调用独立工具发送更新通知..."
if "${PROJECT_DIR}/update-tools/send_update_notification.sh" "$NEXT_YEAR" "$holiday_config_status" "" "$month_config_status" "$WECOM_WEBHOOK"; then
    log_success "更新通知发送成功"
else
    log_warning "更新通知发送失败或未配置Webhook"
fi

# ======================================
# 脚本执行总结
# ======================================

log_info ""
log_success "年度自动更新完成"
log_info "======================================"
log_info "📅 目标年份: ${NEXT_YEAR}"
log_info "⏱️  执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "📝 日志文件: $LOG_FILE"
log_info ""
log_info "💡 提示："
log_info "   - 请检查各配置文件是否正确更新"
log_info "   - 如有API失败，请手动补充数据"
log_info "   - 建议在年初再次运行以获取最新数据"
log_info "======================================"

# ======================================
# 清理备份文件
# ======================================

log_info ""
log_info "🧹 清理临时备份文件..."

# 删除所有 holiday_config.sh.backup.* 备份文件
backup_files=$(find "${PROJECT_DIR}" -maxdepth 1 -name "holiday_config.sh.backup.*" 2>/dev/null)

if [ -n "$backup_files" ]; then
    backup_count=$(echo "$backup_files" | wc -l)
    log_info "  🗑️  发现 $backup_count 个备份文件，正在删除..."
    
    echo "$backup_files" | while read -r backup_file; do
        if [ -f "$backup_file" ]; then
            rm -f "$backup_file"
            log_info "     已删除: $(basename "$backup_file")"
        fi
    done
    
    log_success "备份文件清理完成"
else
    log_info "  没有发现备份文件"
fi

exit 0
