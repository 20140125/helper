#!/bin/bash

# ======================================
# 每日一词历史库（只增不删）+ 每日励志语录库追加
# ======================================
#
# 背景：
#   .cache/api_responses/dailyword_<YYYY-MM>.json 是「原始响应归档」，
#   定位是日内复用，按 prune_api_archive() 只保留最近 1 个自然月。
#   但每日一言是内容素材（金山词霸每日英语 + 一言语录），历史越久越值钱，
#   不该随归档一起被清掉 —— 因此单独沉淀一份历史库：
#
#     .cache/dailyword_library.json
#     {
#       "description": "每日一词历史沉淀（金山词霸每日英语 + 一言语录），只增不删",
#       "updated_at": "2026-10-14",
#       "entries": {
#         "2026-05-12": {"english": "...", "chinese": "...", "quote": "...", "from": "..."},
#         "2026-05-13": { ... }
#       }
#     }
#
# 最终落地：每日一词 → 每日励志
#   历史库只解决「留档」，取数后还要让句子真正被用起来：
#   每日一词的中文名言（quote）会追加进 .cache/reminder_quotes.json 的
#   quotes.quotes（每日励志语录库，get_quote_* 系列与 Web 管理端共用），
#   之后早安播报 / 工作日提醒等场景就能随机取到这些句子。
#   英文部分只进历史库，不混进中文励志库。
#
# 规则：
#   1. 历史库以「天」为 key，天然去重；同一天已存在则保留首次，不覆盖
#      （凌晨预取和白天出卡片会各跑一次，结果应当一致）
#      例外：已存在的条目若有空字段（如 iciba 失效期写入的残缺数据），
#      允许用后续完整数据补全，避免坏数据被「保留首次」永久固化
#   2. 历史库不设条数上限：一条约 100 字节，一年 365 条也只有几十 KB
#   3. 追加励志库按「句子」去重（忽略标点空白），命中则跳过
#   4. 追加前做轻量体检：长度 8~80 字、不含明显消极词（可用环境变量
#      DAILYWORD_QUOTE_BLOCKLIST 追加自定义词，逗号分隔）
#   5. 沉淀 / 追加失败只打日志，不影响卡片 / 早安播报出结果
#   6. 残缺数据不入库：quote / english / chinese 任一为空直接跳过
#      （2026-10-28 起 open.iciba.com/dsapi/ 失效，取数兜底曾把只有 quote
#       的 JSON 沉淀进来，导致历史库连续多天空英文）
#
# 使用方式：
#   source "${PROJECT_DIR}/dailyword_library.sh"
#   persist_dailyword "${items_json}"    # items_json 含 english/chinese/quote/from
#   dailyword_fallback_english          # iciba 失效时从历史沉淀取一句降级
#
# 调用点（两条取数路径都要覆盖）：
#   - scripts/tools/daily_word.sh      卡片脚本 + 预取共用的 fetch_data
#   - scripts/daily_data_manager/prefetch.sh   凌晨预取（早安播报）
#
# 作者：智能提醒系统
# 更新：2026-11-06
# ======================================

# 历史库文件路径（依赖 project_config.sh 导出的 CACHE_DIR，未加载时按脚本位置兜底）
DAILYWORD_LIBRARY="${CACHE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.cache}/dailyword_library.json"
# 每日励志语录库（每日一词的最终落地位置；Web 管理端也读写同一文件）
REMINDER_QUOTES_JSON="${CACHE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.cache}/reminder_quotes.json"

# -----------------------------------------
# 沉淀写入器（Python 源码，供 persist_dailyword 用 python3 -c 调用）
# -----------------------------------------
# 与归档库一致：响应体走 stdin，不走 argv（避免大 payload 触发 E2BIG）
# 退出码：0 写入或已存在；1 数据无效（调用方静默忽略）
# -----------------------------------------
_DAILYWORD_PERSIST_PY="$(cat <<'PYEOF'
import json, os, sys
from datetime import datetime, timezone, timedelta

lib_path = sys.argv[1]
body     = sys.stdin.read()

tz    = timezone(timedelta(hours=8))
today = datetime.now(tz).strftime('%Y-%m-%d')

try:
    item = json.loads(body)
except Exception:
    sys.exit(1)
if not isinstance(item, dict) or not item.get('quote'):
    sys.exit(1)
# 三个正文字段必须齐全：空值入库等于把取数失败固化成「历史事实」，
# 之后同一天再拿到完整数据也不会被「保留首次」覆盖
if not item.get('english') or not item.get('chinese'):
    sys.exit(1)

