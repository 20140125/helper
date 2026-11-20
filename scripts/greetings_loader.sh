#!/bin/bash

# ======================================
# 祝福语加载器（统一版本）
# ======================================
#
# 功能说明：
#   1. 从统一的 greetings.json 文件中加载各类祝福语
#   2. 支持节气、节假日、农历节日、生日、特殊节日等分类
#   3. 使用python3解析JSON，随机或按名称返回祝福语
#   4. 为各提醒脚本提供统一的祝福语获取接口
#
# 提供函数：
#   get_solar_term_greeting <节气名>   - 获取节气祝福语
#   get_holiday_greeting <节日名>      - 获取节假日祝福语
#   get_lunar_festival_greeting <节日> - 获取农历节日祝福语
#   get_birthday_greeting              - 获取生日祝福语
#   get_special_day_greeting <节日名>  - 获取特殊节日祝福语
#
# 数据来源：
#   - .cache/greetings.json（统一祝福语数据文件）
#
# 使用方式：
#   source "${PROJECT_DIR}/greetings_loader.sh"
#
# 作者：智能提醒系统
# 更新：2026-03-23
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 统一JSON文件路径
GREETINGS_JSON="${CACHE_DIR}/greetings.json"

# 从JSON获取24节气祝福语
# 参数: $1 - 节气名称（如：立春、雨水）
# 返回: 祝福语内容
get_solar_term_greeting() {
    local term_name="$1"
    
    python3 << PYEOF 2>/dev/null
import json
import sys

try:
    with open('$GREETINGS_JSON', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    term_name = '$term_name'
    solar_terms = data.get('solar_terms', {})
    
    if term_name in solar_terms:
        val = solar_terms[term_name]
        print(val if isinstance(val, str) else val.get('greeting', val))
    else:
        print(f"## 🌿 {term_name}\\n\\n节气祝福（未找到对应祝福语）")
        sys.exit(1)
except Exception as e:
    print(f"## 🌿 {term_name}\\n\\n节气祝福（读取失败: {e}）")
    sys.exit(1)
PYEOF
}

# 从JSON获取节假日祝福语
# 参数: $1 - 节假日名称（如：元旦、春节、清明、劳动节、端午、中秋、国庆）
# 返回: 祝福语内容
get_holiday_greeting() {
    local holiday_name="$1"
    
    python3 << PYEOF 2>/dev/null
import json
import sys

try:
    with open('$GREETINGS_JSON', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    holiday_name = '$holiday_name'
    
    # 处理节假日名称的变体（映射到 JSON 中实际的 key）
    holiday_map = {
        '元旦': '元旦',
        '春节': '春节',
        '除夕': '春节',
        '清明': '清明节',
        '清明节': '清明节',
        '劳动节': '劳动节',
        '五一': '劳动节',
        '端午': '端午节',
        '端午节': '端午节',
        '中秋': '中秋节',
        '中秋节': '中秋节',
        '国庆': '国庆节',
        '国庆节': '国庆节'
    }
    
    matched_name = holiday_map.get(holiday_name, holiday_name)
    holidays = data.get('holidays', {})
    
    if matched_name in holidays:
        val = holidays[matched_name]
        print(val if isinstance(val, str) else val.get('greeting', val))
    else:
        print(f"## 🎊 {holiday_name}快乐！\\n\\n节日祝福（未找到对应祝福语）")
        sys.exit(1)
except Exception as e:
    print(f"## 🎊 {holiday_name}快乐！\\n\\n节日祝福（读取失败: {e}）")
    sys.exit(1)
PYEOF
}

# 从JSON获取农历节日祝福语
# 参数: $1 - 农历节日名称（如：腊八节、小年、除夕、元宵节、龙抬头、七夕节、中元节、重阳节）
# 返回: 祝福语内容
get_lunar_festival_greeting() {
    local festival_name="$1"
    
    python3 << PYEOF 2>/dev/null
import json
import sys

try:
    with open('$GREETINGS_JSON', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    festival_name = '$festival_name'
    lunar_festivals = data.get('lunar_festivals', {})
    
    if festival_name in lunar_festivals:
        val = lunar_festivals[festival_name]
        print(val if isinstance(val, str) else val.get('greeting', val))
    else:
        print(f"## 🏮 {festival_name}快乐！\\n\\n农历节日祝福（未找到对应祝福语）")
        sys.exit(1)
except Exception as e:
    print(f"## 🏮 {festival_name}快乐！\\n\\n农历节日祝福（读取失败: {e}）")
    sys.exit(1)
PYEOF
}

# 从JSON获取生日祝福语（随机选择一个）
# 参数: $1 - 姓名
#       $2 - 是否随机（true/false，默认true）
# 返回: 祝福语内容（已替换姓名）
get_birthday_greeting() {
    local name="$1"
    local use_random="${2:-true}"
    
    python3 << PYEOF 2>/dev/null
import json
import random
import sys

try:
    with open('$GREETINGS_JSON', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    name = '$name'
    use_random = '$use_random' == 'true'
    
    birthday_data = data.get('birthday', {})
    templates = birthday_data.get('templates', [])
    
    if not templates:
        print(f"🎂 生日快乐！{name}\\n\\n生日祝福（未找到模板）")
        sys.exit(1)
    
    # 选择模板
    if use_random:
        # 使用姓名和日期的哈希来确保同一天同一个人使用相同的祝福语
        import datetime
        day_of_year = datetime.datetime.now().timetuple().tm_yday
        name_hash = sum(ord(c) for c in name)
        index = (day_of_year * 17 + name_hash) % len(templates)
        template = templates[index]
    else:
        template = templates[0]
    
    # 替换姓名
    greeting = template.replace('{name}', name)
    print(greeting)
    
except Exception as e:
    print(f"🎂 生日快乐！{name}\\n\\n生日祝福（读取失败: {e}）")
    sys.exit(1)
PYEOF
}

# 从JSON获取特殊节日祝福语
# 参数: $1 - 特殊节日名称（如：情人节、妇女节、儿童节、教师节、程序员节、圣诞节）
# 返回: 祝福语内容
get_special_day_greeting() {
    local day_name="$1"
    
    python3 << PYEOF 2>/dev/null
import json
import sys

try:
    with open('$GREETINGS_JSON', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    day_name = '$day_name'
    special_days = data.get('special_days', {})
    
    if day_name in special_days:
        print(special_days[day_name])
    else:
        print(f"## 🎉 {day_name}快乐！\\n\\n特殊节日祝福（未找到对应祝福语）")
        sys.exit(1)
except Exception as e:
    print(f"## 🎉 {day_name}快乐！\\n\\n特殊节日祝福（读取失败: {e}）")
    sys.exit(1)
PYEOF
}

# 导出函数
export -f get_solar_term_greeting
export -f get_holiday_greeting
export -f get_lunar_festival_greeting
export -f get_birthday_greeting
export -f get_special_day_greeting
