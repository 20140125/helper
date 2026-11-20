#!/bin/bash

# ======================================
# 周报数据计算公共模块
# ======================================
#
# 功能说明：
#   提供周报（weekend / weekly_reminder 模板）所需的通用数据计算函数，
#   供 weekly_summary.sh 与 custom_rules/template_renderer.sh 共用，避免重复实现。
#
# 公开函数：
#   get_this_monday            - 本周一日期 (YYYY-MM-DD)
#   get_next_monday            - 下周一日期 (YYYY-MM-DD)
#   check_holiday_week         - 是否放假周（0=是，1=否）
#   calculate_workdays         - 本周工作日天数
#   get_week_start             - 统计周期起始 (MM月DD日)
#   get_week_end               - 统计周期结束 (MM月DD日，即今天)
#   get_week_summary           - 出勤统计摘要（多行，含工作日/休息/工作强度）
#   get_next_week_preview      - 下周展望
#   get_next_monday_reminder   - 下周一提醒
#
# 依赖说明：
#   本模块为纯数据协议工具，仅通过 stdout 输出数据供 $() 捕获，
#   不加载 log_utils（避免污染数据通道）。由调用方保证已加载：
#   - holiday_config.sh（提供 is_holiday / is_adjust_workday / HOLIDAYS_YYYY）
#
# 使用方式（source 方式）：
#   source "${SCRIPT_DIR}/weekly_data.sh"
#   count=$(calculate_workdays)
#
# 作者：智能提醒系统
# 更新：2026-08-17
# ======================================

# 获取本周一的日期（周一当天调用也能正确返回当天，避免 GNU date 'last monday' 在周一返回上周一的问题）
# 返回：本周一的 YYYY-MM-DD
get_this_monday() {
    local dow
    dow=$(date '+%u')  # 1=周一 ... 7=周日
    date -d "-$((dow - 1)) days" '+%Y-%m-%d' 2>/dev/null \
        || date -v-$((dow - 1))d '+%Y-%m-%d'
}

# 获取下周一的日期（基于本周一 + 7 天，任意日调用都正确）
# 返回：下周一的 YYYY-MM-DD
get_next_monday() {
    local this_monday
    this_monday=$(get_this_monday)
    date -d "$this_monday +7 days" '+%Y-%m-%d' 2>/dev/null \
        || date -v+7d -j -f "%Y-%m-%d" "$this_monday" '+%Y-%m-%d'
}

# 检查是否为放假周
# 判断标准：周一到周五全部是放假日就是放假周，否则不是
# 返回：0=放假周，1=非放假周
check_holiday_week() {
    local this_monday
    this_monday=$(get_this_monday)

    # 检查周一到周五是否全部是放假日
    for i in {0..4}; do
        local check_date
        check_date=$(date -d "$this_monday +$i days" '+%Y-%m-%d' 2>/dev/null \
            || date -v+${i}d -j -f "%Y-%m-%d" "$this_monday" '+%Y-%m-%d')
        if ! is_holiday "$check_date"; then
            # 发现工作日，不是放假周
            return 1
        fi
    done

    # 周一到周五全部是放假日，是放假周
    return 0
}

# 计算本周工作日天数（统计完整一周 7 天，排除节假日、纳入调休上班日）
# 返回：输出工作日天数
calculate_workdays() {
    local count=0
    local start_date
    start_date=$(get_this_monday)

    # 统计完整的一周（7天）
    for i in {0..6}; do
        local check_date
        check_date=$(date -d "$start_date +$i days" '+%Y-%m-%d' 2>/dev/null \
            || date -v+${i}d -j -f "%Y-%m-%d" "$start_date" '+%Y-%m-%d')

        # 使用 holiday_config.sh 的函数检查节假日
        if is_holiday "$check_date"; then
            continue
        fi

        # 检查是否在调休工作日列表
        if is_adjust_workday "$check_date" >/dev/null; then
            count=$((count + 1))
            continue
        fi

        # 正常工作日（周一到周五）
        local day_of_week
        day_of_week=$(date -d "$check_date" '+%u' 2>/dev/null \
            || date -j -f "%Y-%m-%d" "$check_date" '+%u')
        if [ "$day_of_week" -ge 1 ] && [ "$day_of_week" -le 5 ]; then
            count=$((count + 1))
        fi
    done

    echo $count
}

# 统计周期起始（本周一）
# 返回：MM月DD日
get_week_start() {
    local this_monday
    this_monday=$(get_this_monday)
    date -d "$this_monday" '+%m月%d日' 2>/dev/null \
        || date -j -f "%Y-%m-%d" "$this_monday" '+%m月%d日'
}

# 统计周期结束（今天）
# 返回：MM月DD日
get_week_end() {
    date '+%m月%d日'
}

# 出勤统计摘要（供 {week_summary} 占位符使用）
# 返回：多行摘要（工作日天数 / 周末休息天数 / 工作强度）
get_week_summary() {
    local workdays
    workdays=$(calculate_workdays)

    local intensity
    intensity=$(awk "BEGIN {printf \"%.1f\", ${workdays} * 100 / 7}")

    echo "> 📍 **本周工作日**: **${workdays}天**
> 🎯 **周末休息**: **$((7 - workdays))天**
> 📊 **工作强度**: ${intensity}%"
}

# 下周展望
# 返回：输出下周放假天数统计和详细安排
get_next_week_preview() {
    # 检查下周是否有节假日
    local next_monday
    next_monday=$(get_next_monday)
    local holiday_count=0
    local holiday_details=()
    local has_holiday=false

    for i in {0..6}; do
        local check_date
        check_date=$(date -d "$next_monday +$i days" '+%Y-%m-%d' 2>/dev/null \
            || date -v+${i}d -j -f "%Y-%m-%d" "$next_monday" '+%Y-%m-%d')

        if is_holiday "$check_date"; then
            has_holiday=true
            holiday_count=$((holiday_count + 1))

            # 获取节假日名称
            local year
            year=$(echo "$check_date" | cut -d'-' -f1)
            local var_name="HOLIDAYS_${year}"
            eval "local h_info=\"\${${var_name}[\$check_date]}\""
            local holiday_name
            holiday_name=$(echo "$h_info" | cut -d'|' -f1)

            # 格式化日期显示（月-日）
            local display_date
            display_date=$(echo "$check_date" | cut -d'-' -f2-)

            # 添加节假日详细信息（名称+日期）
            holiday_details+=("${holiday_name}(${display_date})")
        fi
    done

    if [ "$has_holiday" = true ]; then
        local holiday_list
        holiday_list=$(IFS=", "; echo "${holiday_details[*]}")
        # 注：模板外层已有 emoji 标题，这里不再重复加 emoji
        echo "下周有假期！放假${holiday_count}天（${holiday_list}）"
    else
        echo "下周正常工作，继续加油！"
    fi
}

# 检查下周一是否为节假日并生成提醒消息
# 返回：输出下周一的状态提醒
get_next_monday_reminder() {
    local next_monday
    next_monday=$(get_next_monday)
    local next_monday_display
    next_monday_display=$(date -d "$next_monday" '+%m月%d日' 2>/dev/null \
        || date -j -f "%Y-%m-%d" "$next_monday" '+%m月%d日')
    if is_holiday "$next_monday"; then
        echo "🎉 下周一（${next_monday_display}）是放假日，好好享受假期！"
    else
        echo "下周一（${next_monday_display}）早上8:00，我们继续！"
        echo "🎉 *祝您周末愉快！下周见！*"
    fi
}