doc = None
if os.path.isfile(lib_path) and os.path.getsize(lib_path) > 0:
    try:
        with open(lib_path, 'r', encoding='utf-8') as f:
            doc = json.load(f)
        if not isinstance(doc, dict) or not isinstance(doc.get('entries'), dict):
            doc = None
    except Exception:
        doc = None
    # 库读不出来（写一半被中断 / 手工改坏）时，先另存一份再重建：
    # 历史只增不删，直接重建等于静默清空全部沉淀，必须先留证据
    if doc is None:
        try:
            stamp = datetime.now(tz).strftime('%Y%m%d%H%M%S')
            os.replace(lib_path, '{}.corrupt-{}'.format(lib_path, stamp))
        except Exception:
            pass

if doc is None:
    doc = {
        'description': '每日一词历史沉淀（金山词霸每日英语 + 一言语录），按天去重，只增不删',
        'updated_at': today,
        'entries': {},
    }

entry = {
    'english': item.get('english', ''),
    'chinese': item.get('chinese', ''),
    'quote':   item.get('quote', ''),
    'from':    item.get('from', ''),
}
# 可选溯源字段：仅降级 / 回填数据会带，正常条目保持原有 4 字段结构
if item.get('english_source'):
    entry['english_source'] = item['english_source']

# 同一天已存在则保留首次，不覆盖（预取与出卡片同跑一天时结果一致）；
# 但旧条目若有空字段，用本次完整数据补齐（修复 iciba 失效期写入的残缺条目）
if today in doc['entries']:
    old = doc['entries'][today]
    if not isinstance(old, dict):
        sys.exit(1)
    changed = False
    for key, val in entry.items():
        if not old.get(key) and val:
            old[key] = val
            changed = True
    # 英文被补全时同步修正来源标记，避免降级条目一直挂着 fallback 标记
    if changed and entry.get('english_source') and old.get('english') == entry['english']:
        old['english_source'] = entry['english_source']
    if not changed:
        sys.exit(0)
else:
    doc['entries'][today] = entry
doc['updated_at'] = today

# 原子写：先落 .tmp 再 rename，避免预取与出卡片并发写时把库写坏
tmp_path = '{}.tmp'.format(lib_path)
with open(tmp_path, 'w', encoding='utf-8') as f:
    json.dump(doc, f, ensure_ascii=False, indent=2, sort_keys=False)
    f.write('\n')
os.replace(tmp_path, lib_path)
PYEOF
)"

# -----------------------------------------
# 追加写入器（Python 源码，供 append_dailyword_quote 用 python3 -c 调用）
# -----------------------------------------
# 把每日一词的中文名言追加进 reminder_quotes.json → quotes.quotes
# 响应体走 stdin（与历史库一致，避免大 payload 触发 E2BIG）
# 退出码：0 已追加或已存在；2 内容不合规范（调用方静默跳过）；1 写入/解析异常
# -----------------------------------------
_DAILYWORD_QUOTES_PY="$(cat <<'PYEOF'
import json, os, sys

quotes_path = sys.argv[1]
body        = sys.stdin.read()

# 消极词体检：励志库要用于早安播报/工作提醒，明显丧的句子不进库
NEGATIVE = ('绝望', '毁灭', '腐烂', '自杀', '坟墓', '哭泣', '无意义', '空虚')
extra = os.environ.get('DAILYWORD_QUOTE_BLOCKLIST', '')
if extra.strip():
    NEGATIVE = tuple(list(NEGATIVE) + [w.strip() for w in extra.replace('，', ',').split(',') if w.strip()])

def normalize(s):
    return ''.join(ch for ch in s if not ch.isspace() and ch not in '，。！？、；：「」『』（）()《》“”‘’—-～~.,!?;:')

try:
    item = json.loads(body)
except Exception:
    sys.exit(1)
if not isinstance(item, dict):
    sys.exit(1)

quote = ' '.join(str(item.get('quote', '') or '').split())
if not (8 <= len(quote) <= 80):
    sys.exit(2)
if any(word in quote for word in NEGATIVE):
    sys.exit(2)

# 语录库由 Web 管理端共同维护：读不出来就放弃本次追加，绝不重建（重建等于清空人工维护内容）
try:
    with open(quotes_path, 'r', encoding='utf-8') as f:
        doc = json.load(f)
except Exception:
    sys.exit(1)
bucket = doc.get('quotes')
if not isinstance(bucket, dict) or not isinstance(bucket.get('quotes'), list):
    sys.exit(1)

