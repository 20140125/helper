#!/bin/bash

# ======================================
# 工作日判断逻辑模块
# ======================================
#
# 功能说明：
#   判断今天是否为工作日（包含调休上班日判断）
#   设置全局变量 IS_WORKDAY 和 WORKDAY_NOTE
#
# 依赖：
#   - holiday_config.sh（提供 is_adjust_workday / is_holiday 函数）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 判断今天是否是工作日，设置 IS_WORKDAY 和 WORKDAY_NOTE
_check_is_workday() {
    IS_WORKDAY=false
    WORKDAY_NOTE=""
    CURRENT_DAY=$(date '+%u')

    if is_adjust_workday "$current_date" >/dev/null; then
        IS_WORKDAY=true
        WORKDAY_NOTE="(调休补班日)"
    elif [ "$CURRENT_DAY" -ge 1 ] && [ "$CURRENT_DAY" -le 5 ]; then
        if is_holiday "$current_date"; then
            return 1
        fi
        IS_WORKDAY=true
    else
        return 1
    fi
    return 0
}
