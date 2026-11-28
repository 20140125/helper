#!/bin/bash
# ======================================
# fetch_real_horoscope - 抓取器子模块（聚合数据星座运势 API）
# ======================================
# 由主脚本 fetch_real_horoscope.sh source 加载
# 不设置 SCRIPT_DIR / LOG_FILE（由主脚本统一管理）
# 依赖：log_utils / api_archive / cache_db / JUHE_API_KEY / ZODIAC_SIGN
#       同目录的 renderer.sh 需在本模块之前或之后加载均可（主脚本统一 source）
# ======================================

# -----------------------------------------
# 星座专属缓存（按星座归并，全部周期共用一条 KV）
# -----------------------------------------
# 设计取舍：
#   1. 不复用 api_archive.sh 的"按月切分 + entries[date]"模型——
#      星座有 5 种周期（today/tomorrow/week/month/year）且时间粒度各异，
#      塞进通用月条目结构会让 key/二级 key 变形，可读性更差
#   2. 改为"每星座 1 条 KV，5 个周期字段并排"——恒定 12 个 key
#   3. 每个字段自带时间标签，读取时与"今日/本周/本月/今年"比对判命中
#   4. 同一星座的并发写：cron 推送本身就是按星座串行调用，天然无并发
#
# 缓存结构（api_responses/horoscope_白羊座.json）：
#   {
#     "zodiac": "白羊座",
#     "data": {
#       "today":    [ { "date":  "2026-05-11", "payload": { ...原始 API JSON... } } ],
#       "tomorrow": [ { "date":  "2026-05-12", "payload": { ... } } ],
#       "week":     [ { "week":  "2026-W19",   "payload": { ... } } ],
#       "month":    [ { "month": "2026-05",    "payload": { ... } } ],
#       "year":     [ { "year":  "2026",       "payload": { ... } } ]
#     }
#   }
#   注意：data 下每个周期字段都是数组，保留历史记录，读取时取最后一条
# -----------------------------------------

# 缓存数据库通道（主脚本已加载 project_config.sh；这里做幂等兜底）
_HOROSCOPE_PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
if ! declare -F cache_db_read >/dev/null 2>&1; then
    source "${_HOROSCOPE_PROJECT_DIR}/cache_db.sh"
fi

# 计算某星座专属缓存 key（api_responses/horoscope_<星座>.json）
horoscope_cache_path() {
    local zodiac="$1"
    local safe_zodiac
    safe_zodiac=$(printf '%s' "$zodiac" | tr ' /' '__')
    printf '%s' "api_responses/horoscope_${safe_zodiac}.json"
}

# -----------------------------------------
# 读取器（Python 源码）：缓存全文从 stdin 传入，stdout 输出命中周期的原始响应
# -----------------------------------------
_HOROSCOPE_READ_PY="$(cat <<'PYEOF'
import json, sys
from datetime import datetime, timezone, timedelta

type_ = sys.argv[1]
try:
    doc = json.loads(sys.stdin.read())
except Exception:
    sys.exit(2)

# data 下每个周期字段都是数组，保留历史记录
slots = (doc.get('data') or {}).get(type_)
if not isinstance(slots, list) or len(slots) == 0:
    sys.exit(2)

# 取最后一条（最新的）记录
slot = slots[-1]

tz = timezone(timedelta(hours=8))
now = datetime.now(tz)

# 时间标签校验
if type_ in ('today', 'tomorrow'):
    expect = now.strftime('%Y-%m-%d') if type_ == 'today' else (now + timedelta(days=1)).strftime('%Y-%m-%d')
    if slot.get('date') != expect:
        sys.exit(2)
elif type_ == 'week':
    iso_year, iso_week, _ = now.isocalendar()
    if slot.get('week') != f'{iso_year}-W{iso_week:02d}':
        sys.exit(2)
elif type_ == 'month':
    if slot.get('month') != now.strftime('%Y-%m'):
        sys.exit(2)
elif type_ == 'year':
    if slot.get('year') != now.strftime('%Y'):
        sys.exit(2)
else:
    sys.exit(2)

payload = slot.get('payload')
if payload is None:
    sys.exit(2)

# payload 可能是 dict（原始 JSON）或 str（兜底）
if isinstance(payload, str):
    print(payload, end='')
else:
    print(json.dumps(payload, ensure_ascii=False), end='')
PYEOF
)"

