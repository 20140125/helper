#!/bin/bash

# ======================================
# 工作日提醒系统 - 统一配置文件
# ======================================
#
# 功能说明：
#   1. 加载 .env 文件中的环境变量
#   2. 设置时区（Asia/Hong_Kong）
#   3. 配置企业微信 Webhook 地址
#   4. 配置聚合数据 API 密钥
#   5. 配置天气城市、星座等个性化参数
#
# 配置来源：
#   - .env 文件（包含 API密钥等敏感信息）
#   - webhooks.json（企业微信 Webhook 地址及消息风格）
#   - 首次使用请复制 web/.env.example 为 web/.env 并填写配置
#
# 使用方式：
#   source "${PROJECT_DIR}/weather_config.sh"
#
# 提供的环境变量：
#   TZ                  - 时区设置
#   WECOM_WEBHOOKS      - 企业微信机器人 Webhook 地址（多个，换行分隔）
#   MESSAGE_STYLE       - 消息模板风格（来自 webhooks.json 的 style 字段）
#   JUHE_WEATHER_KEY    - 聚合数据天气 API 密钥
#   JUHE_ALMANAC_KEY    - 聚合数据老黄历 API 密钥
#   JUHE_HOROSCOPE_KEY  - 聚合数据星座运势 API 密钥
#   WEATHER_CITY_NAME   - 天气查询城市名称
#   ZODIAC_SIGN         - 星座名称
#
# 作者：智能提醒系统
# 更新：2026-03-10
# ======================================

# ======================================
# 获取脚本所在目录
# ======================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 引入项目路径配置（提供 ENV_FILE：web/.env 优先，缺失时回退 scripts/.env）
source "${SCRIPT_DIR}/project_config.sh"

# ======================================
# 加载 .env 文件
# ======================================
# 上游已解析过 ENV_FILE 时直接沿用，避免与 project_config.sh 的规则脱节
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env}"

if [ -f "$ENV_FILE" ]; then
    # 读取 .env 文件并导出变量
    set -a
    source "$ENV_FILE"
    set +a
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 已加载配置文件: $ENV_FILE" >&2
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  警告: 未找到配置文件，请复制 web/.env.example 为 web/.env 并配置" >&2
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💡 提示: cp ${ROOT_DIR}/web/.env.example ${ROOT_DIR}/web/.env" >&2
fi

# ======================================
# 时区设置
# ======================================
export TZ='Asia/Hong_Kong'

# ======================================
# 星座设置
# ======================================
#
# 星座日期对照表：
# 白羊座 (3.21-4.19)    金牛座 (4.20-5.20)    双子座 (5.21-6.21)
# 巨蟹座 (6.22-7.22)    狮子座 (7.23-8.22)    处女座 (8.23-9.22)
# 天秤座 (9.23-10.23)   天蝎座 (10.24-11.22)  射手座 (11.23-12.21)
# 摩羯座 (12.22-1.19)   水瓶座 (1.20-2.18)    双鱼座 (2.19-3.20)

ZODIAC_SIGN="天秤座"

# ======================================
# 从 webhooks.json 读取企业微信 Webhook 地址
# ======================================
WEBHOOKS_JSON="${SCRIPT_DIR}/../.cache/webhooks.json"

