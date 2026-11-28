#!/bin/bash

# ======================================
# 缓存数据库通道（分表 JSON 真源 / 读写）
# ======================================
#
# 功能说明：
#   1. 复用 log_db.sh 的 MySQL 连接配置
#   2. 提供 cache_db_read / cache_db_write / cache_db_exists / cache_db_list / cache_db_delete
#   3. 全部按缓存键读写数据库，不物化本地文件
#
# 设计约束：
#   - 运行时不再读写 .cache 下的任何文件，按缓存键路由到独立数据表
#   - api_responses/*.json 按资源类型落到 hp_cache_res_*；
#     其余键（含 api_responses/.last_prune）读写 sql/ 里已有的业务表或 hp_cache_res_other（web/utils/database/cache-tables.ts）
#   - 分类表按 period_type / period_key 显式记录时间粒度：
#     day → YYYY-MM-DD、month → YYYY-MM、year → YYYY，静态数据为 static + 空串
#     星座运势文件名无日期，按项目时区（UTC+8）取当前年份（current-year）
#   - 旧库缺少粒度列时，首次写入自动幂等补列 / 补索引
#   - 写 SQL 通过 stdin 传给 mysql，避免大 JSON 超出命令行参数长度限制
#   - 所有函数可被 source；除 cache_db_read / cache_db_list 外不产生 stdout
#
# 使用方式：
#   source "${PROJECT_DIR}/cache_db.sh"
#   cache_db_read 'greetings.json' | jq -r '.birthday[0]'
#   jq '.[] | .id' <<< "$(cache_db_read 'custom_rules.json')"
#   cache_db_write 'greetings.json' "$body"
#   cache_db_exists 'custom_rules.json'
#   cache_db_delete 'daily_data_2026-11-27.json'
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
# (前缀, 分类表, 时间粒度)；auto 表示从缓存键里的日期自动推断，
# current-year 表示文件名里没有日期、按项目时区（UTC+8）取当前年份
ROUTES = [
    ('almanac_', 'hp_cache_res_calendar', 'month'),
    ('nagerholiday-', 'hp_cache_res_holiday', 'year'),
    ('weather_', 'hp_cache_res_weather', 'month'),
    ('horoscope_', 'hp_cache_res_horoscope', 'current-year'),
    ('historytoday-', 'hp_cache_res_history', 'day'),
    ('gtimgquotes_', 'hp_cache_res_finance', 'month'),
    # 热搜榜单五个平台共用一张表，asset_key 保留平台前缀
    ('tencenthot_', 'hp_cache_res_hot_list', 'month'),
    ('weibohot_', 'hp_cache_res_hot_list', 'month'),
    ('bilibilihot_', 'hp_cache_res_hot_list', 'month'),
    ('douyinhot_', 'hp_cache_res_hot_list', 'month'),
    ('iqiyihot_', 'hp_cache_res_hot_list', 'month'),
    ('dailyword_', 'hp_cache_res_quote', 'month'),
    ('video_', 'hp_cache_res_video', 'static'),
    ('image_', 'hp_cache_res_image', 'static'),
    ('news_', 'hp_cache_res_news', 'static'),
    ('', 'hp_cache_res_other', 'auto'),
]
# 需保留文件名前缀作为 asset_key 的表（按平台区分数据，避免同月份撞键）
KEEP_PREFIX_TABLES = {'hp_cache_res_hot_list'}
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

def period_of(stored, granularity):
    if granularity == 'static':
        return ('static', '')
    if granularity == 'current-year':
        return ('year', str(time.gmtime(time.time() + 8 * 3600).tm_year))
    order = ['day', 'month', 'year'] if granularity == 'auto' else [granularity]
    for kind in order:
        m = re.search(PERIOD_PATTERNS[kind], stored)
        if m:
            return (kind, m.group(0))
    return ('static', '')

def target(key):
    if key.startswith(API_PREFIX) and key.endswith('.json'):
        name = key[len(API_PREFIX):]
        base = name[:-5]
        route = next((r for r in ROUTES if r[0] and base.startswith(r[0])), None)
        if route:
            prefix, table, granularity = route
            stored = base if table in KEEP_PREFIX_TABLES else base[len(prefix):]
        else:
            table, stored, granularity = 'hp_cache_res_other', key, 'auto'
        period_type, period_key = period_of(stored, granularity)
        return (table, 'asset_key', 'body', 'cache_updated_at', stored, period_type, period_key)
    raise ValueError('非 api_responses/*.json 缓存键请使用业务表 CLI')

