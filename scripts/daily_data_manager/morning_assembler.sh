#!/bin/bash

# ======================================
# 早安数据组装模块
# ======================================
#
# 功能说明：
#   1. 获取完整的早安数据到全局变量
#   2. 生成早安数据的 Markdown 格式输出
#
# 全局变量输出：
#   MORNING_WEATHER_INFO      - 天气信息
#   MORNING_HISTORY_INFO      - 历史上的今天
#   MORNING_ALMANAC_INFO      - 黄历信息
#   MORNING_HOROSCOPE_INFO    - 星座运势
#   MORNING_INSPIRATIONAL_QUOTE - 励志语录
#
# 依赖：
#   - cache_reader.sh（缓存数据读取）
#   - 各数据获取脚本（作为实时获取的降级方案）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 获取完整的早安数据，结果存入全局变量
get_morning_data() {
    # 获取天气信息
    MORNING_WEATHER_INFO=$(read_cached_data weather 2>/dev/null)
    if [ -z "$MORNING_WEATHER_INFO" ] || [[ "$MORNING_WEATHER_INFO" =~ ^(CACHE_NOT_FOUND|CACHE_EXPIRED|CACHE_EMPTY)$ ]]; then
        if [ -f "${PROJECT_DIR}/fetch_real_weather.sh" ]; then
            MORNING_WEATHER_INFO=$(bash "${PROJECT_DIR}/fetch_real_weather.sh" message 深圳 2>/dev/null)
        fi
    fi
    
    # 获取历史信息
    MORNING_HISTORY_INFO=$(read_cached_data history 2>/dev/null)
    if [ -z "$MORNING_HISTORY_INFO" ] || [[ "$MORNING_HISTORY_INFO" =~ ^(CACHE_NOT_FOUND|CACHE_EXPIRED|CACHE_EMPTY)$ ]]; then
        if [ -f "${PROJECT_DIR}/history_today.sh" ]; then
            MORNING_HISTORY_INFO=$(bash "${PROJECT_DIR}/history_today.sh" message 2>/dev/null)
        fi
    fi
    
    # 获取黄历信息
    MORNING_ALMANAC_INFO=$(read_cached_data almanac 2>/dev/null)
    if [ -z "$MORNING_ALMANAC_INFO" ] || [[ "$MORNING_ALMANAC_INFO" =~ ^(CACHE_NOT_FOUND|CACHE_EXPIRED|CACHE_EMPTY)$ ]]; then
        if [ -f "${PROJECT_DIR}/fetch_real_almanac.sh" ]; then
            MORNING_ALMANAC_INFO=$(bash "${PROJECT_DIR}/fetch_real_almanac.sh" message 2>/dev/null)
        else
            MORNING_ALMANAC_INFO="### 📅 今日黄历\n━━━━━━━━━━━━━━━━━━━━━━\n**数据获取失败**"
        fi
    fi
    
    # 获取星座运势
    MORNING_HOROSCOPE_INFO=$(read_cached_data horoscope 2>/dev/null)
    if [ -z "$MORNING_HOROSCOPE_INFO" ] || [[ "$MORNING_HOROSCOPE_INFO" =~ ^(CACHE_NOT_FOUND|CACHE_EXPIRED|CACHE_EMPTY)$ ]]; then
        local zodiac
        if [ -f "${PROJECT_DIR}/get_zodiac_sign.sh" ]; then
            zodiac=$(bash "${PROJECT_DIR}/get_zodiac_sign.sh" 2>/dev/null)
        else
            MORNING_HOROSCOPE_INFO=""
        fi
        
        if [ -n "$zodiac" ] && [ -f "${PROJECT_DIR}/fetch_real_horoscope.sh" ]; then
            MORNING_HOROSCOPE_INFO=$(bash "${PROJECT_DIR}/fetch_real_horoscope.sh" message "$zodiac" 2>/dev/null)
        elif [ -z "$zodiac" ]; then
            MORNING_HOROSCOPE_INFO=""
        else
            MORNING_HOROSCOPE_INFO="### ✨ 今日星座运势\n━━━━━━━━━━━━━━━━━━━━━━\n**数据获取失败**"
        fi
    fi
    
    # 获取励志语
    MORNING_INSPIRATIONAL_QUOTE=$(read_cached_data inspirational_quote 2>/dev/null)
    if [ -z "$MORNING_INSPIRATIONAL_QUOTE" ] || [[ "$MORNING_INSPIRATIONAL_QUOTE" =~ ^(CACHE_NOT_FOUND|CACHE_EXPIRED|CACHE_EMPTY)$ ]]; then
        if [ -f "${PROJECT_DIR}/inspirational_quotes.sh" ]; then
            MORNING_INSPIRATIONAL_QUOTE=$(bash "${PROJECT_DIR}/inspirational_quotes.sh" daily 2>/dev/null)
        fi
    fi
    
    # 如果励志语为空，使用默认值
    if [ -z "$MORNING_INSPIRATIONAL_QUOTE" ]; then
        MORNING_INSPIRATIONAL_QUOTE="成功不是终点，失败也不是末日，唯有勇气才能永续。"
    fi
}

# 生成早安数据的Markdown格式
generate_morning_data_markdown() {
    if [ -z "$MORNING_WEATHER_INFO" ]; then
        get_morning_data
    fi
    
    local output=""
    
    if [ -n "$MORNING_WEATHER_INFO" ]; then
        output="${output}${MORNING_WEATHER_INFO}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"
    fi
    
    if [ -n "$MORNING_HOROSCOPE_INFO" ]; then
        output="${output}${MORNING_HOROSCOPE_INFO}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"
    fi
    
    if [ -n "$MORNING_ALMANAC_INFO" ]; then
        output="${output}${MORNING_ALMANAC_INFO}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"
    fi
    
    if [ -n "$MORNING_HISTORY_INFO" ]; then
        output="${output}${MORNING_HISTORY_INFO}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"
    fi
    
    if [ -n "$MORNING_INSPIRATIONAL_QUOTE" ]; then
        # MORNING_INSPIRATIONAL_QUOTE 已由 prefetch.sh 组装为完整 Markdown
        # （包含 "## 💡 每日一言" 标题 + 名言引用 + 英语/译文），
        # 直接输出即可，避免外层再包一层 `> **"..."**` 造成渲染错乱。
        output="${output}### 💪 每日励志

${MORNING_INSPIRATIONAL_QUOTE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"
    fi
    
    echo "$output"
}
