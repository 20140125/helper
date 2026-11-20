#!/bin/bash
# ======================================
# card_utils 子模块：天气数据抓取 & 文案
# ======================================
# 被 card_utils.sh 主入口 source，禁止直接执行
# 提供：fetch_weather_for_city / fetch_weather_shenzhen
#      translate_weather_desc / get_weather_desc_cn
#      get_dress_advice / get_uv_desc / get_weather_emoji
# ======================================

# 抓取指定城市的 wttr.in 天气 JSON，失败返回空串并 return 1
# 入参：$1=城市（中英文均可，wttr.in 自带城市名解析；空字符串 → 默认 Shenzhen）
# 健壮性：
#   - 空响应 → return 1
#   - 非 JSON（限流文本/HTML 错误页等）→ return 1，避免下游 jq 刷屏 parse error
#   - 城市含空格/中文 → 用 curl --data-urlencode 构造请求路径，避免 wttr.in 解析失败
fetch_weather_for_city() {
  local city="${1:-Shenzhen}"
  # 去前后空白，空串兜底深圳，保持与原 fetch_weather_shenzhen 行为对齐
  city="${city#"${city%%[![:space:]]*}"}"
  city="${city%"${city##*[![:space:]]}"}"
  [ -z "$city" ] && city="Shenzhen"

  # 用 --get + --data-urlencode 拼路径，能正确处理「上海」「New York」等含中文/空格的城市
  local result
  result=$(curl -s --max-time "${CARD_CURL_TIMEOUT:-10}" \
    --get "https://wttr.in/${city}" \
    --data-urlencode "format=j1" \
    --data-urlencode "lang=zh" 2>/dev/null)
  if [ -z "$result" ]; then
    return 1
  fi
  # 用 jq empty 做 JSON 合法性校验；失败则视为脏数据（含 wttr.in 的 "Unknown location" 文本响应）
  if ! echo "$result" | jq empty >/dev/null 2>&1; then
    return 1
  fi
  # 原始输出模式（data / json）：直接吐 wttr.in 原始 JSON，不再渲染卡片
  if [ "${CARD_OUTPUT_MODE:-card}" != "card" ] && command -v emit_raw >/dev/null 2>&1; then
    emit_raw "$result"
  fi
  echo "$result"
}

# 抓取深圳天气 JSON（wttr.in），失败返回空串并 return 1
# 历史保留 API：内部委托给 fetch_weather_for_city，确保 weather_alerts.sh 等老调用方零改动
fetch_weather_shenzhen() {
  fetch_weather_for_city "Shenzhen"
}

# 将英文天气描述映射到中文（已在 wttr.in 返回 lang_zh 为空时的兜底）
# 参数: $1=英文描述
translate_weather_desc() {
  local desc_en="$1"
  case "$desc_en" in
    *"Heavy rain"*)        echo "大雨" ;;
    *"Moderate rain"*)     echo "中雨" ;;
    *"Light rain shower"*) echo "小阵雨" ;;
    *"Light rain"*)        echo "小雨" ;;
    *"Light drizzle"*)     echo "毛毛雨" ;;
    *"Patchy rain"*)       echo "局部有雨" ;;
    *"Thundery"*)          echo "雷阵雨" ;;
    *"Overcast"*)          echo "阴天" ;;
    *"Cloudy"*)            echo "多云" ;;
    *"Partly cloudy"*|*"Partly Cloudy"*) echo "局部多云" ;;
    *"Sunny"*)             echo "晴" ;;
    *"Clear"*)             echo "晴朗" ;;
    *"Mist"*)              echo "薄雾" ;;
    *"Fog"*)               echo "雾" ;;
    *"Haze"*)              echo "霾" ;;
    *)                     echo "$desc_en" ;;
  esac
}

# 根据 wttr.in 节点返回中文天气描述：优先 lang_zh，不可用时 fallback 英文映射
# 参数: $1=整份 weather JSON  $2=jq 路径前缀（如 ".current_condition[0]" 或 ".weather[1].hourly[4]"）
get_weather_desc_cn() {
  local weather="$1" jq_prefix="$2"
  local desc_cn
  desc_cn=$(echo "$weather" | jq -r "${jq_prefix}.lang_zh[0].value // empty")
  if [ -z "$desc_cn" ] || [ "$desc_cn" = "null" ]; then
    local desc_en
    desc_en=$(echo "$weather" | jq -r "${jq_prefix}.weatherDesc[0].value")
    desc_cn=$(translate_weather_desc "$desc_en")
  fi
  echo "$desc_cn"
}

# 平均温 → 穿衣建议
# 参数: $1=max $2=min  $3=格式 short|long（默认 short）
get_dress_advice() {
  local max_t="$1" min_t="$2" style="${3:-short}"
  local avg=$(( (${max_t%.*} + ${min_t%.*}) / 2 ))
  if [ "$style" = "long" ]; then
    if   [ "$avg" -ge 33 ]; then echo "短袖短裤，注意防暑"
    elif [ "$avg" -ge 28 ]; then echo "轻薄透气，注意补水"
    elif [ "$avg" -ge 23 ]; then echo "薄衬衫 / T恤即可"
    elif [ "$avg" -ge 18 ]; then echo "薄外套 / 长袖，早晚偏凉"
    elif [ "$avg" -ge 13 ]; then echo "外套卫衣，注意保暖"
    elif [ "$avg" -ge 8 ];  then echo "厚外套毛衣，注意防寒"
    else echo "羽绒服棉衣，做好保暖"
    fi
  else
    if   [ "$avg" -ge 33 ]; then echo "短袖短裤 防暑"
    elif [ "$avg" -ge 28 ]; then echo "轻薄透气 补水"
    elif [ "$avg" -ge 23 ]; then echo "薄衬衫/T恤"
    elif [ "$avg" -ge 18 ]; then echo "薄外套/长袖"
    elif [ "$avg" -ge 13 ]; then echo "外套卫衣 保暖"
    elif [ "$avg" -ge 8 ];  then echo "厚外套 防寒"
    else echo "羽绒服棉衣"
    fi
  fi
}

# UV 指数 → 描述
# 参数: $1=uv  $2=格式 plain|rich（默认 plain，rich 带 emoji）
get_uv_desc() {
  local uv="$1" style="${2:-plain}"
  if [ "$style" = "rich" ]; then
    if   [ "$uv" -le 2 ]; then echo "弱"
    elif [ "$uv" -le 5 ]; then echo "中等"
    elif [ "$uv" -le 7 ]; then echo "较强 ⚠️"
    elif [ "$uv" -le 10 ]; then echo "很强 🔥"
    else echo "极强 🚨"
    fi
  else
    if   [ "$uv" -le 2 ]; then echo "弱"
    elif [ "$uv" -le 5 ]; then echo "中等"
    elif [ "$uv" -le 7 ]; then echo "较强"
    else echo "很强"
    fi
  fi
}

# 天气中文描述 → emoji
get_weather_emoji() {
  local desc_cn="$1"
  case "$desc_cn" in
    *"大雨"*|*"暴雨"*) echo "🌧️" ;;
    *"中雨"*)          echo "🌧" ;;
    *"小雨"*|*"阵雨"*|*"毛毛雨"*|*"有雨"*) echo "🌦" ;;
    *"雷"*)            echo "⛈" ;;
    *"阴"*)            echo "☁️" ;;
    *"多云"*)          echo "⛅" ;;
    *"晴"*)            echo "☀️" ;;
    *"雾"*|*"霾"*)     echo "🌫" ;;
    *)                 echo "🌤" ;;
  esac
}
