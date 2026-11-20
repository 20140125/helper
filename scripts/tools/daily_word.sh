#!/bin/bash
# ======================================
# 每日一言卡片
# ======================================
#
# 功能说明：
#   1. 获取金山词霸每日英语（失效时降级复用历史沉淀句子）
#   2. 获取一言API的随机名言（失效时用内置兜底语录）
#   3. 生成每日一言卡片
#
# 使用方式：
#   bash scripts/tools/daily_word.sh     # 出卡片
#   source scripts/tools/daily_word.sh   # 只复用 fetch_data（凌晨预取）
#
# 注：open.iciba.com/dsapi/ 自 2026-10-28 起不可用。本脚本的 fetch_data 是
#     卡片与凌晨预取共用的唯一取数入口，缺一路数据不再让整个流程失败。
#
# 作者：智能提醒系统
# 更新：2026-11-06
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"
# 归档公共库（一月一文件，entries 按日聚合）
source "${PROJECT_DIR}/api_archive.sh"
# 每日一词历史库（只增不删；月归档会被清理，句子沉淀到这里长久保存）
source "${PROJECT_DIR}/dailyword_library.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/daily_word_card.png"
SVG_FILE="/tmp/daily_word_card.svg"

fetch_data() {
    # 先尝试读取今日归档（金山词霸 + 一言 聚合后的 items_json）
    local cache_file
    cache_file=$(api_cache_path dailyword)
    local cached_items
    if cached_items=$(read_cached_api_response "${cache_file}"); then
        # 缓存必须完整：iciba 失效期曾把只有 quote 的残缺 JSON 归档，
        # 只校验 .quote 会让卡片整天复用空英文，这里三个正文字段都要非空
        if [ -n "${cached_items}" ] && echo "${cached_items}" | jq -e \
            '(((.quote // "") | length) > 0) and (((.english // "") | length) > 0) and (((.chinese // "") | length) > 0)' \
            >/dev/null 2>&1; then
            log_info "🗂  命中今日归档缓存: ${cache_file}（bytes=${#cached_items}），跳过 API 请求"
            # 沉淀（幂等：同一天已存在则跳过，残缺条目会被补全）
            persist_dailyword "${cached_items}"
            echo "${cached_items}"
            return 0
        fi
        log_warning "⚠️  今日归档缓存不完整（缺英文/中文/名言），重新取数: ${cache_file}"
    fi

    # 两路都允许失败：iciba 挂了用历史沉淀降级，一言挂了用内置兜底句
    local iciba hitokoto
    iciba=$(fetch_url "https://open.iciba.com/dsapi/" 8)
    hitokoto=$(fetch_url "https://v1.hitokoto.cn/?c=d&c=h&c=i&c=k" 8)

    # jq 的 // 只对 null/false 兜底，空字符串 "" 是 truthy 会被原样带出；
    # 接口返回空 body 时 jq 无输入也直接输出空 —— 用 select(length>0) 统一过滤
    local eng chn quote from
    eng=$(printf '%s' "${iciba}"    | jq -r '((.content // "") | select(length > 0))'    2>/dev/null || true)
    chn=$(printf '%s' "${iciba}"    | jq -r '((.note // "") | select(length > 0))'       2>/dev/null || true)
    quote=$(printf '%s' "${hitokoto}" | jq -r '((.hitokoto // "") | select(length > 0))' 2>/dev/null || true)
    from=$(printf '%s' "${hitokoto}" | jq -r '((.from // "") | select(length > 0))'      2>/dev/null || true)

    local english_source="iciba"
    if [ -z "${eng}" ] || [ -z "${chn}" ]; then
        log_warning "⚠️  金山词霸每日英语不可用（open.iciba.com/dsapi/ 超时或返回空），降级复用历史沉淀"
        local fallback
        fallback=$(dailyword_fallback_english)
        eng=$(printf '%s' "${fallback}" | jq -r '.english // ""' 2>/dev/null || true)
        chn=$(printf '%s' "${fallback}" | jq -r '.chinese // ""' 2>/dev/null || true)
        english_source=$(printf '%s' "${fallback}" | jq -r '.english_source // "static"' 2>/dev/null || true)
    fi

    if [ -z "${quote}" ]; then
        log_warning "⚠️  一言 API 不可用，使用内置兜底语录"
        quote="做你想做的事。"
    fi
    [ -n "${from}" ] || from="佚名"
    # 最后一道兜底：历史库也不可用时，保证三个正文字段都不为空
    if [ -z "${eng}" ] || [ -z "${chn}" ]; then
        eng="Life is beautiful."
        chn="生活是美好的。"
        english_source="static"
    fi
    [ -n "${english_source}" ] || english_source="static"

    local items_json
    items_json=$(jq -n \
        --arg eng "${eng}" --arg chn "${chn}" \
        --arg quote "${quote}" --arg from "${from}" \
        --arg src "${english_source}" \
        '{english:$eng, chinese:$chn, quote:$quote, from:$from, english_source:$src}')

    # 归档聚合后的 items_json（失败不阻断主流程）
    if archive_api_response "${cache_file}" "${items_json}"; then
        log_info "🗂  每日一言原始 JSON 已归档: ${cache_file}"
    else
        log_warning "⚠️  每日一言归档失败（${cache_file}），不影响本次展示"
    fi

    # 沉淀到历史库（只增不删，与月归档的清理策略解耦）
    persist_dailyword "${items_json}"

    echo "$items_json"
}

