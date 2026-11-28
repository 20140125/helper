#!/bin/bash
# ======================================
# 服务看护（守护进程 + Web 存活兜底）
# ======================================
#
# 功能说明：
#   1. 周期性检查提醒守护进程、年度调度器、Web 服务是否存活
#   2. 缺失则自动拉起（幂等：已在运行的服务不做任何操作）
#   3. 替代容器内不可用的 crontab 保活（本环境无 cron / systemd，
#      容器重建后守护进程不会自启，需由本脚本兜底）
#
# 使用方式：
#   bash scripts/watchdog.sh ensure   # 一次性检查拉起 + 保证常驻看护在后台（供登录钩子调用）
#   bash scripts/watchdog.sh check    # 仅一次性检查拉起，不启动常驻
#   bash scripts/watchdog.sh daemon   # 常驻循环模式（每 60 秒检查一次，内部使用）
#   bash scripts/watchdog.sh status   # 查看各项服务存活状态
#   bash scripts/watchdog.sh stop     # 停止常驻看护
#
# 作者：智能提醒系统
# 更新：2026-10-08
# ======================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 缓存数据库通道（放在 project_config.sh 之后）
source "${PROJECT_DIR}/cache_db.sh"

WATCHDOG_LOG="${PROJECT_DIR}/watchdog.log"
LOG_FILE="$WATCHDOG_LOG"
source "${PROJECT_DIR}/log_utils.sh"

PID_FILE="${PROJECT_DIR}/watchdog.pid"
# 自举节流标记改为 KV 条目（相对 .cache 的路径），运行时不再落盘
ENSURE_STAMP_KEY="watchdog_ensure.stamp"

CHECK_INTERVAL="${CHECK_INTERVAL:-60}"
ENSURE_THROTTLE="${ENSURE_THROTTLE:-60}"
WEB_PORT=9527
LAUNCHER_PORT=3001

# ======================================
# 工具函数
# ======================================

# 统计指定脚本的运行实例数
# 参数：
#   $1 - 脚本名（如 reminder_daemon.sh）
# 返回：实例数量（0 表示未运行）
count_instances() {
    local script_name="$1"
    ps -eo pid,args | grep "bash.*${script_name}" | grep -v grep | wc -l | tr -d ' '
}

# 判断指定端口是否有进程监听
# 参数：
#   $1 - 端口号
# 返回：监听中 0 | 未监听 1
is_listening() {
    local port="$1"
    lsof -ti:"${port}" >/dev/null 2>&1 && return 0
    # 回退探测：lsof 偶发取不到监听，用 TCP 连接兜底
    (exec 3<>"/dev/tcp/127.0.0.1/${port}") >/dev/null 2>&1 && return 0
    return 1
}

# ======================================
# 检查与拉起
# ======================================

# 检查提醒守护进程与年度调度器，缺失则拉起
# 参数：无
# 返回：无
check_daemons() {
    local n_reminder n_annual
    n_reminder=$(count_instances "reminder_daemon.sh")
    n_annual=$(count_instances "annual_scheduler.sh")

    if [ "$n_reminder" -eq 0 ] || [ "$n_annual" -eq 0 ]; then
        log_warning "守护进程缺失（提醒=${n_reminder} 年度=${n_annual}），正在拉起..."
        bash "${PROJECT_DIR}/daemon.sh" start >/dev/null 2>&1
        log_success "守护进程拉起完成"
    else
        log_debug "守护进程正常（提醒=${n_reminder} 年度=${n_annual}）"
    fi
}

# 检查 Web 服务与启动器，Web 缺失则拉起
# 参数：无
# 返回：无
check_web() {
    if is_listening "$WEB_PORT"; then
        log_debug "Web 服务正常（端口 ${WEB_PORT}）"
        if ! is_listening "$LAUNCHER_PORT"; then
            log_warning "Web 启动器未运行（端口 ${LAUNCHER_PORT}），Web 服务仍在，等待下次 Web 重启一并恢复"
        fi
        return 0
    fi

    log_warning "Web 服务未运行（端口 ${WEB_PORT}），正在拉起..."
    bash "${PROJECT_DIR}/start_web.sh" start >/dev/null 2>&1
    log_success "Web 服务拉起完成"
}

# 检查全部服务并拉起缺失项
# 参数：无
# 返回：无
check_all() {
    check_daemons
    check_web
}

# ======================================
# 常驻看护自身管理
# ======================================

# 判断常驻看护是否存活
# 参数：无
# 返回：存活 0 | 未运行 1
watchdog_alive() {
    local pid
    [ -f "$PID_FILE" ] || return 1
    pid=$(cat "$PID_FILE" 2>/dev/null)
    [ -n "$pid" ] || return 1
    kill -0 "$pid" 2>/dev/null
}

# 启动常驻看护（后台循环模式）
# 参数：无
# 返回：无
start_watchdog() {
    nohup bash "$0" daemon >> "$WATCHDOG_LOG" 2>&1 &
    local i
    for i in 1 2 3 4 5; do
        [ -f "$PID_FILE" ] && break
        sleep 1
    done
    log_success "常驻看护已启动（PID: $(cat "$PID_FILE" 2>/dev/null)）"
}

