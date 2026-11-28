#!/bin/bash

# ======================================
# 守护进程管理脚本
# ======================================
#
# 功能说明：
#   统一管理守护进程和年度调度器的启动、停止、重启和状态查询
#
# 用法：
#   bash daemon.sh start    # 启动守护进程和年度调度器
#   bash daemon.sh stop     # 停止守护进程和年度调度器
#   bash daemon.sh restart  # 重启守护进程和年度调度器
#   bash daemon.sh status   # 查看运行状态
#
# 作者：智能提醒系统
# 更新：2026-03-10
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

DAEMON_SCRIPT="${SCRIPT_DIR}/reminder_daemon.sh"
PID_FILE="${SCRIPT_DIR}/reminder_daemon.pid"
# LOG_FILE 仅作为日志来源标识（不再指向文件）；守护进程日志统一入库
LOG_FILE="${PROJECT_DIR}/daemon.log"

ANNUAL_SCRIPT="${SCRIPT_DIR}/annual_scheduler.sh"
ANNUAL_PID_FILE="${SCRIPT_DIR}/annual_scheduler.pid"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# ======================================
# 工具函数
# ======================================

# 杀掉所有同名旧进程（排除自身和 grep）
# 参数: $1 - 脚本名称（如 reminder_daemon.sh）
# 参数: $2 - 对应的 PID 文件路径
kill_all_old_processes() {
  local script_name="$1"
  local pid_file="$2"

  # 获取所有同名进程的 PID（通过 ps + grep 精确匹配，排除 grep 自身）
  local pids
  pids=$(ps -eo pid,args | grep "bash.*${script_name}" | grep -v grep | awk '{print $1}')

  if [ -n "$pids" ]; then
    local count
    count=$(echo "$pids" | wc -l)
    log_warning "发现 ${count} 个旧的 ${script_name} 进程，正在清理..."
    for old_pid in $pids; do
      kill "$old_pid" 2>/dev/null
    done
    # 等待进程退出
    sleep 2
    # 仍然存活的进程强制终止
    for old_pid in $pids; do
      if kill -0 "$old_pid" 2>/dev/null; then
        kill -9 "$old_pid" 2>/dev/null
        log_warning "强制终止残留进程（PID: ${old_pid}）"
      fi
    done
    # 等待 kill -9 和旧进程的 EXIT trap 执行完毕
    sleep 1
    # 确认所有进程都已退出后才清理 PID 文件
    local still_alive=false
    for old_pid in $pids; do
      if kill -0 "$old_pid" 2>/dev/null; then
        still_alive=true
        log_error "进程 ${old_pid} 仍未退出，跳过 PID 文件清理"
      fi
    done
    if [ "$still_alive" = false ]; then
      rm -f "$pid_file"
    fi
  else
    # 没有运行中的进程，安全清理残留 PID 文件
    rm -f "$pid_file"
  fi
}

# 启动守护进程
start_daemon() {
  # 先检查是否已有实例在运行（通过 ps 精确匹配，避免 pgrep -f 匹配到自身）
  local running_pids
  running_pids=$(ps -eo pid,args | grep "bash.*reminder_daemon.sh" | grep -v grep | awk '{print $1}')
  if [ -n "$running_pids" ]; then
    local count
    count=$(echo "$running_pids" | wc -l)
    if [ "$count" -eq 1 ]; then
      # 只有一个实例，正常运行中；若 PID 文件丢失则自动恢复
      local the_pid
      the_pid=$(echo "$running_pids" | tr -d ' ')
      if [ ! -f "$PID_FILE" ] || [ "$(cat "$PID_FILE" 2>/dev/null)" != "$the_pid" ]; then
        echo "$the_pid" > "$PID_FILE"
        log_warning "PID 文件丢失或不一致，已自动恢复（PID: ${the_pid}）"
      fi
      log_info "守护进程已在运行（PID: ${the_pid}）"
      return 0
    else
      # 多个实例，全部清理后重新启动
      log_warning "检测到 ${count} 个守护进程实例，先清理再启动..."
      kill_all_old_processes "reminder_daemon.sh" "$PID_FILE"
    fi
  fi

  if [ ! -f "$DAEMON_SCRIPT" ]; then
    log_error "守护进程脚本不存在: ${DAEMON_SCRIPT}"
    log_info "======================================"
    return 1
  fi

  # 子进程自己通过 log_utils.sh 入库；这里丢弃 stdio，避免 nohup 生成 nohup.out
  nohup bash "$DAEMON_SCRIPT" > /dev/null 2>&1 &
  local pid=$!
  # 等待子进程写入自己的 PID 文件（启动时可能有多实例清理，需要较长时间）
  for i in $(seq 1 8); do
    if [ -f "$PID_FILE" ]; then
      pid=$(cat "$PID_FILE" 2>/dev/null)
      break
    fi
    sleep 1
  done
  log_success "守护进程已启动（PID: ${pid}）"
}

# 停止守护进程（清理所有同名进程，而不仅仅是 PID 文件中记录的）
stop_daemon() {
  kill_all_old_processes "reminder_daemon.sh" "$PID_FILE"
  log_success "守护进程已停止（所有实例已清理）"
}

