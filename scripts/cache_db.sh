#!/bin/bash

# ======================================
# 缓存数据库通道（分表 JSON 真源 / 读写）
# ======================================
#
# 功能说明：
#   1. 复用 log_db.sh 的 MySQL 连接配置
#   2. 提供 cache_db_read / cache_db_write / cache_db_exists / cache_db_list / cache_db_delete
#   3. 提供 cache_db_materialize / cache_db_persist，兼容仍以「文件路径」读写 JSON 的脚本
#
# 设计约束：
#   - 运行时不再读写 .cache 下的任何文件，按缓存键路由到独立数据表
#   - api_responses/*.json 按资源类型落到 hp_cache_res_*；
#     其余键（含 api_responses/.last_prune）读写 sql/ 里已有的业务表或 hp_cache_res_other（web/utils/database/cache-tables.ts）
#   - 写 SQL 通过 stdin 传给 mysql，避免大 JSON 超出命令行参数长度限制
#   - 所有函数可被 source；除 cache_db_read / cache_db_list / cache_db_materialize 外不产生 stdout
#
# 使用方式：
#   source "${PROJECT_DIR}/cache_db.sh"
#   cache_db_read 'greetings.json' | jq -r '.birthday[0]'
#   jq '.[] | .id' <<< "$(cache_db_read 'custom_rules.json')"
#   cache_db_write 'greetings.json' "$body"
#   cache_db_persist 'dailyword_library.json' "$tmp_file"
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 优先复用 project_config.sh 提供的 scripts 目录，直接 source 时按脚本自身位置推导
_CACHE_DB_DIR="${PROJECT_DIR:-}"
if [ -z "$_CACHE_DB_DIR" ] || [ ! -f "${_CACHE_DB_DIR}/log_db.sh" ]; then
    _CACHE_DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
fi
# shellcheck source=log_db.sh
source "${_CACHE_DB_DIR}/log_db.sh"

# -----------------------------------------
# 通道自检：mysql 客户端与 DB_* 配置可用
# -----------------------------------------
cache_db_available() {
    log_db_available
}

# -----------------------------------------
# 执行一条 SQL 并把结果按原始文本输出到 stdout
# 参数: $1 - SQL 语句；使用 --raw 保留 JSON 里的换行与反斜杠
# -----------------------------------------
cache_db_query_raw() {
    log_db_available || return 1
    MYSQL_PWD="$LOG_DB_PASSWORD" mysql \
        --host="$LOG_DB_HOST" --port="$LOG_DB_PORT" --user="$LOG_DB_USER" \
        --database="$LOG_DB_NAME" --default-character-set=utf8mb4 \
        --batch --skip-column-names --raw -e "$1" 2>/dev/null
}

# -----------------------------------------
# 从 stdin 读取 SQL 并执行（供大文本 INSERT 使用）
# -----------------------------------------
cache_db_exec_stdin() {
    log_db_available || return 1
    MYSQL_PWD="$LOG_DB_PASSWORD" mysql \
        --host="$LOG_DB_HOST" --port="$LOG_DB_PORT" --user="$LOG_DB_USER" \
        --database="$LOG_DB_NAME" --default-character-set=utf8mb4 \
        --batch --skip-column-names >/dev/null 2>&1
}

# -----------------------------------------
# 缓存键路由与 SQL 生成（与 Web 端 cache-routing.ts 同一套规则）
# 环境变量:
#   CACHE_DB_OP    - read / write / exists / delete / list
#   CACHE_DB_KEY   - 缓存键（list 时为前缀）
# write 时从 stdin 读取缓存全文，SQL 打印到 stdout
# -----------------------------------------
_CACHE_DB_SQL_PY="$(cat <<'PY'
import os, re, sys, time

