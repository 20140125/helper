#!/bin/bash

# ======================================
# template_utils 子模块 — 校验与查询 + CLI
# ======================================
#
# 功能说明：
#   1. 校验模板文件格式
#   2. 查询可用的消息类型和风格
#   3. CLI 入口（validate/preview/types/styles）
#
# 注意：
#   本文件由主脚本 template_utils.sh 加载
#   不可单独执行，不设 SCRIPT_DIR / LOG_FILE
#
# 作者：智能提醒系统
# 更新：2026-04-22
# ======================================

# 校验模板文件格式
# 返回：
#   成功：返回 0
#   失败：返回 1
validate_template_file() {
    if [ ! -f "$TEMPLATE_FILE" ]; then
        log_error "模板文件不存在: $TEMPLATE_FILE"
        return 1
    fi

    # 检查 JSON 格式
    if ! jq empty "$TEMPLATE_FILE" 2>/dev/null; then
        log_error "模板文件格式错误（非有效 JSON）"
        return 1
    fi

    # 检查必需字段
    local required_fields=("templates" "placeholders" "styles")
    for field in "${required_fields[@]}"; do
        if ! jq -e ".$field" "$TEMPLATE_FILE" &>/dev/null; then
            log_error "缺少必需字段: $field"
            return 1
        fi
    done

    log_success "模板文件校验通过: $TEMPLATE_FILE"
    return 0
}

# 列出所有可用的消息类型
# 返回：
#   成功：输出类型列表到 stdout 并返回 0
#   失败：返回 1
list_message_types() {
    if [ ! -f "$TEMPLATE_FILE" ]; then
        log_error "模板文件不存在: $TEMPLATE_FILE"
        return 1
    fi

    jq -r '.templates | keys[]' "$TEMPLATE_FILE" 2>/dev/null
}

# 列出指定类型的所有风格
# 参数：
#   $1 - 消息类型
# 返回：
#   成功：输出风格列表到 stdout 并返回 0
#   失败：返回 1
list_message_styles() {
    local type="$1"

    if [ ! -f "$TEMPLATE_FILE" ]; then
        log_error "模板文件不存在: $TEMPLATE_FILE"
        return 1
    fi

    jq -r ".templates.${type} | keys[]" "$TEMPLATE_FILE" 2>/dev/null
}

# 主函数：处理命令行参数
main() {
    case "${1:-}" in
        validate)
            log_info "======================================"
            log_info "🚀 模板校验启动"
            log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
            log_info "======================================"
            validate_template_file
            log_info "======================================"
            ;;
        preview)
            if [ $# -lt 3 ]; then
                log_error "用法: $0 preview <类型> <风格> [key=value ...]"
                log_info "示例: $0 preview morning default \"city=深圳\" \"weather=多云\""
                exit 1
            fi
            log_info "======================================"
            log_info "🚀 模板预览启动"
            log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
            log_info "📦 类型: $2, 风格: $3"
            log_info "======================================"
            local type="$2"
            local style="$3"
            shift 3
            local result
            result=$(get_message "$type" "$style" "$@")
            if [ $? -eq 0 ]; then
                echo
                echo "$result"
                echo
                log_success "模板预览完成"
            else
                log_error "模板预览失败"
                exit 1
            fi
            log_info "======================================"
            ;;
        types)
            log_info "📋 可用的消息类型："
            list_message_types
            ;;
        styles)
            if [ -z "${2:-}" ]; then
                log_error "用法: $0 styles <类型>"
                log_info "示例: $0 styles morning"
                exit 1
            fi
            log_info "📋 类型 '$2' 的可用风格："
            list_message_styles "$2"
            ;;
        "")
            log_error "用法: $0 {validate|preview|types|styles}"
            log_info "  validate              - 校验模板文件格式"
            log_info "  preview <类型> <风格>  - 预览渲染结果"
            log_info "  types                 - 列出所有消息类型"
            log_info "  styles <类型>          - 列出指定类型的风格"
            exit 1
            ;;
        *)
            log_error "未知参数: $1"
            log_error "用法: $0 {validate|preview|types|styles}"
            exit 1
            ;;
    esac
}
