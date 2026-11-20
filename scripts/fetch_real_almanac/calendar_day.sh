#!/bin/bash
# ======================================
# fetch_real_almanac - 万年历·当日子模块（聚合数据 calendar/day API）
# ======================================
# 由主脚本 fetch_real_almanac.sh source 加载
# 不设置 SCRIPT_DIR / LOG_FILE（由主脚本统一管理）
# 依赖：log_utils / api_archive / JUHE_CALENDAR_API_KEY
# ======================================

# -----------------------------------------
# 获取【万年历·当日】（阳历+农历+节日+周信息）
# 聚合数据 API： http://v.juhe.cn/calendar/day
# 参数：
#   $1 - 日期（可选，YYYY-M-D 或 YYYY-MM-DD 或 YYYYMMDD，默认今天）
# 返回：
#   成功：返回0，stdout 输出 Markdown
#   失败：返回1
# -----------------------------------------
get_calendar_day() {
    local date_input="${1:-$(date +%Y-%-m-%-d)}"
    # 统一为 YYYY-M-D（聚合数据接口要求）
    local date_str
    if [[ "$date_input" =~ ^[0-9]{8}$ ]]; then
        date_str="${date_input:0:4}-$((10#${date_input:4:2}))-$((10#${date_input:6:2}))"
    elif [[ "$date_input" =~ ^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$ ]]; then
        # 把 03 → 3 去前导零
        local y="${date_input%%-*}"
        local rest="${date_input#*-}"
        local m="${rest%%-*}"
        local d="${rest#*-}"
        date_str="${y}-$((10#${m}))-$((10#${d}))"
    else
        date_str="$date_input"
    fi
    log_info "🔍 准备获取万年历·当日数据（目标日期: ${date_str}）"

    if [ -z "$JUHE_CALENDAR_API_KEY" ]; then
        log_warning "未配置聚合数据API Token，请在 .env 中设置 JUHE_ALMANAC_KEY"
        echo "API_TOKEN_NOT_CONFIGURED"
        return 1
    fi

    # 归档策略：只有 date_str == 今天 时才走归档/缓存
    local today_ymd
    today_ymd=$(TZ=Asia/Shanghai date +%Y-%-m-%-d)
    local cache_file=""
    local response=""
    if [ "${date_str}" = "${today_ymd}" ]; then
        # api 名用 calendarday（不带下划线），符合 api_archive.sh 的文件名解析约定
        cache_file=$(api_cache_path calendarday)
        if response=$(read_cached_api_response "${cache_file}"); then
            log_info "🗂  命中今日归档缓存: ${cache_file}，跳过 API 请求"
        fi
    fi
    if [ -z "${response}" ]; then
        local api_url="http://v.juhe.cn/calendar/day"
        log_info "🌐 调用万年历·当日API: ${api_url}"
        local start_ts
        start_ts=$(now_ms)
        response=$(curl -s -m 10 --data-urlencode "date=${date_str}" --data-urlencode "key=${JUHE_CALENDAR_API_KEY}" -G "${api_url}" 2>/dev/null)
        local curl_exit=$?

        if [ $curl_exit -ne 0 ] || [ -z "$response" ]; then
            log_error "API请求失败（curl_exit=${curl_exit}, 响应为空: $([ -z "$response" ] && echo yes || echo no)）"
            echo "API_REQUEST_FAILED"
            return 1
        fi
        log_info "📥 API 响应已接收（bytes=${#response}）"
        log_duration "$start_ts" "万年历·当日API 调用完成"

        # 先校验接口状态再归档：错误响应（如 10001 错误的请求KEY）不能写入缓存，
        # 否则坏数据会被固化成"当日归档"，之后每次都命中这份错误内容
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
            log_info "🗂  非今日查询（date_str=${date_str}），不写入归档"
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

    log_info "🧩 解析万年历字段..."
    local date_val=$(json_get_string "$response" date)
    local weekday=$(json_get_string "$response" weekday)
    local lunar=$(json_get_string "$response" lunar)
    local lunar_year=$(json_get_string "$response" lunarYear)
    local solar_terms=$(json_get_string "$response" solarTerms)
    local festival_list=$(json_get_string "$response" festivalList)
    local suit=$(json_get_string "$response" suit)
    local avoid=$(json_get_string "$response" avoid)

    cat << CALENDAR
## 📅 万年历（${date_val}）

- 🗓  阳历：${date_val}（${weekday}）
- 🌙 农历：${lunar_year} ${lunar}
- 🌿 节气：${solar_terms:-无}
- 🎉 节日：${festival_list:-无}

✅ **宜**：${suit:-—}
❌ **忌**：${avoid:-—}
CALENDAR

    log_success "万年历·当日获取成功（${date_str}）"
    return 0
}