# 读取星座某周期缓存（命中且未过期则返回原始 JSON 字符串到 stdout）
# 参数：
#   $1 - 星座中文名
#   $2 - 周期 today|tomorrow|week|month|year
# 返回：0 命中，1 未命中
# 缓存结构：data 下每个周期字段都是数组，保留历史记录
horoscope_read_cache() {
    local zodiac="$1" type="$2"
    local key
    key=$(horoscope_cache_path "$zodiac")
    cache_db_exists "$key" || return 1

    cache_db_read "$key" | python3 -c "${_HOROSCOPE_READ_PY}" "$type" || return 1
}

# -----------------------------------------
# 写入器（Python 源码）：旧缓存全文从 stdin 传入，本次响应走 argv；
# stdout 输出合并后的完整缓存全文，由 shell 交给 cache_db_write
# -----------------------------------------
_HOROSCOPE_WRITE_PY="$(cat <<'PYEOF'
import json, sys
from datetime import datetime, timezone, timedelta

zodiac, type_, body = sys.argv[1], sys.argv[2], sys.argv[3]

# 读旧文档（存在则保留其它周期字段）
doc = None
old_body = sys.stdin.read()
if old_body.strip():
    try:
        doc = json.loads(old_body)
        if not isinstance(doc, dict):
            doc = None
    except Exception:
        doc = None

if doc is None:
    doc = {'zodiac': zodiac, 'data': {}}
if not isinstance(doc.get('data'), dict):
    doc['data'] = {}

# body 优先解析为 JSON 对象嵌入；失败则原样存为字符串
try:
    payload = json.loads(body)
except Exception:
    payload = body

tz = timezone(timedelta(hours=8))
now = datetime.now(tz)

slot = {'payload': payload}
if type_ == 'today':
    slot['date'] = now.strftime('%Y-%m-%d')
elif type_ == 'tomorrow':
    slot['date'] = (now + timedelta(days=1)).strftime('%Y-%m-%d')
elif type_ == 'week':
    iso_year, iso_week, _ = now.isocalendar()
    slot['week'] = f'{iso_year}-W{iso_week:02d}'
elif type_ == 'month':
    slot['month'] = now.strftime('%Y-%m')
elif type_ == 'year':
    slot['year'] = now.strftime('%Y')
else:
    sys.exit(1)

# 追加新记录到数组（不修改已有记录）
if not isinstance(doc['data'].get(type_), list):
    doc['data'][type_] = []
doc['data'][type_].append(slot)

doc['zodiac'] = zodiac

print(json.dumps(doc, ensure_ascii=False, indent=2, sort_keys=False))
PYEOF
)"

# 写入星座某周期缓存（追加模式，保留历史记录，不修改已有内容）
# 参数：
#   $1 - 星座中文名
#   $2 - 周期
#   $3 - 原始 API 响应字符串（通常是 JSON）
# 返回：0 成功，1 失败
# 缓存结构：data 下每个周期字段都是数组，每次新增一条记录到数组末尾
horoscope_write_cache() {
    local zodiac="$1" type="$2" body="$3"
    local key merged
    key=$(horoscope_cache_path "$zodiac")

    merged="$(cache_db_read "$key" | python3 -c "${_HOROSCOPE_WRITE_PY}" "$zodiac" "$type" "$body")" || return 1
    [ -n "$merged" ] || return 1
    cache_db_write "$key" "$merged" || return 1
}

# 星座中文名转英文
get_zodiac_en() {
    case "$1" in
        白羊座) echo "aries" ;;
        金牛座) echo "taurus" ;;
        双子座) echo "gemini" ;;
        巨蟹座) echo "cancer" ;;
        狮子座) echo "leo" ;;
        处女座) echo "virgo" ;;
        天秤座) echo "libra" ;;
        天蝎座) echo "scorpio" ;;
        射手座) echo "sagittarius" ;;
        摩羯座) echo "capricorn" ;;
        水瓶座) echo "aquarius" ;;
        双鱼座) echo "pisces" ;;
        *) echo "capricorn" ;;
    esac
}

# type 中文化标签（用于日志 / 标题）
get_horoscope_type_label() {
    case "$1" in
        today)    echo "今日" ;;
        tomorrow) echo "明日" ;;
        week)     echo "本周" ;;
        month)    echo "本月" ;;
        year)     echo "今年" ;;
        *)        echo "今日" ;;
    esac
}

