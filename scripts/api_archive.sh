#!/bin/bash

# ======================================
# 原始 API 响应归档与日内复用公共库
# ======================================
#
# 功能说明：
#   1. 将聚合数据等三方 API 的原始 JSON 响应按"接口+参数+月份"
#      归档到 hp_cache_res_* 表（key 为 api_responses/<文件名>），一月一条，
#      便于后续溯源、二次渲染、审计；运行时不再读写 .cache 下的任何文件
#   2. 提供日内复用能力：同一天、同一接口、同一参数，命中缓存时
#      直接读库里的 JSON，不再调用远端 API（节省免费额度）
#   3. 保留策略：默认只保留最近 1 个自然月的月条目（详见
#      API_ARCHIVE_KEEP_MONTHS / prune_api_archive）。归档的定位是
#      "日内复用 + 当日溯源"，过期即清
#
# 归档 key（月条目，内部按日聚合，相对 .cache 的路径）：
#   api_responses/<api>_<key>_<YYYY-MM>.json
#   例：
#     weather_深圳_2026-05.json
#     horoscope_水瓶座_today_2026-05.json
#     almanac_20260508_2026-05.json
#
# 月条目内部结构：
#   {
#     "api":   "weather",
#     "key":   "深圳",
#     "month": "2026-05",
#     "entries": {
#        "2026-05-08": { ...原始 API JSON... },
#        "2026-05-09": { ...原始 API JSON... }
#     }
#   }
#
# 使用方式（在 fetch_real_*.sh 中，契约与旧版完全兼容）：
#   source "${PROJECT_DIR}/api_archive.sh"
#
#   # 注意：api_cache_path / api_cache_daily_path 返回的是缓存 key，不是磁盘路径
#   cached_key="$(api_cache_path weather "${city}")"
#   if response="$(read_cached_api_response "${cached_key}")"; then
#       log_info "🗂  命中今日归档"
#   else
#       response=$(curl -s -m 10 "${api_url}?...")
#   archive_api_response "${cached_key}" "${response}"
#   fi
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 缓存数据库通道（调用方已加载 project_config.sh；这里做幂等兜底）
_ARCHIVE_PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
if ! declare -F cache_db_read >/dev/null 2>&1; then
    source "${_ARCHIVE_PROJECT_DIR}/cache_db.sh"
fi

# 归档 key 前缀（相对 .cache 的路径，对应 hp_cache_res_* 分类表的 asset_key）
# 说明：保留变量名 API_ARCHIVE_DIR 以兼容既有引用，值已从磁盘目录改为 KV 前缀
API_ARCHIVE_DIR="api_responses"

# 归档保留月数：默认 1（只留当月）。想多留几个月用
# API_ARCHIVE_KEEP_MONTHS=3 覆盖；设为 0 或负数等价于只留当月
API_ARCHIVE_KEEP_MONTHS="${API_ARCHIVE_KEEP_MONTHS:-1}"

# -----------------------------------------
# 跨平台 JSON 字段提取（替代 GNU grep -oP / \K）
# macOS BSD grep 不支持 -P，原来 "'\"key\":\\s*\"\\K[^\"]+'" 会直接报
# "grep: invalid option -- P"，导致聚合数据接口全部被误判为失败。
# 这里用 grep -Eo + sed 实现同样的「取第 nth 个同名字段」语义。
# 参数：
#   $1 - JSON 文本
#   $2 - 字段名
#   $3 - 第几个同名字段（默认 1）
# -----------------------------------------
json_get_string() {
    local json="$1" key="$2" nth="${3:-1}"
    printf '%s' "$json" | grep -Eo "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" 2>/dev/null \
        | sed -E "s/^\"${key}\"[[:space:]]*:[[:space:]]*\"(.*)\"\$/\1/" \
        | sed -n "${nth}p"
}

json_get_number() {
    local json="$1" key="$2" nth="${3:-1}"
    printf '%s' "$json" | grep -Eo "\"${key}\"[[:space:]]*:[[:space:]]*-?[0-9]+" 2>/dev/null \
        | sed -E "s/^\"${key}\"[[:space:]]*:[[:space:]]*//" \
        | sed -n "${nth}p"
}

