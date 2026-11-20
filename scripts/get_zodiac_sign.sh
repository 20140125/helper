#!/bin/bash

# ======================================
# 星座自动判断脚本
# ======================================
#
# 功能说明：
#   1. 根据 .env 中配置的出生日期自动判断星座
#   2. 支持12星座的月日范围判断
#   3. 输出星座名称（如：水瓶座、双鱼座）
#   4. 供 fetch_real_horoscope.sh 等脚本调用
#
# 使用方式：
#   bash get_zodiac_sign.sh              # 输出星座名称
#   ZODIAC=$(bash get_zodiac_sign.sh)    # 赋值给变量
#
# 配置来源：
#   - .env 文件中的 BIRTHDAY（格式：YYYY-MM-DD）
#
# 作者：智能提醒系统
# 更新：2026-03-10
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 加载统一配置（包含 TZ）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

# 根据月日判断星座
get_zodiac_by_date() {
    local month=$1
    local day=$2
    
    # 移除前导零
    month=$(echo "$month" | sed 's/^0*//')
    day=$(echo "$day" | sed 's/^0*//')
    
    # 星座判断逻辑
    if [ "$month" -eq 1 ]; then
        if [ "$day" -le 19 ]; then
            echo "摩羯座"
        else
            echo "水瓶座"
        fi
    elif [ "$month" -eq 2 ]; then
        if [ "$day" -le 18 ]; then
            echo "水瓶座"
        else
            echo "双鱼座"
        fi
    elif [ "$month" -eq 3 ]; then
        if [ "$day" -le 20 ]; then
            echo "双鱼座"
        else
            echo "白羊座"
        fi
    elif [ "$month" -eq 4 ]; then
        if [ "$day" -le 19 ]; then
            echo "白羊座"
        else
            echo "金牛座"
        fi
    elif [ "$month" -eq 5 ]; then
        if [ "$day" -le 20 ]; then
            echo "金牛座"
        else
            echo "双子座"
        fi
    elif [ "$month" -eq 6 ]; then
        if [ "$day" -le 21 ]; then
            echo "双子座"
        else
            echo "巨蟹座"
        fi
    elif [ "$month" -eq 7 ]; then
        if [ "$day" -le 22 ]; then
            echo "巨蟹座"
        else
            echo "狮子座"
        fi
    elif [ "$month" -eq 8 ]; then
        if [ "$day" -le 22 ]; then
            echo "狮子座"
        else
            echo "处女座"
        fi
    elif [ "$month" -eq 9 ]; then
        if [ "$day" -le 22 ]; then
            echo "处女座"
        else
            echo "天秤座"
        fi
    elif [ "$month" -eq 10 ]; then
        if [ "$day" -le 23 ]; then
            echo "天秤座"
        else
            echo "天蝎座"
        fi
    elif [ "$month" -eq 11 ]; then
        if [ "$day" -le 22 ]; then
            echo "天蝎座"
        else
            echo "射手座"
        fi
    elif [ "$month" -eq 12 ]; then
        if [ "$day" -le 21 ]; then
            echo "射手座"
        else
            echo "摩羯座"
        fi
    fi
}

# 主函数
main() {
    local date_str="${1:-$(date +%Y-%m-%d)}"
    
    # 解析日期
    local month=$(echo "$date_str" | cut -d'-' -f2)
    local day=$(echo "$date_str" | cut -d'-' -f3)
    
    # 获取星座
    local zodiac=$(get_zodiac_by_date "$month" "$day")
    
    echo "$zodiac"
}

# 执行
main "$@"