# 获取真实星座运势
# 参数：
#   $1 - 星座中文名（可选，默认使用 ZODIAC_SIGN）
#   $2 - 运势周期 today|tomorrow|week|month|year（可选，默认 today）
# 返回：
#   成功：返回0，stdout 输出 Markdown 文本
#   失败：返回1，stdout 输出错误标记
get_real_horoscope() {
    local zodiac_cn="${1:-$ZODIAC_SIGN}"
    local type="${2:-today}"
    # 参数合法性校验
    case "$type" in
        today|tomorrow|week|month|year) ;;
        *)
            log_warning "未识别的 type=${type}，已回退为 today"
            type="today"
            ;;
    esac
    local type_label
    type_label=$(get_horoscope_type_label "$type")
    local zodiac_en=$(get_zodiac_en "$zodiac_cn")
    log_info "🔍 准备获取星座运势（中文: ${zodiac_cn}, 英文: ${zodiac_en}, 周期: ${type}/${type_label}）"

    # 如果没有配置API Key，返回提示
    if [ -z "$JUHE_API_KEY" ]; then
        log_warning "未配置聚合数据API Key，请在 .env 中设置 JUHE_HOROSCOPE_KEY"
        echo "API_KEY_NOT_CONFIGURED"
        return 1
    fi
    log_info "🔑 API Key 已加载（长度: ${#JUHE_API_KEY}）"

    # URL编码中文星座名
    local encoded_zodiac=$(echo -n "$zodiac_cn" | xxd -plain | tr -d '\n' | sed 's/\(..\)/%\1/g')
    log_info "🔗 URL 编码后的星座名: ${encoded_zodiac}"

    # 先尝试读取归档（节省免费额度）——按星座归并，5 周期共用一条 KV
    local response=""
    if response=$(horoscope_read_cache "${zodiac_cn}" "${type}"); then
        log_info "🗂  命中归档缓存: $(horoscope_cache_path "${zodiac_cn}") [${type}]（bytes=${#response}），跳过 API 请求"
    else
        # 调用聚合数据API
        # 聚合数据已停用 http 端口（返回 403），统一走 https
        local api_url="https://web.juhe.cn/constellation/getAll"
        log_info "🌐 调用聚合数据星座API: ${api_url} (type=${type})"
        local start_ts
        start_ts=$(now_ms)
        response=$(curl -s -m 10 "${api_url}?consName=${encoded_zodiac}&type=${type}&key=${JUHE_API_KEY}" 2>/dev/null)
        local curl_exit=$?

        if [ $curl_exit -ne 0 ] || [ -z "$response" ]; then
            local end_ts=$(now_ms)
            local cost=$((end_ts - start_ts))
            log_error "API请求失败（curl_exit=${curl_exit}, 响应为空: $([ -z "$response" ] && echo yes || echo no), 耗时: ${cost}ms）"
            echo "API_REQUEST_FAILED"
            return 1
        fi
        log_info "📥 API 响应已接收（bytes=${#response}）"
        log_duration "$start_ts" "聚合数据星座API 调用完成"

        # 归档原始 JSON（失败不阻断主流程）
        if horoscope_write_cache "${zodiac_cn}" "${type}" "${response}"; then
            log_info "🗂  原始 JSON 已归档: $(horoscope_cache_path "${zodiac_cn}") [${type}]"
        else
            log_warning "⚠️  归档失败（$(horoscope_cache_path "${zodiac_cn}") [${type}]），不影响本次展示"
        fi
    fi

    # 检查API返回状态
    local error_code
    error_code=$(json_get_number "$response" error_code)
    if [ "$error_code" != "0" ]; then
        local reason
        reason=$(json_get_string "$response" reason)
        log_error "API返回错误（error_code=${error_code}, reason=${reason}）"
        echo "API_ERROR: $reason"
        return 1
    fi
    log_success "✅ API 返回状态正常（error_code=0）"

    # 根据 type 分发到不同的渲染器（由 renderer.sh 提供）
    case "$type" in
        today|tomorrow)
            _render_horoscope_day "$zodiac_cn" "$type_label" "$response"
            ;;
        week)
            _render_horoscope_week "$zodiac_cn" "$type_label" "$response"
            ;;
        month)
            _render_horoscope_month "$zodiac_cn" "$type_label" "$response"
            ;;
        year)
            _render_horoscope_year "$zodiac_cn" "$type_label" "$response"
            ;;
    esac

    log_success "真实星座运势获取成功（${zodiac_cn} / ${type}）"
    return 0
}
