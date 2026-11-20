#!/bin/bash

# ======================================
# 自定义规则 - 工具函数
# ======================================
#
# 提供规则执行所需的辅助函数：
#   get_random_quote    - 获取随机励志语录
#   get_type_label      - 规则类型转中文
#   format_condition    - 触发条件格式化
#
# ======================================

# ======================================
# 获取随机励志语录
# ======================================

# 引入通用语录读取工具
source "${SCRIPT_DIR}/inspirational_quotes.sh" 2>/dev/null

get_random_quote() {
    get_quote_random "quotes.quotes"
}

# ======================================
# 规则类型转中文
# ======================================

get_type_label() {
    local type="$1"
    case "$type" in
        date)        echo "公历日期" ;;
        weekday)     echo "每周" ;;
        lunar_date)  echo "农历日期" ;;
        monthly)     echo "每月定时" ;;
        daily)       echo "每日定时" ;;
        workday)     echo "工作日" ;;
        countdown)   echo "倒计时"   ;;
        *)           echo "$type"   ;;
    esac
}

# ======================================
# 触发条件格式化为可读文本
# ======================================

format_condition() {
    local type="$1"
    local condition="$2"
    case "$type" in
        date)
            # MM-DD → M 月 D 日
            local m d
            m=$(echo "$condition" | cut -d'-' -f1 | sed 's/^0//')
            d=$(echo "$condition" | cut -d'-' -f2 | sed 's/^0//')
            echo "${m} 月 ${d} 日"
            ;;
        weekday)
            # 1-7 → 周一~周日
            case "$condition" in
                1) echo "周一" ;;
                2) echo "周二" ;;
                3) echo "周三" ;;
                4) echo "周四" ;;
                5) echo "周五" ;;
                6) echo "周六" ;;
                7) echo "周日" ;;
                *) echo "周 ${condition}" ;;
            esac
            ;;
        lunar_date)
            # MM-DD → 农历 M 月 D 日
            local m d
            m=$(echo "$condition" | cut -d'-' -f1 | sed 's/^0//')
            d=$(echo "$condition" | cut -d'-' -f2 | sed 's/^0//')
            echo "农历 ${m} 月 ${d} 日"
            ;;
        monthly)
            # DD → 每月第 D 天
            local d
            d=$(echo "$condition" | sed 's/^0//')
            echo "每月第 ${d} 天"
            ;;
        daily)
            echo "每天"
            ;;
        workday)
            echo "工作日（含调休）"
            ;;
        countdown)
            # YYYY-MM-DD → 倒计时至 YYYY 年 M 月 D 日
            local y m d
            y=$(echo "$condition" | cut -d'-' -f1)
            m=$(echo "$condition" | cut -d'-' -f2 | sed 's/^0//')
            d=$(echo "$condition" | cut -d'-' -f3 | sed 's/^0//')
            echo "倒计时至 ${y} 年 ${m} 月 ${d} 日"
            ;;
        *)
            echo "$condition"
            ;;
    esac
}
