#!/bin/bash
# ======================================
# 技能文本 — LLM 排版（规则解析的替代/增强路径）
# ======================================
#
# 作用：把 tools/<key>.sh data 的原始输出交给 LLM，直接产出可推送的 Markdown，
#       不再自己写「行情 ~ 分隔 / wttr 结构 / 热度换算」这类归一化规则。
#
# 入参：
#   $1  技能 key（= template_id）
#
# 输出：Markdown 正文（stdout）；失败返回非 0 —— 由调用方回退到卡片模式
#
# 防幻觉（重要，历史上出过模型编造日期的事故）：
#   - system prompt 强约束：只能使用给定原文，禁止编造/修改/补充任何数值与日期
#   - temperature=0.2，只做排版不做创作
#   - 原始数据超长时截断，避免上下文爆炸
#
# 配置（ai-model-configs.json 对应的已有业务表，唯一来源）：
#   第一个配置组的 baseUrl / apiKey / models[0].id，复用 AI 对话的同一套配置
#   SKILL_TEXT_LLM   false 时整体关闭本路径（默认开启，见 skill_text.sh）
#
# 作者：智能提醒系统
# 更新：2026-11-19
# ======================================

set -uo pipefail

key="${1:-}"
[ -n "$key" ] || exit 1

# 本文件位于 scripts/custom_rules/ 下 → 上一级即 scripts/（tools/、weather_config.sh 都在这一层）
SCRIPT_DIR="${SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
# 按需加载项目路径与缓存数据库通道（配置 JSON 不再落盘）
[ -n "${PROJECT_DIR:-}" ] || source "${SCRIPT_DIR}/project_config.sh"
source "${PROJECT_DIR}/cache_db.sh"

# 优先使用配置页标记的「默认模型」及其所属配置组；未标记时回退到第一个配置组。
# 回退链按「默认模型 → 同组其它模型」排列，被限流/余额不足时依次降级。
AI_MODEL_CONFIG_KEY='ai-model-configs.json'
cache_db_exists "$AI_MODEL_CONFIG_KEY" && command -v jq >/dev/null 2>&1 || exit 1
_llm_values=$(cache_db_read "$AI_MODEL_CONFIG_KEY" | jq -r '
    (if type == "array" then . else (.groups // []) end) as $groups
    | ((($groups | map(select(any(.models[]?; .isDefault == true))) | .[0]) // ($groups[0] // {}))) as $group
    | ($group.models // []) as $models
    | [
        ($group.baseUrl // ""),
        ($group.apiKey // ""),
        ((($models | map(select(.isDefault == true) | .id)) + ($models | map(select(.isDefault != true) | .id))) | join(","))
      ]
    | @tsv' 2>/dev/null)
[ -n "$_llm_values" ] || exit 1
IFS=$'\t' read -r LLM_BASE_URL LLM_API_KEY _model_chain <<< "$_llm_values"
[ -n "$_model_chain" ] || exit 1
MODEL_CHAIN="${SKILL_TEXT_LLM_MODELS:-${_model_chain}}"
unset _llm_values _model_chain

[ -n "${LLM_API_KEY:-}" ] || exit 1
[ -n "${LLM_BASE_URL:-}" ] || exit 1
[ -f "${SCRIPT_DIR}/tools/${key}.sh" ] || exit 1

raw=$(bash "${SCRIPT_DIR}/tools/${key}.sh" data 2>/dev/null)
[ -n "$raw" ] || exit 1

# 标题：优先模板库登记的中文名
title=""
tpl_key='message_templates.json'
if cache_db_exists "$tpl_key" && command -v jq >/dev/null 2>&1; then
    title=$(cache_db_read "$tpl_key" | jq -r --arg k "$key" '.template_names[$k] // ""' 2>/dev/null | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
fi
[ -n "$title" ] || title="$key"

# 原始数据截断：榜单/行情类原始返回通常几 KB，够用且省钱
payload=$(printf '%s' "$raw" | head -c 6000)

SYS_PROMPT='你是企业微信群消息的排版助手。你的唯一职责是把给定的原始数据整理成易读的 Markdown 正文。
硬性约束：
1. 严禁编造、推测、修改、补充任何数值、日期、名称、链接——只能用原文里真实出现的内容；
2. 原文里没有的信息一律不许出现（尤其是日期与时间，绝不能自行推算或沿用训练数据里的日期）；
3. 不做点评、不写总结、不加"数据来源"之外的额外说明；
4. 只用 Markdown：一个 ## 标题，其余用列表或表格，不要用代码块包裹整篇；
5. 控制在 15 行以内，中文输出。'

USER_PROMPT="本条消息的业务名称是「${title}」。下面是它的原始数据（可能是 JSON 或文本）：
----
${payload}
----
请按上述要求输出排版后的消息正文。"

# 模型回退链已在配置读取时按 JSON 模型顺序生成；被限流（1305）/ 余额不足（1113）时依次降级

# 每次都现调 LLM：不做结果缓存（缓存目录与过期清理已整体下线，一次推送一次排版）
content=""
for model in $(printf '%s' "$MODEL_CHAIN" | tr ',' '\n' | awk '!seen[$0]++'); do
    [ -n "$model" ] || continue
    body=$(jq -n \
        --arg model "$model" \
        --arg sys "$SYS_PROMPT" \
        --arg user "$USER_PROMPT" \
        '{model: $model, messages: [{role: "system", content: $sys}, {role: "user", content: $user}], stream: false, temperature: 0.2}' 2>/dev/null)
    [ -n "$body" ] || continue

    resp=$(curl -s -m 20 -X POST "${LLM_BASE_URL}/chat/completions" \
        -H "Authorization: Bearer ${LLM_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "$body" 2>/dev/null)

    got=$(printf '%s' "$resp" | jq -r '.choices[0].message.content // ""' 2>/dev/null)
    if [ -n "$got" ]; then
        content="$got"
        break
    fi
done

[ -n "$content" ] || exit 1

printf '%s\n' "$content"
