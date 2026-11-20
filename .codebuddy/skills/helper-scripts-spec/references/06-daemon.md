# 6. 守护进程编写规范

> 从 `annual_scheduler.sh` 与 `reminder_daemon.sh` 提炼，所有后台常驻脚本遵守。

---

## 核心问题

守护进程需解决两个问题：
1. **多实例共存**：crontab 保活可能在旧进程未退出时拉起新实例
2. **PID 文件竞态**：旧实例 trap 可能误删新实例的 PID 文件

---

## 多实例检测

用 `ps -eo pid,args | grep` 而非 `pgrep -f`——`pgrep -f` 会匹配到自身命令行，导致误判：

```bash
other_pids=$(ps -eo pid,args | grep "bash.*xxx.sh" | grep -v grep | awk '{print $1}' | grep -v "^$$\$")
if [ -n "$other_pids" ]; then
    log_warning "⚠️  检测到多实例，正在清理..."
    for p in $other_pids; do kill "$p" 2>/dev/null; done
    sleep 2
    for p in $other_pids; do kill -0 "$p" 2>/dev/null && kill -9 "$p" 2>/dev/null; done
    sleep 1  # 等旧进程 trap 执行完毕
fi
```

---

## PID 文件管理

写入：`echo $$ > "$PID_FILE"`

安全回收（trap 自检 `$$` 一致才删，防止旧进程 trap 误删新实例 PID）：
```bash
trap '[ -f "$PID_FILE" ] && [ "$(cat "$PID_FILE" 2>/dev/null)" = "$$" ] && rm -f "$PID_FILE"' EXIT INT TERM
```

---

## 完整启动骨架

```bash
#!/bin/bash
# ======================================
# XXX 守护进程
# ======================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null
LOG_FILE="${PROJECT_DIR}/xxx.log"
source "${PROJECT_DIR}/log_utils.sh"

# 多实例检测
PID_FILE="${PROJECT_DIR}/xxx.pid"
other_pids=$(ps -eo pid,args | grep "bash.*xxx.sh" | grep -v grep | awk '{print $1}' | grep -v "^$$\$")
if [ -n "$other_pids" ]; then
    for p in $other_pids; do kill "$p" 2>/dev/null; done; sleep 2
    for p in $other_pids; do kill -0 "$p" 2>/dev/null && kill -9 "$p" 2>/dev/null; done; sleep 1
fi

echo $$ > "$PID_FILE"
trap '[ -f "$PID_FILE" ] && [ "$(cat "$PID_FILE" 2>/dev/null)" = "$$" ] && rm -f "$PID_FILE"' EXIT INT TERM

log_info "======================================"
log_info "🚀 XXX 守护进程启动 (PID=$$)"
log_info "======================================"

while true; do
    # 业务逻辑
    sleep 60
done
```

---

## Crontab 保活

```cron
# 开机后等 60 秒启动（等网络就绪）
@reboot sleep 60 && bash /path/to/scripts/daemon.sh start >> /path/to/scripts/daemon_cron.log 2>&1

# 每 5 分钟检查存活
*/5 * * * * bash /path/to/scripts/daemon.sh status 2>/dev/null | grep -q "未运行" && bash /path/to/scripts/daemon.sh start >> /path/to/scripts/daemon_cron.log 2>&1
```

---

## 日志清理（annual_scheduler.sh 范式）

每月 1/15 号 00:01（避开整点洪峰），保留 15 天，用 `last_cleanup_month` 防重复：

```bash
if { [ "$current_day" = "01" ] || [ "$current_day" = "15" ]; } && [ "$current_time" = "00:01" ]; then
    if [ "$last_cleanup_month" != "$current_month-$current_day" ]; then
        clean_old_logs "${PROJECT_DIR}" 15
        last_cleanup_month="$current_month-$current_day"
        sleep 120
    fi
fi
```

日志清理集中在 `annual_scheduler.sh`，不分散到各守护进程——方便统一管理保留策略。

---

## 自检命令

改完脚本跑下列三条，结果应全部为空：

```bash
# 1. 冗余 log_utils 加载（source 了但没用）
for f in $(find scripts -maxdepth 2 -name "*.sh" ! -name "*.bak"); do
    loaded=$(grep -c "source.*log_utils" "$f")
    used=$(grep -cE "log_info|log_success|log_warning|log_error|log_debug|log_duration|log_separator" "$f")
    [ "$loaded" -gt 0 ] && [ "$used" -eq 0 ] && echo "⚠️  冗余 log_utils: $f"
done

# 2. echo 违规（用 echo 输出日志）
grep -rn --include="*.sh" -E '^\s*echo\s+"[^$]' scripts/ \
  | grep -v "update-tools/" | grep -v "inspirational_quotes\|get_zodiac_sign"

# 3. 守护进程反模式
grep -rn --include="*.sh" -E 'pgrep -f' scripts/
grep -rn --include="*.sh" -E "trap '.*rm -f.*PID" scripts/ | grep -v '\$(cat'
```
