#!/bin/bash

# ======================================
# 历史上的今天脚本
# ======================================
# 
# 功能说明：
#   1. 获取历史上今天发生的重要事件
#   2. 使用维基百科API获取100%真实数据
#   3. 支持生成企业微信消息格式（供 daily_data_manager.sh 调用缓存）
#   4. 原始 JSON 归档到 .cache/api_responses/ (一月一文件)
# 
# 使用方式：
#   ./history_today.sh show          # 显示今天的历史事件
#   ./history_today.sh show 10 1     # 显示10月1日的历史事件
#   ./history_today.sh message       # 生成企业微信消息格式（输出到 stdout）
# 
# 数据来源：
#   - 维基百科API（100%真实数据）
#   - API地址：https://zh.wikipedia.org/api/rest_v1/feed/onthisday/events/{MM}/{DD}
# 
# 作者：智能提醒系统
# 更新：2026-05-08
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 加载配置
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null || true

# 日志文件配置
LOG_FILE="${PROJECT_DIR}/history_today.log"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# 引入原始 API 响应归档公共库（归档 + 日内复用 + 消除重复请求）
source "${PROJECT_DIR}/api_archive.sh"


# -----------------------------------------
# 内部：拉取维基百科原始 JSON（带归档 + 日内复用）
# 参数：
#   $1 - 月份（两位补零）
#   $2 - 日期（两位补零）
# 返回：
#   0 + stdout 输出原始 JSON
#   1 + stdout 输出错误标记
# -----------------------------------------
_fetch_wikipedia_events() {
    local month_padded="$1"
    local day_padded="$2"

    # 归档为单日文件 historytoday-YYYY-MM-DD.json（一年一文件，文件名即日期）。
    # 维基百科「历史上的今天」只与月日有关，年份仅用于让归档归属清晰、便于审计
    local date_key
    date_key="$(TZ=Asia/Shanghai date '+%Y')-${month_padded}-${day_padded}"
    local cache_file
    cache_file=$(api_cache_daily_path historytoday "${date_key}")

    local body=""
    if body=$(read_cached_api_response "${cache_file}"); then
        log_info "🗂  命中今日归档缓存: ${cache_file}（bytes=${#body}），跳过 API 请求"
        printf '%s' "$body"
        return 0
    fi

    local api_url="https://zh.wikipedia.org/api/rest_v1/feed/onthisday/events/${month_padded}/${day_padded}"
    log_info "🌐 调用维基百科历史事件 API: ${api_url}"
    local start_ts
    start_ts=$(now_ms)
    body=$(curl -fsS --max-time 10 -H "User-Agent: MorningReminder/1.0" "${api_url}")
    local curl_exit=$?

    local primary_ok=false
    if [ $curl_exit -eq 0 ] && [ -n "$body" ] \
        && printf '%s' "$body" | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if isinstance(d.get("events"), list) and len(d["events"]) > 0 else 1)' 2>/dev/null; then
        primary_ok=true
    fi

    if [ "$primary_ok" = true ]; then
        log_info "📥 API 响应已接收（bytes=${#body}）"
        log_duration "$start_ts" "维基百科历史事件 API 调用完成"
    else
        local end_ts
        end_ts=$(now_ms)
        local cost=$((end_ts - start_ts))
        log_warning "维基百科历史事件 API 调用失败（curl_exit=${curl_exit}, 耗时: ${cost}ms），尝试 Byabbe 备用源"

        # 维基百科 REST 在部分网络下不可达；Byabbe 同样基于 Wikipedia，免 Key 且响应较小。
        # 统一归一化为 {"events":[{"year":..., "text":...}]}，下游解析无需区分来源。
        local fallback_url="https://byabbe.se/on-this-day/${month_padded}/${day_padded}/events.json"
        local fallback_body
        fallback_body=$(curl -fsS --max-time 10 -H "User-Agent: MorningReminder/1.0" "${fallback_url}")
        curl_exit=$?
        if [ $curl_exit -ne 0 ] || [ -z "$fallback_body" ]; then
            log_error "Byabbe 备用源也失败（curl_exit=${curl_exit}）"
            echo "API_FAILED"
            return 1
        fi

        body=$(python3 - "$fallback_body" << 'PYEOF'
import json, sys
try:
    doc = json.loads(sys.argv[1])
except Exception:
    print('')
    sys.exit(1)

events = []
for item in doc.get('events', [])[:10]:
    year = str(item.get('year', '')).strip()
    text = str(item.get('description') or item.get('text') or '').strip()
    if year and text:
        events.append({'year': year, 'text': text})

if not events:
    print('')
    sys.exit(1)

print(json.dumps({'events': events}, ensure_ascii=False))
PYEOF
)
        if [ -z "$body" ]; then
            log_error "Byabbe 备用源解析失败"
            echo "API_FAILED"
            return 1
        fi
        log_info "📥 Byabbe 备用源响应已归一化（bytes=${#body}）"
        log_duration "$start_ts" "历史数据获取完成（Byabbe 备用源）"
    fi

    # 归档归一化后的 JSON（失败不阻断主流程）
    if archive_api_response "${cache_file}" "${body}"; then
        log_info "🗂  原始 JSON 已归档: ${cache_file}"
    else
        log_warning "⚠️  归档失败（${cache_file}），不影响本次展示"
    fi

    printf '%s' "$body"
    return 0
}


