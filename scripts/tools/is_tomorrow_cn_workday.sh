#!/bin/bash
# ======================================
# 明日工作日判断
# ======================================
#
# 功能说明：
#   1. 判断明天是否为中国法定工作日
#   2. 复用 holiday_config.sh 的 is_workday()
#
# 返回码：
#   0 - 工作日
#   1 - 非工作日
#
# 使用方式：
#   bash scripts/tools/scripts/is_tomorrow_cn_workday.sh
#
# 作者：智能提醒系统
# 更新：2026-04-25
# ======================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
source "${PROJECT_DIR}/holiday_config.sh"

tomorrow=$(TZ=Asia/Shanghai date -d "+1 day" +%Y-%m-%d 2>/dev/null || TZ=Asia/Shanghai date -v+1d +%Y-%m-%d 2>/dev/null)

set +u
if is_workday "$tomorrow"; then
    exit 0
else
    exit 1
fi