# 停止常驻看护
# 参数：无
# 返回：无
stop_watchdog() {
    local pid
    if [ -f "$PID_FILE" ]; then
        pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            sleep 1
            kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
        fi
        rm -f "$PID_FILE"
        log_success "常驻看护已停止"
    else
        log_info "常驻看护未运行"
    fi
}

# ======================================
# 子命令
# ======================================

# 常驻循环模式：每 CHECK_INTERVAL 秒检查一次
# 参数：无
# 返回：无
cmd_daemon() {
    local other_pids
    other_pids=$(ps -eo pid,args | grep "bash.*watchdog.sh daemon" | grep -v grep | awk '{print $1}' | grep -v "^$$\$")
    if [ -n "$other_pids" ]; then
        log_warning "⚠️  检测到其他常驻看护实例，正在清理: $(echo "$other_pids" | tr '\n' ' ')"
        for p in $other_pids; do kill "$p" 2>/dev/null; done
        sleep 2
        for p in $other_pids; do kill -0 "$p" 2>/dev/null && kill -9 "$p" 2>/dev/null; done
        sleep 1
    fi

    echo $$ > "$PID_FILE"
    trap '[ -f "$PID_FILE" ] && [ "$(cat "$PID_FILE" 2>/dev/null)" = "$$" ] && rm -f "$PID_FILE"' EXIT INT TERM

    log_info "======================================"
    log_info "🚀 服务看护启动（常驻模式）"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "🔁 检查间隔: ${CHECK_INTERVAL}s"
    log_info "======================================"

    while true; do
        check_all
        sleep "$CHECK_INTERVAL"
    done
}

# 一次性检查拉起（不起常驻），供手动执行或登录钩子调用
# 参数：无
# 返回：无
cmd_check() {
    log_info "======================================"
    log_info "🚀 服务看护启动（单次检查）"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"
    check_all
    log_success "脚本执行完成"
    log_info "======================================"
}

# 自举：检查拉起全部服务 + 保证常驻看护存活（带节流，供登录钩子调用）
# 参数：无
# 返回：无
cmd_ensure() {
    local now last
    now=$(date +%s)
    last="$(cache_db_read "$ENSURE_STAMP_KEY" 2>/dev/null)"
    [ -n "$last" ] || last=0

    if [ "$((now - last))" -lt "$ENSURE_THROTTLE" ]; then
        log_debug "自举节流命中（${ENSURE_THROTTLE}s 内已执行），跳过"
        return 0
    fi

    cache_db_write "$ENSURE_STAMP_KEY" "$now"

    log_info "======================================"
    log_info "🚀 服务看护启动（自举）"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    check_all

    if watchdog_alive; then
        log_debug "常驻看护已在运行（PID: $(cat "$PID_FILE")）"
    else
        log_warning "常驻看护未运行，正在启动..."
        start_watchdog
    fi

    log_success "脚本执行完成"
    log_info "======================================"
}

# 查看各项服务存活状态
# 参数：无
# 返回：无
cmd_status() {
    log_info "======================================"
    log_info "📊 服务看护状态"
    log_info "======================================"

    local n_reminder n_annual
    n_reminder=$(count_instances "reminder_daemon.sh")
    n_annual=$(count_instances "annual_scheduler.sh")

    if [ "$n_reminder" -gt 0 ]; then
        log_success "提醒守护进程：运行中（${n_reminder} 个实例）"
    else
        log_warning "提醒守护进程：未运行"
    fi

    if [ "$n_annual" -gt 0 ]; then
        log_success "年度调度器：运行中（${n_annual} 个实例）"
    else
        log_warning "年度调度器：未运行"
    fi

    if is_listening "$WEB_PORT"; then
        log_success "Web 服务：运行中（端口 ${WEB_PORT}）"
    else
        log_warning "Web 服务：未运行"
    fi

    if is_listening "$LAUNCHER_PORT"; then
        log_success "Web 启动器：运行中（端口 ${LAUNCHER_PORT}）"
    else
        log_warning "Web 启动器：未运行"
    fi

    if watchdog_alive; then
        log_success "常驻看护：运行中（PID: $(cat "$PID_FILE")）"
    else
        log_warning "常驻看护：未运行"
    fi

    log_info "======================================"
}

# ======================================
# 主函数
# ======================================

# 主函数：解析子命令并分发
# 参数：
#   $1 - 子命令（ensure|check|daemon|status|stop，默认 ensure）
# 返回：无
main() {
    local action="${1:-ensure}"
    # 非常驻模式：日志输出到终端，便于交互查看
    [ "$action" != "daemon" ] && LOG_FILE="/dev/stdout"
    case "$action" in
        ensure) cmd_ensure ;;
        check)  cmd_check ;;
        daemon) cmd_daemon ;;
        status) cmd_status ;;
        stop)   log_separator "服务看护停止"; stop_watchdog ;;
        *)
            log_error "未知参数: ${action}"
            log_error "用法: $0 {ensure|check|daemon|status|stop}"
            exit 1
            ;;
    esac
}

main "$@"