# 获取历史上的今天
# 参数：
#   $1 - 月份（可选，默认当前月份，不含前导零）
#   $2 - 日期（可选，默认当前日期，不含前导零）
# 返回：成功 0 | 失败 1
get_history_today() {
    local month="${1:-$(date '+%-m')}"
    local day="${2:-$(date '+%-d')}"
    local month_padded=$(printf "%02d" "$month")
    local day_padded=$(printf "%02d" "$day")

    log_info "🔍 准备获取历史事件（目标日期: ${month}月${day}日，API 路径: /${month_padded}/${day_padded}）"

    local history_data
    history_data=$(_fetch_wikipedia_events "$month_padded" "$day_padded")
    if [ $? -ne 0 ] || [ "$history_data" = "API_FAILED" ]; then
        echo "API_FAILED"
        return 1
    fi

    log_info "🧩 解析 JSON 并提取前 5 条历史事件..."
    local temp_file="/tmp/history_$$.json"
    echo "$history_data" > "$temp_file"

    local events
    events=$(python3 << EOF
import json
import re

with open('$temp_file', 'r', encoding='utf-8') as f:
    data = json.load(f)

events = data.get('events', [])

if not events:
    print('API_NO_DATA')
else:
    for i, event in enumerate(events[:5]):
        year = event.get('year', '未知年份')
        text = event.get('text', '无描述')
        text = re.sub(r'<[^>]+>', '', text)
        print(f'{year}年 - {text}')
        if i < len(events) - 1 and i < 4:
            print('')
EOF
)

    rm -f "$temp_file"

    if [ -z "$events" ] || [[ "$events" == API_* ]]; then
        log_error "历史数据解析失败: ${events:-<空>}"
        echo "数据获取失败，请稍后重试"
        return 1
    fi

    log_info "✅ JSON 解析完成，事件概览："
    while IFS= read -r line; do
        [ -n "$line" ] && log_info "   • ${line}"
    done <<< "$events"

    log_info "📝 生成终端格式化输出..."
    cat << HISTORY_OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    📜 历史上的今天（${month}月${day}日）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

$events

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 数据来源：维基百科 / Byabbe（100%真实数据）
HISTORY_OUTPUT

    log_success "历史数据获取成功（${month}月${day}日，来自 Wikipedia API）"
    return 0
}