generate_card() {
    local items_json="$1"
    local date_str="$2"

    # Node 负责：计算行数、输出 body 中所有动态 text 行，并把卡片总高度通过 stdout 最后一行返回给 bash。
    local body card_h
    body=$(node -e "
const data = JSON.parse(process.argv[1]);

function wrapText(text, maxLen) {
  const lines = [];
  let line = '';
  for (let i = 0; i < text.length; i++) {
    line += text[i];
    if (line.length >= maxLen || i === text.length - 1) {
      lines.push(line);
      line = '';
    }
  }
  return lines;
}

const engLines = wrapText(data.english, 50);
const chnLines = wrapText(data.chinese, 40);
const quoteLines = wrapText(data.quote, 40);

// 布局计算：保持与原版完全一致
let y = 200;
engLines.forEach((line, i) => { y += i === 0 ? 0 : 40; y += 45; });
y += 10;
chnLines.forEach(() => { y += 40; });
y += 60;
const divider_y = y;
y += 60;
const quote_y = y;
quoteLines.forEach(() => { y += 42; });
y += 20;
y += 50;
const h = y + 70;

// 输出 body（不含 header / footer / </svg>）
const body = [
  ...engLines.map((l, i) => \`  <text x=\"540\" y=\"\${200 + i * 45}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"28\" font-style=\"italic\" fill=\"#ffffffdd\" text-anchor=\"middle\">\${l}</text>\`),
  ...chnLines.map((l, i) => \`  <text x=\"540\" y=\"\${200 + engLines.length * 45 + 10 + i * 40}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"24\" fill=\"#ffffff99\" text-anchor=\"middle\">\${l}</text>\`),
  \`  <line x1=\"400\" y1=\"\${divider_y}\" x2=\"680\" y2=\"\${divider_y}\" stroke=\"#ffffff30\" stroke-width=\"1\"/>\`,
  ...quoteLines.map((l, i) => \`  <text x=\"540\" y=\"\${quote_y + i * 42}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"26\" fill=\"#ffffffdd\" text-anchor=\"middle\">\${l}</text>\`),
  \`  <text x=\"540\" y=\"\${quote_y + quoteLines.length * 42 + 20}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"22\" fill=\"#ffffff88\" text-anchor=\"middle\">—— \${data.from}</text>\`,
].join('\n');

// 约定：stdout 前面是 body，最后一行单独输出高度，方便 bash 用 tail -n1 读取
console.log(body);
console.log('__H__' + h);
" "$items_json")

    card_h=$(echo "$body" | awk -F'__H__' '/^__H__/{print $2}')
    body=$(echo "$body" | grep -v '^__H__')

    {
        svg_header "$card_h" "#2E1A0A" "#1A0E05" "每日一言" "${date_str}"
        echo "$body"
        if [ "$(printf '%s' "${items_json}" | jq -r '.english_source // "iciba"')" != "iciba" ]; then
            svg_footer "$card_h" "数据来源：历史沉淀 · 一言"
        else
            svg_footer "$card_h" "数据来源：金山词霸 · 一言"
        fi
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "每日一言卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"
    
    local date_str
    date_str=$(get_date_str)
    
    local items_json
    items_json=$(fetch_data) || exit 1
    
    generate_card "$items_json" "$date_str"
    
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

# 被 source 时（凌晨预取复用 fetch_data）不执行 main，避免顺带生成 PNG
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
