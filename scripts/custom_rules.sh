#!/bin/bash

# ======================================
# 自定义规则执行脚本
# ======================================
#
# 功能说明：
#   读取 custom_rules.json 对应的已有业务表 中的规则配置，
#   根据规则类型（date/weekday/lunar_date/countdown/keyword）
#   判断是否满足触发条件，满足则发送企业微信消息。
#
# 使用方式：
#   执行所有启用规则：bash custom_rules.sh
#   执行指定规则：    bash custom_rules.sh test <ruleId>
#
# 规则类型说明：
#   date       - 固定日期，格式 MM-DD，每年该日期触发
#   weekday    - 每周星期几，格式 1-7（1=周一，7=周日）
#   lunar_date - 农历日期，格式 MM-DD
#   monthly    - 每月定时，格式 DD（每月第几天）
#   daily      - 每日定时，每天触发
#   workday    - 工作日，综合判断（含调休上班日）
#   countdown  - 倒计时，格式 YYYY-MM-DD，距离目标日期 ≤7 天内触发
#
# 模块拆分：
#   custom_rules/utils.sh              - 工具函数
#   custom_rules/trigger.sh            - 触发条件判断
#   custom_rules/sender.sh             - 消息发送
#   custom_rules/rule_reader.sh        - 规则数据读取
#   custom_rules/message_builder.sh    - 自定义规则消息构建
#   custom_rules/runner.sh             - 规则执行调度
#   custom_rules/template_renderer.sh  - 模板消息渲染
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# ======================================
# 加载配置文件
# ======================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"
# 按需加载缓存数据库通道（规则 JSON 不再落盘）
source "${PROJECT_DIR}/cache_db.sh"
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null
source "${PROJECT_DIR}/holiday_config.sh" 2>/dev/null

RULES_KEY='custom_rules.json'

# 日志文件
LOG_FILE="${PROJECT_DIR}/custom_rules.log"

source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/template_utils.sh"

# ======================================
# 加载子模块
# ======================================

source "${SCRIPT_DIR}/custom_rules/utils.sh"
source "${SCRIPT_DIR}/custom_rules/trigger.sh"
source "${SCRIPT_DIR}/custom_rules/sender.sh"
source "${SCRIPT_DIR}/custom_rules/rule_reader.sh"
source "${SCRIPT_DIR}/custom_rules/message_builder.sh"
source "${SCRIPT_DIR}/custom_rules/template_renderer.sh"
source "${SCRIPT_DIR}/custom_rules/skill_text.sh"
source "${SCRIPT_DIR}/custom_rules/runner.sh"

# ======================================
# 执行所有启用的规则
# ======================================

run_all_enabled() {
    log_info "======================================"
    log_info "🚀 自定义规则检查启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    if ! cache_db_exists "$RULES_KEY"; then
        log_warning "规则文件不存在: $RULES_KEY"
        log_info "======================================"
        exit 0
    fi

    local rule_count
    rule_count=$(get_enabled_rule_count)
    log_info "已启用规则数量: ${rule_count:-0}"

    local triggered=0

    # 逐条读取规则
    local ids
    ids=$(get_enabled_rule_ids)

    for rule_id in $ids; do
        if ! read_rule_data "$rule_id"; then
            log_error "规则 $rule_id 数据读取失败，跳过"
            continue
        fi

        log_info "🔍 检查规则 [${RULE_NAME}]（$(get_type_label "$RULE_TYPE")：${RULE_CONDITION}）"

        if should_trigger "$RULE_TYPE" "$RULE_CONDITION"; then
            # 检查是否在本分钟内已触发过，防止重复
            if is_duplicate_trigger "$rule_id"; then
                log_info "  规则 [${RULE_NAME}] 本分钟已触发过，跳过"
            else
                update_last_triggered_at "$rule_id"
                run_rule "$RULE_NAME" "$RULE_MESSAGE" "$RULE_TYPE" "$RULE_CONDITION" "$RULE_TIME" "$RULE_WEBHOOK_IDS" "$RULE_TEMPLATE_ID" "$RULE_CUSTOM_CONTENT" "$RULE_OUTPUT_MODE"
                triggered=$((triggered + 1))
            fi
        else
            log_warning " 未满足触发条件，跳过"
        fi
    done

    log_info "======================================"
    log_info "📊 检查完成，共触发 ${triggered} 条规则"
    log_info "======================================"
}

