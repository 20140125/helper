#!/bin/bash

# ======================================
# 原始 API 响应归档与日内复用公共库
# ======================================
#
# 功能说明：
#   1. 将聚合数据等三方 API 的原始 JSON 响应按"接口+参数+月份"
#      归档到 .cache/api_responses/ 目录，一月一文件，便于后续
#      溯源、二次渲染、审计
#   2. 提供日内复用能力：同一天、同一接口、同一参数，命中缓存时
#      直接读本地 JSON，不再调用远端 API（节省免费额度）
#   3. 保留策略：默认只保留最近 1 个自然月的月文件（详见
#      API_ARCHIVE_KEEP_MONTHS / prune_api_archive）。归档的定位是
#      "日内复用 + 当日溯源"，过去月份的数据对出卡片没有任何作用，
#      留着只会让 .cache 越滚越大，过期即清
#
# 归档路径（月文件，内部按日聚合）：
#   .cache/api_responses/<api>_<key>_<YYYY-MM>.json
#   例：
#     weather_深圳_2026-05.json
#     horoscope_水瓶座_today_2026-05.json
#     almanac_20260508_2026-05.json
#
# 月文件内部结构：
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
#   # 调用前先探缓存（注意返回的是"月文件路径"，但只代表"今日槽位"的意向）
#   cached_file="$(api_cache_path weather "${city}")"
#   if response="$(read_cached_api_response "${cached_file}")"; then
#       log_info "🗂  命中今日归档"
#   else
#       response=$(curl -s -m 10 "${api_url}?...")
#   archive_api_response "${cached_file}" "${response}"
#   fi
#
# 作者：智能提醒系统
# 更新：2026-05-08
# ======================================

# 归档根目录（依赖 project_config.sh 已加载 CACHE_DIR）
API_ARCHIVE_DIR="${CACHE_DIR}/api_responses"

# 归档保留月数：默认 1（只留当月）。想多留几个月用
# API_ARCHIVE_KEEP_MONTHS=3 覆盖；设为 0 或负数等价于只留当月
API_ARCHIVE_KEEP_MONTHS="${API_ARCHIVE_KEEP_MONTHS:-1}"

# -----------------------------------------
# 归档写入器（Python 源码，供 archive_api_response 用 python3 -c 调用）
# -----------------------------------------
# 响应体一律通过 stdin 传入，不走命令行参数：
#   Linux 单个参数上限为 128KiB（MAX_ARG_STRLEN=32*PAGE_SIZE），
#   维基百科「历史上的今天」响应约 280KB，走 argv 会触发 execve E2BIG，
#   python3 根本启动不了 —— 表现为"归档失败"但主流程照常出结果，极易被忽略。
# 槽位粒度：默认按天；环境变量 API_ARCHIVE_SLOT 可指定更细粒度：
#   hour   → YYYY-MM-DDTHH  （AQI、币价、地震这类小时内会变的数据）
#   minute → YYYY-MM-DDTHH:MM（行情类：同一分钟内的多张卡片共用一次请求）
# 细粒度槽位仍写进同一个月文件，只是 key 带上时/分。
# -----------------------------------------
_API_ARCHIVE_WRITE_PY="$(cat <<'PYEOF'
import json, os, re, sys
from datetime import datetime, timezone, timedelta

file_path = sys.argv[1]
body      = sys.stdin.read()

tz = timezone(timedelta(hours=8))
slot_fmt  = {'hour': '%Y-%m-%dT%H', 'minute': '%Y-%m-%dT%H:%M'}.get(
    os.environ.get('API_ARCHIVE_SLOT', 'day'), '%Y-%m-%d')
slot      = datetime.now(tz).strftime(slot_fmt)

# 从文件名反推 api / key / month（右侧先锚定月份，左侧按第一个下划线切分）
base = os.path.basename(file_path)
m = re.match(r'^(?P<rest>.+)_(?P<month>\d{4}-\d{2})\.json$', base)
if not m:
    # 文件名不符合约定，兜底直接落盘裸内容（原子写：先 tmp 再 rename）
    _tmp = '{}.tmp'.format(file_path)
    with open(_tmp, 'w', encoding='utf-8') as f:
        f.write(body)
    os.replace(_tmp, file_path)
    sys.exit(0)

rest  = m.group('rest')
month = m.group('month')
if '_' in rest:
    api, key = rest.split('_', 1)
else:
    api, key = rest, ''

# 读旧月文件（存在则合并）
doc = None
if os.path.isfile(file_path) and os.path.getsize(file_path) > 0:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            doc = json.load(f)
        if not isinstance(doc, dict) or not isinstance(doc.get('entries'), dict):
            doc = None
    except Exception:
        doc = None
    # 月文件读不出来（并发写一半 / 手工改坏）时先另存再重建，
    # 避免重建时把当月已归档的其它天静默清掉（与 dailyword_library.sh 同策略）
    if doc is None:
        try:
            _stamp = datetime.now(tz).strftime('%Y%m%d%H%M%S')
            os.replace(file_path, '{}.corrupt-{}'.format(file_path, _stamp))
        except Exception:
            pass

