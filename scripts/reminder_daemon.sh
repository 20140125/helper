#!/bin/bash

# ======================================
# 工作日提醒守护进程（带企业微信通知）
# ======================================
#
# 功能说明：
#   1. 凌晨01:00 - 预获取当天数据（天气、黄历、历史等）
#   2. 早上07:55 - 备用数据预获取（如01:00失败）
#   3. 每轮循环 - 触发到点的自定义规则（所有提醒消息都由规则发出）
#
# 推送类提醒已全部迁到自定义规则（.cache/custom_rules.json，Web「定时提醒」页配置）：
#   早安 08:00 / 节日节气 08:00 / 月度 08:00 / 假期倒计时 08:00 / 生日 09:00
#   / 午餐 12:00 / 下班 18:00 / 明日调休预告 18:00 / 每周总结 18:30
#   本进程不再直接发任何提醒消息——各脚本内部自行判断当天该不该发，
#   规则只负责「什么时间、什么条件、发给谁」
#
# 调度可配置化：
#   上面所有时间点、任务开关、主循环节拍均可在 .env 中覆盖（见 schedule_config.sh），
#   每轮循环开头重读一次，改完不用重启守护进程；
#   未配置的项沿用上面的默认值，行为与改造前完全一致。
#   配置项：SCHED_POLL_SECONDS / SCHED_WINDOW_MINUTES / SCHED_<任务>_TIME（时间点留空即停用该任务）
#
# 提醒优先级（早上8:00）：
#   优先级1：节假日祝福
#   优先级2：传统农历节日
#   优先级3：二十四节气
#   优先级4：特殊节日（情人节、妇女节、儿童节、教师节、程序员节、圣诞节）
#   优先级5：月度提醒（月初/月底）
#   优先级6：假期倒计时
#   优先级7：常规早安提醒（含调休工作日状态 + 星座 + 黄历 + 励志语录）
#
# 作者：智能提醒系统
# 更新：2026-03-23
# ======================================

# 第1步：获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 第2步：加载项目路径配置
source "${SCRIPT_DIR}/project_config.sh"

# 第3步：加载统一配置（包含 TZ 和 WECOM_WEBHOOK）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

# 第3.1步：加载节假日配置（提供 is_workday / is_last_workday_of_week 等函数，
# 周五18:30每周总结调度依赖该函数判断是否为本周最后一个工作日）
source "${PROJECT_DIR}/holiday_config.sh" 2>/dev/null

REMINDER_SCRIPT="${PROJECT_DIR}/workday_manager.sh"
WEEKLY_SCRIPT="${PROJECT_DIR}/weekly_summary.sh"
BIRTHDAY_SCRIPT="${PROJECT_DIR}/birthday_reminder.sh"
HOLIDAY_SCRIPT="${PROJECT_DIR}/festival_greetings.sh"
CUSTOM_RULES_SCRIPT="${PROJECT_DIR}/custom_rules.sh"

# 第4步：设置日志文件
LOG_FILE="${PROJECT_DIR}/reminder_daemon.log"

# 第5步：引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# 第5.1步：引入调度配置（时间点 / 开关 / 节拍统一从 .env 读，支持热更新）
source "${PROJECT_DIR}/schedule_config.sh"

# 第6步：防止多实例运行（使用 pgrep 检测所有同名进程，而不仅依赖 PID 文件）
PID_FILE="${PROJECT_DIR}/reminder_daemon.pid"

# 检查是否有其他同名进程在运行（排除自身，使用 ps+grep 避免 pgrep -f 匹配自身命令行）
other_pids=$(ps -eo pid,args | grep "bash.*reminder_daemon.sh" | grep -v grep | awk '{print $1}' | grep -v "^$$\$")
if [ -n "$other_pids" ]; then
    other_count=$(echo "$other_pids" | wc -l)
    log_warning "检测到 ${other_count} 个其他守护进程实例，正在清理后启动..."
    for old_pid in $other_pids; do
        kill "$old_pid" 2>/dev/null
    done
    sleep 2
    # 强制清理仍然存活的
    for old_pid in $other_pids; do
        if kill -0 "$old_pid" 2>/dev/null; then
            kill -9 "$old_pid" 2>/dev/null
        fi
    done
    # 等待旧进程的 EXIT trap 完全执行完毕，避免新 PID 文件被误删
    sleep 1
fi

echo $$ > "$PID_FILE"

# 进程退出时清理 PID 文件（仅当文件中记录的 PID 是自身时才删除，避免新实例的 PID 文件被旧实例的 trap 误删）
trap '[ -f "$PID_FILE" ] && [ "$(cat "$PID_FILE" 2>/dev/null)" = "$$" ] && rm -f "$PID_FILE"' EXIT INT TERM

# 记录守护进程启动
log_info "======================================"
log_info "🚀 工作日提醒守护进程启动"
log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "📌 进程PID: $$"
log_info "======================================"

# 用于记录今天是否已经发送过提醒（持久化到 JSON 文件，重启后自动恢复）
SENT_STATE_FILE="${CACHE_DIR}/daemon_sent_state.json"

