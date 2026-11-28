#!/bin/bash

# ======================================
# 日志数据库通道（统一入库 / 查询 / 清理）
# ======================================
#
# 功能说明：
#   1. 从 web/.env 读取 DB_* 连接参数，供 shell 侧直连 MySQL
#   2. 提供 log_db_insert：把一条运行日志写入 hp_run_logs（唯一持久化落点）
#   3. 提供 log_db_query / log_db_exec / log_db_purge：供 view_logs 与定时清理复用
#
# 设计约束：
#   - 只写数据库，不创建/追加任何日志文件；数据库不可用时由调用方降级到 stderr
#   - SQL 字符串统一经 log_db_quote 转义，禁止拼接未经处理的原始内容
#   - 全部函数可被 source，不产生 stdout 输出（log_db_query 除外，它输出查询结果）
#
# 使用方式：
#   source "${PROJECT_DIR}/log_db.sh"
#   log_db_insert "INFO" "任务完成" '{}' "xx.sh:1" "reminder_daemon" "script" ...
#   log_db_query "SELECT source, COUNT(*) FROM hp_run_logs GROUP BY source"
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

_LOG_DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_LOG_DB_ROOT="$(cd "${_LOG_DB_DIR}/.." && pwd)"

# -----------------------------------------
# 连接配置：进程内只解析一次 .env
# 优先级：已存在的 DB_* 环境变量 > ENV_FILE(web/.env) > scripts/.env > 内置默认值
# -----------------------------------------
log_db_config() {
    [ -n "${_LOG_DB_READY:-}" ] && return 0
    _LOG_DB_READY=1

    local env_file="${ENV_FILE:-}"
    if [ -z "$env_file" ] || [ ! -f "$env_file" ]; then
        if [ -f "${_LOG_DB_ROOT}/web/.env" ]; then
            env_file="${_LOG_DB_ROOT}/web/.env"
        else
            env_file="${_LOG_DB_DIR}/.env"
        fi
    fi

    local f_host="" f_port="" f_user="" f_password="" f_name="" f_retention=""
    local key value
    if [ -f "$env_file" ]; then
        while IFS='=' read -r key value; do
            value="${value%$'\r'}"
            value="${value#\"}"; value="${value%\"}"
            value="${value#\'}"; value="${value%\'}"
            case "$key" in
                DB_HOST) f_host="$value" ;;
                DB_PORT) f_port="$value" ;;
                DB_USER) f_user="$value" ;;
                DB_PASSWORD) f_password="$value" ;;
                DB_NAME) f_name="$value" ;;
                LOG_RETENTION_DAYS) f_retention="$value" ;;
            esac
        done < <(grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME|LOG_RETENTION_DAYS)=' "$env_file" 2>/dev/null)
    fi

    LOG_DB_HOST="${DB_HOST:-${f_host:-127.0.0.1}}"
    LOG_DB_PORT="${DB_PORT:-${f_port:-3306}}"
    LOG_DB_USER="${DB_USER:-${f_user:-}}"
    LOG_DB_PASSWORD="${DB_PASSWORD:-${f_password:-}}"
    LOG_DB_NAME="${DB_NAME:-${f_name:-}}"
    LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-${f_retention:-15}}"
    case "$LOG_RETENTION_DAYS" in
        ''|*[!0-9]*) LOG_RETENTION_DAYS=15 ;;
    esac
    export LOG_RETENTION_DAYS
}

# -----------------------------------------
# 通道自检：mysql 客户端存在且连接参数齐全
# -----------------------------------------
log_db_available() {
    log_db_config
    command -v mysql >/dev/null 2>&1 || return 1
    [ -n "$LOG_DB_USER" ] && [ -n "$LOG_DB_NAME" ] || return 1
    return 0
}

# -----------------------------------------
# 执行一条 SQL 并把结果按 TSV 输出到 stdout（失败时输出为空，返回非 0）
# 参数: $1 - SQL 语句
# -----------------------------------------
log_db_query() {
    log_db_available || return 1
    MYSQL_PWD="$LOG_DB_PASSWORD" mysql \
        --host="$LOG_DB_HOST" --port="$LOG_DB_PORT" --user="$LOG_DB_USER" \
        --database="$LOG_DB_NAME" --default-character-set=utf8mb4 \
        --batch --skip-column-names -e "$1" 2>/dev/null
}

