#!/bin/bash

# ======================================
# 真实天气获取脚本
# ======================================
#
# 功能说明：
#   1. 调用聚合数据天气API获取实时天气信息
#   2. 返回温度、湿度、风力、天气状况等数据
#   3. 支持指定城市查询（默认深圳）
#   4. 原始响应归档到 hp_cache_res_*（api_responses/ 下的 KV）
#
# 数据来源：
#   - 聚合数据天气API
#   - API文档：https://www.juhe.cn/docs/api/id/73
#   - API密钥：.env 中的 JUHE_WEATHER_KEY
#
# 使用方式：
#   bash fetch_real_weather.sh        # 获取默认城市天气
#   bash fetch_real_weather.sh 北京   # 获取指定城市天气
#
# 作者：智能提醒系统
# 更新：2026-04-21
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 加载统一配置（包含 TZ 和 API Keys）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null || true

# 日志文件配置
LOG_FILE="${PROJECT_DIR}/fetch_real_weather.log"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# 引入原始 API 响应归档公共库（归档 + 日内复用）
source "${PROJECT_DIR}/api_archive.sh"

# 引入城市名归一化（仅用于缓存 key，API 请求仍用中文原名）
source "${SCRIPT_DIR}/tools/card_utils/city_map.sh"

# 聚合数据API配置
JUHE_API_KEY="${JUHE_WEATHER_KEY:-}"



# 获取真实天气
# 参数：
#   $1 - 城市名（可选，默认 WEATHER_CITY_NAME 或 深圳）
# 返回：
#   成功：返回0，stdout 输出 Markdown 文本
#   失败：返回1，stdout 输出错误标记
get_real_weather() {
    local city="${1:-${WEATHER_CITY_NAME:-深圳}}"
    log_info "🔍 准备获取天气数据（目标城市: ${city}）"

    # 如果没有配置API Key，返回提示
    if [ -z "$JUHE_API_KEY" ]; then
        log_warning "未配置聚合数据天气API Key，请在 .env 中设置 JUHE_WEATHER_KEY"
        echo "API_KEY_NOT_CONFIGURED"
        return 1
    fi
    log_info "🔑 API Key 已加载（长度: ${#JUHE_API_KEY}）"

    # 先尝试读取今日归档（节省免费额度）
    # 缓存 key 走归一化（深圳市/深圳/shenzhen → shenzhen），避免同一城市多份归档
    local cache_file
    cache_file=$(api_cache_path weather "$(normalize_city_slug "${city}")")
    local response=""
    if response=$(read_cached_api_response "${cache_file}"); then
        log_info "🗂  命中今日归档缓存: ${cache_file}（bytes=${#response}），跳过 API 请求"
    else
        # 调用聚合数据天气API
        # API文档：https://www.juhe.cn/docs/api/id/73
        local api_url="http://apis.juhe.cn/simpleWeather/query"
        log_info "🌐 调用聚合数据天气API: ${api_url}"
        local start_ts
        start_ts=$(now_ms)
        response=$(curl -s -m 10 "${api_url}?key=${JUHE_API_KEY}&city=${city}" 2>/dev/null)
        local curl_exit=$?

        if [ $curl_exit -ne 0 ] || [ -z "$response" ]; then
            local end_ts=$(now_ms)
            local cost=$((end_ts - start_ts))
            log_error "API请求失败（curl_exit=${curl_exit}, 响应为空: $([ -z "$response" ] && echo yes || echo no), 耗时: ${cost}ms）"
            echo "API_REQUEST_FAILED"
            return 1
        fi
        log_info "📥 API 响应已接收（bytes=${#response}）"
        log_duration "$start_ts" "聚合数据天气API 调用完成"

        # 归档原始 JSON（失败不阻断主流程）
        if archive_api_response "${cache_file}" "${response}"; then
            log_info "🗂  原始 JSON 已归档: ${cache_file}"
        else
            log_warning "⚠️  归档失败（${cache_file}），不影响本次展示"
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
    log_info "✅ API 返回状态正常（error_code=0）"

    # 解析JSON数据 - 实况天气（realtime字段）
    log_info "🧩 解析实况天气字段..."
    local temperature=$(json_get_string "$response" temperature 1)
    local info=$(json_get_string "$response" info 1)
    local humidity=$(json_get_string "$response" humidity 1)
    local wind_direction=$(json_get_string "$response" direct 1)
    local wind_power=$(json_get_string "$response" power 1)
    local aqi=$(json_get_string "$response" aqi 1)

    log_info "   温度:     ${temperature:-<空>}℃"
    log_info "   天气:     ${info:-<空>}"
    log_info "   湿度:     ${humidity:-<空>}%"
    log_info "   风向风力: ${wind_direction:-<空>} ${wind_power:-<空>}"
    log_info "   空气质量: AQI ${aqi:-<空>}"

    if [ -z "$temperature" ] && [ -z "$info" ]; then
        log_warning "⚠️  关键字段（temperature/info）均为空，API 结构可能已变更"
    fi

    # 解析未来天气（future数组，聚合 simpleWeather 通常返回 5 天，本处仅取前 3 天，避免推送内容过长）
    log_info "🧩 解析未来 3 天天气..."
    local future_data=$(echo "$response" | grep -A 300 '"future"')

    # 提取未来 3 天（future 与 realtime 都有 temperature/direct，故按出现顺序取第 2/3/4 个）
    local day1_date=$(json_get_string "$future_data" date 1)
    local day1_temp=$(json_get_string "$future_data" temperature 2)
    local day1_weather=$(json_get_string "$future_data" weather 1)
    local day1_direct=$(json_get_string "$future_data" direct 2)

    local day2_date=$(json_get_string "$future_data" date 2)
    local day2_temp=$(json_get_string "$future_data" temperature 3)
    local day2_weather=$(json_get_string "$future_data" weather 2)
    local day2_direct=$(json_get_string "$future_data" direct 3)

    local day3_date=$(json_get_string "$future_data" date 3)
    local day3_temp=$(json_get_string "$future_data" temperature 4)
    local day3_weather=$(json_get_string "$future_data" weather 3)
    local day3_direct=$(json_get_string "$future_data" direct 4)

    log_info "   D+1: ${day1_date:-?} ${day1_weather:-?} ${day1_temp:-?} ${day1_direct:-?}"
    log_info "   D+2: ${day2_date:-?} ${day2_weather:-?} ${day2_temp:-?} ${day2_direct:-?}"
    log_info "   D+3: ${day3_date:-?} ${day3_weather:-?} ${day3_temp:-?} ${day3_direct:-?}"

    # 生成Markdown格式
    log_info "📝 生成 Markdown 输出..."
    cat << WEATHER
## 🌤️ ${city}天气

**当前温度**：${temperature}℃
**天气状况**：${info}
**湿度**：${humidity}%
**风向风力**：${wind_direction} ${wind_power}
**空气质量**：AQI ${aqi}

### 未来天气

📅 **${day1_date}**：${day1_weather}，${day1_temp}${day1_direct:+，${day1_direct}}
📅 **${day2_date}**：${day2_weather}，${day2_temp}${day2_direct:+，${day2_direct}}
📅 **${day3_date}**：${day3_weather}，${day3_temp}${day3_direct:+，${day3_direct}}

💡 天气数据来自聚合数据
WEATHER

    log_success "真实天气获取成功（${city}）"
    return 0
}