# -----------------------------------------
# 归档写入器（Python 源码，供 archive_api_response 用 python3 -c 调用）
# -----------------------------------------
# 响应体一律通过 stdin 传入，不走命令行参数：
#   Linux 单个参数上限为 128KiB（MAX_ARG_STRLEN=32*PAGE_SIZE），
#   维基百科「历史上的今天」响应约 280KB，走 argv 会触发 execve E2BIG，
#   python3 根本启动不了 —— 表现为"归档失败"但主流程照常出结果，极易被忽略。
# stdin 布局（大文本既不走 argv，也不落任何临时文件）：
#   第一行 = 旧缓存全文的字节数；其后依次拼接「旧缓存全文」+「本次响应全文」
#   Python 按长度切出两段，合并/格式化后把最终全文输出到 stdout，
#   由 shell 交给 cache_db_write 写回同一个 key。
# 槽位粒度：默认按天；环境变量 API_ARCHIVE_SLOT 可指定更细粒度：
#   hour   → YYYY-MM-DDTHH  （AQI、币价、地震这类小时内会变的数据）
#   minute → YYYY-MM-DDTHH:MM（行情类：同一分钟内的多张卡片共用一次请求）
# 细粒度槽位仍写进同一个月条目，只是 key 带上时/分。
# 非月条目（如 historytoday-2026-10-01.json）走「裸写」分支：
#   整条缓存就是一条响应，原样输出，不做分槽合并。
# -----------------------------------------
_API_ARCHIVE_WRITE_PY="$(cat <<'PYEOF'
import json, os, re, sys
from datetime import datetime, timezone, timedelta

cache_key = sys.argv[1]
raw = sys.stdin.buffer.read()
sep = raw.find(b'\n')
old_len = int(raw[:sep])
buf = raw[sep + 1:]
old_body = buf[:old_len].decode('utf-8')
body = buf[old_len:].decode('utf-8')

tz = timezone(timedelta(hours=8))
slot_fmt = {'hour': '%Y-%m-%dT%H', 'minute': '%Y-%m-%dT%H:%M'}.get(
    os.environ.get('API_ARCHIVE_SLOT', 'day'), '%Y-%m-%d')
slot = datetime.now(tz).strftime(slot_fmt)

# 从 key 的文件名反推 api / key / month（右侧先锚定月份，左侧按第一个下划线切分）
base = os.path.basename(cache_key)
m = re.match(r'^(?P<rest>.+)_(?P<month>\d{4}-\d{2})\.json$', base)
if not m:
    # 文件名不符合月条目约定，整条缓存即一条响应，原样写回
    sys.stdout.write(body)
    sys.exit(0)

rest = m.group('rest')
month = m.group('month')
if '_' in rest:
    api, key = rest.split('_', 1)
else:
    api, key = rest, ''

# 读旧月条目（存在则合并）
# 旧版在月文件读不出来时会另存 .corrupt-<时间戳> 备份再重建；
# KV 通道没有"另存"概念，直接重建即可，不会污染其它 key。
doc = None
if old_body.strip():
    try:
        doc = json.loads(old_body)
        if not isinstance(doc, dict) or not isinstance(doc.get('entries'), dict):
            doc = None
    except Exception:
        doc = None

if doc is None:
    doc = {'api': api, 'key': key, 'month': month, 'entries': {}}

# body 原始串优先解析为 JSON 对象嵌入；失败则原样存为字符串
try:
    entry = json.loads(body)
except Exception:
    entry = body

doc['entries'][slot] = entry

sys.stdout.write(json.dumps(doc, ensure_ascii=False, indent=2, sort_keys=False) + '\n')
PYEOF
)"

# -----------------------------------------
# 计算某个 API 响应的归档 key（月条目）
# 参数：
#   $1    - api 名（weather/horoscope/almanac/...）
#   $2... - 业务关键字（如城市、星座、日期），多个参数会拼接为 key
# 输出：
#   stdout 输出缓存 key（api_responses/<api>_<key>_<YYYY-MM>.json）
# -----------------------------------------
api_cache_path() {
    local api="$1"
    shift
    local month
    month=$(TZ=Asia/Shanghai date +%Y-%m)

    # 把业务关键字拼接为 key，并做安全处理（空格/斜杠转下划线）
    local key=""
    local part
    for part in "$@"; do
        [ -z "${part}" ] && continue
        if [ -z "${key}" ]; then
            key="${part}"
        else
            key="${key}_${part}"
        fi
    done
    key=$(printf '%s' "${key}" | tr ' /' '__')

    if [ -z "${key}" ]; then
        echo "${API_ARCHIVE_DIR}/${api}_${month}.json"
    else
        echo "${API_ARCHIVE_DIR}/${api}_${key}_${month}.json"
    fi
}

