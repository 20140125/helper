#!/bin/bash

# ======================================
# 年度自动更新调度器（守护进程方式）
# ======================================
#
# 功能说明：
#   1. 由于crontab不可用，使用守护进程每分钟检查是否到达执行时间
#   2. 每年12月31日 23:59 自动触发年度更新（annual_update.sh）
#   3. 每月1号和15号 00:01 执行日志清理（每15天清空一次所有日志）
#   4. 后台运行，通过 daemon.sh 统一管理
#
# 调度可配置化：
#   两个任务的日期 / 时间 / 开关与主循环节拍均可在 .env 中覆盖（见 schedule_config.sh），
#   每轮循环开头重读一次，改完不用重启：
#   SCHED_ANNUAL_POLL_SECONDS / SCHED_ANNUAL_UPDATE_{DATE,TIME} / SCHED_LOG_CLEAN_{DAYS,TIME}；
#   未配置则沿用上面的默认值，时间点留空即停用对应任务
#
# 使用方式：
#   通过 daemon.sh 启动：bash daemon.sh start
#   直接启动：nohup bash annual_scheduler.sh &
#
# 作者：智能提醒系统
# 更新：2026-04-21
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 加载统一配置（包含 TZ）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

LOG_FILE="${PROJECT_DIR}/annual_scheduler.log"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# 引入调度配置（日期 / 时间 / 开关 / 节拍统一从 .env 读，支持热更新）
source "${PROJECT_DIR}/schedule_config.sh"

# 引入日志清理模块（提供 force_clean_logs 函数）
# 注意：log_cleaner.sh 内部依赖 LOG_DIR 变量，需在 source 前定义
LOG_DIR="${PROJECT_DIR}"
source "${SCRIPT_DIR}/view_logs/log_cleaner.sh"

# 防止多实例运行
# 防止多实例运行（使用 ps -eo pid,args 检测所有同名进程，排除自身与 grep 本身）
ANNUAL_PID_FILE="${PROJECT_DIR}/annual_scheduler.pid"

other_pids=$(ps -eo pid,args | grep "bash.*annual_scheduler.sh" | grep -v grep | awk '{print $1}' | grep -v "^$$\$")
if [ -n "$other_pids" ]; then
    other_count=$(echo "$other_pids" | wc -l)
    log_warning "⚠️  检测到 ${other_count} 个其他年度调度器实例，正在清理后启动..."
    for old_pid in $other_pids; do
        kill "$old_pid" 2>/dev/null
    done
    sleep 2
    for old_pid in $other_pids; do
        if kill -0 "$old_pid" 2>/dev/null; then
            kill -9 "$old_pid" 2>/dev/null
        fi
    done
    # 等待旧进程的 EXIT trap 完全执行完毕，避免新 PID 文件被误删
    sleep 1
fi

echo $$ > "$ANNUAL_PID_FILE"

# 进程退出时清理 PID 文件（仅当文件中记录的 PID 是自身时才删除，避免新实例的 PID 文件被旧实例的 trap 误删）
trap '[ -f "$ANNUAL_PID_FILE" ] && [ "$(cat "$ANNUAL_PID_FILE" 2>/dev/null)" = "$$" ] && rm -f "$ANNUAL_PID_FILE"' EXIT INT TERM

log_info "======================================"
log_info "🚀 年度自动更新调度器启动"
log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "⏰ 年度更新: $(sched_get SCHED_ANNUAL_UPDATE_DATE 12-31) $(sched_get SCHED_ANNUAL_UPDATE_TIME 23:59)（时间点留空即停用）"
log_info "🧹 日志清理: 每月 $(sched_get SCHED_LOG_CLEAN_DAYS '01,15') 号 $(sched_get SCHED_LOG_CLEAN_TIME 00:01)（时间点留空即停用）"
log_info "======================================"

# 记录上次执行日志清理的月份，避免重复执行
last_cleanup_month=""

while true; do
    # 热更新：每轮重读 .env，改完调度配置无需重启调度器
    sched_reload

    # 获取当前日期和时间
    current_date=$(date '+%m-%d')
    current_time=$(date '+%H:%M')
    current_day=$(date '+%d')
    current_month=$(date '+%Y-%m')

    # 检查是否到日志清理的日期与时间（日期清单与时间可在 .env 配置）
    clean_days=$(sched_get SCHED_LOG_CLEAN_DAYS '01,15')
    if [ -n "${clean_days}" ] && [[ ",${clean_days}," == *",${current_day},"* ]] \
        && sched_due SCHED_LOG_CLEAN_TIME 00:01; then
        if [ "$last_cleanup_month" != "$current_month-$current_day" ]; then
            log_info "🧹 触发日志清理任务！"
            log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
            
            # 执行日志清理（清空 LOG_DIR 下所有 .log 文件，跳过自身日志）
            force_clean_logs
            
            # 记录本次已执行（月份+日期，避免同一天重复执行）
            last_cleanup_month="$current_month-$current_day"
            
            log_success "日志清理任务执行完成"
            
            # 等待2分钟，避免重复执行
            sleep 120
        fi
    fi
    
    # 检查是否到年度更新的日期与时间（可在 .env 配置）
    annual_date=$(sched_get SCHED_ANNUAL_UPDATE_DATE 12-31)
    if [ -n "${annual_date}" ] && [ "$current_date" = "${annual_date}" ] \
        && sched_due SCHED_ANNUAL_UPDATE_TIME 23:59; then
        log_info "⏰ 触发年度自动更新！"
        
        # 执行年度更新脚本
        "${PROJECT_DIR}/annual_update.sh" >> "$LOG_FILE" 2>&1
        
        log_success "年度更新执行完成"
        
        # 等待到第二天，避免重复执行
        sleep 120
    fi
    
    # 主循环节拍（可在 .env 配 SCHED_ANNUAL_POLL_SECONDS，默认 60 秒）
    poll_seconds=$(sched_get SCHED_ANNUAL_POLL_SECONDS 60)
    case "${poll_seconds}" in
        ''|*[!0-9]*) poll_seconds=60 ;;
    esac
    sleep "${poll_seconds}"
done
