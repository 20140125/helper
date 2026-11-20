# 5. 子工具脚本与辅助模式

---

## 子工具脚本规范

`update-tools/` 目录下的年度更新子工具：

- **命名**：功能动词 + 对象名称，下划线分隔（`get_holidays.sh`、`generate_holiday_config.sh`）
- **核心业务与 main 分离**：

```bash
业务函数名() {
    local year="$1"
    local json_file="$2"
    # 业务逻辑
    return 0
}

main() {
    if [ $# -lt 2 ]; then
        log_error "用法: $0 <年份> <JSON文件路径>"
        exit 1
    fi
    if 业务函数名 "$1" "$2"; then
        log_success "脚本执行完成"
        exit 0
    else
        log_error "执行失败"
        exit 1
    fi
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
```

- 通过退出码（`exit 0`/`exit 1`）向父脚本传递状态
- 不直接修改父脚本变量，通过文件传递数据

---

## 错误处理

```bash
# 命令执行检查
local result
result=$(some_command 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$result" ]; then
    log_error "命令执行失败"
    return 1
fi

# 文件存在性
if [ ! -f "$json_file" ]; then
    log_error "数据文件不存在: $json_file"
    return 1
fi

# API 失败 → 提供手动处理提示
if [ -z "$result" ]; then
    log_error "API 获取失败"
    log_info "💡 解决方案："
    log_info "     1. 在浏览器中访问 https://example.com/api"
    log_info "     2. 将 JSON 保存到 ${json_file}"
    log_info "     3. 重新运行此脚本"
    return 1
fi

# Python 调用统一用 python3
solar_date=$(python3 "${PROJECT_DIR}/date_utils.py" birthday "$lunar_month" "$lunar_day" 2>/dev/null)
```

---

## CLI 参数处理

```bash
case "${1:-默认模式}" in
    check)  main ;;
    test)   log_info "测试模式..." ;;
    run_one)
        if [ -z "$2" ]; then
            log_error "用法: $0 run_one <id>"
            exit 1
        fi
        run_single "$2"
        ;;
    *)
        log_error "未知参数: $1"
        log_error "用法: $0 {check|test|run_one <id>}"
        exit 1
        ;;
esac
```

- 参数不足时输出用法 + 示例
- 未知参数 `log_error` + `exit 1`
- 可选参数用 `${参数:-默认值}`

---

## Dry-Run 模式

```bash
DRY_RUN=false

do_send_message() {
    local message="$1"
    if [ "$DRY_RUN" = true ]; then
        log_info "📝 [DRY-RUN] 以下消息将被发送："
        echo "$message"
    else
        send_wecom_message "$message"
    fi
}

case "${1:-check}" in
    check)          main ;;
    dry-run|dryrun) DRY_RUN=true; main ;;
esac
```

- 全局 `DRY_RUN` 控制，默认 `false`；所有发送经过 `do_send_message()`
- 同时接受 `dry-run` 和 `dryrun`

---

## Source/执行双模式

部分脚本既可被 `source` 引入作函数库，也可直接执行：

```bash
# 函数定义区（无论 source 还是执行都加载）
get_message() { ... }
render_template() { ... }

main() {
    case "${1:-}" in
        validate)  validate_template_file ;;
        preview)   preview_template ;;
        *)         log_error "用法: $0 {validate|preview}" ;;
    esac
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
```

适用：`template_utils.sh`（source→函数库，执行→validate/preview）、`daily_data_manager.sh`（source→`get_morning_data()`，执行→prefetch/read）。