API_PREFIX = 'api_responses/'
# (前缀, 分类表, 时间粒度)；auto 表示从缓存键里的日期自动推断
ROUTES = [
    ('almanac_', 'hp_cache_res_calendar', 'month'),
    ('nagerholiday-', 'hp_cache_res_holiday', 'year'),
    ('weather_', 'hp_cache_res_weather', 'month'),
    ('horoscope_', 'hp_cache_res_horoscope', 'static'),
    ('historytoday-', 'hp_cache_res_history', 'day'),
    ('gtimgquotes_', 'hp_cache_res_finance', 'month'),
    ('tencenthot_', 'hp_cache_res_hot_list', 'month'),
    ('dailyword_', 'hp_cache_res_quote', 'month'),
    ('video_', 'hp_cache_res_video', 'static'),
    ('image_', 'hp_cache_res_image', 'static'),
    ('news_', 'hp_cache_res_news', 'static'),
    ('', 'hp_cache_res_other', 'auto'),
]
PERIOD_PATTERNS = {
    'day': r'\d{4}-\d{2}-\d{2}',
    'month': r'\d{4}-\d{2}',
    'year': r'\d{4}',
}
PERIOD_TYPE_DDL = "ADD COLUMN `period_type` VARCHAR(8) NOT NULL DEFAULT 'static' COMMENT '时间粒度：day/month/year/static'"
PERIOD_KEY_DDL = "ADD COLUMN `period_key` VARCHAR(10) NOT NULL DEFAULT '' COMMENT '粒度日期：YYYY-MM-DD / YYYY-MM / YYYY，静态为空'"

def quote(value):
    value = value.replace('\\', '\\\\')
    value = value.replace("'", "''")
    value = value.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
    return "'" + value + "'"

def target(key):
    if key.startswith(API_PREFIX) and key.endswith('.json'):
        name = key[len(API_PREFIX):]
        base = name[:-5]
        route = next((r for r in ROUTES if r[0] and base.startswith(r[0])), None)
        if route:
            prefix, table = route
            stored = base[len(prefix):]
        else:
            table = 'hp_cache_res_other'
            stored = key
        return (table, 'asset_key', 'body', 'cache_updated_at', stored)
    raise ValueError('非 api_responses/*.json 缓存键请使用业务表 CLI')

def union_sql():
    parts = []
    for prefix, table in ROUTES:
        if not prefix:
            continue
        parts.append(
            "SELECT CONCAT(%s, %s, asset_key, '.json') AS file_key, LENGTH(body) AS size, "
            "cache_updated_at AS updated_at FROM `%s`"
            % (quote(API_PREFIX), quote(prefix), table)
        )
    parts.append(
        "SELECT asset_key AS file_key, LENGTH(body) AS size, cache_updated_at AS updated_at "
        "FROM `hp_cache_res_other`"
    )
    return ' UNION ALL '.join(parts)

op = os.environ.get('CACHE_DB_OP', 'read')
key = os.environ.get('CACHE_DB_KEY', '')

if op == 'list':
    print("SELECT file_key FROM (%s) AS cache_entries WHERE file_key LIKE %s ORDER BY file_key;"
          % (union_sql(), quote(key + '%')))
else:
    table, key_col, body_col, time_col, stored = target(key)
    where = "`%s`.`%s` = %s" % (table, key_col, quote(stored))
    if op == 'read':
        print("SELECT `%s` FROM `%s` WHERE %s LIMIT 1;" % (body_col, table, where))
    elif op == 'exists':
        print("SELECT 1 FROM `%s` WHERE %s LIMIT 1;" % (table, where))
    elif op == 'delete':
        print("DELETE FROM `%s` WHERE %s;" % (table, where))
    elif op == 'write':
        body = sys.stdin.read()
        ts = int(time.time() * 1000)
        print("INSERT INTO `%s` (`%s`, `%s`, `%s`) VALUES (%s, %s, %d) "
              "ON DUPLICATE KEY UPDATE `%s` = VALUES(`%s`), `%s` = VALUES(`%s`);"
              % (table, key_col, body_col, time_col, quote(stored), quote(body), ts,
                 body_col, body_col, time_col, time_col))
PY
)"

# -----------------------------------------
# 生成一条 SQL（不执行，仅 api_responses 键使用）
# 参数: $1 - 操作；$2 - 缓存键或前缀
# -----------------------------------------
_cache_db_sql() {
    CACHE_DB_OP="$1" CACHE_DB_KEY="${2:-}" python3 -c "$_CACHE_DB_SQL_PY"
}

