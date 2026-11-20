#!/bin/bash

# ======================================
# 生日消息发送模块
# ======================================
#
# 功能说明：
#   1. 统一消息发送（支持 dry-run 模式）
#   2. 发送生日祝福消息
#   3. 发送生日倒计时提醒
#
# 所属：birthday_reminder 子模块
#
# 依赖：
#   - greetings_loader.sh（祝福语加载器）
#   - template_utils.sh（消息模板工具）
#   - send_wecom_message()（企业微信发送）
#
# 作者：智能提醒系统
# 更新：2026-04-22
# ======================================

# 统一的消息发送（支持 dry-run 模式）
# 参数：
#   $1 - 消息内容
do_send_message() {
    local message="$1"
    if [ "$DRY_RUN" = true ]; then
        log_info "📝 [DRY-RUN] 以下消息将被发送："
        log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "$message"
        log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    else
        send_wecom_message "$message"
    fi
}

# 发送生日祝福
# 参数：
#   $1 - 姓名
#   $2 - 用户ID
#   $3 - 生日字符串（可选）
send_birthday_greeting() {
    local name="$1"
    local userid="$2"
    local birthday_str="${3:-}"

    log_info "🎂 发送生日祝福给: $name"

    # 从 greetings.json 获取随机祝福语
    local birthday_wish
    birthday_wish=$(get_birthday_greeting "$name")

    # 如果是农历生日，在祝福语末尾追加农历信息
    if [[ "$birthday_str" == lunar:* ]]; then
        local lunar_date="${birthday_str#lunar:}"
        birthday_wish=$(printf '%s\n\n💫 农历生日：%s' "$birthday_wish" "${lunar_date}")
    fi

    # 使用消息模板渲染（将祝福语填充到 {birthday_wish} 占位符）
    local message
    message=$(get_message "birthday" "${MESSAGE_STYLE:-default}" \
        "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
        "name=${name}" \
        "birthday_wish=${birthday_wish}"
    )

    if [ $? -ne 0 ] || [ -z "$message" ]; then
        log_warning "模板渲染失败，使用祝福语直接发送"
        message="${birthday_wish}"
    fi

    # 发送企业微信消息（统一走 do_send_message）
    do_send_message "$message"
}

# 发送生日倒计时提醒
# 参数：
#   $1 - 姓名
#   $2 - 用户ID
#   $3 - 生日展示日期（已格式化，如 "2026-04-15（农历03月15日）"）
#   $4 - 倒计时天数
send_advance_reminder() {
    local name="$1"
    local userid="$2"
    local birthday_date="$3"
    local days="${4:-$ADVANCE_DAYS}"

    log_info "📅 发送生日倒计时提醒: $name - 还有 ${days} 天（${birthday_date}）"

    # 使用 birthday_countdown 模板渲染消息
    local message
    message=$(get_message "birthday_countdown" "${MESSAGE_STYLE:-default}" \
        "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
        "name=${name}" \
        "days=${days}" \
        "birthday_date=${birthday_date}"
    )

    if [ $? -ne 0 ] || [ -z "$message" ]; then
        log_warning "模板渲染失败，使用兜底消息"
        message=$(printf '## 🎂 生日倒计时\n\n🎉 %s 的生日还有 **%s** 天！（%s）\n\n🎁 记得提前准备祝福哦！\n\n💡 *此消息由智能提醒系统发送*' \
            "$name" "$days" "$birthday_date")
    fi

    # 发送企业微信消息（统一走 do_send_message）
    do_send_message "$message"
}
