# 3. 消息发送与格式规范

---

## 发送函数

**标准模式**（主脚本）：

```bash
send_wecom_message() {
    local message="$1"
    if send_wecom_notify "$message"; then
        log_success "企业微信消息发送成功"
    else
        log_error "企业微信消息发送失败"
        return 1
    fi
}
```

**多 Webhook 模式**（custom_rules.sh 风格）：

```bash
send_wecom_message() {
    local message="$1"
    local webhook_ids="${2:-}"  # 逗号分隔，为空发所有

    # python3 JSON 转义——直接拼接 JSON 遇到引号/换行会破坏结构
    local json_payload
    json_payload=$(python3 -c "
import json, sys
msg = sys.stdin.read()
payload = {'msgtype': 'markdown', 'markdown': {'content': msg}}
print(json.dumps(payload, ensure_ascii=False))
" <<< "$message")

    # 遍历目标 URL 发送，检查 "errcode":0
}
```

要点：
- 消息内容通过 `python3` JSON 转义（直接拼 JSON 遇特殊字符会破坏结构）
- 发送结果检查 `"errcode":0`
- Webhook 未配置时 `log_error` + `return 1`

---

## 消息内容格式

统一 Markdown 格式：

```
## 🌅 消息标题

> **当前时间**: $(date '+%Y年%m月%d日 %H:%M')
> **关键信息**: 值

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 📝 内容区块
内容...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *此消息由智能提醒系统发送*
```

- 头部包含时间，尾部有签名——便于用户识别消息来源和时效
- 推荐用 heredoc 构建多行内容

---

## 消息模板系统

使用 `template_utils.sh` 统一渲染：

```
get_message(type, style, key=value...)
    ├── load_template(type, style)     → jq 读取 .cache/message_templates.json
    └── render_template(template, key=value...)  → python3 替换 {key}
```

```bash
# 一步到位（推荐）
local message
message=$(get_message "morning" "${MESSAGE_STYLE:-default}" \
    "date_time=$(date '+%Y年%m月%d日 %H:%M')" \
    "weather=${WEATHER_INFO}")

# 两步分开（复用模板时）
local template=$(load_template "morning" "default")
local message=$(render_template "$template" "city=深圳" "weather=多云")
```

模板渲染失败时用 `printf` 构建兜底消息。

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `MESSAGE_STYLE` | `default` | 风格（`default`/`brief`/`formal`） |
