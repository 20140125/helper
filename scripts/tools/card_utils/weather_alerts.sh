#!/bin/bash
# ======================================
# card_utils 子模块：异常天气预警规则
# ======================================
# 被 card_utils.sh 主入口 source，禁止直接执行
# 依赖同包 weather_data.sh 的 fetch_weather_shenzhen()
# 所有 check_alert_*：参数为 wttr JSON；命中规则时向 stdout 输出一行预警（以 [xxx] 开头）；
# 未命中则无输出。fetch_weather_alerts 为统一入口。
# ======================================

# 检查高温
check_alert_high_temp() {
  local w="$1" temp today_max
  temp=$(echo "$w" | jq -r '.current_condition[0].temp_C')
  today_max=$(echo "$w" | jq -r '.weather[0].maxtempC')
  if [ "$(echo "$temp >= 40" | bc 2>/dev/null)" = "1" ]; then
    echo "[红色高温] 当前${temp}度，极端高温，尽量避免外出"
  elif [ "$(echo "$temp >= 37" | bc 2>/dev/null)" = "1" ]; then
    echo "[橙色高温] 当前${temp}度，高温酷热，注意防暑降温"
  elif [ "$(echo "$temp >= 35" | bc 2>/dev/null)" = "1" ]; then
    echo "[黄色高温] 当前${temp}度，持续高温，注意补水防晒"
  elif [ "$(echo "$today_max >= 37" | bc 2>/dev/null)" = "1" ]; then
    echo "[高温提醒] 今日最高${today_max}度，注意防暑降温"
  fi
}

# 检查寒潮
check_alert_cold_wave() {
  local w="$1" temp today_max tomorrow_min temp_drop
  temp=$(echo "$w" | jq -r '.current_condition[0].temp_C')
  today_max=$(echo "$w" | jq -r '.weather[0].maxtempC')
  tomorrow_min=$(echo "$w" | jq -r '.weather[1].mintempC // empty')
  if [ -n "$tomorrow_min" ] && [ "$tomorrow_min" != "null" ]; then
    temp_drop=$(echo "$today_max - $tomorrow_min" | bc 2>/dev/null)
    if [ "$(echo "$temp_drop >= 8" | bc 2>/dev/null)" = "1" ] && [ "$(echo "$tomorrow_min <= 4" | bc 2>/dev/null)" = "1" ]; then
      echo "[寒潮预警] 预计降温${temp_drop}度，明日最低${tomorrow_min}度，注意防寒"
    elif [ "$(echo "$temp_drop >= 10" | bc 2>/dev/null)" = "1" ]; then
      echo "[大幅降温] 预计降温${temp_drop}度，明日最低${tomorrow_min}度，添衣保暖"
    elif [ "$(echo "$temp_drop >= 6" | bc 2>/dev/null)" = "1" ]; then
      echo "[降温提醒] 预计降温${temp_drop}度，明日最低${tomorrow_min}度，注意保暖"
    fi
  fi
  if [ "$(echo "$temp <= 3" | bc 2>/dev/null)" = "1" ]; then
    echo "[低温预警] 当前${temp}度，注意防寒保暖"
  fi
}

# 检查大风
check_alert_wind() {
  local w="$1" wind_gust today_max_wind=0 today_max_gust=0 effective_gust
  wind_gust=$(echo "$w" | jq -r '.current_condition[0].WindGustKmph // 0')
  local i hw hg
  for i in $(seq 0 7); do
    hw=$(echo "$w" | jq -r ".weather[0].hourly[$i].windspeedKmph // 0")
    hg=$(echo "$w" | jq -r ".weather[0].hourly[$i].WindGustKmph // 0")
    [ "$hw" -gt "$today_max_wind" ] 2>/dev/null && today_max_wind=$hw
    [ "$hg" -gt "$today_max_gust" ] 2>/dev/null && today_max_gust=$hg
  done
  effective_gust=$today_max_gust
  [ "$wind_gust" -gt "$effective_gust" ] 2>/dev/null && effective_gust=$wind_gust
  if   [ "$effective_gust" -ge 118 ] 2>/dev/null; then echo "[红色大风] 阵风达12级以上(${effective_gust}km/h)，台风级别，停止外出"
  elif [ "$effective_gust" -ge 89 ]  2>/dev/null; then echo "[橙色大风] 阵风达10级(${effective_gust}km/h)，台风影响，注意安全"
  elif [ "$effective_gust" -ge 62 ]  2>/dev/null; then echo "[黄色大风] 阵风达8级(${effective_gust}km/h)，注意出行安全"
  elif [ "$effective_gust" -ge 39 ] 2>/dev/null || [ "$today_max_wind" -ge 39 ] 2>/dev/null; then
    echo "[蓝色大风] 阵风达6级(${effective_gust}km/h)，注意防风"
  fi
}

