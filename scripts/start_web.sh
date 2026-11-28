#!/bin/bash

# ======================================
# Web 服务管理脚本
# ======================================
#
# 功能说明：
#   1. 启动 / 停止 / 重启 Web 服务（server.ts）
#   2. 启动 / 停止 Web 启动器（web-launcher.ts）
#   3. 查看 Web 服务运行状态
#
# 使用方式：
#   bash scripts/start_web.sh [start|stop|restart|status]
#
# 注意事项：
#   - Web 服务监听端口 9527，启动器监听端口 3001
#   - PID 文件存放在 scripts/ 目录下
#   - 运行日志统一写入 hp_run_logs（不产生日志文件）
#
# 作者：智能提醒系统
# 更新：2026-03-13
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# ======================================
# 路径配置
# ======================================

WEB_DIR="$(cd "${SCRIPT_DIR}/../web" && pwd)"
# LOG_FILE 只是来源标识，不再是落盘路径；本脚本的启停操作与 Web 服务日志同归 web_server 来源
LOG_FILE="${SCRIPT_DIR}/web_server.log"
source "${SCRIPT_DIR}/log_utils.sh"

PID_FILE="${SCRIPT_DIR}/web.pid"
LAUNCHER_PID_FILE="${SCRIPT_DIR}/launcher.pid"

# ======================================
# 工具函数
# ======================================

# 启动 Web 启动器（web-launcher.ts，端口 3001）
# 参数：无
# 返回：
#   成功：启动器进程已在后台运行，返回 0
#   失败：返回 1
start_launcher() {
  # 启动前先 kill 旧进程：PID 文件可能丢失/过期，此时端口仍被占用会导致 EADDRINUSE，
  # 故与 stop_launcher 一样再按 3001 端口兜底清理
  if [ -f "$LAUNCHER_PID_FILE" ]; then
    local pid
    pid=$(cat "$LAUNCHER_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      sleep 0.5
    fi
    rm -f "$LAUNCHER_PID_FILE"
  fi
  local port_pid
  port_pid=$(lsof -ti:3001 2>/dev/null | head -1)
  if [ -n "$port_pid" ]; then
    kill "$port_pid" 2>/dev/null
    sleep 0.5
  fi
  cd "$WEB_DIR" || return 1
  # 启动器的 console 输出由 web-launcher.ts 自行入库；这里丢弃 stdio，不生成日志文件
  nohup npx ts-node web-launcher.ts > /dev/null 2>&1 &
  log_info "🔌 Web 启动器已启动（端口 3001）"
}

# 停止 Web 启动器
# 参数：无
# 返回：无
stop_launcher() {
  if [ -f "$LAUNCHER_PID_FILE" ]; then
    local pid
    pid=$(cat "$LAUNCHER_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
    fi
    rm -f "$LAUNCHER_PID_FILE"
  fi
  # 兜底：杀掉占用 3001 端口的进程
  local port_pid
  port_pid=$(lsof -ti:3001 2>/dev/null | head -1)
  if [ -n "$port_pid" ]; then
    kill "$port_pid" 2>/dev/null
  fi
}

# 启动 Web 服务（server.ts，端口 9527）
# 参数：无
# 返回：
#   成功：服务进程已在后台运行，返回 0
#   失败：返回 1
start_web() {
  # 启动前先 kill 旧进程
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      local waited=0
      while kill -0 "$pid" 2>/dev/null; do
        sleep 0.5
        waited=$((waited + 1))
        if [ $waited -ge 10 ]; then
          kill -9 "$pid" 2>/dev/null
          break
        fi
      done
    fi
    rm -f "$PID_FILE"
  fi

  log_info "启动 Web 服务..."
  cd "$WEB_DIR" || exit 1
  nohup npx ts-node server.ts > /dev/null 2>&1 &
  local nohup_pid=$!
  # 等待端口 9527 监听成功，最多等 60 秒
  local waited=0
  while ! lsof -ti:9527 >/dev/null 2>&1; do
    sleep 0.5
    waited=$((waited + 1))
    if [ $waited -ge 120 ]; then
      break
    fi
  done
  # 直接使用 nohup 启动的进程 PID（不用 lsof 查，避免取到子进程 PID）
  if lsof -ti:9527 >/dev/null 2>&1; then
    echo $nohup_pid > "$PID_FILE"
    log_success "Web 服务已启动，PID: $nohup_pid"
  else
    log_error "Web 服务启动失败，请在「运行日志」页查看 web_server 来源，或查 hp_run_logs"
    log_info "也可前台运行查看启动错误：cd web && npx ts-node server.ts"
  fi
}

# 停止 Web 服务及启动器
# 参数：无
# 返回：无
stop_web() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      # 等待进程真正退出，最多等待 10 秒
      local waited=0
      while kill -0 "$pid" 2>/dev/null; do
        sleep 0.5
        waited=$((waited + 1))
        if [ $waited -ge 20 ]; then
          log_warning "进程未响应，强制终止..."
          kill -9 "$pid" 2>/dev/null
          break
        fi
      done
      rm -f "$PID_FILE"
      log_success "Web 服务已停止"
    else
      log_info "Web 服务未运行"
      rm -f "$PID_FILE"
    fi
  else
    log_info "Web 服务未运行"
  fi
  # 额外清理：kill 所有仍占用 9527 端口的残留进程
  local port_pids
  port_pids=$(lsof -ti:9527 2>/dev/null)
  if [ -n "$port_pids" ]; then
    echo "$port_pids" | xargs kill -9 2>/dev/null
  fi
  # 停止主服务时同时停止 launcher
  stop_launcher
}

# 重启 Web 服务（同时确保启动器存活）
# 参数：无
# 返回：无
restart_web() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      local waited=0
      while kill -0 "$pid" 2>/dev/null; do
        sleep 0.5
        waited=$((waited + 1))
        if [ $waited -ge 20 ]; then
          log_warning "进程未响应，强制终止..."
          kill -9 "$pid" 2>/dev/null
          break
        fi
      done
      rm -f "$PID_FILE"
      log_success "Web 服务已停止"
    else
      log_info "Web 服务未运行"
      rm -f "$PID_FILE"
    fi
  else
    log_info "Web 服务未运行"
  fi
  # 额外清理：kill 所有仍占用 9527 端口的残留进程（ts-node 子进程等）
  local port_pids
  port_pids=$(lsof -ti:9527 2>/dev/null)
  if [ -n "$port_pids" ]; then
    log_info "清理残留进程: $port_pids"
    echo "$port_pids" | xargs kill -9 2>/dev/null
    sleep 1
  fi
  # 检查启动器是否存活，不存活则重新启动
  local launcher_alive=false
  if [ -f "$LAUNCHER_PID_FILE" ]; then
    local launcher_pid
    launcher_pid=$(cat "$LAUNCHER_PID_FILE")
    if kill -0 "$launcher_pid" 2>/dev/null; then
      launcher_alive=true
    fi
  fi
  if [ "$launcher_alive" = false ]; then
    log_warning "启动器未运行，重新启动..."
    start_launcher
  fi
  start_web
}

