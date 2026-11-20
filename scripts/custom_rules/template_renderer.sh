#!/bin/bash

# ======================================
# 自定义规则 - 模板消息渲染
# ======================================
#
# 提供本地模板消息的渲染功能（仅用于没有独立脚本的模板）：
#   build_template_message_local - 根据 template_id 渲染消息
#
# 设计说明：
#   采用「通用变量全量计算 + 模板按需替换」机制，替代逐模板 case 分支。
#   render_template 只替换模板中实际声明的 {占位符}，多余的 key=value 会被安全忽略，
#   因此新增模板时只要复用已有占位符，无需改动本文件；仅当引入全新占位符时才需补充变量。
#
#   已支持的占位符：
#     基础类  date_time / week_day / quote / rule_name
#     周报类  week_start / week_end / week_summary / next_week_preview
#     餐食类  greeting / tips / <template_id>_suggestion
#
# 辅助函数：
#   _get_day_key      - 获取星期英文 key
#   _get_week_day_cn  - 获取中文星期
#
# 依赖说明：
#   本文件由 custom_rules.sh source，依赖已加载的：
#   - holiday_config.sh（提供 is_holiday / is_adjust_workday）
#   - weekly_data.sh（提供 get_week_start / get_week_end / get_week_summary / get_next_week_preview）
#
# 作者：智能提醒系统
# 更新：2026-08-17
# ======================================

# 引入周报数据计算公共模块（依赖 holiday_config.sh 已由主脚本加载）
source "${SCRIPT_DIR}/weekly_data.sh"

# ======================================
# 辅助函数：获取星期英文 key（monday~friday / weekend）
# ======================================

_get_day_key() {
    case "$(date '+%u')" in
        1) echo "monday" ;;
        2) echo "tuesday" ;;
        3) echo "wednesday" ;;
        4) echo "thursday" ;;
        5) echo "friday" ;;
        *) echo "weekend" ;;
    esac
}

# ======================================
# 辅助函数：获取中文星期
# ======================================

_get_week_day_cn() {
    case "$(date '+%u')" in
        1) echo "星期一" ;;
        2) echo "星期二" ;;
        3) echo "星期三" ;;
        4) echo "星期四" ;;
        5) echo "星期五" ;;
        6) echo "星期六" ;;
        7) echo "星期日" ;;
    esac
}

# ======================================
# 本地构建模板消息（仅用于没有独立脚本的模板）
# ======================================
# 参数：
#   $1 - template_id
#   $2 - 规则名称
# 返回：
#   成功：输出渲染后的消息内容并返回 0
#   失败：返回 1

build_template_message_local() {
    local template_id="$1"
    local rule_name="$2"

    log_info "  📋 本地模板渲染: ${template_id}"

    # 1. 基础通用变量
    local date_time week_day quote
    date_time=$(date '+%Y年%m月%d日 %H:%M')
    week_day=$(_get_week_day_cn)
    quote=$(get_random_quote)

    # 2. 周报变量（weekend / weekly_reminder 模板）
    local week_start week_end week_summary next_week_preview
    week_start=$(get_week_start)
    week_end=$(get_week_end)
    week_summary=$(get_week_summary)
    next_week_preview=$(get_next_week_preview)

    # 3. 语录变量（breakfast / dinner 等餐食模板，按 template_id 约定取语录库）
    local day_key greeting tips suggestion
    day_key=$(_get_day_key)
    greeting=$(get_quote_random "${template_id}.tips")
    tips=$(get_quote_random "${template_id}.tips")
    suggestion=$(get_quote_random "${template_id}.nutrition_advice.${day_key}")

    # 4. 统一渲染：模板只替换自身声明的占位符，多余键值对会被忽略
    get_message "$template_id" "${MESSAGE_STYLE:-default}" \
        "date_time=${date_time}" \
        "week_day=${week_day}" \
        "quote=${quote}" \
        "rule_name=${rule_name}" \
        "week_start=${week_start}" \
        "week_end=${week_end}" \
        "week_summary=${week_summary}" \
        "next_week_preview=${next_week_preview}" \
        "greeting=${greeting}" \
        "tips=${tips}" \
        "${template_id}_suggestion=${suggestion}"
}