def union_sql():
    parts = []
    seen = set()
    for prefix, table, _ in ROUTES:
        if not prefix or table in seen:
            continue
        seen.add(table)
        used_prefix = '' if table in KEEP_PREFIX_TABLES else prefix
        parts.append(
            "SELECT CONCAT(%s, %s, asset_key, '.json') AS file_key, LENGTH(body) AS size, "
            "cache_updated_at AS updated_at FROM `%s`"
            % (quote(API_PREFIX), quote(used_prefix), table)
        )
    parts.append(
        "SELECT asset_key AS file_key, LENGTH(body) AS size, cache_updated_at AS updated_at "
        "FROM `hp_cache_res_other`"
    )
    return ' UNION ALL '.join(parts)

# 旧库幂等补列/补索引：不存在的表或已存在的列/索引都退化为 SELECT 1
def ensure_period_sql():
    lines = []
    for table in dict.fromkeys(t for _, t, _ in ROUTES):
        checks = [
            ('information_schema.COLUMNS', 'COLUMN_NAME', 'period_type',
             'ALTER TABLE `%s` %s' % (table, PERIOD_TYPE_DDL)),
            ('information_schema.COLUMNS', 'COLUMN_NAME', 'period_key',
             'ALTER TABLE `%s` %s' % (table, PERIOD_KEY_DDL)),
            ('information_schema.STATISTICS', 'INDEX_NAME', 'idx_cache_period',
             'ALTER TABLE `%s` ADD KEY `idx_cache_period` (`period_type`, `period_key`)' % table),
        ]
        for source, col, name, ddl in checks:
            lines.append(
                "SET @ddl = (SELECT IF(EXISTS(SELECT 1 FROM information_schema.TABLES "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s) "
                "AND NOT EXISTS(SELECT 1 FROM %s WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = %s AND %s = %s), %s, 'SELECT 1'));"
                % (quote(table), source, quote(table), col, quote(name), quote(ddl))
            )
            lines.append('PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;')
    return '\n'.join(lines)

op = os.environ.get('CACHE_DB_OP', 'read')
key = os.environ.get('CACHE_DB_KEY', '')

if op == 'list':
    print("SELECT file_key FROM (%s) AS cache_entries WHERE file_key LIKE %s ORDER BY file_key;"
          % (union_sql(), quote(key + '%')))
elif op == 'ensure_period':
    print(ensure_period_sql())
else:
    table, key_col, body_col, time_col, stored, period_type, period_key = target(key)
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
        print("INSERT INTO `%s` (`%s`, `%s`, `%s`, `period_type`, `period_key`) VALUES (%s, %s, %d, %s, %s) "
              "ON DUPLICATE KEY UPDATE `%s` = VALUES(`%s`), `%s` = VALUES(`%s`), "
              "`period_type` = VALUES(`period_type`), `period_key` = VALUES(`period_key`);"
              % (table, key_col, body_col, time_col, quote(stored), quote(body), ts,
                 quote(period_type), quote(period_key),
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
# 确保分类表带时间粒度列（旧库幂等迁移，进程内只跑一次）
# 说明: 仅当存在缺列 / 缺索引的 hp_cache_res_* 表时才补 DDL
# -----------------------------------------
_CACHE_DB_PERIOD_ENSURED=0
_cache_db_ensure_period_columns() {
    [ "$_CACHE_DB_PERIOD_ENSURED" = "1" ] && return 0
    local missing
    missing="$(cache_db_query_raw "SELECT COUNT(*) FROM information_schema.TABLES t WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME LIKE 'hp_cache_res_%' AND (NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS c WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME AND c.COLUMN_NAME = 'period_type') OR NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS c WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME AND c.COLUMN_NAME = 'period_key') OR NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA = t.TABLE_SCHEMA AND s.TABLE_NAME = t.TABLE_NAME AND s.INDEX_NAME = 'idx_cache_period'));")" || return 1
    case "${missing:-}" in
        ''|*[!0-9]*) missing=0 ;;
    esac
    if [ "$missing" -gt 0 ]; then
        CACHE_DB_OP=ensure_period python3 -c "$_CACHE_DB_SQL_PY" | cache_db_exec_stdin || return 1
    fi
    _CACHE_DB_PERIOD_ENSURED=1
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
        _cache_db_ensure_period_columns || return 1
        sql="$(printf '%s' "$body" | CACHE_DB_OP=write CACHE_DB_KEY="$key" python3 -c "$_CACHE_DB_SQL_PY")" || return 1
        printf '%s' "$sql" | cache_db_exec_stdin
    else
        printf '%s' "$body" | _cache_db_cli write "$key"
    fi
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
