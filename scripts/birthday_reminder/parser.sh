#!/bin/bash

# ======================================
# 生日解析模块
# ======================================
#
# 功能说明：
#   解析生日条目，支持公历和农历格式
#   - 公历：YYYY-MM-DD 或 MM-DD
#   - 农历：lunar:MM-DD（每年自动转换）
#   调用 date_utils.py 进行农历→公历转换和倒计时计算
#
# 所属：birthday_reminder 子模块
#
# 依赖：
#   - date_utils.py（农历日期转换/倒计时计算）
#
# 作者：智能提醒系统
# 更新：2026-04-22
# ======================================

# 解析生日条目，获取公历 MM-DD 和展示用的日期字符串
# 避免重复调用 python3 转换农历日期
# 参数：
#   $1 - 生日字符串（如 "MM-DD"、"YYYY-MM-DD"、"lunar:MM-DD"）
# 输出（通过 echo，以 | 分隔）：
#   birth_md|birthday_display|days_until
#   例如: 04-15|2026-04-15（农历03月15日）|26
parse_birthday_entry() {
    local birthday_str="$1"
    local birth_md=""
    local birthday_display=""
    local days_remaining=""

    if [[ "$birthday_str" == lunar:* ]]; then
        local lunar_date="${birthday_str#lunar:}"
        local lunar_month
        lunar_month=$(echo "$lunar_date" | cut -d'-' -f1)
        local lunar_day
        lunar_day=$(echo "$lunar_date" | cut -d'-' -f2)

        # 使用 date_utils.py 一次性获取：公历日期 + 倒计时天数
        local solar_date
        solar_date=$(python3 "${PROJECT_DIR}/date_utils.py" birthday "$lunar_month" "$lunar_day" 2>/dev/null)

        if [ $? -ne 0 ] || [ -z "$solar_date" ]; then
            echo "ERROR"
            return 1
        fi

        birth_md=$(echo "$solar_date" | cut -d'-' -f2-3)
        birthday_display="${solar_date}（农历${lunar_month}月${lunar_day}日）"

        # 计算精确倒计时天数
        days_remaining=$(python3 "${PROJECT_DIR}/date_utils.py" days_until_lunar "$lunar_month" "$lunar_day" 2>/dev/null)
    else
        # 公历格式：提取 MM-DD
        birth_md=$(echo "$birthday_str" | grep -oP '\d{2}-\d{2}$' || echo "$birthday_str")
        birthday_display="$birthday_str"

        # 提取月和日计算倒计时
        local month
        month=$(echo "$birth_md" | cut -d'-' -f1)
        local day
        day=$(echo "$birth_md" | cut -d'-' -f2)
        days_remaining=$(python3 "${PROJECT_DIR}/date_utils.py" days_until "$month" "$day" 2>/dev/null)
    fi

    # 倒计时获取失败时回退
    if [ -z "$days_remaining" ]; then
        days_remaining="-1"
    fi

    echo "${birth_md}|${birthday_display}|${days_remaining}"
}
