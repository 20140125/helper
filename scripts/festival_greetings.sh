#!/bin/bash

# ======================================
# 统一节日祝福脚本
# ======================================
# 
# 功能说明：
#   1. 节假日祝福
#   2. 传统农历节日提醒
#   3. 二十四节气提醒
#   4. 特殊节日提醒（情人节、妇女节等）
# 
# 子命令：
#   holiday      - 节假日祝福（检查今天和明天）
#   lunar        - 传统农历节日提醒
#   solar_term   - 二十四节气提醒
#   special      - 特殊节日提醒（情人节、妇女节等）
#   list_lunar   - 列出当年所有农历节日
#   all          - 依次执行所有检查（默认）
# 
# 数据来源：
#   - 节假日配置：holiday_config.sh
#   - 祝福语配置：.cache/greetings.json（各分类）
#   - 祝福语加载器：greetings_loader.sh
#   - 消息模板：.cache/message_templates.json
#   - 模板工具：template_utils.sh
#   - 节气/农历计算：date_utils.py
# 
# 模块拆分：
#   festival_greetings/holiday.sh      - 节假日祝福
#   festival_greetings/lunar.sh        - 传统农历节日提醒
#   festival_greetings/solar_term.sh   - 二十四节气提醒
#   festival_greetings/special.sh      - 特殊节日提醒
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# ======================================
# 加载配置文件
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 加载统一配置（包含 TZ 和 WECOM_WEBHOOK）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

# 日志文件
LOG_FILE="${PROJECT_DIR}/festival_greetings.log"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# 加载统一的祝福语加载器
source "${PROJECT_DIR}/greetings_loader.sh" 2>/dev/null

# 加载消息模板工具
source "${PROJECT_DIR}/template_utils.sh" 2>/dev/null

# ======================================
# 全局变量
# ======================================

TODAY=$(date '+%Y-%m-%d')
TODAY_MD=$(date '+%m-%d')
TOMORROW=$(pc_date_shift 1 '%Y-%m-%d')
TOMORROW_MD=$(pc_date_shift 1 '%m-%d')
CURRENT_YEAR=$(date '+%Y')

# ======================================
# 加载子模块
# ======================================

source "${SCRIPT_DIR}/festival_greetings/holiday.sh"
source "${SCRIPT_DIR}/festival_greetings/lunar.sh"
source "${SCRIPT_DIR}/festival_greetings/solar_term.sh"
source "${SCRIPT_DIR}/festival_greetings/special.sh"

# ======================================
# 主入口：子命令路由
# ======================================

log_info "======================================"
log_info "🚀 节日祝福脚本启动 (${1:-all})"
log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "======================================"

case "${1:-all}" in
    holiday|check)
        cmd_holiday
        ;;
    lunar)
        cmd_lunar
        ;;
    solar_term|solar)
        cmd_solar_term
        ;;
    special)
        cmd_special
        ;;
    list_lunar|list)
        cmd_list_lunar
        ;;
    all)
        # 依次执行所有检查（供 reminder_daemon.sh 一次性调用）
        cmd_holiday
        sleep 1
        cmd_lunar
        sleep 1
        cmd_solar_term
        sleep 1
        cmd_special
        ;;
    *)
        log_error "未知参数: ${1:-}"
        log_error "用法: $0 {holiday|lunar|solar_term|special|list_lunar|all}"
        log_info "  holiday     - 节假日祝福（检查今天和明天）"
        log_info "  lunar       - 传统农历节日提醒"
        log_info "  solar_term  - 二十四节气提醒"
        log_info "  special     - 特殊节日提醒（情人节、妇女节等）"
        log_info "  list_lunar  - 列出当年所有农历节日"
        log_info "  all         - 依次执行所有检查（默认）"
        exit 1
        ;;
esac