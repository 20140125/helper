#!/bin/bash

# ======================================
# 统一日志工具 v5.0 - 全量入库
# ======================================
#
# 功能说明：
#   1. 支持 JSON 和 TEXT 两种终端输出格式
#   2. 自动记录调用栈信息（脚本、行号、函数）
#   3. 支持日志级别过滤（DEBUG/INFO/WARNING/ERROR）
#   4. 支持性能日志（记录耗时）
#   5. 支持额外上下文信息（JSON extra 字段）
#   6. 每条日志在输出 stderr 的同时写入 hp_run_logs，不再写任何日志文件
#
# 配置环境变量：
#   LOG_FORMAT=json                    # 终端输出格式（json | text，默认 text）
#   LOG_FILE=reminder_daemon.log       # 兼容旧脚本赋值，仅用于推导来源标识，不再是落盘路径
#   LOG_LEVEL=INFO                     # 日志级别（DEBUG | INFO | WARNING | ERROR，默认 INFO）
#   DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME  # 从 web/.env 读取，详见 log_db.sh
#
# 入库失败策略：静默降级为「仅 stderr 输出」，绝不阻塞业务脚本；
#   同一进程只打印一次告警，避免刷屏。
#
# 使用示例：
#   source log_utils.sh
#   log_info "服务启动"
#   log_error "连接失败" '{"host":"api.example.com","port":443}'
#   start_time=$(now_ms)
#   # ... 执行任务 ...
#   log_duration $start_time "任务完成"
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 配置项（可通过环境变量覆盖）
LOG_FORMAT="${LOG_FORMAT:-text}"        # json | text（只影响终端输出，入库字段不受影响）
LOG_FILE="${LOG_FILE:-/dev/stdout}"     # 兼容旧脚本赋值，仅用于推导 source
LOG_LEVEL="${LOG_LEVEL:-INFO}"          # DEBUG | INFO | WARNING | ERROR

# 日志数据库通道（提供 log_db_insert / log_db_source / log_db_query 等）
_LOG_UTILS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${_LOG_UTILS_DIR}/log_db.sh"

# 颜色定义（仅终端输出使用，入库内容不含 ANSI 转义码）
COLOR_RESET="\033[0m"
COLOR_INFO="\033[0;32m"     # 绿色
COLOR_SUCCESS="\033[1;32m"  # 亮绿色
COLOR_WARNING="\033[0;33m"  # 黄色
COLOR_ERROR="\033[0;31m"    # 红色
COLOR_DEBUG="\033[0;36m"    # 青色

# ======================================
# 内部工具函数
# ======================================

