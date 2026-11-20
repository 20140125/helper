# 4. 模块化拆分与子命令路由

---

## 模块化拆分模式

复杂脚本采用「主脚本 + 同名子目录」结构：

```
scripts/
├── custom_rules.sh              # 主脚本（入口）
├── custom_rules/                # 同名子目录
│   ├── utils.sh
│   ├── trigger.sh
│   ├── sender.sh
│   └── runner.sh
├── workday_manager.sh
├── workday_manager/
│   ├── morning.sh
│   ├── lunch.sh
│   └── evening.sh
```

**已采用此模式的脚本**：`custom_rules`(7)、`workday_manager`(5)、`festival_greetings`(4)、`view_logs`(4)、`daily_data_manager`(3)、`birthday_reminder`(3)、`template_utils`(3)。

**主脚本加载子模块**：

```bash
# ======================================
# 加载子模块
# ======================================
source "${SCRIPT_DIR}/custom_rules/utils.sh"
source "${SCRIPT_DIR}/custom_rules/trigger.sh"
source "${SCRIPT_DIR}/custom_rules/sender.sh"
source "${SCRIPT_DIR}/custom_rules/runner.sh"
```

**子模块规范**：
- 不设置自己的 `SCRIPT_DIR` 和 `LOG_FILE`——由主脚本统一管理，避免路径冲突
- `cmd_xxx()` 函数需要独立日志时在内部设置：

```bash
cmd_morning() {
    LOG_FILE="${PROJECT_DIR}/workday_manager.log"
    source "${PROJECT_DIR}/log_utils.sh"

    log_info "======================================"
    log_info "🌅 工作日早安提醒"
    log_info "======================================"
    # 业务逻辑
}
```

---

## 子命令路由

大型脚本用 `case` + `cmd_xxx()` 做子命令路由：

```bash
case "${1:-all}" in
    holiday|check)  cmd_holiday ;;
    lunar)          cmd_lunar ;;
    all)
        cmd_holiday
        sleep 1
        cmd_lunar
        ;;
    *)
        log_error "未知参数: ${1:-}"
        log_error "用法: $0 {holiday|lunar|all}"
        exit 1
        ;;
esac
```

- 入口函数统一 `cmd_` 前缀
- 支持别名：`holiday|check)`、`solar_term|solar)`
- **auto 子命令**用 `exec "$0"` 自递归——避免嵌套维护 case 结构，`exec` 替换当前进程保持日志/PID 干净，`"$0"` 兼容符号链接场景：

```bash
auto)
    current_hour=$(date '+%H' | sed 's/^0//')
    if [ "$current_hour" -lt 11 ]; then
        exec "$0" morning
    elif [ "$current_hour" -lt 15 ]; then
        exec "$0" lunch
    else
        exec "$0" evening
    fi
    ;;
```

**入口选择**：

| 模式 | 适用场景 | 示例 |
|------|----------|------|
| `main "$@"` | 简单脚本，单一职责 | ≤200 行单功能脚本 |
| `main "$@"` + 子目录 | 功能单一但逻辑复杂 | `birthday_reminder.sh`（195 行主+3 子模块） |
| `case` + `cmd_xxx()` + 子目录 | 多子命令 | `festival_greetings.sh`、`workday_manager.sh` |
| `BASH_SOURCE guard` + `case` + 子目录 | 兼做函数库和命令行 | `template_utils.sh`、`daily_data_manager.sh` |

---

## 拆分阈值

| 条件 | 动作 |
|------|------|
| 主脚本超 300 行 | 拆分 |
| ≥3 个独立函数组 | 建议拆分 |
| ≥2 个脚本含重复逻辑 | 抽取到工具脚本 |

拆分后目标：主脚本 ≤200 行，子模块各 ≤200 行。

### 典型案例

**birthday_reminder.sh (385→195 行)**：
```
scripts/
├── birthday_reminder.sh      # 配置加载 + main() + case 路由
└── birthday_reminder/
    ├── parser.sh              # parse_birthday_entry()：公历/农历解析
    ├── sender.sh              # do_send_message/send_birthday_greeting/send_advance_reminder
    └── checker.sh             # check_today_birthday()
```

**template_utils.sh (335→104 行)**（source/执行双模式）：
```
scripts/
├── template_utils.sh         # 配置 + get_message() + BASH_SOURCE guard
└── template_utils/
    ├── loader.sh              # load_template()
    ├── renderer.sh            # render_template() + Python 替换
    └── validator.sh           # validate/list 校验查询 + main() CLI
```