# -----------------------------------------
# 计算「单日/单次」归档 key（文件名即完整 key，不带月份后缀）
# -----------------------------------------
# 与 api_cache_path 的区别：
#   api_cache_path      → <api>_<key>_<YYYY-MM>.json   月条目，内部按天分槽
#                         （适合每天一个 key、一个月内要复用的场景，如天气）
#   api_cache_daily_path → <api>-<key>.json            一条缓存一响应，无分槽
#                         （适合 key 本身已是完整日期的场景，如「历史上的今天」，
#                           写成 historytoday-2026-10-01.json 一眼可读，
#                           不像月条目那样出现 2026-10-01_2026-10 的月份重复）
# 参数：
#   $1    - api 名（不带下划线，如 historytoday）
#   $2... - 业务关键字（通常是完整日期 YYYY-MM-DD），多段用 "-" 连接
# 输出：
#   stdout 输出缓存 key
# 说明：该 key 由 archive_api_response 走「裸写」分支入库（文件名不匹配月条目正则），
#       读取侧 read_cached_api_response 已同步支持无 entries 的整条返回。
# -----------------------------------------
api_cache_daily_path() {
    local api="$1"
    shift
    local key=""
    local part
    for part in "$@"; do
        [ -z "${part}" ] && continue
        if [ -z "${key}" ]; then
            key="${part}"
        else
            key="${key}-${part}"
        fi
    done
    key=$(printf '%s' "${key}" | tr ' /' '--')

    if [ -z "${key}" ]; then
        echo "${API_ARCHIVE_DIR}/${api}.json"
    else
        echo "${API_ARCHIVE_DIR}/${api}-${key}.json"
    fi
}

# -----------------------------------------
# 归档一条 API 响应（写入月条目的 entries[今日] 槽位）
# 参数：
#   $1 - 缓存 key（由 api_cache_path / api_cache_daily_path 生成）
#   $2 - 原始响应字符串
# 返回：
#   0 成功，1 失败
# -----------------------------------------
archive_api_response() {
    local key="$1"
    local body="$2"

    if [ -z "${key}" ]; then
        return 1
    fi
    if [ -z "${body}" ]; then
        return 1
    fi

    # 旧缓存全文 + 本次响应全文一次喂给写入器（见 _API_ARCHIVE_WRITE_PY 上方注释）
    local old_body old_bytes merged
    old_body="$(cache_db_read "${key}")" || old_body=''
    old_bytes="$(printf '%s' "${old_body}" | wc -c | tr -d ' ')"
    merged="$({ printf '%s\n' "${old_bytes}"; printf '%s' "${old_body}"; printf '%s' "${body}"; } \
        | python3 -c "${_API_ARCHIVE_WRITE_PY}" "${key}")" || return 1
    [ -n "${merged}" ] || return 1

    # Python 对 JSON 的处理比 shell 安全得多（引号、转义、中文）
    cache_db_write "${key}" "${merged}" || return 1

    # 顺手清理过期归档（每次写入都调，内部按天去重，开销可忽略）
    prune_api_archive
    return 0
}

# -----------------------------------------
# 过期归档挑选器（Python 源码，供 prune_api_archive 用 python3 -c 调用）
# stdin：cache_db_list 输出的 key 列表（每行一个）；stdout：过期 key 列表
# -----------------------------------------
_API_ARCHIVE_PRUNE_PY="$(cat <<'PYEOF'
import re, sys
from datetime import date

try:
    keep = max(1, int(sys.argv[1]))
except ValueError:
    keep = 1
today = sys.argv[2]
cur = date.fromisoformat(today)
cutoff_month = cur.year * 12 + cur.month - (keep - 1)

