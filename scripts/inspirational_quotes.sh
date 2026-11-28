#!/bin/bash

# ======================================
# reminder_quotes.json 通用数据读取工具
# ======================================
#
# 功能说明：
#   提供从 reminder_quotes.json 对应的已有业务表 读取任意分类数据的通用方法。
#   其他脚本只需 source 本文件，即可调用以下函数获取所需内容，
#   无需在各处重复编写 JSON 解析逻辑。
#
# 支持的 JSON 路径（json_path 参数）示例：
#   quotes.quotes            - 励志语录
#   weekend.messages         - 周末寄语
#   workday_adjust.advance_reminders  - 调休提前提醒
#   workday_adjust.today_reminders    - 调休当日提醒
#   breakfast.tips           - 早餐提醒语
#   breakfast.nutrition_advice.monday - 周一早餐营养建议
#   lunch.tips               - 午餐提醒语
#   lunch.nutrition_advice.friday     - 周五午餐营养建议
#   dinner.tips              - 晚餐提醒语
#   dinner.nutrition_advice.weekend   - 调休日晚餐营养建议
#
# 公开函数：
#   get_quote_random  <json_path>          - 随机获取一条
#   get_quote_daily   <json_path>          - 按日期固定获取一条（同一天同一条）
#   get_quote_list    <json_path>          - 输出该路径下所有条目
#   get_quote_count   <json_path>          - 输出该路径下条目总数
#
# 使用示例（source 方式）：
#   source "${SCRIPT_DIR}/inspirational_quotes.sh"
#   msg=$(get_quote_random "quotes.quotes")
#   msg=$(get_quote_daily  "breakfast.tips")
#
# 命令行直接调用：
#   ./inspirational_quotes.sh random  quotes.quotes
#   ./inspirational_quotes.sh daily   weekend.messages
#   ./inspirational_quotes.sh list    lunch.tips
#   ./inspirational_quotes.sh count   dinner.tips
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# ======================================
# 路径初始化
# ======================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"
# 按需加载缓存数据库通道（缓存 JSON 不再落盘）
source "${PROJECT_DIR}/cache_db.sh"

# JSON 的缓存键
QUOTES_KEY='reminder_quotes.json'

# 默认兜底语录
_QUOTES_FALLBACK="成功不是终点，失败也不是末日，唯有勇气才能永续。"

# ======================================
# 内部工具函数
# ======================================

# 将 "a.b.c" 格式的路径转换为 Python dict 访问链
# 例：quotes.quotes → data['quotes']['quotes']
_quotes_build_py_access() {
    local json_path="$1"
    local py_access="data"
    IFS='.' read -ra parts <<< "$json_path"
    for part in "${parts[@]}"; do
        py_access="${py_access}['${part}']"
    done
    echo "$py_access"
}

