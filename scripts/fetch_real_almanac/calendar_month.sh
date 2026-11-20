#!/bin/bash
# ======================================
# fetch_real_almanac - 万年历·当月子模块（聚合数据 calendar/month API）
# ======================================
# 由主脚本 fetch_real_almanac.sh source 加载
# 不设置 SCRIPT_DIR / LOG_FILE（由主脚本统一管理）
# 依赖：log_utils / api_archive / JUHE_CALENDAR_API_KEY / python3
# ======================================

# -----------------------------------------
# 获取【万年历·当月】（整月阳农对照）
# 聚合数据 API： http://v.juhe.cn/calendar/month
# 参数：
#   $1 - 月份（可选，YYYY-M 或 YYYY-MM，默认本月）
# 返回：
#   成功：返回0，stdout 输出 Markdown（含按日展开表）
#   失败：返回1
# -----------------------------------------
get_calendar_month() {
    local month_input="${1:-$(date +%Y-%-m)}"
    # 统一为 YYYY-M
    local year_month
    if [[ "$month_input" =~ ^[0-9]{4}-[0-9]{1,2}$ ]]; then
        local y="${month_input%-*}"
        local m="${month_input#*-}"
        year_month="${y}-$((10#${m}))"
    else
        year_month="$month_input"
    fi
    log_info "🔍 准备获取万年历·当月数据（目标月份: ${year_month}）"

    if [ -z "$JUHE_CALENDAR_API_KEY" ]; then
        log_warning "未配置聚合数据API Token，请在 .env 中设置 JUHE_ALMANAC_KEY"
        echo "API_TOKEN_NOT_CONFIGURED"
        return 1
    fi

    # 归档策略：只有目标月 == 当月时才走归档/缓存，跨月查询禁止归档以免覆盖当月槽位
    local cur_year_month
    cur_year_month=$(TZ=Asia/Shanghai date +%Y-%-m)
    local cache_file=""
    local response=""
    if [ "${year_month}" = "${cur_year_month}" ]; then
        # api 名用 calendarmonth（不带下划线），符合 api_archive.sh 的文件名解析约定
        cache_file=$(api_cache_path calendarmonth)
        if response=$(read_cached_api_response "${cache_file}"); then
            log_info "🗂  命中今日归档缓存: ${cache_file}，跳过 API 请求"
        fi
    fi
    if [ -z "${response}" ]; then
        local api_url="http://v.juhe.cn/calendar/month"
        log_info "🌐 调用万年历·当月API: ${api_url}"
        local start_ts
        start_ts=$(now_ms)
        response=$(curl -s -m 15 --data-urlencode "year-month=${year_month}" --data-urlencode "key=${JUHE_CALENDAR_API_KEY}" -G "${api_url}" 2>/dev/null)
        local curl_exit=$?

        if [ $curl_exit -ne 0 ] || [ -z "$response" ]; then
            log_error "API请求失败（curl_exit=${curl_exit}, 响应为空: $([ -z "$response" ] && echo yes || echo no)）"
            echo "API_REQUEST_FAILED"
            return 1
        fi
        log_info "📥 API 响应已接收（bytes=${#response}）"
        log_duration "$start_ts" "万年历·当月API 调用完成"

        # 先校验接口状态再归档：错误响应（如 10001 错误的请求KEY）不能写入缓存，
        # 否则坏数据会被固化成"当月归档"，之后每次都命中这份错误内容
        local api_error_code
        api_error_code=$(json_get_number "$response" error_code)
        if [ "${api_error_code:-0}" != "0" ]; then
            local api_reason
            api_reason=$(json_get_string "$response" reason)
            log_error "API返回错误（error_code=${api_error_code}, reason=${api_reason}），不写入归档"
            echo "API_ERROR: ${api_reason}"
            return 1
        fi

        if [ -n "${cache_file}" ]; then
            if archive_api_response "${cache_file}" "${response}"; then
                log_info "🗂  原始 JSON 已归档: ${cache_file}"
            else
                log_warning "⚠️  归档失败（${cache_file}），不影响本次展示"
            fi
        else
            log_info "🗂  跨月查询（year_month=${year_month}），不写入归档"
        fi
    fi

    local error_code
    error_code=$(json_get_number "$response" error_code)
    if [ "$error_code" != "0" ]; then
        local reason
        reason=$(json_get_string "$response" reason)
        log_error "API返回错误（error_code=${error_code}, reason=${reason}）"
        echo "API_ERROR: $reason"
        return 1
    fi

    # 月接口数据量较大，交给 Python 做结构化抽取
    log_info "🧩 解析当月阳农对照（Python 结构化提取）..."
    local md
    md=$(python3 - "$response" "$year_month" << 'PYEOF'
import json, sys
body       = sys.argv[1]
year_month = sys.argv[2]
try:
    doc = json.loads(body)
except Exception as e:
    print(f"JSON_PARSE_FAIL: {e}")
    sys.exit(0)

result = doc.get('result') or {}
data   = result.get('data') or {}
holiday_arr = data.get('holidayArray') or []

# 节假日分组输出
lines = []
lines.append(f"## 📅 {year_month} 当月万年历")
lines.append("")
lines.append(f"- 节假日及调休安排（共 {len(holiday_arr)} 组）：")
for h in holiday_arr:
    name = h.get('name', '')
    tip  = h.get('tip', '')
    rest = h.get('rest', '')
    lines.append(f"  - **{name}**：{tip}  (放假/调休：{rest})")

# 每日概要（只展示日期+农历+节气/节日，避免信息爆炸）
day_arr = data.get('almanac') or data.get('dayList') or []
if day_arr:
    lines.append("")
    lines.append("- 全月每日速览：")
    for d in day_arr:
        date_v  = d.get('date') or d.get('gregoriandate') or ''
        lunar_v = d.get('lunar') or d.get('lunardate') or ''
        fest    = d.get('festivalList') or d.get('festival') or ''
        terms   = d.get('solarTerms') or d.get('jieqi') or ''
        tags = []
        if terms: tags.append(f"🌿{terms}")
        if fest:  tags.append(f"🎉{fest}")
        tag_str = ("  " + " ".join(tags)) if tags else ""
        lines.append(f"  - {date_v}  农历 {lunar_v}{tag_str}")

print("\n".join(lines))
PYEOF
    )
    printf '%s\n' "$md"

    log_success "万年历·当月获取成功（${year_month}）"
    return 0
}