# 从 JSON 状态文件恢复发送标记（防止重启后重复发送或遗漏）
_load_sent_state() {
    if [ -f "$SENT_STATE_FILE" ]; then
        eval "$(python3 -c "
import json, sys
try:
    with open('$SENT_STATE_FILE', 'r') as f:
        d = json.load(f)
    for key in ['morning', 'lunch', 'evening', 'weekly', 'birthday', 'holiday', 'prefetch']:
        val = d.get(key, '')
        print(f'{key.upper()}_SENT_DATE=\"{val}\"')
except Exception as e:
    print(f'# 状态文件读取失败: {e}', file=sys.stderr)
" 2>/dev/null)"
        log_info "📂 已从状态文件恢复发送标记: MORNING=${MORNING_SENT_DATE:-空} LUNCH=${LUNCH_SENT_DATE:-空} EVENING=${EVENING_SENT_DATE:-空} BIRTHDAY=${BIRTHDAY_SENT_DATE:-空} WEEKLY=${WEEKLY_SENT_DATE:-空} PREFETCH=${PREFETCH_SENT_DATE:-空}"
    else
        log_info "📂 状态文件不存在，所有发送标记初始化为空"
    fi
}

# 保存发送标记到 JSON 文件
_save_sent_state() {
    python3 -c "
import json
data = {
    'updated_at': '$(date '+%Y-%m-%d %H:%M:%S')',
    'morning': '${MORNING_SENT_DATE}',
    'lunch': '${LUNCH_SENT_DATE}',
    'evening': '${EVENING_SENT_DATE}',
    'weekly': '${WEEKLY_SENT_DATE}',
    'birthday': '${BIRTHDAY_SENT_DATE}',
    'holiday': '${HOLIDAY_SENT_DATE}',
    'prefetch': '${PREFETCH_SENT_DATE}'
}
with open('$SENT_STATE_FILE', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
" 2>/dev/null
}

# 初始化：先设默认值，再尝试从文件恢复
MORNING_SENT_DATE=""
LUNCH_SENT_DATE=""
EVENING_SENT_DATE=""
WEEKLY_SENT_DATE=""
BIRTHDAY_SENT_DATE=""
HOLIDAY_SENT_DATE=""
PREFETCH_SENT_DATE=""
_load_sent_state

CUSTOM_RULES_FILE="${CACHE_DIR}/custom_rules.json"

# 加载自定义规则读取工具（提供 get_matching_rule_ids、update_last_triggered_at、get_rule_name_by_id 等函数）
# shellcheck source=custom_rules/rule_reader.sh
source "${PROJECT_DIR}/custom_rules/rule_reader.sh"
RULES_FILE="$CUSTOM_RULES_FILE"

## 辅助函数：判断当前时间是否在指定小时:分钟的触发窗口内
## 使用范围判断（±2分钟）代替精确匹配，避免因任务执行耗时导致错过触发
_in_time_window() {
    # 转发到 schedule_config.sh 的公共实现：窗口分钟数可在 .env 配 SCHED_WINDOW_MINUTES
    sched_in_window "$@"
}

while true; do
    # 热更新：每轮重读 .env，改完调度配置无需重启守护进程
    sched_reload

    # 获取当前时间
    CURRENT_TIME=$(date '+%H:%M')
    CURRENT_DATE=$(date '+%Y-%m-%d')
    CURRENT_DAY=$(date '+%u')  # 1=周一, 5=周五
    
    # 凌晨数据预获取（不发送通知，只缓存数据）
    if sched_due SCHED_PREFETCH_TIME 01:00; then
        if [ "$PREFETCH_SENT_DATE" != "$CURRENT_DATE" ]; then
            if [ -f "${PROJECT_DIR}/daily_data_manager.sh" ]; then
                bash "${PROJECT_DIR}/daily_data_manager.sh" prefetch &
            fi
            PREFETCH_SENT_DATE="$CURRENT_DATE"
            _save_sent_state
        fi
    fi
    
    # 早上备用数据预获取（保险机制：如果凌晨那次失败，早上再试一次）
    if sched_due SCHED_PREFETCH_BACKUP_TIME 07:55; then
        # 检查今天的缓存是否存在
        today=$(date +%Y-%m-%d)
        cache_file="${CACHE_DIR}/daily_data_${today}.json"
        if [ ! -f "$cache_file" ]; then
            # 缓存不存在，立即预获取
            if [ -f "${PROJECT_DIR}/daily_data_manager.sh" ]; then
                bash "${PROJECT_DIR}/daily_data_manager.sh" prefetch
            fi
        fi
    fi
    
    # 推送类提醒全部交给自定义规则（custom_rules.json），本进程只负责数据与维护类任务：
    #   早安 08:00 / 节日节气 08:00 / 月度 08:00 / 假期倒计时 08:00 / 生日 09:00
    #   / 明日调休预告 18:00 / 每周总结 18:30 —— 脚本内部自行判断当天该不该发

    # 自定义规则调度：检查当前时间是否有规则需要触发（使用±2分钟窗口匹配）
    if [ -f "$CUSTOM_RULES_FILE" ]; then
        now_minutes=$(( 10#$(date '+%H') * 60 + 10#$(date '+%M') ))
        # 找出所有启用、time 在当前时间窗口内、且今天尚未触发的规则 ID
        matching_ids=$(get_matching_rule_ids "$now_minutes" "$CURRENT_DATE")

        for rule_id in $matching_ids; do
            # 先将 lastTriggeredAt 写回 JSON，防止同一分钟内重复触发
            update_last_triggered_at "$rule_id"
            rule_name=$(get_rule_name_by_id "$rule_id")
            log_info "⏰ 自定义规则触发: ${rule_name:-$rule_id} @ ${CURRENT_TIME}"
            bash "$CUSTOM_RULES_SCRIPT" run_one "$rule_id" &
        done
    fi

    # 主循环节拍（可在 .env 配 SCHED_POLL_SECONDS，默认 30 秒）
    poll_seconds=$(sched_get SCHED_POLL_SECONDS 30)
    case "${poll_seconds}" in
        ''|*[!0-9]*) poll_seconds=30 ;;
    esac
    sleep "${poll_seconds}"
done