# 查看 Web 服务运行状态
# 参数：无
# 返回：无
status_web() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log_success "Web 服务运行中，PID: $pid"
    else
      log_error "Web 服务未运行（PID 文件存在但进程不存在）"
      rm -f "$PID_FILE"
    fi
  else
    log_error "Web 服务未运行"
  fi
}

# ======================================
# 主函数
# ======================================

# 主函数：处理命令行参数，分发到对应操作
# 参数：
#   $1 - 操作类型（start|stop|restart|status，默认 start）
main() {
  local action="${1:-start}"
  case "$action" in
    start)
      log_info "======================================"
      log_info "🚀 start_web.sh 启动"
      log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
      log_info "======================================"
      start_launcher
      start_web
      log_success "脚本执行完成"
      log_info "======================================"
      ;;
    stop)
      log_info "======================================"
      log_info "🛑 start_web.sh 停止"
      log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
      log_info "======================================"
      stop_web
      log_success "脚本执行完成"
      log_info "======================================"
      ;;
    restart)
      log_info "======================================"
      log_info "🔄 start_web.sh 重启"
      log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
      log_info "======================================"
      restart_web
      log_success "脚本执行完成"
      log_info "======================================"
      ;;
    status)
      log_info "======================================"
      log_info "📊 start_web.sh 状态查询"
      log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
      log_info "======================================"
      status_web
      log_success "脚本执行完成"
      log_info "======================================"
      ;;
    *)
      log_error "未知参数: $action"
      log_error "用法: $0 {start|stop|restart|status}"
      exit 1
      ;;
  esac
}

# 执行主函数
main "$@"
