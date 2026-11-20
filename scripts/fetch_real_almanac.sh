#!/bin/bash

# ======================================
# 真实黄历获取脚本
# ======================================
#
# 功能说明：
#   1. 调用聚合数据老黄历API获取当日黄历信息（宜忌/五行/吉凶神）
#   2. 调用聚合数据万年历【当日】API 获取阳历+农历+节日（calendar_day）
#   3. 调用聚合数据万年历【当月】API 批量获取整月阳农对照（calendar_month）
#   4. 原始 JSON 归档到 .cache/api_responses/（一月一文件）
#
# 数据来源：
#   - 聚合数据老黄历API
#   - API密钥：.env 中的 JUHE_ALMANAC_KEY
#
# 使用方式：
#   bash fetch_real_almanac.sh                           # 今天的黄历（老黄历）
#   bash fetch_real_almanac.sh show                      # 同上
#   bash fetch_real_almanac.sh show 2026-03-10           # 指定日期黄历
#   bash fetch_real_almanac.sh calendar_day              # 今日万年历（阳历+农历+节日）
#   bash fetch_real_almanac.sh calendar_day 2026-03-10   # 指定日期万年历
#   bash fetch_real_almanac.sh calendar_month            # 本月整月万年历
#   bash fetch_real_almanac.sh calendar_month 2026-03    # 指定月份整月万年历
#
# 作者：智能提醒系统
# 更新：2026-05-09
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 加载统一配置（包含 TZ 和 API Keys）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null || true

# 日志文件配置
LOG_FILE="${PROJECT_DIR}/fetch_real_almanac.log"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# 引入原始 API 响应归档公共库（归档 + 日内复用）
source "${PROJECT_DIR}/api_archive.sh"

# 聚合数据API配置
JUHE_API_KEY="${JUHE_ALMANAC_KEY:-}"

# ======================================
# 加载子模块（规范：主脚本+同名子目录）
# ======================================
source "${SCRIPT_DIR}/fetch_real_almanac/main_api.sh"
source "${SCRIPT_DIR}/fetch_real_almanac/calendar_day.sh"
source "${SCRIPT_DIR}/fetch_real_almanac/calendar_month.sh"

# 主入口
main() {
    log_info "======================================"
    log_info "🚀 真实黄历获取脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local action="${1:-show}"
    local date_arg="${2:-}"
    log_info "🎯 动作: ${action}, 日期参数: ${date_arg:-<默认>}"

    case "$action" in
        show|message)
            local target="${date_arg:-$(date +%Y%m%d)}"
            if get_real_almanac "$target"; then
                log_success "脚本执行完成"
                log_info "======================================"
                exit 0
            else
                log_error "脚本执行失败"
                log_info "======================================"
                exit 1
            fi
            ;;
        calendar_day)
            if get_calendar_day "$date_arg"; then
                log_success "脚本执行完成"
                log_info "======================================"
                exit 0
            else
                log_error "脚本执行失败"
                log_info "======================================"
                exit 1
            fi
            ;;
        calendar_month)
            if get_calendar_month "$date_arg"; then
                log_success "脚本执行完成"
                log_info "======================================"
                exit 0
            else
                log_error "脚本执行失败"
                log_info "======================================"
                exit 1
            fi
            ;;
        *)
            log_error "用法: $0 {show|message|calendar_day|calendar_month} [日期|月份]"
            log_info "======================================"
            exit 1
            ;;
    esac
}

main "$@"
