#!/bin/bash
# ======================================
# 天气查询卡片（自适应时段，支持指定城市）
# ======================================
#
# 功能说明：
#   1. 抓取指定城市实时天气 + 今日/明日概况（wttr.in）
#   2. 根据当前时间自动切换显示模式：
#        05:00~11:00  → 早间（关注今日实况 / 穿衣 / UV）
#        11:00~17:00  → 午间（关注午后高温 / 体感 / 紫外线）
#        17:00~次日05 → 夜间（关注明日天气 / 降雨 / 温差）
#   3. 生成天气卡片 PNG
#
# 使用方式：
#   bash scripts/tools/weather_card_gen.sh                # 默认深圳
#   bash scripts/tools/weather_card_gen.sh 上海           # 指定城市（中英文均可）
#   bash scripts/tools/weather_card_gen.sh "New York"    # 含空格的城市用引号包裹
#
# 入参：
#   $1  城市名，可选；留空 = 深圳。中文（上海/北京/深圳）/拼音/英文均可，
#       由 wttr.in 解析；解析失败会兜底降级为深圳，避免卡片渲染失败。
#
# 作者：智能提醒系统
# 更新：2026-05-28
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/weather_card_gen_card.png"
SVG_FILE="/tmp/weather_card_gen_card.svg"