# 通用 Python 读取函数，返回指定路径下的数组内容（每行一条）
# 用法：_quotes_read_array <json_path>
_quotes_read_array() {
    local json_path="$1"
    local py_access
    py_access=$(_quotes_build_py_access "$json_path")

    QUOTES_PY_ACCESS="$py_access" \
    python3 3< <(cache_db_read "$QUOTES_KEY") << 'PYEOF'
import json
import os
import sys

py_access = os.environ.get('QUOTES_PY_ACCESS', '')

try:
    with os.fdopen(3, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 动态访问嵌套路径
    result = data
    for key in py_access.replace("data", "").replace("['", "").replace("']", " ").split():
        result = result[key]

    if not isinstance(result, list):
        print(f"错误：路径 {py_access} 对应的值不是数组", file=sys.stderr)
        sys.exit(1)

    for item in result:
        print(item)

except KeyError as e:
    print(f"错误：找不到路径 {py_access}，缺少键 {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"错误：{e}", file=sys.stderr)
    sys.exit(1)
PYEOF
}

# ======================================
# 公开函数
# ======================================

# 随机获取一条语录/寄语
# 用法：get_quote_random <json_path>
# 示例：get_quote_random "quotes.quotes"
get_quote_random() {
    local json_path="${1:-quotes.quotes}"

    if ! cache_db_exists "$QUOTES_KEY"; then
        echo "$_QUOTES_FALLBACK"
        return 1
    fi

    local py_access
    py_access=$(_quotes_build_py_access "$json_path")

    QUOTES_PY_ACCESS="$py_access" \
    python3 3< <(cache_db_read "$QUOTES_KEY") << 'PYEOF'
import json
import random
import os
import sys

py_access = os.environ.get('QUOTES_PY_ACCESS', '')

try:
    with os.fdopen(3, 'r', encoding='utf-8') as f:
        data = json.load(f)

    result = data
    for key in py_access.replace("data", "").replace("['", "").replace("']", " ").split():
        result = result[key]

    if not isinstance(result, list) or not result:
        print("成功不是终点，失败也不是末日，唯有勇气才能永续。")
        sys.exit(1)

    print(random.choice(result))

except Exception as e:
    print("成功不是终点，失败也不是末日，唯有勇气才能永续。")
    sys.exit(1)
PYEOF
}

# 按日期固定获取一条语录/寄语（同一天返回同一条）
# 用法：get_quote_daily <json_path>
# 示例：get_quote_daily "weekend.messages"
get_quote_daily() {
    local json_path="${1:-quotes.quotes}"

    if ! cache_db_exists "$QUOTES_KEY"; then
        echo "$_QUOTES_FALLBACK"
        return 1
    fi

    local py_access
    py_access=$(_quotes_build_py_access "$json_path")

    QUOTES_PY_ACCESS="$py_access" \
    python3 3< <(cache_db_read "$QUOTES_KEY") << 'PYEOF'
import json
import os
import sys
from datetime import datetime

py_access = os.environ.get('QUOTES_PY_ACCESS', '')

try:
    with os.fdopen(3, 'r', encoding='utf-8') as f:
        data = json.load(f)

    result = data
    for key in py_access.replace("data", "").replace("['", "").replace("']", " ").split():
        result = result[key]

    if not isinstance(result, list) or not result:
        print("成功不是终点，失败也不是末日，唯有勇气才能永续。")
        sys.exit(1)

    # 根据一年中的第几天选择（确保同一天返回同一条）
    day_of_year = datetime.now().timetuple().tm_yday
    index = day_of_year % len(result)
    print(result[index])

except Exception as e:
    print("成功不是终点，失败也不是末日，唯有勇气才能永续。")
    sys.exit(1)
PYEOF
}

# 列出指定路径下所有条目
# 用法：get_quote_list <json_path>
# 示例：get_quote_list "breakfast.tips"
get_quote_list() {
    local json_path="${1:-quotes.quotes}"

    if ! cache_db_exists "$QUOTES_KEY"; then
        echo "错误：语录文件不存在：$QUOTES_KEY" >&2
        return 1
    fi

    _quotes_read_array "$json_path"
}

# 获取指定路径下条目总数
# 用法：get_quote_count <json_path>
# 示例：get_quote_count "quotes.quotes"
get_quote_count() {
    local json_path="${1:-quotes.quotes}"

    if ! cache_db_exists "$QUOTES_KEY"; then
        echo "0"
        return 1
    fi

    local count
    count=$(get_quote_list "$json_path" 2>/dev/null | wc -l | tr -d ' ')
    echo "$count"
}

# ======================================
# 命令行入口（直接执行时生效）
# ======================================

# 仅在直接执行（非 source）时运行命令行逻辑
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    _json_path="${2:-quotes.quotes}"

    case "${1:-}" in
        random)
            get_quote_random "$_json_path"
            ;;
        daily)
            get_quote_daily "$_json_path"
            ;;
        list)
            get_quote_list "$_json_path" | while IFS= read -r line; do
                echo "- ${line}"
            done
            ;;
        count)
            count=$(get_quote_count "$_json_path")
            echo "路径 [${_json_path}] 共收录 ${count} 条内容"
            ;;
        *)
            echo "用法: $0 <命令> [json_path]"
            echo ""
            echo "命令："
            echo "  random  [json_path]  - 随机获取一条（默认：quotes.quotes）"
            echo "  daily   [json_path]  - 按日期固定获取一条"
            echo "  list    [json_path]  - 列出所有条目"
            echo "  count   [json_path]  - 显示条目总数"
            echo ""
            echo "json_path 示例："
            echo "  quotes.quotes                      励志语录"
            echo "  weekend.messages                   周末寄语"
            echo "  workday_adjust.advance_reminders   调休提前提醒"
            echo "  workday_adjust.today_reminders     调休当日提醒"
            echo "  breakfast.tips                     早餐提醒语"
            echo "  breakfast.nutrition_advice.monday  周一早餐营养建议"
            echo "  lunch.tips                         午餐提醒语"
            echo "  lunch.nutrition_advice.friday      周五午餐营养建议"
            echo "  dinner.tips                        晚餐提醒语"
            echo "  dinner.nutrition_advice.weekend    调休日晚餐营养建议"
            ;;
    esac
fi
