#!/bin/bash

# ======================================
# 工作日提醒管理脚本
# ======================================
# 
# 功能说明：
#   1. 调休上班提醒 - 提前一天预告（由晚上18:00统一触发；当天状态并入早安提醒）
#   2. 工作日早安提醒 - 含天气、星座、黄历、历史、励志
#   3. 工作日午餐提醒 - 营养建议
#   4. 工作日下班提醒 - 励志语录
#   5. 自动识别节假日和调休日
# 
# 子命令：
#   adjust        - 调休上班提醒（仅提前一天预告，建议 18:00 触发）
#   morning      - 工作日早安提醒
#   lunch        - 工作日午餐提醒
#   evening      - 工作日下班提醒
#   auto         - 根据当前时间自动选择执行
# 
# 数据来源：
#   - 节假日配置：holiday_config.sh
#   - 寄语配置：.cache/reminder_quotes.json（workday_adjust 分类）
#   - 数据缓存：daily_data_manager.sh（早安数据）
#   - 消息模板：template_utils.sh
# 
# 模块拆分：
#   workday_manager/adjust.sh         - 调休上班提醒
#   workday_manager/workday_check.sh  - 工作日判断逻辑
#   workday_manager/morning.sh        - 早安提醒
#   workday_manager/lunch.sh          - 午餐提醒
#   workday_manager/evening.sh        - 下班提醒
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

# 加载节假日配置（提供 is_adjust_workday / is_holiday / is_workday 函数）
source "${PROJECT_DIR}/holiday_config.sh" 2>/dev/null

# 日志文件配置
LOG_FILE="${PROJECT_DIR}/workday_manager.log"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# 加载消息模板工具
source "${PROJECT_DIR}/template_utils.sh" 2>/dev/null

# ======================================
# 全局变量
# ======================================

current_date=$(date '+%Y-%m-%d')
tomorrow=$(pc_date_add_days "$current_date" 1)
day_of_week=$(date '+%u')  # 1-7 (周一到周日)
tomorrow_week=$(pc_date_weekday "$tomorrow")
WEEK_DAY=$(date '+%A' | sed 's/Monday/周一/;s/Tuesday/周二/;s/Wednesday/周三/;s/Thursday/周四/;s/Friday/周五/;s/Saturday/周六/;s/Sunday/周日/')

# ======================================
# 加载子模块
# ======================================

source "${SCRIPT_DIR}/workday_manager/workday_check.sh"
source "${SCRIPT_DIR}/workday_manager/adjust.sh"
source "${SCRIPT_DIR}/workday_manager/morning.sh"
source "${SCRIPT_DIR}/workday_manager/lunch.sh"
source "${SCRIPT_DIR}/workday_manager/evening.sh"

# ======================================
# 主入口：子命令路由
# ======================================

log_info "======================================"
log_info "🚀 工作日管理器启动 (${1:-auto})"
log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "======================================"

case "${1:-}" in
    adjust|check)
        cmd_adjust "tomorrow"
        ;;
    morning)
        cmd_morning
        ;;
    lunch)
        cmd_lunch
        ;;
    evening)
        cmd_evening
        ;;
    auto)
        # 根据当前时间自动判断执行哪个子命令
        #   00:00 ~ 10:59 → morning（工作日早安）
        #   11:00 ~ 14:59 → lunch（工作日午餐）
        #   15:00 ~ 23:59 → evening（工作日下班）
        current_hour=$(date '+%H' | sed 's/^0//')
        if [ "$current_hour" -lt 11 ]; then
            exec "$0" morning
        elif [ "$current_hour" -lt 15 ]; then
            exec "$0" lunch
        else
            exec "$0" evening
        fi
        ;;
    *)
        log_error "未知参数: ${1:-}"
        log_error "用法: $0 {adjust|morning|lunch|evening|auto}"
        log_info "  adjust   - 调休上班提醒（提前一天预告明天是否补班）"
        log_info "  morning  - 调休检查 + 工作日早安提醒"
        log_info "  lunch    - 工作日午餐提醒"
        log_info "  evening  - 工作日下班提醒"
        log_info "  auto     - 根据当前时间自动选择执行"
        exit 1
        ;;
esac