# 获取毫秒时间戳（兼容 GNU date 与 macOS BSD date）
# @returns {string} 13 位毫秒时间戳
# @description BSD date 不支持 %3N，会原样输出 N 导致算术运算报错；统一走此函数
now_ms() {
  local candidate
  candidate=$(date +%s%3N 2>/dev/null || true)
  if [[ "$candidate" =~ ^[0-9]+$ ]]; then
    printf '%s' "$candidate"
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    candidate=$(python3 -c 'import time; print(int(time.time() * 1000))' 2>/dev/null || true)
    if [[ "$candidate" =~ ^[0-9]+$ ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  fi
  printf '%s000' "$(date +%s)"
}

# 获取调用栈信息
# 参数: $1 - 调用栈深度（默认 2）
get_caller_info() {
  local frame=${1:-2}
  local caller_script=$(basename "${BASH_SOURCE[$frame]}" 2>/dev/null || echo "unknown")
  local caller_line="${BASH_LINENO[$((frame-1))]}"
  local caller_func="${FUNCNAME[$frame]}"

  # 如果函数名为空或是 main，则不显示
  if [ -z "$caller_func" ] || [ "$caller_func" = "main" ]; then
    echo "${caller_script}:${caller_line}"
  else
    echo "${caller_script}:${caller_line}:${caller_func}"
  fi
}

# JSON 终端输出
# 参数: $1 - 日志级别, $2 - 消息, $3 - 额外信息（JSON字符串）
log_json() {
  local level="$1"
  local message="$2"
  local extra="${3-}"
  [ -z "$extra" ] && extra='{}'

  local ms
  ms=$(now_ms)
  local timestamp
  timestamp=$(python3 -c 'import datetime,sys; ms=int(sys.argv[1]); print(datetime.datetime.fromtimestamp(ms/1000, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + f".{ms % 1000:03d}Z")' "$ms" 2>/dev/null || date -u '+%Y-%m-%dT%H:%M:%SZ')
  local caller=$(get_caller_info 4)  # 调整栈深度以跳过中间函数
  local hostname=$(hostname 2>/dev/null || echo "unknown")

  # 转义消息中的特殊字符
  local escaped_message=$(echo "$message" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r/\\r/g; s/\t/\\t/g')

  # 构建 JSON（手动拼接，避免依赖 jq）
  cat <<EOF
{"timestamp":"$timestamp","level":"$level","message":"$escaped_message","caller":"$caller","hostname":"$hostname","pid":$$,"extra":$extra}
EOF
}

# 文本终端输出
# 参数: $1 - 日志级别, $2 - 消息, $3 - 颜色代码
log_text() {
  local level="$1"
  local message="$2"
  local color="$3"

  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${color}[${timestamp}] [${level}] ${message}${COLOR_RESET}"
}

# 取业务脚本的调用位置（跳过 log_utils.sh / log_db.sh 这些库文件帧）
# @returns {string} 形如 reminder_daemon.sh:57
# @description 日志入库后 caller 是跨模块检索的重要字段；固定栈深度在
#   「脚本直接调用」与「子脚本 source 后调用」两种场景下会漂移，故反向扫描取帧。
_log_caller() {
  local i f line name
  # 最外层公开 log_* 帧的 BASH_LINENO 正是业务脚本调用 log_info 的那一行；
  # 用它比「顶层 main 帧」精确（后者会指向 main "$@" 这一行）
  for ((i = ${#FUNCNAME[@]} - 1; i >= 0; i--)); do
    name="${FUNCNAME[$i]:-}"
    case "$name" in
      log_info|log_warning|log_error|log_debug|log_success|log_duration|log_separator) ;;
      *) continue ;;
    esac
    f="${BASH_SOURCE[$((i+1))]##*/}"
    line="${BASH_LINENO[$i]:-0}"
    printf '%s:%s' "${f:-unknown}" "${line:-0}"
    return 0
  done
  printf 'unknown:0'
}

# 日志级别判断（返回 0 表示应该记录，1 表示过滤）
# 参数: $1 - 当前日志级别
should_log() {
  local current_level="$1"

  # 级别优先级: DEBUG < INFO < WARNING < ERROR
  case "$LOG_LEVEL" in
    DEBUG)
      return 0  # 记录所有级别
      ;;
    INFO)
      [ "$current_level" = "DEBUG" ] && return 1
      return 0
      ;;
    WARNING)
      [ "$current_level" = "DEBUG" ] || [ "$current_level" = "INFO" ] && return 1
      return 0
      ;;
    ERROR)
      [ "$current_level" = "ERROR" ] && return 0
      return 1
      ;;
    *)
      return 0  # 未知级别，默认记录
      ;;
  esac
}