# 高德天气备份源
# 参数：
#   $1 - 城市名（可选，默认 WEATHER_CITY_NAME 或 深圳）
# 返回：
#   成功：返回0，stdout 输出与聚合数据同格式的 Markdown
#   失败：返回1
# 说明：
#   聚合数据限流/额度用尽时顶上，保证早安提醒不断档。
#   高德返回的是实况 + 未来 3~4 天预报，没有 AQI（这一项留空）。
get_amap_weather() {
    local city="${1:-${WEATHER_CITY_NAME:-深圳}}"

    if [ -z "${AMAP_KEY:-}" ]; then
        log_warning "未配置 AMAP_KEY，无法使用高德天气备份源"
        return 1
    fi

    # 高德的 city 参数接受中文城市名或 adcode；去掉「市」后缀提高命中率
    local amap_city="${city%市}"
    log_info "🌐 调用高德天气备份源（city=${amap_city}）"

    # 注意：高德的两个 extensions 互斥——
    #   base → 只返回实况 lives[]；all → 只返回预报 forecasts[]
    # 所以要各请求一次，再拼成同一份 Markdown
    local live_response forecast_response
    live_response=$(curl -s -m 10 -G "https://restapi.amap.com/v3/weather/weatherInfo" \
        --data-urlencode "key=${AMAP_KEY}" \
        --data-urlencode "city=${amap_city}" \
        --data-urlencode "extensions=base" 2>/dev/null)
    forecast_response=$(curl -s -m 10 -G "https://restapi.amap.com/v3/weather/weatherInfo" \
        --data-urlencode "key=${AMAP_KEY}" \
        --data-urlencode "city=${amap_city}" \
        --data-urlencode "extensions=all" 2>/dev/null)

    if [ -z "$live_response" ] && [ -z "$forecast_response" ]; then
        log_error "高德天气请求失败（实况与预报均无响应）"
        return 1
    fi

    local status
    status=$(echo "$live_response" | jq -r '.status // "0"' 2>/dev/null)
    if [ "$status" != "1" ]; then
        log_error "高德天气返回错误（info=$(echo "$live_response" | jq -r '.info // "未知"' 2>/dev/null)）"
        return 1
    fi

    # 实况（lives[0]）
    local temperature info humidity wind_direction wind_power
    temperature=$(echo "$live_response" | jq -r '.lives[0].temperature // ""')
    info=$(echo "$live_response" | jq -r '.lives[0].weather // ""')
    humidity=$(echo "$live_response" | jq -r '.lives[0].humidity // ""')
    wind_direction=$(echo "$live_response" | jq -r '.lives[0].winddirection // ""')
    wind_power=$(echo "$live_response" | jq -r '.lives[0].windpower // ""')

    # 未来 3 天（forecasts[0].casts）
    local day1_date day1_weather day1_temp day1_direct
    local day2_date day2_weather day2_temp day2_direct
    local day3_date day3_weather day3_temp day3_direct
    day1_date=$(echo "$forecast_response" | jq -r '.forecasts[0].casts[0].date // ""')
    day1_weather=$(echo "$forecast_response" | jq -r '.forecasts[0].casts[0].dayweather // ""')
    day1_temp=$(echo "$forecast_response" | jq -r 'if .forecasts[0].casts[0] then ((.forecasts[0].casts[0].nighttemp // "") + "~" + (.forecasts[0].casts[0].daytemp // "") + "℃") else "" end')
    day1_direct=$(echo "$forecast_response" | jq -r '.forecasts[0].casts[0].daywind // ""')

    day2_date=$(echo "$forecast_response" | jq -r '.forecasts[0].casts[1].date // ""')
    day2_weather=$(echo "$forecast_response" | jq -r '.forecasts[0].casts[1].dayweather // ""')
    day2_temp=$(echo "$forecast_response" | jq -r 'if .forecasts[0].casts[1] then ((.forecasts[0].casts[1].nighttemp // "") + "~" + (.forecasts[0].casts[1].daytemp // "") + "℃") else "" end')
    day2_direct=$(echo "$forecast_response" | jq -r '.forecasts[0].casts[1].daywind // ""')

    day3_date=$(echo "$forecast_response" | jq -r '.forecasts[0].casts[2].date // ""')
    day3_weather=$(echo "$forecast_response" | jq -r '.forecasts[0].casts[2].dayweather // ""')
    day3_temp=$(echo "$forecast_response" | jq -r 'if .forecasts[0].casts[2] then ((.forecasts[0].casts[2].nighttemp // "") + "~" + (.forecasts[0].casts[2].daytemp // "") + "℃") else "" end')
    day3_direct=$(echo "$forecast_response" | jq -r '.forecasts[0].casts[2].daywind // ""')

    cat << WEATHER
## 🌤️ ${city}天气

**当前温度**：${temperature}℃
**天气状况**：${info}
**湿度**：${humidity}%
**风向风力**：${wind_direction} ${wind_power}

### 未来天气

📅 **${day1_date}**：${day1_weather}，${day1_temp}${day1_direct:+，${day1_direct}}
📅 **${day2_date}**：${day2_weather}，${day2_temp}${day2_direct:+，${day2_direct}}
📅 **${day3_date}**：${day3_weather}，${day3_temp}${day3_direct:+，${day3_direct}}

💡 天气数据来自高德地图（聚合数据不可用时的备份源）
WEATHER

    log_success "高德天气备份源获取成功（${city}）"
    return 0
}

# 主入口
main() {
    log_info "======================================"
    log_info "🚀 真实天气获取脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local action="${1:-show}"
    local city_arg="${2:-${WEATHER_CITY_NAME:-深圳}}"
    log_info "🎯 动作: ${action}, 城市参数: ${city_arg}"

    case "$action" in
        show|message)
            if get_real_weather "$city_arg"; then
                log_success "脚本执行完成"
                log_info "======================================"
                exit 0
            else
                # 聚合数据不可用（未配置 Key / 请求失败 / 额度用尽）→ 顶上高德备份源
                log_warning "聚合数据天气获取失败，回退高德天气备份源"
                if get_amap_weather "$city_arg"; then
                    log_success "脚本执行完成（高德备份源）"
                    log_info "======================================"
                    exit 0
                fi
                log_error "脚本执行失败"
                log_info "======================================"
                exit 1
            fi
            ;;
        *)
            log_error "用法: $0 {show|message} [城市名]"
            log_info "======================================"
            exit 1
            ;;
    esac
}

main "$@"