# 启动年度调度器
start_annual() {
  # 先检查是否已有实例在运行
  local running_pids
  running_pids=$(ps -eo pid,args | grep "bash.*annual_scheduler.sh" | grep -v grep | awk '{print $1}')
  if [ -n "$running_pids" ]; then
    local count
    count=$(echo "$running_pids" | wc -l)
    if [ "$count" -eq 1 ]; then
      local the_pid
      the_pid=$(echo "$running_pids" | tr -d ' ')
      if [ ! -f "$ANNUAL_PID_FILE" ] || [ "$(cat "$ANNUAL_PID_FILE" 2>/dev/null)" != "$the_pid" ]; then
        echo "$the_pid" > "$ANNUAL_PID_FILE"
        log_warning "PID 文件丢失或不一致，已自动恢复（PID: ${the_pid}）"
      fi
      log_info "年度调度器已在运行（PID: ${the_pid}）"
      return 0
    else
      log_warning "检测到 ${count} 个年度调度器实例，先清理再启动..."
      kill_all_old_processes "annual_scheduler.sh" "$ANNUAL_PID_FILE"
    fi
  fi

  if [ ! -f "$ANNUAL_SCRIPT" ]; then
    log_error "年度调度器脚本不存在: ${ANNUAL_SCRIPT}"
    log_info "======================================"
    return 1
  fi

  nohup bash "$ANNUAL_SCRIPT" > /dev/null 2>&1 &
  local pid=$!
  # 等待子进程写入自己的 PID 文件（启动时可能有多实例清理，需要较长时间）
  for i in $(seq 1 8); do
    if [ -f "$ANNUAL_PID_FILE" ]; then
      pid=$(cat "$ANNUAL_PID_FILE" 2>/dev/null)
      break
    fi
    sleep 1
  done
  log_success "年度调度器已启动（PID: ${pid}）"
}

# 停止年度调度器（清理所有同名进程）
stop_annual() {
  kill_all_old_processes "annual_scheduler.sh" "$ANNUAL_PID_FILE"
  log_success "年度调度器已停止（所有实例已清理）"
}

# 查看运行状态
# 说明：状态查询是「人手动执行、看一眼就完」的一次性输出，用 echo 打到 stdout 而不用 log_*：
#   写进 reminder_daemon.log 只会让每次查询都追加一段无历史价值的噪音（日志里曾连续出现三段同样的状态块）。
#   需要留痕的异常（多实例）由 watchdog / daemon 自身的启动分支记录。
show_status() {
  echo "======================================"
  echo "📊 守护进程状态"
  echo "======================================"

  # 守护进程状态 - 通过 ps 检测实际运行的进程数量
  local daemon_pids
  daemon_pids=$(ps -eo pid,args | grep "bash.*reminder_daemon.sh" | grep -v grep | awk '{print $1}')
  if [ -n "$daemon_pids" ]; then
    local daemon_count
    daemon_count=$(echo "$daemon_pids" | wc -l)
    if [ "$daemon_count" -eq 1 ]; then
      echo "✅ 守护进程：运行中（PID: $(echo $daemon_pids | tr -d ' ')）"
    else
      echo "❌ 守护进程：检测到 ${daemon_count} 个实例（应该只有1个）！"
      echo "  PID列表: $(echo $daemon_pids | tr '\n' ' ')"
      echo "  请执行 'bash daemon.sh restart' 修复"
    fi
  else
    echo "⚠️  守护进程：未运行"
  fi

  # 年度调度器状态
  local annual_pids
  annual_pids=$(ps -eo pid,args | grep "bash.*annual_scheduler.sh" | grep -v grep | awk '{print $1}')
  if [ -n "$annual_pids" ]; then
    local annual_count
    annual_count=$(echo "$annual_pids" | wc -l)
    if [ "$annual_count" -eq 1 ]; then
      echo "✅ 年度调度器：运行中（PID: $(echo $annual_pids | tr -d ' ')）"
    else
      echo "❌ 年度调度器：检测到 ${annual_count} 个实例（应该只有1个）！"
      echo "  PID列表: $(echo $annual_pids | tr '\n' ' ')"
      echo "  请执行 'bash daemon.sh restart' 修复"
    fi
  else
    echo "⚠️  年度调度器：未运行"
  fi

  echo "======================================"
}

# ======================================
# 主逻辑
# ======================================

ACTION="${1:-start}"

case "$ACTION" in
  start)
    log_info "======================================"
    log_info "🚀 启动守护进程..."
    log_info "======================================"
    start_daemon
    start_annual
    log_info "======================================"
    ;;
  stop)
    log_info "======================================"
    log_info "🛑 停止守护进程..."
    log_info "======================================"
    stop_daemon
    stop_annual
    log_info "======================================"
    ;;
  restart)
    log_info "======================================"
    log_info "🔄 重启守护进程..."
    log_info "======================================"
    stop_daemon
    stop_annual
    sleep 1
    start_daemon
    start_annual
    log_info "======================================"
    ;;
  status)
    show_status
    ;;
  *)
    log_error "用法: $0 {start|stop|restart|status}"
    log_info "======================================"
    exit 1
    ;;
esac

exit 0