for line in sys.stdin:
    key = line.strip()
    if not key:
        continue
    name = key.rsplit('/', 1)[-1]
    if not name.endswith('.json'):
        continue
    m = re.match(r'^.+_(\d{4})-(\d{2})\.json$', name)
    if m:
        if int(m.group(1)) * 12 + int(m.group(2)) < cutoff_month:
            print(key)
        continue
    m = re.match(r'^.+?(\d{4}-\d{2}-\d{2})\.json$', name)
    if m and m.group(1) < today:
        print(key)
PYEOF
)"

# -----------------------------------------
# 清理过期归档：只保留最近 API_ARCHIVE_KEEP_MONTHS 个自然月
# -----------------------------------------
# 两类 key 分别处理：
#   月条目    <api>_<key>_<YYYY-MM>.json  → 月份序号 < 阈值即删
#   单日条目  <api>-<YYYY-MM-DD>.json     → 日期 < 今天即删
#              （如 historytoday-2026-10-13.json）
# 不匹配的（如 horoscope_双子座.json、nagerholiday-CN-2026.json、
# .last_prune 标记）一律保留，不动。
# 旧版的 .corrupt-<时间戳> 损坏备份由文件系统另存产生，KV 通道不再生成，
# 因此无需备份清理分支。
#
# 执行频率：同一天内只跑一次，用 api_responses/.last_prune 这条 KV 记日期，
# 避免一天几十次归档反复扫库。想强制跑一次：
#   cache_db_delete 'api_responses/.last_prune'
# 清理失败不影响主流程。
# -----------------------------------------
prune_api_archive() {
    local today stamp_key
    today=$(TZ=Asia/Shanghai date +%F)
    stamp_key="api_responses/.last_prune"

    if [ "$(cache_db_read "${stamp_key}")" = "${today}" ]; then
        return 0
    fi

    # Python 只负责"挑出"过期 key 并逐行打印，删除统一交给 cache_db_delete
    local keys expired removed=0
    keys="$(cache_db_list 'api_responses/')" || return 0
    if [ -z "${keys}" ]; then
        cache_db_write "${stamp_key}" "${today}" || true
        return 0
    fi
    expired="$(printf '%s\n' "${keys}" \
        | python3 -c "${_API_ARCHIVE_PRUNE_PY}" "${API_ARCHIVE_KEEP_MONTHS}" "${today}")" || return 0

    if [ -n "${expired}" ]; then
        local k
        # herestring 而非无引号 heredoc：后者会对内容做参数/命令替换，
        # key 里若含 $ 或反引号会被展开（key 来自城市名等外部输入）
        while IFS= read -r k; do
            [ -n "${k}" ] || continue
            cache_db_delete "${k}" && removed=$((removed + 1))
        done <<< "${expired}"
    fi

    cache_db_write "${stamp_key}" "${today}" || true

    if [ "${removed}" -gt 0 ]; then
        echo "🧹  清理过期归档 ${removed} 个（保留最近 ${API_ARCHIVE_KEEP_MONTHS} 个月）" >&2
    fi
    return 0
}

# -----------------------------------------
# 归档读取器（Python 源码，供 read_cached_api_response 用 python3 -c 调用）
# 缓存全文从 stdin 传入；stdout 输出当前槽位的原始响应字符串
# -----------------------------------------
_API_ARCHIVE_READ_PY="$(cat <<'PYEOF'
import json, os, sys
from datetime import datetime, timezone, timedelta

# 槽位粒度与写入侧保持一致（默认按天，API_ARCHIVE_SLOT=hour 按小时）
tz = timezone(timedelta(hours=8))
slot_fmt = {'hour': '%Y-%m-%dT%H', 'minute': '%Y-%m-%dT%H:%M'}.get(
    os.environ.get('API_ARCHIVE_SLOT', 'day'), '%Y-%m-%d')
slot = datetime.now(tz).strftime(slot_fmt)

try:
    doc = json.loads(sys.stdin.read())
except Exception:
    sys.exit(2)

if not isinstance(doc, dict):
    sys.exit(2)

# 单日归档（api_cache_daily_path 生成，如 historytoday-2026-10-01.json）：
# 整条缓存就是一条响应，没有 entries 分槽结构 —— 读到即视为命中
if 'entries' in doc:
    entry = doc.get('entries', {}).get(slot)
    if entry is None:
        sys.exit(2)
