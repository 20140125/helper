#!/bin/bash

# ======================================
# 每日数据管理脚本
# ======================================
#
# 功能说明：
#   1. 凌晨预获取所有数据并缓存
#   2. 按类型读取缓存数据
#   3. 组装早安数据
#
# 子命令：
#   prefetch             - 预获取今天的所有数据并缓存
#   read <type>          - 读取指定类型的缓存数据
#   assemble             - 组装早安数据到全局变量（需 source 使用）
#   markdown             - 输出完整的早安数据 Markdown
#
# 支持的数据类型（read 子命令）：
#   weather             - 天气数据
#   history             - 历史上的今天
#   almanac             - 黄历信息
#   horoscope           - 星座运势
#   inspirational_quote - 每日励志语录
#
# 数据来源：
#   - 天气：聚合数据天气API（fetch_real_weather.sh）
#   - 黄历：聚合数据老黄历API（fetch_real_almanac.sh）
#   - 星座：聚合数据星座API（fetch_real_horoscope.sh）
#   - 历史：维基百科API（history_today.sh）
#   - 励志语录：reminder_quotes.json 对应的已有业务表（quotes 分类）
#
# 模块拆分：
#   daily_data_manager/prefetch.sh          - 数据预获取
#   daily_data_manager/cache_reader.sh      - 缓存数据读取
#   daily_data_manager/morning_assembler.sh - 早安数据组装
#
# 使用方式：
#   bash daily_data_manager.sh prefetch          # 预获取今天的数据
#   bash daily_data_manager.sh read weather      # 读取天气缓存
#   source daily_data_manager.sh                 # 加载函数库
#   get_morning_data                             # 获取早安数据
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"
# 按需加载缓存数据库通道（每日数据不再落盘）
source "${PROJECT_DIR}/cache_db.sh"

# 加载统一配置（包含 TZ 和 API Keys）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null || true

# 缓存键（按日期命名）
TODAY=$(date +%Y-%m-%d)
CACHE_KEY="daily_data_${TODAY}.json"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# ======================================
# 加载子模块
# ======================================

source "${SCRIPT_DIR}/daily_data_manager/cache_reader.sh"
source "${SCRIPT_DIR}/daily_data_manager/morning_assembler.sh"
source "${SCRIPT_DIR}/daily_data_manager/prefetch.sh"

# ======================================
# 主入口：子命令路由
# ======================================

# 如果被 source 引入而非直接执行，则不进入子命令路由
# 这样 get_morning_data 和 generate_morning_data_markdown 可以作为函数库使用
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    log_info "======================================"
    log_info "🚀 每日数据管理器启动 (${1:-help})"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"
    case "${1:-}" in
        prefetch)
            cmd_prefetch
            ;;
        read)
            cmd_read "$2"
            ;;
        markdown)
            get_morning_data
            generate_morning_data_markdown
            ;;
        *)
            echo "用法: $0 {prefetch|read <type>|markdown}"
            echo ""
            echo "  prefetch           - 预获取今天的所有数据并缓存"
            echo "  read <type>        - 读取指定类型的缓存数据"
            echo "    types: weather, history, almanac, horoscope, inspirational_quote"
            echo "  markdown           - 输出完整的早安数据 Markdown"
            echo ""
            echo "作为函数库 source 使用："
            echo "  source $0"
            echo "  get_morning_data           # 获取数据到全局变量"
            echo "  generate_morning_data_markdown  # 输出 Markdown"
            exit 1
            ;;
    esac
fi