#!/bin/bash

# ======================================
# 统一日志工具 v4.0 - JSON 格式支持
# ======================================
#
# 功能说明：
#   1. 支持 JSON 和 TEXT 两种日志格式
#   2. 自动记录调用栈信息（脚本、行号、函数）
#   3. 支持日志级别过滤（DEBUG/INFO/WARNING/ERROR）
#   4. 支持性能日志（记录耗时）
#   5. 支持额外上下文信息（JSON extra 字段）
#   6. 文件日志自动轮转：单文件超 LOG_MAX_BYTES 即切分，保留 LOG_KEEP 份历史
#
# 配置环境变量：
#   LOG_FORMAT=json        # 日志格式（json | text，默认 text）
#   LOG_FILE=/path/to.log  # 日志文件路径（默认 stdout）
#   LOG_LEVEL=INFO         # 日志级别（DEBUG | INFO | WARNING | ERROR，默认 INFO）
#   LOG_MAX_BYTES=1048576  # 单文件轮转上限（字节，默认 1MB；0 表示不轮转）
#   LOG_KEEP=3             # 轮转后保留的历史份数（.1 ~ .N，默认 3）
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
# 更新：2026-03-18
# ======================================

# 配置项（可通过环境变量覆盖）
LOG_FORMAT="${LOG_FORMAT:-text}"  # json | text
LOG_FILE="${LOG_FILE:-/dev/stdout}"
LOG_LEVEL="${LOG_LEVEL:-INFO}"    # DEBUG | INFO | WARNING | ERROR

# ── 轮转配置 ──
LOG_MAX_BYTES="${LOG_MAX_BYTES:-1048576}"  # 单文件上限（默认 1MB）；0 = 关闭轮转
LOG_KEEP="${LOG_KEEP:-3}"                  # 保留历史份数（custom_rules.log.1 / .2 / .3）
# 进程内节流：每 60 秒最多 stat 一次（$SECONDS 是 bash 内建，取值零子进程开销）
_LOG_LAST_ROTATE_CHECK="${_LOG_LAST_ROTATE_CHECK:--99999}"

# 颜色定义（文本模式）
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