# -----------------------------------------
# 判断是否为 API 响应归档键
# 参数: $1 - 缓存键
# -----------------------------------------
_cache_db_is_api() {
    case "${1:-}" in
        api_responses/*.json) return 0 ;;
        *) return 1 ;;
    esac
}

# -----------------------------------------
# 调用业务表 CLI（与 Web 端共用 cache-tables.ts）
# 参数: 操作 + 缓存键/前缀；write 时从 stdin 读取全文
# -----------------------------------------
_CACHE_DB_WEB_DIR="$(cd "${_CACHE_DB_DIR}/.." && pwd)/web"
_cache_db_cli() {
    (
        cd "$_CACHE_DB_WEB_DIR" || return 1
        TS_NODE_PROJECT="${_CACHE_DB_WEB_DIR}/tsconfig.json" \
            ./node_modules/.bin/ts-node scripts/cache-table-cli.ts "$@"
    )
}

# -----------------------------------------
# 读取缓存条目原始全文
# 参数: $1 - 缓存键
# 输出: body 原文；条目不存在时输出为空并返回 0
# -----------------------------------------
cache_db_read() {
    local key="${1:-}" sql
    [ -n "$key" ] || return 1
    if _cache_db_is_api "$key"; then
        sql="$(_cache_db_sql read "$key")" || return 1
        cache_db_query_raw "$sql"
    else
        _cache_db_cli read "$key"
    fi
}

# -----------------------------------------
# 写入缓存条目（UPSERT）
# 参数: $1 - 缓存键；$2 - 原始内容（省略时从 stdin 读取）
# 返回: 0 成功；非 0 表示数据库不可用
# -----------------------------------------
cache_db_write() {
    log_db_available || return 1
    local key="${1:-}" body sql
    [ -n "$key" ] || return 1
    if [ "$#" -ge 2 ]; then
        body="$2"
    else
        body="$(cat)"
    fi
    if _cache_db_is_api "$key"; then
        sql="$(printf '%s' "$body" | CACHE_DB_OP=write CACHE_DB_KEY="$key" python3 -c "$_CACHE_DB_SQL_PY")" || return 1
        printf '%s' "$sql" | cache_db_exec_stdin
    else
        printf '%s' "$body" | _cache_db_cli write "$key"
    fi
}

# -----------------------------------------
# 把本地文件内容写入缓存条目（供仍使用临时文件的脚本收尾）
# 参数: $1 - 缓存键；$2 - 文件路径
# -----------------------------------------
cache_db_persist() {
    local key="${1:-}" file="${2:-}"
    [ -n "$key" ] && [ -f "$file" ] || return 1
    cache_db_write "$key" < "$file"
}

# -----------------------------------------
# 把缓存条目物化为临时文件，返回临时文件路径
# 参数: $1 - 缓存键
# 说明: 供依赖「文件路径」的 jq / python 脚本渐进改造使用；条目不存在时物化为 '{}'
# -----------------------------------------
cache_db_materialize() {
    local key="${1:-}" tmp
    [ -n "$key" ] || return 1
    tmp="$(mktemp "${TMPDIR:-/tmp}/helper-cache.XXXXXX")" || return 1
    local body
    body="$(cache_db_read "$key")" || body=''
    if [ -z "$body" ]; then body='{}'; fi
    printf '%s' "$body" > "$tmp"
    printf '%s' "$tmp"
}

# -----------------------------------------
# 判断缓存条目是否存在
# 参数: $1 - 缓存键
# -----------------------------------------
cache_db_exists() {
    local key="${1:-}" sql out
    [ -n "$key" ] || return 1
    if _cache_db_is_api "$key"; then
        sql="$(_cache_db_sql exists "$key")" || return 1
        out="$(cache_db_query_raw "$sql")" || return 1
        [ -n "$out" ]
    else
        _cache_db_cli exists "$key"
    fi
}

# -----------------------------------------
# 列出指定前缀的缓存键
# 参数: $1 - 键前缀（可省略）
# -----------------------------------------
cache_db_list() {
    local prefix="${1:-}" sql api_keys struct_keys
    sql="$(_cache_db_sql list "$prefix")" || return 1
    api_keys="$(cache_db_query_raw "$sql")" || return 1
    struct_keys="$(_cache_db_cli list "$prefix")" || return 1
    printf '%s\n%s\n' "$api_keys" "$struct_keys" | grep -v '^$' | sort -u
}

# -----------------------------------------
# 删除缓存条目
# 参数: $1 - 缓存键
# -----------------------------------------
cache_db_delete() {
    local key="${1:-}" sql
    [ -n "$key" ] || return 1
    if _cache_db_is_api "$key"; then
        sql="$(_cache_db_sql delete "$key")" || return 1
        cache_db_query_raw "$sql" >/dev/null
    else
        _cache_db_cli delete "$key" >/dev/null
    fi
}