if doc is None:
    doc = {'api': api, 'key': key, 'month': month, 'entries': {}}

# body 原始串优先解析为 JSON 对象嵌入；失败则原样存为字符串
try:
    entry = json.loads(body)
except Exception:
    entry = body

doc['entries'][slot] = entry

# 原子写：先落 .tmp 再 rename，避免多个脚本并发归档时把月文件写坏
_tmp = '{}.tmp'.format(file_path)
with open(_tmp, 'w', encoding='utf-8') as f:
    json.dump(doc, f, ensure_ascii=False, indent=2, sort_keys=False)
    f.write('\n')
os.replace(_tmp, file_path)
PYEOF
)"

# -----------------------------------------
# 计算某个 API 响应的归档文件路径（月文件）
# 参数：
#   $1    - api 名（weather/horoscope/almanac/...）
#   $2... - 业务关键字（如城市、星座、日期），多个参数会拼接为 key
# 输出：
#   stdout 输出月文件完整路径（YYYY-MM 自动附加）
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
# 计算「单日/单次」归档文件路径（文件名即完整 key，不带月份后缀）
# -----------------------------------------
# 与 api_cache_path 的区别：
#   api_cache_path      → <api>_<key>_<YYYY-MM>.json   月文件，内部按天分槽
#                         （适合每天一个 key、一个月内要复用的场景，如天气）
#   api_cache_daily_path → <api>-<key>.json            一文件一响应，无分槽
#                         （适合 key 本身已是完整日期的场景，如「历史上的今天」，
#                           文件名写成 historytoday-2026-10-01.json 一眼可读，
#                           不像月文件那样出现 2026-10-01_2026-10 的月份重复）
# 参数：
#   $1    - api 名（不带下划线，如 historytoday）
#   $2... - 业务关键字（通常是完整日期 YYYY-MM-DD），多段用 "-" 连接
# 输出：
#   stdout 输出文件完整路径
# 说明：该文件由 archive_api_response 走「裸写」分支落盘（文件名不匹配月文件正则），
#       读取侧 read_cached_api_response 已同步支持无 entries 的整文件返回。
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
# 归档一条 API 响应（写入月文件的 entries[今日] 槽位）
# 参数：
#   $1 - 月文件路径（由 api_cache_path 生成）
#   $2 - 原始响应字符串
# 返回：
#   0 成功，1 失败
# -----------------------------------------
archive_api_response() {
    local file="$1"
    local body="$2"

    if [ -z "${file}" ]; then
        return 1
    fi
    if [ -z "${body}" ]; then
        return 1
    fi

    mkdir -p "$(dirname "${file}")" 2>/dev/null || return 1

    # 交给 Python 完成：读旧月文件 → 合并 → 格式化 JSON 回写
    # Python 对 JSON 的处理比 shell 安全得多（引号、转义、中文）
    # 响应体走 stdin（见 _API_ARCHIVE_WRITE_PY 上方注释：argv 有 128KiB 上限）
    printf '%s' "${body}" | python3 -c "${_API_ARCHIVE_WRITE_PY}" "${file}" || return 1

    # 顺手清理过期归档（每次写入都调，内部按天去重，开销可忽略）
    prune_api_archive
    return 0
}

