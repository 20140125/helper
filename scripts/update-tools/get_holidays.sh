#!/bin/bash

# ======================================
# 获取国务院节假日数据（年度更新子工具）
# ======================================
#
# 功能说明：
#   1. 检查缓存库中是否已有匹配请求年份的数据，匹配则直接使用
#   2. 如无数据或年份不匹配，则从API获取
#   3. 支持多个备用API，提高成功率
#   4. 数据写入 holiday_data.json 对应的已有业务表（KV，运行时不落盘）
#
# 使用方式：
#   bash scripts/update-tools/get_holidays.sh <年份> [缓存 key]
#   bash scripts/update-tools/get_holidays.sh 2026 holiday_data.json
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_SELF_DIR="$SCRIPT_DIR"

# 加载项目路径配置
source "${SCRIPT_DIR}/../project_config.sh"

# 缓存数据库通道（放在 project_config.sh 之后）
source "${PROJECT_DIR}/cache_db.sh"

# 加载统一配置（包含 WECOM_WEBHOOK 等环境变量）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

# 设置日志文件（仅在直接执行且未设置 LOG_FILE 时生效）
if [ -z "$LOG_FILE" ]; then
    LOG_FILE="${_SELF_DIR}/get_holidays.log"
fi

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"
# 参数：
#   $1 - 年份
#   $2 - 缓存 key（默认 holiday_data.json）
# 返回：
#   成功：输出JSON数据并返回0
#   失败：返回1
get_holidays_api() {
    local year="$1"
    local cache_key="${2:-holiday_data.json}"

    # 首先检查缓存库里是否已有数据，且数据对应请求的年份
    local existing_data
    existing_data="$(cache_db_read "${cache_key}")" || existing_data=''
    if [ -n "$existing_data" ]; then
        log_info "📁 发现已存在的缓存条目: ${cache_key}"
        if echo "$existing_data" | grep -q '"holiday"'; then
            # 检查数据是否包含请求年份的日期（如 "01-01" 对应 year 年的日期键）
            # API 返回的 holiday 对象的 key 格式为 "MM-DD"，但 name 字段会包含年份信息
            # 更可靠的方式：检查数据中是否存在该年份的日期字符串（如 "2026-"）
            if echo "$existing_data" | grep -q "\"${year}-"; then
                log_success "缓存数据匹配年份 ${year}，直接使用"
                echo "$existing_data"
                return 0
            else
                log_warning "缓存数据不包含 ${year} 年数据，重新获取..."
            fi
        else
            log_warning "数据格式错误，重新获取..."
        fi
    fi

    log_info "🔍 获取 ${year} 年官方节假日数据..."

    # 设置User-Agent来绕过Cloudflare检测
    local user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    # API 1: timor.tech
    local result=$(curl -s --connect-timeout 10 \
        -H "User-Agent: $user_agent" \
        -H "Accept: application/json" \
        "https://timor.tech/api/holiday/year/${year}" 2>/dev/null)

    # 验证是否为有效JSON（排除HTML页面）
    if [ -n "$result" ] && ! echo "$result" | grep -qi "<!DOCTYPE\\|<html"; then
        # 进一步验证JSON结构
        if echo "$result" | grep -q '"holiday"' && echo "$result" | grep -q '"code"'; then
            log_success " 获取成功 (timor.tech)"
            # 写入缓存库
            cache_db_write "${cache_key}" "${result}"
            log_info "💾 数据已保存到: ${cache_key}"
            echo "$result"
            return 0
        fi
    fi

    log_error " API 获取失败，无法获取节假日数据"
    log_info "💡 提示: 可能遇到Cloudflare人机验证或网络限制"
    log_info "💡 解决方案："
    log_info "     1. 在浏览器中访问 https://timor.tech/api/holiday/year/${year}"
    log_info "     2. 将返回的JSON数据写入缓存 key ${cache_key}"
    log_info "     3. 重新运行此脚本"
    return 1
}

# 主函数：处理命令行参数
main() {
    if [ $# -lt 2 ]; then
        log_error "用法: $0 <年份> <缓存 key>"
        log_info "示例: $0 2026 holiday_data.json"
        exit 1
    fi

    local year="$1"
    local cache_key="$2"

    log_info "======================================"
    log_info "🚀 节假日数据获取脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "📦 处理年份: ${year}"
    log_info "======================================"

    # 调用获取函数
    if get_holidays_api "$year" "$cache_key"; then
        log_success "脚本执行完成"
        log_info "======================================"
        exit 0
    else
        log_error "节假日数据获取失败"
        log_info "======================================"
        exit 1
    fi
}

# 如果直接运行此脚本，则执行主函数
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
