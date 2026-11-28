#!/bin/bash

# ======================================
# template_utils 子模块 — 模板加载
# ======================================
#
# 功能说明：
#   从 JSON 配置文件加载指定类型和风格的消息模板
#
# 注意：
#   本文件由主脚本 template_utils.sh 加载
#   不可单独执行，不设 SCRIPT_DIR / LOG_FILE
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 加载指定类型和风格的模板
# 参数：
#   $1 - 消息类型（morning/lunch/evening/birthday/holiday）
#   $2 - 消息风格（default/brief/formal，可选，默认使用 MESSAGE_STYLE）
# 返回：
#   成功：输出模板字符串到 stdout 并返回 0
#   失败：返回 1
load_template() {
    local type="$1"
    local style="${2:-$MESSAGE_STYLE}"

    # 检查模板缓存键是否存在
    if ! cache_db_exists "$TEMPLATE_KEY"; then
        log_error "模板文件不存在: $TEMPLATE_KEY"
        return 1
    fi

    # 检查是否安装了 jq
    if ! command -v jq &> /dev/null; then
        log_error "未安装 jq，无法解析 JSON 模板"
        log_error "请安装: apt-get install jq 或 yum install jq"
        return 1
    fi

    # 尝试读取指定风格的模板
    local template
    template=$(cache_db_read "$TEMPLATE_KEY" | jq -r ".templates.${type}.${style} // empty" 2>/dev/null)

    # 如果指定风格不存在，回退到 default
    if [ -z "$template" ] || [ "$template" = "null" ]; then
        log_debug "风格 '$style' 不存在，回退到 default"
        template=$(cache_db_read "$TEMPLATE_KEY" | jq -r ".templates.${type}.default // empty" 2>/dev/null)
    fi

    # 检查模板是否存在
    if [ -z "$template" ] || [ "$template" = "null" ]; then
        log_error "模板不存在: type=$type, style=$style"
        return 1
    fi

    echo "$template"
}
