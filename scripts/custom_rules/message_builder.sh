#!/bin/bash

# ======================================
# 自定义规则 - 消息构建
# ======================================
#
# 提供自定义规则消息的构建功能：
#   build_custom_rule_message - 使用 custom_rule 模板构建消息
#
# 依赖模块：
#   utils.sh - get_random_quote / get_type_label / format_condition
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# ======================================
# 构建自定义规则消息（使用 custom_rule 模板）
# ======================================
# 参数：
#   $1 - 规则名称
#   $2 - 消息内容
#   $3 - 规则类型
#   $4 - 触发条件
#   $5 - 规则时间
# 返回：
#   成功：输出渲染后的消息内容并返回 0
#   失败：返回 1

build_custom_rule_message() {
    local name="$1"
    local message="$2"
    local rule_type="$3"
    local rule_condition="$4"
    local rule_time="$5"

    local quote
    quote=$(get_random_quote)
    log_info "  励志语录: ${quote}"

    local type_label
    type_label=$(get_type_label "$rule_type")

    local condition_text
    condition_text=$(format_condition "$rule_type" "$rule_condition")

    get_message "custom_rule" "$MESSAGE_STYLE" \
        "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
        "rule_name=${name}" \
        "condition_text=${condition_text}" \
        "type_label=${type_label}" \
        "rule_time=${rule_time}" \
        "message=${message}" \
        "quote=${quote}"
}
