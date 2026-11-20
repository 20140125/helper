#!/bin/bash

# ======================================
# 真实星座运势获取脚本
# ======================================
#
# 功能说明：
#   1. 调用聚合数据API获取星座运势（免费 key 支持 today/tomorrow/week/month/year 共 5 档）
#   2. 自动判断当前日期对应的星座（基于出生日期）
#   3. 返回综合、爱情、事业、财运、健康等多维度运势
#   4. 原始 API 响应归档到 .cache/api_responses/（一月一文件）
#
# 数据来源：
#   - 聚合数据星座运势API  http://web.juhe.cn/constellation/getAll
#   - API密钥：.env 中的 JUHE_HOROSCOPE_KEY
#
# 使用方式：
#   bash fetch_real_horoscope.sh                            # 今日（默认）
#   bash fetch_real_horoscope.sh show 水瓶座                 # 今日指定星座
#   bash fetch_real_horoscope.sh show 水瓶座 tomorrow        # 明日
#   bash fetch_real_horoscope.sh show 水瓶座 week            # 本周
#   bash fetch_real_horoscope.sh show 水瓶座 month           # 本月
#   bash fetch_real_horoscope.sh show 水瓶座 year            # 今年
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
LOG_FILE="${PROJECT_DIR}/fetch_real_horoscope.log"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# 引入原始 API 响应归档公共库（归档 + 日内复用）
source "${PROJECT_DIR}/api_archive.sh"

# 自动判断当前日期的星座
if [ -f "${PROJECT_DIR}/get_zodiac_sign.sh" ]; then
    DEFAULT_ZODIAC=$(bash "${PROJECT_DIR}/get_zodiac_sign.sh" 2>/dev/null)
else
    DEFAULT_ZODIAC="水瓶座"
fi

# 星座配置（如果未配置则使用自动判断的星座）
ZODIAC_SIGN="${ZODIAC_SIGN:-$DEFAULT_ZODIAC}"

# 聚合数据API配置
JUHE_API_KEY="${JUHE_HOROSCOPE_KEY:-}"  # 在 .env 中配置 JUHE_HOROSCOPE_KEY

# ======================================
# 加载子模块（规范：主脚本+同名子目录）
# ======================================
source "${SCRIPT_DIR}/fetch_real_horoscope/renderer.sh"
source "${SCRIPT_DIR}/fetch_real_horoscope/fetcher.sh"

# 主入口
# 用法:
#   bash fetch_real_horoscope.sh                      # 默认星座今日运势
#   bash fetch_real_horoscope.sh show 天秤座           # 指定星座今日运势
#   bash fetch_real_horoscope.sh show 天秤座 week     # 指定星座本周运势
#   bash fetch_real_horoscope.sh show 天秤座 month    # 指定星座本月运势
#   bash fetch_real_horoscope.sh show 天秤座 year     # 指定星座今年运势
#   bash fetch_real_horoscope.sh show 天秤座 tomorrow # 指定星座明日运势
main() {
    log_info "======================================"
    log_info "🚀 真实星座运势获取脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local action="${1:-show}"
    local zodiac_arg="${2:-$ZODIAC_SIGN}"
    local type_arg="${3:-today}"
    log_info "🎯 动作: ${action}, 星座: ${zodiac_arg}, 周期: ${type_arg}（默认星座: ${DEFAULT_ZODIAC}）"

    case "$action" in
        show|message)
            if get_real_horoscope "$zodiac_arg" "$type_arg"; then
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
            log_error "用法: $0 {show|message} [星座名] [today|tomorrow|week|month|year]"
            log_info "======================================"
            exit 1
            ;;
    esac
}

main "$@"
