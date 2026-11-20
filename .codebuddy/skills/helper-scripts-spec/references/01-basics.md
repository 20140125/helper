# 1. 脚本基础规范

---

## 文件头注释

```bash
#!/bin/bash
# ======================================
# 脚本名称（简短描述）
# ======================================
#
# 功能说明：
#   1. 功能一
#   2. 功能二
#
# 使用方式（子工具脚本需提供）：
#   bash scripts/xxx.sh [参数]
#
# 作者：智能提醒系统
# 更新：YYYY-MM-DD
# ======================================
```

分割线 38 个 `=`，作者统一 `智能提醒系统`。

---

## 路径初始化

**主脚本**：
```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"
```

**子工具脚本**（`update-tools/`）：
```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_SELF_DIR="$SCRIPT_DIR"
source "${SCRIPT_DIR}/../project_config.sh"
```

---

## 配置加载顺序（固定不可乱序）

```bash
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null   # 1. TZ/Webhook 等
source "${PROJECT_DIR}/holiday_config.sh" 2>/dev/null   # 2. 节假日
LOG_FILE="${PROJECT_DIR}/脚本名.log"                     # 3. 日志路径
source "${PROJECT_DIR}/log_utils.sh"                    # 4. 日志工具（依赖 LOG_FILE）
# 5. 其他业务配置...
```

子工具脚本避免覆盖父脚本日志：
```bash
if [ -z "$LOG_FILE" ]; then LOG_FILE="${_SELF_DIR}/脚本名.log"; fi
source "${PROJECT_DIR}/log_utils.sh"
```

---

## 按需加载

不使用就不加载——减少启动开销，避免副作用。每条 `source` 对应脚本内实际调用的函数/变量。

| 文件 | 加载条件 |
|------|---------|
| `project_config.sh` | 所有脚本 |
| `weather_config.sh` | 用了 `send_wecom_message`/`WECOM_WEBHOOKS`/`JUHE_*_KEY`/`TZ`（含 `date`） |
| `holiday_config.sh` | 调用 `is_holiday`/`is_workday`/`is_adjust_workday` 或读 `HOLIDAYS_YYYY` |
| `log_utils.sh` | 调用任一 `log_*` 函数 |
| `template_utils.sh` | 调用 `get_message`/`load_template`/`render_template` |
| `greetings_loader.sh` | 调用 `get_*_greeting` 系列 |
| `inspirational_quotes.sh` | 调用 `get_quote_*` 系列 |

模块化脚本的判定覆盖所有子模块（主脚本 + `xxx/*.sh`）。

**数据协议工具豁免**：仅通过 `echo` 输出数据供 `$()` 捕获的工具（如 `get_zodiac_sign.sh`），不加载 `log_utils.sh`——它们的 stdout 是数据通道，log_utils 会污染输出。

### 自检命令

```bash
for f in $(find scripts -maxdepth 2 -name "*.sh" ! -name "*.bak"); do
    loaded=$(grep -c "source.*log_utils" "$f")
    used=$(grep -cE "log_info|log_success|log_warning|log_error|log_debug|log_duration|log_separator" "$f")
    [ "$loaded" -gt 0 ] && [ "$used" -eq 0 ] && echo "⚠️  冗余加载: $f"
done
```

---

## 日志工具（log_utils.sh v4.0）

用 log_utils 而不是 echo——log_utils 支持日志级别、文件轮转和 JSON 格式，echo 不行。

| 函数 | 用途 |
|------|------|
| `log_info "..."` | 普通信息 |
| `log_success "..."` | 操作成功 |
| `log_warning "..."` | 警告 |
| `log_error "..."` | 错误（含具体原因） |
| `log_debug "..."` | 调试（仅 DEBUG 级别） |
| `log_duration $start "..."` | 性能（超 5000ms 升级 WARNING） |
| `log_separator "标题"` | 分隔线 |

环境变量：`LOG_FORMAT`(text/json)、`LOG_FILE`(/dev/stdout)、`LOG_LEVEL`(DEBUG/INFO/WARNING/ERROR)
