#!/bin/bash

# ======================================
# 生日检查模块
# ======================================
#
# 功能说明：
#   遍历生日列表，检查今天是否有人生日
#   - 调用 parser 解析公历/农历生日
#   - 调用 sender 发送祝福或倒计时提醒
#
# 所属：birthday_reminder 子模块
#
# 依赖：
#   - birthday_reminder/parser.sh（生日解析）
#   - birthday_reminder/sender.sh（消息发送）
#
# 作者：智能提醒系统
# 更新：2026-04-22
# ======================================

# 检查今天是否有人生日
# 功能：遍历配置列表，检查今天生日和提前提醒日期
check_today_birthday() {
    local today
    today=$(date '+%m-%d')

    log_info "🔍 检查生日提醒（今天：$today，提前提醒：${ADVANCE_DAYS} 天）"

    local birthday_found=false

    for entry in "${BIRTHDAY_LIST[@]}"; do
        local name birthday_str userid
        IFS='|' read -r name birthday_str userid <<< "$entry"

        # 统一解析生日信息（公历/农历只调用一次 python3）
        local parsed
        parsed=$(parse_birthday_entry "$birthday_str")

        if [ "$parsed" = "ERROR" ]; then
            log_error "  ❌ ${name}: 农历日期转换失败，跳过"
            continue
        fi

        local birth_md birthday_display days_remaining
        IFS='|' read -r birth_md birthday_display days_remaining <<< "$parsed"

        if [[ "$birthday_str" == lunar:* ]]; then
            log_success "  🌙 ${name}: ${birthday_str} → 公历${birth_md}（还有 ${days_remaining} 天）"
        else
            log_info "  📅 ${name}: ${birthday_str}（还有 ${days_remaining} 天）"
        fi

        # 检查是否是今天生日
        if [ "$birth_md" = "$today" ] && [ "$SEND_ON_BIRTHDAY" = "true" ]; then
            send_birthday_greeting "$name" "$userid" "$birthday_str"
            birthday_found=true
        fi

        # 检查是否在提前提醒范围内（精确天数匹配）
        if [ "$days_remaining" -gt 0 ] 2>/dev/null && [ "$days_remaining" -le "$ADVANCE_DAYS" ] 2>/dev/null && [ "$ADVANCE_DAYS" -gt 0 ]; then
            # 只在恰好等于 ADVANCE_DAYS 时提醒，避免每天重复发送
            if [ "$days_remaining" = "$ADVANCE_DAYS" ]; then
                send_advance_reminder "$name" "$userid" "$birthday_display" "$days_remaining"
                birthday_found=true
            fi
        fi
    done

    if [ "$birthday_found" = false ]; then
        log_info "ℹ️  今天没有需要发送的生日提醒"
    fi
}