# 生成企业微信消息格式（100%真实API数据）
# 参数：
#   $1 - 月份（可选，默认当前月份）
#   $2 - 日期（可选，默认当前日期）
# 返回：成功 0 | 失败 1（stdout 始终输出 Markdown，失败时输出兜底文案）
generate_history_message() {
    local month="${1:-$(date '+%-m')}"
    local day="${2:-$(date '+%-d')}"
    local month_padded=$(printf "%02d" "$month")
    local day_padded=$(printf "%02d" "$day")

    log_info "🔍 准备生成企微历史事件消息（目标日期: ${month}月${day}日）"

    local history_data
    history_data=$(_fetch_wikipedia_events "$month_padded" "$day_padded")
    if [ $? -ne 0 ] || [ "$history_data" = "API_FAILED" ]; then
        printf '## 📜 历史上的今天\n\n**%s月%s日**\n\n• 数据获取失败，请稍后重试\n\n💡 **温馨提示**：以史为鉴，可以知兴替\n' "${month}" "${day}"
        return 1
    fi

    log_info "🧩 解析 JSON 并生成 Markdown 列表..."
    local temp_file="/tmp/history_msg_$$.json"
    echo "$history_data" > "$temp_file"

    local events
    events=$(python3 << EOF
import json
import re

with open('$temp_file', 'r', encoding='utf-8') as f:
    data = json.load(f)

events = data.get('events', [])

if not events:
    print('• 暂无该日期的历史事件记录')
else:
    for i, event in enumerate(events[:5]):
        year = event.get('year', '未知')
        text = event.get('text', '无描述')
        text = re.sub(r'<[^>]+>', '', text)
        if len(text) > 80:
            text = text[:77] + '...'
        print(f'• **{year}年** - {text}')
EOF
)

    rm -f "$temp_file"

    if [ -z "$events" ]; then
        log_warning "⚠️  JSON 解析得到空结果，API 结构可能已变更"
    else
        log_info "✅ Markdown 列表生成完成，条目概览："
        while IFS= read -r line; do
            [ -n "$line" ] && log_info "   ${line}"
        done <<< "$events"
    fi

    log_info "📝 输出企微消息 Markdown..."
    printf '## 📜 历史上的今天\n\n**%s月%s日**\n\n%s\n\n💡 **数据来源**：维基百科 / Byabbe（100%%真实数据）\n' "${month}" "${day}" "${events}"

    log_success "历史事件消息生成成功（${month}月${day}日）"
    return 0
}

# 主入口
main() {
    local action="${1:-show}"
    local month_arg="${2:-}"
    local day_arg="${3:-}"

    log_info "======================================"
    log_info "🚀 历史上的今天脚本启动 (${action})"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"
    if [ -n "$month_arg" ] && [ -n "$day_arg" ]; then
        log_info "🎯 动作: ${action}, 指定日期: ${month_arg}月${day_arg}日"
    else
        log_info "🎯 动作: ${action}, 日期: 今天 ($(date '+%-m月%-d日'))"
    fi

    case "$action" in
        show)
            if get_history_today "$month_arg" "$day_arg"; then
                log_success "脚本执行完成"
                log_info "======================================"
                exit 0
            else
                log_error "脚本执行失败"
                log_info "======================================"
                exit 1
            fi
            ;;
        message)
            if generate_history_message "$month_arg" "$day_arg"; then
                log_success "脚本执行完成"
                log_info "======================================"
                exit 0
            else
                log_error "脚本执行失败"
                log_info "======================================"
                exit 1
            fi
            ;;
        *)
            log_error "用法: $0 {show|message} [月份] [日期]"
            log_info "命令："
            log_info "  show    - 显示历史上的今天（终端输出）"
            log_info "  message - 生成企业微信消息格式（供 daily_data_manager.sh 调用）"
            log_info "示例："
            log_info "  $0 show          # 显示今天"
            log_info "  $0 show 10 1     # 显示10月1日"
            log_info "  $0 message       # 输出消息内容"
            log_info "======================================"
            exit 1
            ;;
    esac
}

main "$@"