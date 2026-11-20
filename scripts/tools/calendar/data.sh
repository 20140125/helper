#!/bin/bash
# ======================================
# calendar 子模块：数据抓取
# ======================================
# 被 calendar.sh 主入口 source，禁止直接执行
# 依赖主入口已 source：project_config.sh / log_utils.sh / holiday_config.sh
# 提供：fetch_lunar_data / fetch_solar_term / get_workday_info
# ======================================

# 获取农历信息（使用系统 date_utils.py）
fetch_lunar_data() {
    local today
    today=$(TZ=Asia/Shanghai date +%Y-%m-%d)
    local lunar_raw
    lunar_raw=$(python3 "${PROJECT_DIR}/date_utils.py" solar2lunar "$today" 2>/dev/null)
    if [ -z "$lunar_raw" ]; then
        log_warning "农历数据获取失败"
        echo ""
        return
    fi
    # 输出如 "2026-03-09 (三月初九)"，提取括号内
    local lunar_cn
    lunar_cn=$(echo "$lunar_raw" | grep -oP '\(\K[^)]+')
    echo "$lunar_cn"
}

# 获取今日节气（使用系统 date_utils.py）
fetch_solar_term() {
    local today
    today=$(TZ=Asia/Shanghai date +%Y-%m-%d)
    python3 "${PROJECT_DIR}/date_utils.py" solar_term "$today" 2>/dev/null || true
}

# 判断今天工作日状态（使用系统 holiday_config.sh）
get_workday_info() {
    local today
    today=$(TZ=Asia/Shanghai date +%Y-%m-%d)
    set +u
    if is_workday "$today"; then
        set -u; echo "工作日"
    elif is_holiday "$today"; then
        set -u; echo "假期"
    else
        set -u; echo "休息日"
    fi
}