# 读取所有 webhook URL 和消息模板风格
if [ -f "$WEBHOOKS_JSON" ]; then
    read_result=$(python3 -c "
import json, sys
try:
    hooks = json.load(open('$WEBHOOKS_JSON'))
    urls = [h['url'] for h in hooks if h.get('url')]
    style = hooks[0].get('style', 'default') if hooks else 'default'
    print(style if style else 'default')
    print('\n'.join(urls))
except Exception as e:
    print('default')
    sys.exit(0)
" 2>/dev/null)

    # 第一行为 style，其余为 URL
    MESSAGE_STYLE=$(echo "$read_result" | head -n 1)
    WECOM_WEBHOOKS=$(echo "$read_result" | tail -n +2)
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  警告: 未找到 webhooks.json，企业微信通知将不可用" >&2
    WECOM_WEBHOOKS=""
    MESSAGE_STYLE="default"
fi

# ======================================
# 导出变量供其他脚本使用
# ======================================
export WECOM_WEBHOOKS
export MESSAGE_STYLE
export ZODIAC_SIGN
export WEATHER_CITY_NAME
export JUHE_HOROSCOPE_KEY
export JUHE_ALMANAC_KEY
export JUHE_WEATHER_KEY
# 高德地图 Web 服务 Key：通勤路况 / 路线规划 / POI 搜索，以及天气的备份数据源
export AMAP_KEY
export WEB_PORT
# 自动追加当前年份，确保 URL 始终指向当前年份的假期数据
HOLIDAY_API_URL="${HOLIDAY_API_URL}/$(date '+%Y')"
export HOLIDAY_API_URL
export PROJECT_DIR

# ======================================
# 配置验证（日志输出到 stderr）
# ======================================
if [ -z "$WECOM_WEBHOOKS" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 错误: 未配置任何企业微信 Webhook，请在 Web 管理界面添加机器人" >&2
fi

if [ -z "$JUHE_HOROSCOPE_KEY" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  警告: JUHE_HOROSCOPE_KEY 未配置，星座运势功能将不可用" >&2
fi

if [ -z "$JUHE_ALMANAC_KEY" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  警告: JUHE_ALMANAC_KEY 未配置，黄历功能将不可用" >&2
fi

if [ -z "$JUHE_WEATHER_KEY" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  警告: JUHE_WEATHER_KEY 未配置，天气功能将不可用" >&2
fi

# ======================================
# 通用企业微信消息发送函数
# 遍历 WECOM_WEBHOOKS 中所有机器人逐一发送
# 参数：$1 - 消息内容（Markdown 格式）
# ======================================
send_wecom_notify() {
    local message="$1"

    if [ -z "$WECOM_WEBHOOKS" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 企业微信 Webhook 未配置，请在 Web 管理界面添加机器人" >&2
        return 1
    fi

    # 使用 python3 对消息内容进行 JSON 转义，避免特殊字符破坏 JSON
    local json_payload
    json_payload=$(python3 -c "
import json, sys
msg = sys.stdin.read()
payload = {'msgtype': 'markdown', 'markdown': {'content': msg}}
print(json.dumps(payload, ensure_ascii=False))
" <<< "$message")

    local success=0
    local fail=0
    while IFS= read -r url; do
        [ -z "$url" ] && continue
        local response
        response=$(curl -s -X POST "$url" \
            -H 'Content-Type: application/json' \
            -d "$json_payload")
        if echo "$response" | grep -q '"errcode":0'; then
            if command -v log_success >/dev/null 2>&1; then
                log_success "[企微推送] 消息发送成功 (${url:0:60}...)"
            fi
            success=$((success + 1))
        else
            if command -v log_error >/dev/null 2>&1; then
                log_error "[企微推送] 消息发送失败 (${url:0:60}...): $response"
            else
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 消息发送失败 (${url:0:60}...): $response" >&2
            fi
            fail=$((fail + 1))
        fi
    done <<< "$WECOM_WEBHOOKS"

    [ "$fail" -eq 0 ] && return 0 || return 1
}

# ======================================
# 企微消息日志辅助函数
# ======================================
# 把企微消息体按行完整打印到当前日志文件，便于离线排查。
# 仅在当前 shell 已 source 过 log_utils.sh（即 log_info 可用）时才打印，
# 避免在未初始化日志环境的场景下调用未定义函数。
#
# 参数：
#   $1 - 消息内容
#   $2 - 附加上下文字符串（如 "webhook_ids=xxx"），可选
_log_wecom_message_body() {
    # 若日志函数不可用则静默返回（例如 weather_config.sh 被单独 source 的场景）
    command -v log_info >/dev/null 2>&1 || return 0

    local message="$1"
    local extra_ctx="${2:-}"

    local byte_size
    byte_size=$(printf '%s' "$message" | wc -c | tr -d ' ')
    local line_count
    line_count=$(printf '%s\n' "$message" | wc -l | tr -d ' ')

    local header="📤 [企微推送] 准备发送消息（bytes=${byte_size}, lines=${line_count}"
    [ -n "$extra_ctx" ] && header="${header}, ${extra_ctx}"
    header="${header}）"
    log_info "$header"

    # 完整输出所有行，不截断
    while IFS= read -r line || [ -n "$line" ]; do
        log_info "    │ $line"
    done <<< "$message"
}
export -f _log_wecom_message_body

# ======================================
# 标准化消息推送函数（带日志输出）
# ======================================
# 发送消息到企业微信
# 参数：$1 - 消息内容（Markdown格式）
send_wecom_message() {
    local message="$1"

    # 推送前：将完整消息体落盘到当前日志文件
    _log_wecom_message_body "$message"

    # 注意：按 webhook 粒度的成功/失败日志已由 send_wecom_notify 内部统一打印，
    # 此处只做整体结果汇总，避免引用函数外已失效的 $url / $response 变量。
    if send_wecom_notify "$message"; then
        return 0
    else
        return 1
    fi
}
export -f send_wecom_message
