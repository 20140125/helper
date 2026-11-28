#!/bin/bash

# ======================================
# 更新月份配置数据（年度更新子工具）
# ======================================
#
# 功能说明：
#   1. 生成月份配置JSON，包含月份名称和天数
#   2. 动态计算闰年2月天数（28天或29天）
#   3. 数据写入 month_config.json 对应的已有业务表（KV，运行时不落盘）
#   4. 支持中英文月份名称和描述信息
#
# 使用方式：
#   bash scripts/update-tools/update_month_config.sh <年份> [缓存 key]
#   bash scripts/update-tools/update_month_config.sh 2026
#   bash scripts/update-tools/update_month_config.sh 2026 month_config.json
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

# 加载统一配置（包含环境变量）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

# 设置日志文件（仅在直接执行且未设置LOG_FILE时生效）
if [ -z "$LOG_FILE" ]; then
    LOG_FILE="${_SELF_DIR}/update_month_config.log"
fi

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"
# 参数：
#   $1 - 年份
#   $2 - 缓存 key（可选，默认：month_config.json）
# 返回：
#   成功：返回0
#   失败：返回1
update_month_config() {
    local year="$1"
    local cache_key="${2:-month_config.json}"

    log_info "📅 生成 ${year} 年月份配置..."

    # 判断是否为闰年
    is_leap_year() {
        local year=$1
        if [ $((year % 4)) -eq 0 ] && [ $((year % 100)) -ne 0 ] || [ $((year % 400)) -eq 0 ]; then
            echo "true"
        else
            echo "false"
        fi
    }

    # 判断当前年份是否为闰年
    local leap_year_status=$(is_leap_year "$year")
    if [ "$leap_year_status" = "true" ]; then
        log_info "🎉 ${year} 年是闰年，2月将有29天"
        local feb_days=29
    else
        log_info "📊 ${year} 年是平年，2月有28天"
        local feb_days=28
    fi

    # 生成月份配置 JSON（内容不变，只是不再落盘）
    local month_json
    month_json="$(cat << EOF
{
  "months": {
    "01": {
      "name": "January",
      "name_cn": "一月",
      "days": 31,
      "description": "新年伊始，充满希望"
    },
    "02": {
      "name": "February",
      "name_cn": "二月",
      "days": "$feb_days",
      "description": "春回大地，万物复苏",
      "leap_year_rule": "能被4整除但不能被100整除，或能被400整除的年份为闰年，2月有29天，否则28天",
      "is_leap_year": $leap_year_status
    },
    "03": {
      "name": "March",
      "name_cn": "三月",
      "days": 31,
      "description": "春暖花开，生机勃勃"
    },
    "04": {
      "name": "April",
      "name_cn": "四月",
      "days": 30,
      "description": "清明时节，雨纷纷"
    },
    "05": {
      "name": "May",
      "name_cn": "五月",
      "days": 31,
      "description": "劳动光荣，青春飞扬"
    },
    "06": {
      "name": "June",
      "name_cn": "六月",
      "days": 30,
      "description": "仲夏时节，热情似火"
    },
    "07": {
      "name": "July",
      "name_cn": "七月",
      "days": 31,
      "description": "盛夏酷暑，砥砺前行"
    },
    "08": {
      "name": "August",
      "name_cn": "八月",
      "days": 31,
      "description": "秋高气爽，收获在望"
    },
    "09": {
      "name": "September",
      "name_cn": "九月",
      "days": 30,
      "description": "金秋时节，硕果累累"
    },
    "10": {
      "name": "October",
      "name_cn": "十月",
      "days": 31,
      "description": "国庆佳节，举国欢庆"
    },
    "11": {
      "name": "November",
      "name_cn": "十一月",
      "days": 30,
      "description": "冬日将至，蓄势待发"
    },
    "12": {
      "name": "December",
      "name_cn": "十二月",
      "days": 31,
      "description": "岁末年终，总结展望"
    }
  },
  "config": {
    "version": "1.0",
    "last_updated": "$(date +%Y-%m-%d)",
    "current_year": "$year",
    "is_leap_year": $leap_year_status,
    "description": "月份配置信息，已根据${year}年闰年状态更新2月天数"
  }
}
EOF
)"

    # 写入缓存库并校验结果
    if cache_db_write "${cache_key}" "${month_json}"; then
        log_success "月份配置生成成功"
        log_info "📁 已保存到: ${cache_key}"

        # 显示配置摘要
        log_info "=== 月份配置摘要 ==="
        log_info "年份: $year"
        log_info "闰年状态: $leap_year_status"
        log_info "2月天数: $feb_days"
        log_info "更新时间: $(date)"
        log_info "======================================"

        return 0
    else
        log_error "月份配置写入失败"
        return 1
    fi
}

# 主函数：处理命令行参数
main() {
    if [ $# -lt 1 ]; then
        log_error "用法: $0 <年份> [缓存 key]"
        log_info "示例: $0 2026"
        log_info "示例: $0 2026 month_config.json"
        exit 1
    fi

    local year="$1"
    local cache_key="${2:-}"

    log_info "======================================"
    log_info "🚀 月份配置更新脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "📦 目标年份: ${year}"
    log_info "======================================"

    # 调用更新配置函数
    if update_month_config "$year" "$cache_key"; then
        log_success "脚本执行完成"
        log_info "======================================"
        exit 0
    else
        log_error "月份配置更新失败"
        log_info "======================================"
        exit 1
    fi
}

# 如果直接运行此脚本，则执行主函数
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
