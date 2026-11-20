#!/bin/bash

# ======================================
# 自定义规则 - 触发条件判断
# ======================================
#
# 提供规则触发条件的判断逻辑：
#   should_trigger  - 判断单条规则是否应触发
#
# 支持的规则类型：
#   date       - 公历日期 (MM-DD)
#   weekday    - 每周 (1-7)
#   countdown  - 倒计时 (YYYY-MM-DD，≤7天)
#   lunar_date - 农历日期 (MM-DD)
#   monthly    - 每月定时 (DD)
#   daily      - 每日触发
#   workday    - 工作日（含调休）
#
# ======================================

# ======================================
# 判断单条规则是否应触发
# ======================================

should_trigger() {
    local type="$1"
    local condition="$2"

    local today
    today=$(date '+%m-%d')
    local weekday
    weekday=$(date '+%u')  # 1=周一 ... 7=周日

    case "$type" in
        date)
            # 格式 MM-DD，匹配今天
            [ "$condition" = "$today" ] && return 0
            ;;
        weekday)
            # 格式 1-7，匹配今天星期几
            [ "$condition" = "$weekday" ] && return 0
            ;;
        countdown)
            # 格式 YYYY-MM-DD，距离目标日期 ≤7 天时触发
            local target_ts
            target_ts=$(date -d "$condition" '+%s' 2>/dev/null)
            if [ -z "$target_ts" ]; then
                log_error "  countdown 日期格式错误: $condition"
                return 1
            fi
            local now_ts
            now_ts=$(date '+%s')
            local diff=$(( (target_ts - now_ts) / 86400 ))
            [ "$diff" -ge 0 ] && [ "$diff" -le 7 ] && return 0
            ;;
        lunar_date)
            # 农历日期：格式 MM-DD，使用 date_utils.py 将农历转为今年公历后与今天比较
            local lunar_month lunar_day
            lunar_month=$(echo "$condition" | cut -d'-' -f1)
            lunar_day=$(echo "$condition" | cut -d'-' -f2)
            local solar_date
            solar_date=$(python3 "${SCRIPT_DIR}/date_utils.py" birthday "$lunar_month" "$lunar_day" 2>/dev/null)
            if [ -z "$solar_date" ]; then
                log_error "  农历转公历失败: $condition"
                return 1
            fi
            local solar_mmdd
            solar_mmdd=$(echo "$solar_date" | cut -d'-' -f2,3)
            log_info "  🌙 农历 ${condition} → 今年公历 ${solar_date}，今天 ${today}"
            [ "$solar_mmdd" = "$today" ] && return 0
            ;;
        monthly)
            # 格式 DD，匹配今天是本月第几天
            local today_day
            today_day=$(date '+%d')
            local cond_day
            cond_day=$(printf '%02d' "$condition")
            log_info "  📆 每月第 ${condition} 天，今天是本月第 ${today_day} 天"
            [ "$cond_day" = "$today_day" ] && return 0
            ;;
        daily)
            # 每天都触发
            log_info "  🔁 每日定时规则，直接触发"
            return 0
            ;;
        workday)
            # 工作日判断：调用 is_workday（含调休上班日）
            log_info "  💼 工作日规则，调用 is_workday 判断..."
            if is_workday; then
                log_info "  ✅ 今天是工作日，触发"
                return 0
            else
                log_warning "  今天不是工作日，跳过"
            fi
            ;;
        *)
            log_error "  未知规则类型: $type"
            ;;
    esac

    return 1
}