# -----------------------------------------
# 执行一条不关心结果集的 SQL（INSERT / DELETE），返回 mysql 的退出码
# 参数: $1 - SQL 语句
# -----------------------------------------
log_db_exec() {
    log_db_available || return 1
    MYSQL_PWD="$LOG_DB_PASSWORD" mysql \
        --host="$LOG_DB_HOST" --port="$LOG_DB_PORT" --user="$LOG_DB_USER" \
        --database="$LOG_DB_NAME" --default-character-set=utf8mb4 \
        --batch --skip-column-names -e "$1" >/dev/null 2>&1
}

# -----------------------------------------
# SQL 字符串转义：输出带单引号的字面量
# 先翻倍反斜杠（MySQL 默认转义模式），再用 '' 转义单引号；
# 换行/回车/制表符转成 \n / \r / \t，避免破坏单行日志结构。
# 参数: $1 - 原始字符串
# -----------------------------------------
log_db_quote() {
    local s="${1//\\/\\\\}"
    # 替换串必须放变量里：直接写 ${s//\'/\'\'} 会被 bash 保留反斜杠，SQL 里变成 \'\'
    local doubled_quote="''"
    s="${s//\'/$doubled_quote}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf "'%s'" "$s"
}

# -----------------------------------------
# 推导日志来源标识（source）
# 规则：LOG_FILE 仍被各脚本设置，但不再代表落盘路径，只作为来源名；
#       指向 /dev/stdout 时回退到调用脚本名。
# 输出: 形如 reminder_daemon / tools / web_access
# -----------------------------------------
log_db_source() {
    local src="${LOG_FILE##*/}"
    case "$src" in
        ''|stdout|stderr|/dev/stdout|/dev/stderr)
            local i f
            for ((i = 0; i < ${#BASH_SOURCE[@]}; i++)); do
                f="${BASH_SOURCE[$i]##*/}"
                case "$f" in
                    log_utils.sh|log_db.sh|"") continue ;;
                esac
                src="${f%.sh}"
                break
            done
            ;;
    esac
    src="${src%%.*}"
    printf '%s' "${src:-unknown}"
}

# -----------------------------------------
# 写入一条运行日志到 hp_run_logs
# 参数：
#   $1 级别  $2 正文  $3 上下文 JSON  $4 调用位置  $5 来源标识  $6 来源类型
#   $7 毫秒时间戳  $8 发生时间(YYYY-MM-DD HH:MM:SS)  $9 主机名  $10 PID
# 返回：0 成功；非 0 表示入库不可用（调用方应降级到 stderr）
# -----------------------------------------
log_db_insert() {
    log_db_available || return 1

    local level="$1" message="$2" context="$3" caller="$4" source="$5" source_type="$6"
    local ts_ms="$7" logged_at="$8" host="$9" pid="${10}"

    case "$ts_ms" in
        ''|*[!0-9]*) ts_ms="NULL" ;;
    esac
    case "$pid" in
        ''|*[!0-9]*) pid="NULL" ;;
    esac
    [ -z "$context" ] && context='{}'

    local sql
    sql="INSERT INTO hp_run_logs (logged_at, ts_ms, level, source_type, source, message, context, caller, hostname, pid) VALUES ("
    sql+="$(log_db_quote "$logged_at"), $ts_ms, $(log_db_quote "$level"), $(log_db_quote "$source_type"), "
    sql+="$(log_db_quote "$source"), $(log_db_quote "$message"), $(log_db_quote "$context"), "
    sql+="$(log_db_quote "$caller"), $(log_db_quote "$host"), $pid);"

    log_db_exec "$sql"
}

# -----------------------------------------
# 按保留天数清理过期日志（替代原先的「清空所有 .log 文件」）
# 参数: $1 - 保留天数（省略则用 LOG_RETENTION_DAYS）
# 输出: 被删除的行数
# -----------------------------------------
log_db_purge() {
    log_db_available || return 1
    local days="${1:-$LOG_RETENTION_DAYS}"
    case "$days" in
        ''|*[!0-9]*) days=15 ;;
    esac
    log_db_query "DELETE FROM hp_run_logs WHERE logged_at < DATE_SUB(NOW(), INTERVAL ${days} DAY); SELECT ROW_COUNT();"
}