# JSON 日志输出
# 参数: $1 - 日志级别, $2 - 消息, $3 - 额外信息（JSON字符串）
log_json() {
  local level="$1"
  local message="$2"
  local extra="${3:-{}}"
  
  local timestamp=$(date -u '+%Y-%m-%dT%H:%M:%S.%3NZ' 2>/dev/null || date -u '+%Y-%m-%dT%H:%M:%SZ')
  local caller=$(get_caller_info 4)  # 调整栈深度以跳过中间函数
  local hostname=$(hostname 2>/dev/null || echo "unknown")
  
  # 转义消息中的特殊字符
  local escaped_message=$(echo "$message" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g; s/\r/\\r/g; s/\t/\\t/g')
  
  # 构建 JSON（手动拼接，避免依赖 jq）
  cat <<EOF
{"timestamp":"$timestamp","level":"$level","message":"$escaped_message","caller":"$caller","hostname":"$hostname","pid":$$,"extra":$extra}
EOF
}

# 文本日志输出
# 参数: $1 - 日志级别, $2 - 消息, $3 - 颜色代码
log_text() {
  local level="$1"
  local message="$2"
  local color="$3"
  
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${color}[${timestamp}] [${level}] ${message}${COLOR_RESET}"
}

# 取文件大小（字节）：优先 GNU stat -c，回落 BSD stat -f，都失败按 0 处理
# 参数: $1 - 文件路径
_file_size() {
  stat -c %s "$1" 2>/dev/null || stat -f %z "$1" 2>/dev/null || echo 0
}

# 日志文件轮转（超限时）
# 说明：
#   - 只对真实文件生效；/dev/stdout / /dev/stderr 这类输出目标无需轮转
#   - 历史文件顺延（.1 → .2 → .3），超出 LOG_KEEP 的那份直接丢弃
#   - mv 走后原文件消失，下一次写入会自动重建，因此不需要预先创建空文件；
#     这里主动写一行轮转痕迹，方便事后判断"日志为何从某处断开"
#   - 全程容错：轮转失败不影响业务写入
_rotate_log_if_needed() {
  case "$LOG_FILE" in
    /dev/stdout|/dev/stderr|"") return 0 ;;
  esac
  [ "${LOG_MAX_BYTES:-0}" -gt 0 ] 2>/dev/null || return 0
  [ -f "$LOG_FILE" ] || return 0

  # 节流：同一进程内 60 秒检查一次即可
  local now=$SECONDS
  [ $((now - _LOG_LAST_ROTATE_CHECK)) -lt 60 ] && return 0
  _LOG_LAST_ROTATE_CHECK=$now

  local size
  size=$(_file_size "$LOG_FILE")
  [ "${size:-0}" -lt "$LOG_MAX_BYTES" ] && return 0

  # 最老一份直接丢弃，其余依次顺延
  [ -f "${LOG_FILE}.${LOG_KEEP}" ] && rm -f "${LOG_FILE}.${LOG_KEEP}"
  local i=$((LOG_KEEP - 1))
  while [ "$i" -ge 1 ]; do
    [ -f "${LOG_FILE}.${i}" ] && mv -f "${LOG_FILE}.${i}" "${LOG_FILE}.$((i + 1))"
    i=$((i - 1))
  done

  mv -f "$LOG_FILE" "${LOG_FILE}.1" 2>/dev/null || return 0
  printf '[%s] [INFO] ♻️ 日志已轮转（单文件上限 %s 字节，保留 %s 份）：%s → %s.1\n' \
    "$(date '+%Y-%m-%d %H:%M:%S')" "$LOG_MAX_BYTES" "$LOG_KEEP" \
    "$(basename "$LOG_FILE")" "$(basename "$LOG_FILE")" > "$LOG_FILE"
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
_log() {
  local level="$1"
  local message="$2"
  local extra="${3:-{}}"
  local color="$4"
  
  # 日志级别过滤
  should_log "$level" || return 0
  
  # 根据格式选择输出方式
  local log_line
  if [ "$LOG_FORMAT" = "json" ]; then
    log_line=$(log_json "$level" "$message" "$extra")
  else
    log_line=$(log_text "$level" "$message" "$color")
  fi
  
  # 输出到控制台和日志文件
  if [ "$LOG_FILE" = "/dev/stdout" ] || [ "$LOG_FILE" = "/dev/stderr" ]; then
    # 交互式/默认场景：带颜色输出到 stderr（-e 用于解释 \033 转义）
    echo -e "$log_line" >&2
  else
    # 文件日志场景：只写文件一份（去掉 ANSI 转义码），避免 stderr 被 crontab 2>&1 重复捕获导致乱码
    _rotate_log_if_needed
    echo "$log_line" | sed 's/\x1b\[[0-9;]*m//g' >> "$LOG_FILE"
  fi
}

# ======================================
# 公开接口
# ======================================

# 普通信息日志
# 参数: $1 - 消息, $2 - 额外信息（可选，JSON 字符串）
log_info() {
  _log "INFO" "$1" "${2:-{}}" "$COLOR_INFO"
}

# 警告日志（带 ⚠️ 表情）
# 参数: $1 - 消息, $2 - 额外信息（可选，JSON 字符串）
log_warning() {
  _log "WARNING" "⚠️ $1" "${2:-{}}" "$COLOR_WARNING"
}

# 错误日志（带 ❌ 表情）
# 参数: $1 - 消息, $2 - 额外信息（可选，JSON 字符串）
log_error() {
  _log "ERROR" "❌ $1" "${2:-{}}" "$COLOR_ERROR"
}

# 调试日志（带 🔍 表情）
# 参数: $1 - 消息, $2 - 额外信息（可选，JSON 字符串）
log_debug() {
  _log "DEBUG" "🔍 $1" "${2:-{}}" "$COLOR_DEBUG"
}

# 成功日志（带 ✅ 表情）
# 参数: $1 - 消息, $2 - 额外信息（可选，JSON 字符串）
log_success() {
  _log "INFO" "✅ $1" "${2:-{}}" "$COLOR_SUCCESS"
}

# 性能日志（记录耗时）
# 参数: $1 - 开始时间（毫秒，通过 now_ms 获取）, $2 - 消息
log_duration() {
  local start_time="$1"
  local message="$2"

  # 兼容旧调用传入秒级/非法值；统一按毫秒计算耗时
  if [[ ! "$start_time" =~ ^[0-9]+$ ]]; then
    start_time=$(now_ms)
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