#!/bin/bash

# ======================================
# 消息模板渲染工具
# ======================================
#
# 功能说明：
#   1. 从 JSON 配置文件加载消息模板
#   2. 支持多种消息风格（default/brief/formal）
#   3. 动态渲染模板（替换占位符）
#   4. 支持模板校验和预览
#
# 使用方式：
#   被其他脚本引入：
#     source "${PROJECT_DIR}/template_utils.sh"
#     msg=$(get_message "morning" "default" "city=深圳" "weather=多云")
#
#   直接执行（校验/预览/查询）：
#     bash scripts/template_utils.sh validate
#     bash scripts/template_utils.sh preview morning default "city=深圳"
#     bash scripts/template_utils.sh types
#     bash scripts/template_utils.sh styles morning
#
# 配置环境变量：
#   TEMPLATE_KEY   - 模板缓存键（默认 message_templates.json，存于 已有业务表）
#   MESSAGE_STYLE  - 消息风格（default | brief | formal，默认 default）
#
# 数据来源：
#   - 消息模板：message_templates.json 对应的已有业务表（运行时不落盘）
#
# 子模块：
#   - template_utils/loader.sh    — 模板加载（load_template）
#   - template_utils/renderer.sh  — 模板渲染（render_template）
#   - template_utils/validator.sh — 校验查询 + CLI（validate/preview/types/styles）
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"
# 按需加载缓存数据库通道（缓存 JSON 不再落盘）
source "${PROJECT_DIR}/cache_db.sh"

# ======================================
# 配置加载
# ======================================

# 默认配置
TEMPLATE_KEY="${TEMPLATE_KEY:-message_templates.json}"
MESSAGE_STYLE="${MESSAGE_STYLE:-default}"

# 设置日志文件（仅在直接执行且未设置 LOG_FILE 时生效）
if [ -z "$LOG_FILE" ]; then
    LOG_FILE="${PROJECT_DIR}/template_utils.log"
fi

# 引入统一日志工具（必须在 LOG_FILE 设置之后）
source "${PROJECT_DIR}/log_utils.sh"

# ======================================
# 加载子模块
# ======================================

source "${SCRIPT_DIR}/template_utils/loader.sh"
source "${SCRIPT_DIR}/template_utils/renderer.sh"
source "${SCRIPT_DIR}/template_utils/validator.sh"
log_debug "template_utils 子模块加载完成"

# ======================================
# 高级接口
# ======================================

# 一步到位：加载并渲染模板
# 参数：
#   $1 - 消息类型（morning/lunch/evening/birthday/holiday）
#   $2 - 消息风格（default/brief/formal，可选，默认使用 MESSAGE_STYLE）
#   $3... - 键值对（格式: key=value）
# 返回：
#   成功：输出渲染后的消息到 stdout 并返回 0
#   失败：返回 1
get_message() {
    local type="$1"
    local style="${2:-$MESSAGE_STYLE}"
    shift 2  # 移除前两个参数

    # 加载模板
    local template
    template=$(load_template "$type" "$style")
    if [ $? -ne 0 ]; then
        return 1
    fi

    # 渲染模板
    render_template "$template" "$@"
}

# ======================================
# 入口
# ======================================

# 如果直接运行此脚本，则执行主函数
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
