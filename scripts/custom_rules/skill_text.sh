#!/bin/bash

# ======================================
# 自定义规则 - 技能文本渲染
# ======================================
#
# 提供卡片技能「数据文本」形态的渲染能力：
#   skill_text_supported <key>   - 该技能是否有文本解析器（0=有，1=无）
#   render_skill_text <key>      - 渲染技能文本消息（stdout 输出 Markdown）
#
# 为什么需要这一层：
#   卡片技能（scripts/tools/*.sh）默认产出 PNG 图片（msgtype=image）。
#   但定时推送更常见的是「取最新数据 → 渲染成 Markdown 文本」，图片只在
#   用户显式要求时才出（由规则的 output_mode 开关控制，默认 text）。
#
# 渲染策略（render_skill_text）：
#   排版完全交给 LLM（贾维斯）：把 tools/<key>.sh data 的原始数据直接交给大模型，
#   由它排版成 Markdown（见 skill_text_llm.sh）。不再有手写解析规则与通用模板。
#   关闭：SKILL_TEXT_LLM=false（关闭后本路径不产出，上层回退卡片模式）
#   模型被限流/余额不足/网络异常时同样回退卡片模式，不阻断推送。
#
# 作者：智能提醒系统
# 更新：2026-10-23
# ======================================

# ======================================
# 判断技能是否支持文本输出
# ======================================
# 参数：$1 - 技能 key（等于 template_id）
# 返回：0=有解析器，1=无

skill_text_supported() {
    local key="$1"
    [ -n "$key" ] || return 1

    # 黑名单（不走文本形态）：
    #   qrcode / diagram_card：入参必填，规则里表达不了
    #   weather_alert_card：无异常天气时需静默跳过，走文本会破坏该语义
    case "$key" in
        qrcode|diagram_card|weather_alert_card) return 1 ;;
    esac

    # 全技能统一走 LLM 排版：脚本存在即可尝试（排版失败会自动回退图片卡片）
    local tool="${SCRIPT_DIR}/tools/${key}.sh"
    # 模板类型名与工具脚本名可能不同（ai_news_card ↔ ai_news_card_gen.sh）：按后缀兜底
    if [ ! -f "$tool" ]; then
        local suffix
        for suffix in _gen _card; do
            if [ -f "${SCRIPT_DIR}/tools/${key}${suffix}.sh" ]; then
                tool="${SCRIPT_DIR}/tools/${key}${suffix}.sh"
                break
            fi
        done
    fi
    [ -f "$tool" ] && return 0
    return 1
}

# ======================================
# 渲染技能文本消息
# ======================================
# 参数：$1 - 技能 key（等于 template_id）
# 返回：0=成功（stdout 输出 Markdown），1=失败

render_skill_text() {
    local key="$1"

    # ── 排版全部交给 LLM：直接把原始数据交给模型，产出即推送正文 ──
    # 关闭：SKILL_TEXT_LLM=false（关闭后不产出，上层回退卡片模式）
    # 模型被限流/余额不足/网络异常时同样回退卡片，不阻断推送
    if [ "${SKILL_TEXT_LLM:-true}" = "false" ]; then
        log_info "  ⏭ SKILL_TEXT_LLM=false，跳过文本形态: ${key}"
        return 1
    fi
    if [ ! -f "${SCRIPT_DIR}/custom_rules/skill_text_llm.sh" ]; then
        log_error "缺少 LLM 排版脚本（skill_text_llm.sh）"
        return 1
    fi

    local content
    content=$(bash "${SCRIPT_DIR}/custom_rules/skill_text_llm.sh" "$key" 2>>"$LOG_FILE")
    if [ $? -ne 0 ] || [ -z "$content" ]; then
        log_error "技能 [${key}] LLM 排版失败或结果为空"
        return 1
    fi

    log_info "  🤖 LLM 排版成功: ${key}"
    echo "$content"
    return 0
}