target = normalize(quote)
for existing in bucket['quotes']:
    if isinstance(existing, str) and normalize(existing) == target:
        sys.exit(0)

bucket['quotes'].append(quote)

# 原子写：先落 .tmp 再 rename，避免与 Web 管理端 / 预取并发写时把库写坏
tmp_path = '{}.tmp'.format(quotes_path)
with open(tmp_path, 'w', encoding='utf-8') as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
    f.write('\n')
os.replace(tmp_path, quotes_path)
PYEOF
)"

# -----------------------------------------
# 把每日一词的中文名言追加进每日励志语录库（quotes.quotes）
# 参数：
#   $1 - items_json（含 english/chinese/quote/from 的 JSON 字符串）
# 返回：
#   恒成立 0（只是补充语料，失败不影响主流程）
# -----------------------------------------
append_dailyword_quote() {
    # ${1:-}：调用方可能是 set -u 环境（如 daily_word.sh），不传参时不能让脚本崩
    local items_json="${1:-}"

    if [ -z "${items_json}" ] || [ ! -f "${REMINDER_QUOTES_JSON}" ]; then
        return 0
    fi

    local rc=0
    printf '%s' "${items_json}" | python3 -c "${_DAILYWORD_QUOTES_PY}" "${REMINDER_QUOTES_JSON}" 2>/dev/null || rc=$?

    # rc=2：句子太长/太短或命中消极词，属正常跳过，不打警告
    case "${rc}" in
        0|2) return 0 ;;
        *)   echo "⚠️  每日一词未能追加进励志语录库（${REMINDER_QUOTES_JSON} 读写异常），不影响展示" >&2
             return 0 ;;
    esac
}

# -----------------------------------------
# 把一条每日一词沉淀进历史库（并顺带落地到每日励志语录库）
# 参数：
#   $1 - items_json（含 english/chinese/quote/from 的 JSON 字符串）
# 返回：
#   恒成立 0（沉淀只是留档，失败不影响主流程）
# -----------------------------------------
persist_dailyword() {
    # ${1:-}：调用方可能是 set -u 环境（如 daily_word.sh），不传参时不能让脚本崩
    local items_json="${1:-}"

    if [ -z "${items_json}" ]; then
        return 0
    fi

    # 最终落地：先补进每日励志语录库，再沉淀进历史库（两者的 key 不同，互不依赖）
    append_dailyword_quote "${items_json}"

    mkdir -p "$(dirname "${DAILYWORD_LIBRARY}")" 2>/dev/null

    if printf '%s' "${items_json}" | python3 -c "${_DAILYWORD_PERSIST_PY}" "${DAILYWORD_LIBRARY}" 2>/dev/null; then
        return 0
    fi

    echo "⚠️  每日一词沉淀失败（数据无效或写入异常），不影响展示" >&2
    return 0
}

# -----------------------------------------
# 金山词霸接口失效时的英文降级：从历史沉淀里确定性取一句
# 输出：单行 JSON {"english":"...","chinese":"...","english_source":"library"}
# -----------------------------------------
# 背景：open.iciba.com/dsapi/ 自 2026-10-28 起不可用，卡片与预取都不能
# 因为拿不到英文就整体失败。历史库已沉淀 180+ 条真实句子，按当天日期取模
# 选一条即可：同一天预取 / 出卡片结果一致，也不会天天重复同一句。
# 库不可用（首次部署 / 文件损坏）时退到内置兜底句。
# -----------------------------------------
_DAILYWORD_FALLBACK_PY="$(cat <<'PYEOF'
import json, sys
from datetime import datetime, timezone, timedelta

lib_path = sys.argv[1]
today = datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d')

pool = []
try:
    with open(lib_path, 'r', encoding='utf-8') as f:
        doc = json.load(f)
    for day in sorted(doc.get('entries', {})):
        if day >= today:
            continue
        entry = doc['entries'][day]
        if isinstance(entry, dict) and entry.get('english') and entry.get('chinese'):
            pool.append([entry['english'], entry['chinese']])
except Exception:
    pass

if pool:
    picked = pool[int(today.replace('-', '')) % len(pool)]
    result = {'english': picked[0], 'chinese': picked[1], 'english_source': 'library'}
else:
    result = {'english': 'Life is beautiful.',
              'chinese': '生活是美好的。',
              'english_source': 'static'}
print(json.dumps(result, ensure_ascii=False))
PYEOF
)"

dailyword_fallback_english() {
    python3 -c "${_DAILYWORD_FALLBACK_PY}" "${DAILYWORD_LIBRARY}" 2>/dev/null
}