# 判断当前时段：morning | afternoon | evening
detect_period() {
    local hour
    hour=$(TZ=Asia/Shanghai date +%H)
    hour=$((10#$hour))
    if   [ "$hour" -ge 5 ]  && [ "$hour" -lt 11 ]; then echo "morning"
    elif [ "$hour" -ge 11 ] && [ "$hour" -lt 17 ]; then echo "afternoon"
    else echo "evening"
    fi
}

# 1) 抓取数据（直接复用 card_utils）
# 入参: $1=城市（留空 = Shenzhen）
fetch_data() {
    local city="$1"
    local weather
    weather=$(fetch_weather_for_city "$city")
    if [ -z "$weather" ]; then
        log_error "wttr.in 获取天气失败 (city=${city:-Shenzhen})"
        return 1
    fi
    echo "$weather"
}

# 2) 解析数据（统一产出 JSON，交给 generate_card 的 node 渲染）
# 入参: $1=weather JSON  $2=period  $3=城市展示名（用于卡片标题）
parse_data() {
    local weather="$1" period="$2" city_name="$3"
    local out

    # 通用字段
    local cur_temp feels_like humidity wind_kmph uv sunrise sunset
    cur_temp=$(echo "$weather"  | jq -r '.current_condition[0].temp_C')
    feels_like=$(echo "$weather" | jq -r '.current_condition[0].FeelsLikeC')
    humidity=$(echo "$weather"  | jq -r '.current_condition[0].humidity')
    wind_kmph=$(echo "$weather" | jq -r '.current_condition[0].windspeedKmph')
    uv=$(echo "$weather"        | jq -r '.weather[0].uvIndex // 0')
    sunrise=$(echo "$weather"   | jq -r '.weather[0].astronomy[0].sunrise')
    sunset=$(echo "$weather"    | jq -r '.weather[0].astronomy[0].sunset')

    # 今日
    local today_max today_min today_desc today_emoji
    today_max=$(echo "$weather"  | jq -r '.weather[0].maxtempC')
    today_min=$(echo "$weather"  | jq -r '.weather[0].mintempC')
    today_desc=$(get_weather_desc_cn "$weather" '.current_condition[0]')
    today_emoji=""

    # 明日
    local tmr_max tmr_min tmr_desc tmr_emoji tmr_rain
    tmr_max=$(echo "$weather"  | jq -r '.weather[1].maxtempC')
    tmr_min=$(echo "$weather"  | jq -r '.weather[1].mintempC')
  tmr_desc=$(get_weather_desc_cn "$weather" '.weather[1].hourly[4]')
    tmr_emoji=""
    tmr_rain=$(echo "$weather" | jq -r '[.weather[1].hourly[].chanceofrain|tonumber]|max')

    # 降雨高峰时段（今日未来 4 段 + 明日前 4 段）
    local rain_peaks
    rain_peaks=$(echo "$weather" | jq -r '
      [ (.weather[0].hourly[] | {h:(.time|tonumber/100|floor), r:(.chanceofrain|tonumber)}),
        (.weather[1].hourly[] | {h:(.time|tonumber/100|floor+24), r:(.chanceofrain|tonumber)}) ]
      | map(select(.r >= 50)) | .[0:3]
      | map("\(.h % 24):00 \(.r)%") | join(" · ")
    ')

    # 穿衣 / UV（使用纯文本，避免 emoji 渲染为方框）
    local dress uv_desc
    dress=$(get_dress_advice "$today_max" "$today_min" long)
    uv_desc=$(get_uv_desc "$uv" plain)

    # 组装 JSON
    out=$(jq -n \
      --arg city        "$city_name" \
      --arg period      "$period" \
      --arg cur_temp    "$cur_temp" \
      --arg feels       "$feels_like" \
      --arg humidity    "$humidity" \
      --arg wind        "$wind_kmph" \
      --arg uv          "$uv" \
      --arg uv_desc     "$uv_desc" \
      --arg sunrise     "$sunrise" \
      --arg sunset      "$sunset" \
      --arg today_max   "$today_max" \
      --arg today_min   "$today_min" \
      --arg today_desc  "$today_desc" \
      --arg today_emoji "$today_emoji" \
      --arg tmr_max     "$tmr_max" \
      --arg tmr_min     "$tmr_min" \
      --arg tmr_desc    "$tmr_desc" \
      --arg tmr_emoji   "$tmr_emoji" \
      --arg tmr_rain    "$tmr_rain" \
      --arg rain_peaks  "$rain_peaks" \
      --arg dress       "$dress" \
      '{city:$city, period:$period, cur_temp:$cur_temp, feels:$feels, humidity:$humidity, wind:$wind,
        uv:$uv, uv_desc:$uv_desc, sunrise:$sunrise, sunset:$sunset,
        today_max:$today_max, today_min:$today_min, today_desc:$today_desc, today_emoji:$today_emoji,
        tmr_max:$tmr_max, tmr_min:$tmr_min, tmr_desc:$tmr_desc, tmr_emoji:$tmr_emoji,
        tmr_rain:$tmr_rain, rain_peaks:$rain_peaks, dress:$dress}')

    echo "$out"
}

# 3) 生成卡片
generate_card() {
    local items_json="$1" date_str="$2"

    # Node 只负责 body + 返回 h 和 title/subtitle/c1/c2（交由 bash 调 svg_header）
    local meta body card_h title subtitle c1 c2
    meta=$(node -e "
const d = JSON.parse(process.argv[1]);

const titleMap = {
  morning:   { title: \`\${d.city} · 今日天气\`, subtitle: '早安，出门前看看天气' },
  afternoon: { title: \`\${d.city} · 午后天气\`, subtitle: '午后提醒，注意防晒补水' },
  evening:   { title: \`\${d.city} · 明日天气\`, subtitle: '晚安，看看明天穿什么' },
};
const { title, subtitle } = titleMap[d.period] || titleMap.morning;

const isEvening = d.period === 'evening';
const mainTemp  = isEvening ? d.tmr_max    : d.cur_temp;
const mainDesc  = isEvening ? d.tmr_desc   : d.today_desc;
const rangeText = isEvening
  ? \`明日 \${d.tmr_min}° ~ \${d.tmr_max}°C\`
  : \`今日 \${d.today_min}° ~ \${d.today_max}°C · 体感 \${d.feels}°C\`;

const cells = isEvening ? [
  ['明日最高', \`\${d.tmr_max}°C\`],
  ['明日最低', \`\${d.tmr_min}°C\`],
  ['降雨概率', \`\${d.tmr_rain}%\`],
  ['紫外线',   d.uv_desc],
  ['日出',     d.sunrise],
  ['日落',     d.sunset],
] : [
  ['当前温度', \`\${d.cur_temp}°C\`],
  ['体感温度', \`\${d.feels}°C\`],
  ['湿度',     \`\${d.humidity}%\`],
  ['风速',     \`\${d.wind} km/h\`],
  ['紫外线',   d.uv_desc],
  ['今日区间', \`\${d.today_min}° ~ \${d.today_max}°\`],
];

let cellsSvg = '';
const cellW = 470, cellH = 80, gap = 20;
const startX = 50, startY = 410;
cells.forEach((c, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = startX + col * (cellW + gap);
  const y = startY + row * (cellH + gap);
  cellsSvg += \`
  <rect x=\"\${x}\" y=\"\${y}\" width=\"\${cellW}\" height=\"\${cellH}\" fill=\"#ffffff0a\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
  <text x=\"\${x+25}\" y=\"\${y+34}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"22\" fill=\"#ffffff80\">\${c[0]}</text>
  <text x=\"\${x+cellW-25}\" y=\"\${y+54}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"28\" font-weight=\"600\" fill=\"#ffffffee\" text-anchor=\"end\">\${c[1]}</text>\`;
});

const tipY = startY + 3 * (cellH + gap) + 20;
let tipsSvg = \`
  <rect x=\"50\" y=\"\${tipY}\" width=\"980\" height=\"70\" fill=\"#ffffff0a\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
  <text x=\"75\" y=\"\${tipY+45}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffffcc\">穿衣建议　\${d.dress}</text>\`;

let rainTipSvg = '';
if (d.rain_peaks) {
  const rainY = tipY + 90;
  rainTipSvg = \`
  <rect x=\"50\" y=\"\${rainY}\" width=\"980\" height=\"70\" fill=\"#ffffff0a\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
  <text x=\"75\" y=\"\${rainY+45}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffffcc\">降雨时段　\${d.rain_peaks}</text>\`;
}

const h = (d.rain_peaks ? tipY + 90 + 70 : tipY + 70) + 70;

const bgColors = {
  morning:   ['#4A90E2', '#1E3C72'],
  afternoon: ['#F39C12', '#C0392B'],
  evening:   ['#2C3E50', '#1A1A2E'],
};
const [c1, c2] = bgColors[d.period] || bgColors.morning;

const body = [
  \`  <text x=\"70\" y=\"290\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"120\" font-weight=\"300\" fill=\"#ffffffee\">\${mainTemp}°</text>\`,
  \`  <text x=\"360\" y=\"290\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"48\" font-weight=\"500\" fill=\"#ffffffee\">\${mainDesc}</text>\`,
  \`  <text x=\"70\" y=\"360\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffff80\">\${rangeText}</text>\`,
  \`  <line x1=\"70\" y1=\"390\" x2=\"1010\" y2=\"390\" stroke=\"#ffffff20\" stroke-width=\"1\"/>\`,
  cellsSvg,
  tipsSvg,
  rainTipSvg,
].filter(Boolean).join('\n');

// 以 __TAG__key=value 约定把元数据返回 bash，body 放最后（含多行）通过 __BODY__ 标记
console.log('__H__' + h);
console.log('__TITLE__' + title);
console.log('__SUBTITLE__' + subtitle);
console.log('__C1__' + c1);
console.log('__C2__' + c2);
console.log('__BODY__');
console.log(body);
" "$items_json")

    card_h=$(echo "$meta"   | awk -F'__H__'    '/^__H__/{print $2}')
    title=$(echo "$meta"    | awk -F'__TITLE__'    '/^__TITLE__/{print $2}')
    subtitle=$(echo "$meta" | awk -F'__SUBTITLE__' '/^__SUBTITLE__/{print $2}')
    c1=$(echo "$meta"       | awk -F'__C1__' '/^__C1__/{print $2}')
    c2=$(echo "$meta"       | awk -F'__C2__' '/^__C2__/{print $2}')
    body=$(echo "$meta"     | awk '/^__BODY__$/{flag=1;next}flag{print}')

    {
        svg_header "$card_h" "$c1" "$c2" "$title" "${date_str}  ${subtitle}"
        echo "$body"
        svg_footer "$card_h" "数据来源：wttr.in"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

# 拉取卡片展示用城市名
# 入参: $1=weather JSON  $2=用户原始输入
# 优先级：用户输入 > "深圳"（默认调用，保持与历史卡片标题一致）
# 注：wttr 返回的 nearest_area.areaName 在深圳容易解析为「Ma Tso Lung」等边境小村，
#     不适合做默认展示文案，因此当用户不传 city 时直接锁定为"深圳"。
resolve_city_name() {
    local weather="$1" user_input="$2"
    if [ -n "$user_input" ]; then
        echo "$user_input"
        return
    fi
    echo "深圳"
}

main() {
    log_info "======================================"
    log_info "天气查询卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    # 0. 解析入参（$1=城市，缺省 = 深圳）
    local city="${1:-}"
    log_info "目标城市: ${city:-深圳（默认）}"

    # 1. 当前时段
    local period date_str
    period=$(detect_period)
    date_str=$(get_date_str)
    log_info "时段: $period   日期: $date_str"

    # 2. 抓取
    local weather
    weather=$(fetch_data "$city") || exit 1
    log_info "天气数据抓取成功"

    # 2.5 解析城市展示名（用户输入优先，wttr 返回 areaName 兜底）
    local city_name
    city_name=$(resolve_city_name "$weather" "$city")
    log_info "卡片展示城市名: $city_name"

    # 3. 解析
    local items_json
    items_json=$(parse_data "$weather" "$period" "$city_name")
    log_info "数据解析完成"

    # 4. 生成
    generate_card "$items_json" "$date_str"
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"

    echo "$OUTPUT_FILE"
}

main "$@"