else:
    entry = doc

# entry 可能是 dict（原始 JSON）或 str（原样落盘）
if isinstance(entry, str):
    print(entry, end='')
else:
    print(json.dumps(entry, ensure_ascii=False), end='')
PYEOF
)"

# -----------------------------------------
# 尝试从归档读取一条 API 响应（日内复用）
# 读月条目 entries[今日]，命中即返回
# 参数：
#   $1 - 缓存 key（由 api_cache_path / api_cache_daily_path 生成）
# 返回：
#   0 命中，stdout 输出原始响应字符串（通常是 JSON）
#   1 未命中或读取失败，stdout 无输出
# -----------------------------------------
read_cached_api_response() {
    local key="$1"

    if [ -z "${key}" ]; then
        return 1
    fi

    local body
    body="$(cache_db_read "${key}")" || return 1
    [ -n "${body}" ] || return 1

    local entry
    entry="$(printf '%s' "${body}" | python3 -c "${_API_ARCHIVE_READ_PY}")" || return 1
    if [ -n "${entry}" ]; then
        # 原始输出模式（data / json）：暂存归档里的原始返回，供最后统一输出
        if [ "${CARD_OUTPUT_MODE:-card}" != "card" ] && command -v emit_raw >/dev/null 2>&1; then
            emit_raw "${entry}"
        fi
        printf '%s' "${entry}"
        return 0
    fi

    return 1
}

# -----------------------------------------
# 带归档缓存的 curl（推荐入口，一行接入日内复用）
# 用法：
#   cached_curl "$(api_cache_path <api> [key...])" <curl 参数...>
# 行为：
#   1) 命中当前槽位缓存 → 直接输出，不发起网络请求
#   2) 未命中 → 执行 curl，成功后归档再输出
#   3) curl 失败或响应为空 → 重试 3 次（间隔 2s），仍失败返回 1 且无输出
# 说明：归档失败不阻断（数据已拿到，缓存只是优化），只在 stderr 留痕
# -----------------------------------------
cached_curl() {
    local key="$1"
    shift

    if [ -z "${key}" ]; then
        return 1
    fi

    local body=""
    if body=$(read_cached_api_response "${key}") && [ -n "${body}" ]; then
        # 原始输出模式（data / json）：暂存缓存里的原始返回，供最后统一输出
        if [ "${CARD_OUTPUT_MODE:-card}" != "card" ] && command -v emit_raw >/dev/null 2>&1; then
            emit_raw "${body}"
        fi
        printf '%s' "${body}"
        return 0
    fi

    # 请求：失败重试（默认 3 次，间隔 2s）
    #   - -f：HTTP >= 400 视为失败，避免错误页/404 被当正常数据归档，
    #     然后日内复用一直命中错误缓存（与 exchange_rate.sh 的 result 校验同理）
    #   - 空 body 也算失败：实测必应壁纸接口会「HTTP 200 + 空 body」地偶发抽风，
    #     不重试的话 cron 抓到空就整天出不了图
    #   - 次数/间隔可用 API_CACHE_RETRY / API_CACHE_RETRY_SLEEP 覆盖
    local max_attempts="${API_CACHE_RETRY:-3}"
    local retry_sleep="${API_CACHE_RETRY_SLEEP:-2}"
    local attempt=1
    while [ "${attempt}" -le "${max_attempts}" ]; do
        if body=$(curl -f "$@") && [ -n "${body}" ]; then
            break
        fi
        body=""
        attempt=$((attempt + 1))
        if [ "${attempt}" -le "${max_attempts}" ]; then
            sleep "${retry_sleep}"
        fi
    done

    if [ -z "${body}" ]; then
        echo "⚠️  请求失败（已重试 ${max_attempts} 次）" >&2
        return 1
    fi

    archive_api_response "${key}" "${body}" || \
        echo "⚠️  归档失败（${key}），不影响本次使用" >&2

    # 原始输出模式（data / json）：暂存本次请求的原始返回，供最后统一输出
    if [ "${CARD_OUTPUT_MODE:-card}" != "card" ] && command -v emit_raw >/dev/null 2>&1; then
        emit_raw "${body}"
    fi
    printf '%s' "${body}"
    return 0
}