# 统一日志入口（内部函数）
# 参数: $1 - 日志级别, $2 - 消息, $3 - 额外信息（JSON），$4 - 颜色代码
# @description 唯一持久化落点是 hp_run_logs；stderr 输出只是给交互式/前台运行看的副本。
#   入库失败不抛错、不写文件，保证日志链路异常时业务脚本照常执行。
_log() {
  local level="$1"
  local message="$2"
  local extra="${3-}"
  [ -z "$extra" ] && extra='{}'
  local color="$4"

  # 日志级别过滤
  should_log "$level" || return 0

  local ts_ms logged_at caller host source log_line
  ts_ms=$(now_ms)
  logged_at=$(date '+%Y-%m-%d %H:%M:%S')
  caller=$(_log_caller)
  host=$(hostname 2>/dev/null || echo "unknown")
  source=$(log_db_source)

  # 1) 终端输出（不落文件）
  if [ "$LOG_FORMAT" = "json" ]; then
    log_line=$(log_json "$level" "$message" "$extra")
    printf '%s\n' "$log_line" >&2
  else
    log_line=$(log_text "$level" "$message" "$color")
    echo -e "$log_line" >&2
  fi

  # 2) 入库（唯一持久化落点）
  if ! log_db_insert "$level" "$message" "$extra" "$caller" "$source" "script" \
      "$ts_ms" "$logged_at" "$host" "$$"; then
    if [ -z "${_LOG_DB_WARNED:-}" ]; then
      _LOG_DB_WARNED=1
      printf '[log_utils] 日志入库失败，仅输出到 stderr（检查 web/.env 的 DB_* 与 mysql 客户端）\n' >&2
    fi
  fi
}

# ======================================
# 公开接口
# ======================================

# 普通信息日志
# 参数: $1 - 消息, $2 - 额外信息（可选，JSON 字符串）
log_info() {
  _log "INFO" "$1" "${2-}" "$COLOR_INFO"
}

# 警告日志（带 ⚠️ 表情）
# 参数: $1 - 消息, $2 - 额外信息（可选，JSON 字符串）
log_warning() {
  _log "WARNING" "⚠️ $1" "${2-}" "$COLOR_WARNING"
}

# 错误日志（带 ❌ 表情）
# 参数: $1 - 消息, $2 - 额外信息（可选，JSON 字符串）
log_error() {
  _log "ERROR" "❌ $1" "${2-}" "$COLOR_ERROR"
}

# 调试日志（带 🔍 表情）
# 参数: $1 - 消息, $2 - 额外信息（可选，JSON 字符串）
log_debug() {
  _log "DEBUG" "🔍 $1" "${2-}" "$COLOR_DEBUG"
}

# 成功日志（带 ✅ 表情）
# 参数: $1 - 消息, $2 - 额外信息（可选，JSON 字符串）
log_success() {
  _log "INFO" "✅ $1" "${2-}" "$COLOR_SUCCESS"
}

# 性能日志（记录耗时）
# 参数: $1 - 开始时间（毫秒，通过 now_ms 获取）, $2 - 消息
log_duration() {
  local start_time="$1"
  local message="$2"

  # 兼容旧调用传入秒级/非法值；统一按毫秒计算耗时
  if [[ ! "$start_time" =~ ^[0-9]+$ ]]; then
    start_time=$(now_ms)
  elif [ ${#start_time} -le 10 ]; then
    start_time=$((start_time * 1000))
  fi

  # 计算耗时（毫秒）
  local end_time=$(now_ms)
  local duration=$((end_time - start_time))

  # 构建额外信息
  local extra="{\"duration_ms\": $duration}"

  # 根据耗时选择日志级别
  if [ $duration -gt 5000 ]; then
    _log "WARNING" "⏱️ $message (耗时: ${duration}ms)" "$extra" "$COLOR_WARNING"
  else
    _log "INFO" "⏱️ $message (耗时: ${duration}ms)" "$extra" "$COLOR_INFO"
  fi
}

# 分隔线（用于区分不同阶段的日志）
# 参数: $1 - 标题（可选）
log_separator() {
  local title="${1:-}"
  if [ -n "$title" ]; then
    log_info "==========================================="
    log_info "  $title"
    log_info "==========================================="
  else
    log_info "==========================================="
  fi
}

# ======================================
# 导出函数（供其他脚本使用）
# ======================================

export -f now_ms
export -f log_info
export -f log_warning
export -f log_error
export -f log_debug
export -f log_success
export -f log_duration
export -f log_separator
