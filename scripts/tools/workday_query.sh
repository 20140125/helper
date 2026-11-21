#!/bin/bash
# ======================================
# 工作日 / 节假日查询（JSON 输出）
# ======================================
#
# 功能说明：
#   1. 按日期查询是否工作日（复用 holiday_config.sh 的权威判断：法定节假日 + 调休）
#   2. 输出 JSON，供 AI 助手（贾维斯）与 Web 端消费
#   3. 支持一次查询连续多天，便于回答"这周哪几天上班""最近假期"
#
# 使用方式：
#   bash scripts/tools/workday_query.sh                # 只查今天
#   bash scripts/tools/workday_query.sh 2026-10-10     # 查指定日期
#   bash scripts/tools/workday_query.sh 2026-10-10 7   # 查起连续 7 天
#
# 输出示例：
#   {"days":[{"date":"2026-10-10","weekday":"周六","is_workday":false,
#             "is_holiday":false,"is_adjust_workday":false,"holiday_name":""}]}
#
# 作者：智能提醒系统
# 更新：2026-10-10
# ======================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
source "${PROJECT_DIR}/holiday_config.sh"

TARGET_DATE="${1:-$(TZ=Asia/Shanghai date '+%Y-%m-%d')}"
DAYS="${2:-1}"

WEEKDAY_CN=('周一' '周二' '周三' '周四' '周五' '周六' '周日')

# 输出单日信息（JSON 对象，不含外层括号）
info_of() {
    local d="$1"
    local year="${d%%-*}"
    local h_info="" name="" flag="0"

    # 取该年份节假日表里的条目（格式 '节日名|2放假' 或 '节日名|3调休'）
    # :- 兜底避免 set -u 下访问不存在的键报 unbound variable
    eval "h_info=\"\${HOLIDAYS_${year}[\$d]:-}\""
    if [ -n "$h_info" ]; then
        name="${h_info%|*}"
        flag="${h_info##*|}"
    fi

    local dow
    dow=$(pc_date_weekday "$d")
    local idx=$((dow - 1))

    local is_holiday=false is_adjust=false is_work=false
    [ "$flag" = "2" ] && is_holiday=true
    [ "$flag" = "3" ] && is_adjust=true

    if [ "$is_adjust" = true ]; then
        is_work=true
    elif [ "$is_holiday" = true ]; then
        is_work=false
    elif [ "$dow" -le 5 ]; then
        is_work=true
    fi

    printf '{"date":"%s","weekday":"%s","is_workday":%s,"is_holiday":%s,"is_adjust_workday":%s,"holiday_name":"%s"}' \
        "$d" "${WEEKDAY_CN[$idx]}" "$is_work" "$is_holiday" "$is_adjust" "$name"
}

printf '{"days":['
i=0
while [ "$i" -lt "$DAYS" ]; do
    cur=$(pc_date_add_days "$TARGET_DATE" "$i")
    if [ "$i" -gt 0 ]; then printf ','; fi
    info_of "$cur"
    i=$((i + 1))
done
printf ']}\n'