# 检查暴雨
check_alert_rainstorm() {
  local w="$1" total=0 i hr
  for i in $(seq 0 7); do
    hr=$(echo "$w" | jq -r ".weather[0].hourly[$i].precipMM // 0")
    total=$(echo "$total + $hr" | bc 2>/dev/null)
  done
  # 兜底：bc 失败时避免后续比较报错
  [ -z "$total" ] && total=0
  if   [ "$(echo "$total >= 100" | bc 2>/dev/null)" = "1" ]; then echo "[红色暴雨] 今日累计降水${total}mm，特大暴雨，注意避险"
  elif [ "$(echo "$total >= 50"  | bc 2>/dev/null)" = "1" ]; then echo "[橙色暴雨] 今日累计降水${total}mm，暴雨来袭，注意安全"
  elif [ "$(echo "$total >= 30"  | bc 2>/dev/null)" = "1" ]; then echo "[蓝色暴雨] 今日累计降水${total}mm，大到暴雨，带好雨具"
  elif [ "$(echo "$total >= 15"  | bc 2>/dev/null)" = "1" ]; then echo "[强降雨提醒] 今日累计降水${total}mm，注意带伞"
  fi
}

# 检查雷电
check_alert_thunder() {
  local w="$1" i thunder
  for i in $(seq 0 7); do
    thunder=$(echo "$w" | jq -r ".weather[0].hourly[$i].chanceofthunder // 0")
    if [ "$thunder" -ge 50 ] 2>/dev/null; then
      echo "[雷电预警] 今日有雷暴天气，减少户外活动，远离金属物体"
      return
    fi
  done
}

# 检查大雾
check_alert_fog() {
  local w="$1" visibility desc_en vis_m
  visibility=$(echo "$w" | jq -r '.current_condition[0].visibility')
  desc_en=$(echo "$w" | jq -r '.current_condition[0].weatherDesc[0].value')
  if [ "$(echo "$visibility < 1" | bc 2>/dev/null)" = "1" ] && echo "$desc_en" | grep -qiE 'fog|mist|haze'; then
    vis_m=$(echo "$visibility * 1000" | bc 2>/dev/null)
    if   [ "$(echo "$vis_m < 50"  | bc 2>/dev/null)" = "1" ]; then echo "[红色大雾] 能见度不足50米，高速封路，避免驾车"
    elif [ "$(echo "$vis_m < 200" | bc 2>/dev/null)" = "1" ]; then echo "[橙色大雾] 能见度不足200米，注意行车安全"
    else echo "[黄色大雾] 能见度较低，注意交通安全"
    fi
  fi
}

# 检查霾
check_alert_haze() {
  local w="$1" visibility humidity desc_en
  visibility=$(echo "$w" | jq -r '.current_condition[0].visibility')
  humidity=$(echo "$w" | jq -r '.current_condition[0].humidity')
  desc_en=$(echo "$w" | jq -r '.current_condition[0].weatherDesc[0].value')
  if [ "$(echo "$visibility < 5" | bc 2>/dev/null)" = "1" ] \
     && [ "$(echo "$humidity < 80" | bc 2>/dev/null)" = "1" ] \
     && echo "$desc_en" | grep -qiE 'haze|smog'; then
    echo "[霾预警] 空气质量较差，建议佩戴口罩，减少户外活动"
  fi
}