# ======================================
# 测试执行指定规则（忽略触发条件，直接发送）
# ======================================

run_test_rule() {
    local rule_id="$1"

    log_info "======================================"
    log_info "🧪 测试执行规则: ${rule_id}"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    if ! cache_db_exists "$RULES_KEY"; then
        log_error "规则文件不存在: $RULES_KEY"
        log_info "======================================"
        exit 1
    fi

    if ! read_rule_data_full "$rule_id"; then
        log_error "规则不存在: $rule_id"
        log_info "======================================"
        exit 1
    fi

    log_info "📋 规则名称: ${RULE_NAME}"
    log_info "🏷️  规则类型: $(get_type_label "${RULE_TYPE}")"
    log_info "🎯 触发条件: ${RULE_CONDITION}"
    if [ -n "$RULE_TEMPLATE_ID" ]; then
        log_info "📋 消息模板: ${RULE_TEMPLATE_ID}"
    else
        log_info "💬 提醒内容: ${RULE_MESSAGE}"
    fi
    log_info "======================================"
    log_info "⚡ 测试模式：忽略触发条件，直接发送消息"

    run_rule "$RULE_NAME" "$RULE_MESSAGE" "$RULE_TYPE" "$RULE_CONDITION" "$RULE_TIME" "$RULE_WEBHOOK_IDS" "$RULE_TEMPLATE_ID" "$RULE_CUSTOM_CONTENT" "$RULE_OUTPUT_MODE"

    log_info "======================================"
}

# ======================================
# 入口
# ======================================

case "$1" in
    test)
        if [ -z "$2" ]; then
            log_error "用法: $0 test <ruleId>"
            log_info "======================================"
            exit 1
        fi
        run_test_rule "$2"
        ;;
    run_one)
        # 由守护进程调用：执行单条规则（需满足触发条件）
        if [ -z "$2" ]; then
            log_error "用法: $0 run_one <ruleId>"
            log_info "======================================"
            exit 1
        fi
        rule_id="$2"

        if ! read_rule_data "$rule_id"; then
            log_error "规则不存在: $rule_id"
            log_info "======================================"
            exit 1
        fi

        if [ -z "$RULE_NAME" ]; then
            log_error "规则不存在: $rule_id"
            log_info "======================================"
            exit 1
        fi

        log_info "======================================"
        log_info "⏰ 守护进程触发规则检查"
        log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
        log_info "======================================"
        log_info "🔍 检查规则 [${RULE_NAME}]（$(get_type_label "$RULE_TYPE")：${RULE_CONDITION}）"
        if should_trigger "$RULE_TYPE" "$RULE_CONDITION"; then
            # 防重由守护进程负责（已在调用前写入 lastTriggeredAt），此处直接执行
            run_rule "$RULE_NAME" "$RULE_MESSAGE" "$RULE_TYPE" "$RULE_CONDITION" "$RULE_TIME" "$RULE_WEBHOOK_IDS" "$RULE_TEMPLATE_ID" "$RULE_CUSTOM_CONTENT" "$RULE_OUTPUT_MODE"
        else
            log_warning " 未满足触发条件，跳过"
        fi
        log_info "======================================"
        ;;
    "")
        run_all_enabled
        ;;
    *)
        log_error "未知参数: $1"
        log_error "用法: $0 [test <ruleId> | run_one <ruleId>]"
        log_info "======================================"
        exit 1
        ;;
esac
