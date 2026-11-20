#!/bin/bash

# ======================================
# 每日数据预获取模块
# ======================================
#
# 功能说明：
#   凌晨预获取所有数据并缓存到 JSON 文件
#   包含：天气、历史、黄历、星座、励志语录
#
# 依赖：
#   - fetch_real_weather.sh（天气API）
#   - history_today.sh（历史上的今天）
#   - fetch_real_almanac.sh（黄历API）
#   - fetch_real_horoscope.sh（星座API）
#   - get_zodiac_sign.sh（星座判断）
#   - inspirational_quotes.sh（励志语录）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

cmd_prefetch() {
    LOG_FILE="${PROJECT_DIR}/daily_data_manager.log"
    source "${PROJECT_DIR}/log_utils.sh"

    log_info "======================================"
    log_info "🚀 每日数据预获取脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "📦 预获取日期: ${TODAY}"
    log_info "======================================"

    # 1. 获取天气数据
    log_info "1️⃣  获取天气数据（聚合数据API）..."
    weather_data=""
    if [ -f "${PROJECT_DIR}/fetch_real_weather.sh" ]; then
        weather_data=$(bash "${PROJECT_DIR}/fetch_real_weather.sh" message 深圳 2>/dev/null)
        if [ -n "$weather_data" ] && [ "$weather_data" != "API_KEY_NOT_CONFIGURED" ] && [ "$weather_data" != "API_REQUEST_FAILED" ] && [[ ! "$weather_data" =~ ^API_ERROR ]]; then
            log_success "天气数据获取成功（聚合数据API）"
        else
            log_error "天气API调用失败：${weather_data}"
            weather_data="API_FAILED"
        fi
    else
        log_error "fetch_real_weather.sh 不存在"
        weather_data="SCRIPT_NOT_FOUND"
    fi

    # 2. 获取历史上的今天
    log_info "2️⃣  获取历史上的今天..."
    history_data=""
    if [ -f "${PROJECT_DIR}/history_today.sh" ]; then
        history_data=$(bash "${PROJECT_DIR}/history_today.sh" message 2>/dev/null)
        if [ -n "$history_data" ]; then
            log_success "历史数据获取成功"
        else
            log_warning "历史数据获取失败"
            history_data="FETCH_FAILED"
        fi
    else
        log_error "history_today.sh 不存在"
        history_data="SCRIPT_NOT_FOUND"
    fi

    # 3. 获取黄历数据
    log_info "3️⃣  获取黄历数据（聚合数据API）..."
    almanac_data=""
    if [ -f "${PROJECT_DIR}/fetch_real_almanac.sh" ]; then
        almanac_data=$(bash "${PROJECT_DIR}/fetch_real_almanac.sh" message 2>/dev/null)
        if echo "$almanac_data" | grep -q "^##"; then
            log_success "黄历数据获取成功（聚合数据API）"
        else
            log_error "黄历API调用失败：${almanac_data}"
            almanac_data="API_FAILED"
        fi
    else
        log_error "fetch_real_almanac.sh 不存在"
        almanac_data="SCRIPT_NOT_FOUND"
    fi


    # 4. 获取星座运势
    log_info "4️⃣  获取星座运势（聚合数据API）..."
    horoscope_data=""
    if [ -f "${PROJECT_DIR}/get_zodiac_sign.sh" ]; then
        ZODIAC_SIGN=$(bash "${PROJECT_DIR}/get_zodiac_sign.sh" 2>/dev/null)
        log_info "   当前星座：${ZODIAC_SIGN}"
    else
        log_error "   错误：get_zodiac_sign.sh 脚本不存在"
        log_info "======================================"
        exit 1
    fi

    if [ -f "${PROJECT_DIR}/fetch_real_horoscope.sh" ]; then
        horoscope_data=$(bash "${PROJECT_DIR}/fetch_real_horoscope.sh" message "$ZODIAC_SIGN" 2>/dev/null)
        if echo "$horoscope_data" | grep -q "^##"; then
            log_success "星座运势获取成功（聚合数据API - ${ZODIAC_SIGN}）"
        else
            log_error "星座API调用失败：${horoscope_data}"
            horoscope_data="API_FAILED"
        fi
    else
        log_error "fetch_real_horoscope.sh 不存在"
        horoscope_data="SCRIPT_NOT_FOUND"
    fi

    # 5. 获取每日一言（金山词霸英语 + hitokoto 中文名言）
    # 取数统一走 tools/daily_word.sh 的 fetch_data：该脚本已加 source 守卫，
    # 被 source 时不执行 main，可直接复用「归档缓存 → API → 降级」整套逻辑。
    # 旧版这里另写了一份 hitokoto+iciba 抓取兜底，正是 2026-10-28 起把空英文
    # 写进归档 / 历史库的源头（jq 对空 body 无输出，.content // 默认值不生效）。
    # 归档位置：.cache/api_responses/dailyword_<YYYY-MM>.json（一月一文件）
    log_info "5️⃣  获取每日一言（金山词霸 + 一言API）..."
    inspirational_quote=""
    # 每日一词历史库（只增不删；fetch_data 内部会自行加载归档库等依赖）
    source "${PROJECT_DIR}/dailyword_library.sh"
    local daily_word_script="${PROJECT_DIR}/tools/daily_word.sh"
    local daily_word_json=""

    if [ -f "${daily_word_script}" ]; then
        daily_word_json=$(bash -c "source '${daily_word_script}' >/dev/null 2>&1; fetch_data" 2>/dev/null || true)
    fi

    # 只接受完整数据：三个正文字段任一为空就当取数失败，绝不写入缓存 / 历史库
    if ! echo "${daily_word_json}" | jq -e \
        '(((.quote // "") | length) > 0) and (((.english // "") | length) > 0) and (((.chinese // "") | length) > 0)' \
        >/dev/null 2>&1; then
        daily_word_json=""
    fi

    # 沉淀到每日一词历史库（fetch_data 内已沉淀一次，这里幂等兜底）
    persist_dailyword "${daily_word_json}"

    if [ -n "${daily_word_json}" ]; then
        # 组装 Markdown：保留中英文 + 一言 + 出处
        inspirational_quote=$(python3 - "${daily_word_json}" << 'PYEOF'
import json, sys
try:
    data = json.loads(sys.argv[1])
except Exception:
    data = {}
english = data.get('english', '')
chinese = data.get('chinese', '')
quote   = data.get('quote', '')
src     = data.get('from', '佚名')

# 注意：外层 morning_assembler.sh 会包一个 "### 💪 每日励志" 标题，
# 这里不再重复输出 "## 💡 每日一言"，避免双标题。
lines = []
if quote:
    lines.append(f"> {quote}  —— {src}")
    lines.append("")
if english:
    lines.append(f"> {english}")
if chinese:
    lines.append(f"> {chinese}")
print("\n".join(lines))
PYEOF
)
        log_success "每日一言获取成功（iciba 失效时自动降级复用历史沉淀）"
    else
        log_warning "每日一言获取失败，使用默认语录"
        inspirational_quote="> 成功不是终点，失败也不是末日，唯有勇气才能永续。\n> —— 丘吉尔"
    fi

    # 6. 保存到缓存文件（使用 Python json.dumps 序列化，避免特殊字符截断问题）
    log_info "6️⃣  保存到缓存文件..."

    local fetch_time
    fetch_time="$(date '+%Y-%m-%d %H:%M:%S')"

    python3 - "$CACHE_FILE" "$TODAY" "$fetch_time" \
        "$weather_data" "$history_data" "$almanac_data" \
        "$horoscope_data" "$inspirational_quote" << 'PYEOF'
import json, sys

cache_file   = sys.argv[1]
today        = sys.argv[2]
fetch_time   = sys.argv[3]
weather      = sys.argv[4]
history      = sys.argv[5]
almanac      = sys.argv[6]
horoscope    = sys.argv[7]
inspirational= sys.argv[8]

payload = {
    "date":               today,
    "fetch_time":         fetch_time,
    "weather":            weather,
    "history":            history,
    "almanac":            almanac,
    "horoscope":          horoscope,
    "inspirational_quote":inspirational,
}

with open(cache_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
PYEOF

    if [ -f "$CACHE_FILE" ]; then
        cache_size=$(du -h "$CACHE_FILE" | cut -f1)
        log_success "缓存文件已保存：${CACHE_FILE} (${cache_size})"
    else
        log_error "缓存文件保存失败"
    fi

    # 7. 清理旧缓存
    log_info "7️⃣  清理旧缓存..."
    find "$CACHE_DIR" -name "daily_data_*.json" ! -name "daily_data_${TODAY}.json" -delete 2>/dev/null
    remaining=$(ls -1 "$CACHE_DIR"/daily_data_*.json 2>/dev/null | wc -l)
    log_success "旧缓存已清理，保留 ${remaining} 个缓存文件（仅今天）"

    log_success "脚本执行完成"
    log_info "======================================"

    exit 0
}