# 检查临近降雨
# wttr.in 的 hourly 是 8 段 × 3 小时时段（time: 0/300/600/900/1200/1500/1800/2100）
# 这里只取"当前时段 + 下一个时段"（覆盖未来 0~6 小时），
# 同时结合 chanceofrain>=80 且 precipMM>=0.5 才触发，避免小雨刷屏。
check_alert_imminent_rain() {
  local w="$1" now_hour cur_slot rain_hours="" i hour_time h rain_chance precip
  now_hour=$(TZ=Asia/Shanghai date +%H)
  now_hour=$((10#$now_hour))
  # 当前时刻落在哪个 3 小时时段（0/3/6/9/12/15/18/21）
  cur_slot=$(( now_hour / 3 * 3 ))
  for i in $(seq 0 7); do
    hour_time=$(echo "$w" | jq -r ".weather[0].hourly[$i].time")
    h=$((hour_time / 100))
    # 只关心当前时段或下一个时段（+3 小时）
    if [ "$h" -eq "$cur_slot" ] || [ "$h" -eq "$((cur_slot + 3))" ]; then
      rain_chance=$(echo "$w" | jq -r ".weather[0].hourly[$i].chanceofrain // 0")
      precip=$(echo "$w" | jq -r ".weather[0].hourly[$i].precipMM // 0")
      if [ "$rain_chance" -ge 80 ] 2>/dev/null \
         && [ "$(echo "$precip >= 0.5" | bc 2>/dev/null)" = "1" ]; then
        rain_hours="${rain_hours}${h}:00-$((h + 3)):00(${rain_chance}%,${precip}mm) "
      fi
    fi
  done
  if [ -n "$rain_hours" ]; then
    echo "[临近降雨] ${rain_hours}降雨概率较高，出门带伞"
  fi

  # 20 点后额外提示"明日早晨"是否有雨（对应次日 06:00-15:00 三个时段）
  # 这样晚上推送能帮助用户决策第二天上班是否带伞
  if [ "$now_hour" -ge 20 ]; then
    local has_tomorrow tomorrow_rain="" j t_time t_h t_chance t_precip
    has_tomorrow=$(echo "$w" | jq -r '.weather[1].hourly // empty | length // 0')
    if [ "$has_tomorrow" -gt 0 ] 2>/dev/null; then
      # hourly 索引 2/3/4 分别对应 time=600/900/1200
      for j in 2 3 4; do
        t_time=$(echo "$w" | jq -r ".weather[1].hourly[$j].time // empty")
        [ -z "$t_time" ] || [ "$t_time" = "null" ] && continue
        t_h=$((t_time / 100))
        t_chance=$(echo "$w" | jq -r ".weather[1].hourly[$j].chanceofrain // 0")
        t_precip=$(echo "$w" | jq -r ".weather[1].hourly[$j].precipMM // 0")
        if [ "$t_chance" -ge 80 ] 2>/dev/null \
           && [ "$(echo "$t_precip >= 0.5" | bc 2>/dev/null)" = "1" ]; then
          tomorrow_rain="${tomorrow_rain}${t_h}:00-$((t_h + 3)):00(${t_chance}%,${t_precip}mm) "
        fi
      done
      if [ -n "$tomorrow_rain" ]; then
        echo "[明日降雨] 明早 ${tomorrow_rain}有雨，上班记得带伞"
      fi
    fi
  fi
}

# 检查干旱
check_alert_drought() {
  local w="$1" humidity temp
  humidity=$(echo "$w" | jq -r '.current_condition[0].humidity')
  temp=$(echo "$w" | jq -r '.current_condition[0].temp_C')
  if [ "$(echo "$humidity < 20" | bc 2>/dev/null)" = "1" ] \
     && [ "$(echo "$temp > 30" | bc 2>/dev/null)" = "1" ]; then
    echo "[干燥预警] 湿度仅${humidity}%，极度干燥，注意用火安全"
  fi
}

# 检查紫外线
check_alert_uv() {
  local w="$1" uv
  uv=$(echo "$w" | jq -r '.weather[0].uvIndex // 0')
  if [ "$uv" -ge 11 ] 2>/dev/null; then
    echo "[紫外线极强] UV指数${uv}，避免长时间户外暴晒"
  fi
}

# 统一入口：抓取天气 + 执行所有预警规则，每行一条预警（无预警则无输出）
# 不 return 1；调用方自行判断是否为空
fetch_weather_alerts() {
  local w
  w=$(fetch_weather_shenzhen) || return 0
  {
    check_alert_high_temp "$w"
    check_alert_cold_wave "$w"
    check_alert_wind "$w"
    check_alert_rainstorm "$w"
    check_alert_thunder "$w"
    check_alert_fog "$w"
    check_alert_haze "$w"
    check_alert_imminent_rain "$w"
    check_alert_drought "$w"
    check_alert_uv "$w"
  } | grep -v '^$' || true
}