# -----------------------------------------
# 清理过期归档：只保留最近 API_ARCHIVE_KEEP_MONTHS 个自然月
# -----------------------------------------
# 三类文件分别处理：
#   月文件    <api>_<key>_<YYYY-MM>.json  → 月份序号 < 阈值即删
#   单日文件  <api>-<YYYY-MM-DD>.json     → 日期 < 今天即删
#              （如 historytoday-2026-10-13.json）
#   损坏备份  <原文件名>.corrupt-<时间戳>  → 超过 7 天即删（保留 7 天供排查，
#              否则归档损坏一次就永久留一个文件）
# 不匹配的（如 horoscope_双子座.json、nagerholiday-CN-2026.json、
# .last_prune 标记文件）一律保留，不动。
#
# 执行频率：同一天内只跑一次，用 ${API_ARCHIVE_DIR}/.last_prune 记日期，
# 避免一天几十次归档反复扫目录。想强制跑一次：rm .last_prune 再归档。
# 清理失败不影响主流程（只是 .cache 会残留）。
# -----------------------------------------
prune_api_archive() {
    [ -d "${API_ARCHIVE_DIR}" ] || return 0

    local today stamp_file
    today=$(TZ=Asia/Shanghai date +%F)
    stamp_file="${API_ARCHIVE_DIR}/.last_prune"

    if [ -f "${stamp_file}" ] && [ "$(cat "${stamp_file}" 2>/dev/null)" = "${today}" ]; then
        return 0
    fi

    # Python 只负责"挑出"过期文件并逐行打印路径，真正删除交给 shell 的 rm：
    # 删除动作本身没什么逻辑，但某些环境下 python 的 os.remove 会被安全
    # 删除钩子接管（移到回收站），跨设备时直接崩，交给 rm 更稳。
    local expired removed=0
    expired=$(python3 - "${API_ARCHIVE_DIR}" "${API_ARCHIVE_KEEP_MONTHS}" "${today}" << 'PYEOF'
import os, re, sys, time
from datetime import date

dir_path, today = sys.argv[1], sys.argv[3]
try:
    keep = max(1, int(sys.argv[2]))
except ValueError:
    keep = 1

# 损坏备份（<原文件名>.corrupt-<时间戳>）保留 7 天供排查，之后清掉，避免永久堆积
CORRUPT_KEEP_DAYS = 7
now_ts = time.time()

cur = date.fromisoformat(today)
cutoff_month = cur.year * 12 + cur.month - (keep - 1)

for name in sorted(os.listdir(dir_path)):
    path = os.path.join(dir_path, name)
    if not os.path.isfile(path):
        continue

    if re.search(r'\.corrupt-\d{14}$', name):
        if now_ts - os.path.getmtime(path) > CORRUPT_KEEP_DAYS * 86400:
            print(path)
        continue

    m = re.match(r'^.+_(\d{4})-(\d{2})\.json$', name)
    if m:
        if int(m.group(1)) * 12 + int(m.group(2)) < cutoff_month:
            print(path)
        continue

    m = re.match(r'^.+?(\d{4}-\d{2}-\d{2})\.json$', name)
    if m and m.group(1) < today:
        print(path)
PYEOF
    )

    if [ -n "${expired}" ]; then
        local f
        # herestring 而非无引号 heredoc：后者会对内容做参数/命令替换，
        # 路径里若含 $ 或反引号会被展开（文件名来自城市名等外部输入）
        while IFS= read -r f; do
            [ -n "${f}" ] || continue
            rm -f -- "${f}" && removed=$((removed + 1))
        done <<< "${expired}"
    fi

    printf '%s' "${today}" > "${stamp_file}" 2>/dev/null

    if [ "${removed}" -gt 0 ]; then
        echo "🧹  清理过期归档 ${removed} 个（保留最近 ${API_ARCHIVE_KEEP_MONTHS} 个月）" >&2
    fi
    return 0
}

# -----------------------------------------
# 尝试从归档读取一条 API 响应（日内复用）
# 读月文件 entries[今日]，命中即返回
# 参数：
#   $1 - 月文件路径（由 api_cache_path 生成）
# 返回：
#   0 命中，stdout 输出原始响应字符串（通常是 JSON）
#   1 未命中或读取失败，stdout 无输出
# -----------------------------------------
read_cached_api_response() {
    local file="$1"

    if [ -z "${file}" ]; then
        return 1
    fi

    if [ ! -f "${file}" ] || [ ! -s "${file}" ]; then
        return 1
    fi

    local body
    body=$(python3 - "${file}" << 'PYEOF'
import json, os, sys
from datetime import datetime, timezone, timedelta

file_path = sys.argv[1]

# 槽位粒度与写入侧保持一致（默认按天，API_ARCHIVE_SLOT=hour 按小时）
tz = timezone(timedelta(hours=8))
slot_fmt = {'hour': '%Y-%m-%dT%H', 'minute': '%Y-%m-%dT%H:%M'}.get(
    os.environ.get('API_ARCHIVE_SLOT', 'day'), '%Y-%m-%d')
slot = datetime.now(tz).strftime(slot_fmt)

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        doc = json.load(f)
except Exception:
    sys.exit(2)

if not isinstance(doc, dict):
    sys.exit(2)

# 单日归档文件（api_cache_daily_path 生成，文件名形如 historytoday-2026-10-01.json）：
# 整个文件就是一条响应，没有 entries 分槽结构 —— 文件存在即视为命中
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
    )
    if [ $? -eq 0 ] && [ -n "${body}" ]; then
        # 原始输出模式（data / json）：暂存归档里的原始返回，供最后统一输出
        if [ "${CARD_OUTPUT_MODE:-card}" != "card" ] && command -v emit_raw >/dev/null 2>&1; then
            emit_raw "${body}"
        fi
        printf '%s' "${body}"
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
    local file="$1"
    shift

    if [ -z "${file}" ]; then
        return 1
    fi

    local body=""
    if body=$(read_cached_api_response "${file}") && [ -n "${body}" ]; then
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

    archive_api_response "${file}" "${body}" || \
        echo "⚠️  归档失败（${file}），不影响本次使用" >&2

    # 原始输出模式（data / json）：暂存本次请求的原始返回，供最后统一输出
    if [ "${CARD_OUTPUT_MODE:-card}" != "card" ] && command -v emit_raw >/dev/null 2>&1; then
        emit_raw "${body}"
    fi
    printf '%s' "${body}"
    return 0
}
