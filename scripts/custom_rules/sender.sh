#!/bin/bash

# ======================================
# 自定义规则 - 消息发送
# ======================================
#
# 提供企业微信消息发送功能：
#   send_wecom_message  - 发送 Markdown 消息到企微机器人
#
# 参数：
#   $1 - 消息内容（Markdown格式）
#   $2 - webhookIds（逗号分隔，可选；为空则发送到所有机器人）
#
# ======================================

# 按需加载缓存数据库通道（主脚本已加载时直接复用）
if ! declare -F cache_db_read >/dev/null 2>&1; then
    _CR_SENDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    if [ -z "${PROJECT_DIR:-}" ]; then
        source "${_CR_SENDER_DIR}/project_config.sh"
    fi
    source "${PROJECT_DIR}/cache_db.sh"
fi

send_wecom_message() {
    local message="$1"
    local webhook_ids="${2:-}"

    if [ -z "$WECOM_WEBHOOKS" ]; then
        log_error "企业微信 Webhook 未配置，请在 Web 管理界面添加机器人"
        return 1
    fi

    # 推送前：将完整消息体落盘到当前日志文件（依赖 weather_config.sh 提供的辅助函数）
    if command -v _log_wecom_message_body >/dev/null 2>&1; then
        _log_wecom_message_body "$message" "webhook_ids=${webhook_ids:-<all>}"
    fi

    # 使用 python3 对消息内容进行 JSON 转义，避免多行字符串和特殊字符破坏 JSON
    local json_payload
    json_payload=$(python3 -c "
import json, sys
msg = sys.stdin.read()
payload = {'msgtype': 'markdown', 'markdown': {'content': msg}}
print(json.dumps(payload, ensure_ascii=False))
" <<< "$message")

    # 根据 webhookIds 过滤目标 URL
    local target_urls
    target_urls=$(cache_db_read 'webhooks.json' | WEBHOOK_IDS="$webhook_ids" python3 -c "
import json, sys, os

ids_str = os.environ.get('WEBHOOK_IDS', '')

try:
    hooks = json.load(sys.stdin)
except Exception:
    sys.exit(1)

if ids_str.strip():
    ids = [i.strip() for i in ids_str.split(',') if i.strip()]
    urls = [h['url'] for h in hooks if h.get('id') in ids and h.get('url')]
else:
    urls = [h['url'] for h in hooks if h.get('url')]

print('\n'.join(urls))
" 2>/dev/null)

    if [ -z "$target_urls" ]; then
        log_error "[企微推送] 未找到可用的 Webhook 地址"
        return 1
    fi

    local success=0
    local fail=0
    while IFS= read -r url; do
        [ -z "$url" ] && continue
        local response
        response=$(curl -s -X POST "$url" \
            -H 'Content-Type: application/json' \
            -d "$json_payload")
        if echo "$response" | grep -q '"errcode":0'; then
            log_success "[企微推送] 消息发送成功 (${url:0:60}...)"
            success=$((success + 1))
        else
            log_error "[企微推送] 消息发送失败 (${url:0:60}...): $response"
            fail=$((fail + 1))
        fi
    done <<< "$target_urls"

    [ "$fail" -eq 0 ] && return 0 || return 1
}
