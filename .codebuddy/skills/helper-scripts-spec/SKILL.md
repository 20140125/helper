---
name: helper-scripts-spec
description: "helper 项目 scripts/ 目录 Shell 脚本编写规范。Use this skill whenever the user mentions Shell scripts, bash scripts, script specifications, scripts directory, daemon processes, crontab, scheduled tasks, information cards, SVG rendering, log_utils, WeCom messages, modular splitting, source loading, path initialization, reminder scripts, or information card scripts in the helper project. 凡涉及 scripts/ 下任何文件——新建脚本、修改脚本、加提醒逻辑、修Bug、重构、规范审查——都先使用本技能。覆盖文件头规范、配置加载顺序、日志规范、企微消息、守护进程、信息卡片脚本编写。触发关键词：Shell脚本、bash脚本、脚本规范、scripts目录、守护进程、crontab、定时任务、信息卡片、SVG渲染、log_utils、企微消息、模块化拆分、source加载、路径初始化、提醒脚本、信息卡片脚本、shell scripting、bash scripting、script standards。"
---

# helper Scripts 编写规范

你是 helper `scripts/` 目录的 **Shell 脚本规范专家**。在 helper 项目下写或改任何 Shell 脚本都**必须**先遵循本规范。

## 参考文件

| 文件 | 内容 | 何时读 |
|------|------|--------|
| `references/01-basics.md` | 文件头、路径初始化、配置加载顺序、按需加载、log_utils v4.0 | **每次必读** |
| `references/02-function-style.md` | 函数定义、主入口模式、启动/结束日志、分割线 | 写新脚本 |
| `references/03-messaging.md` | 企微消息发送、JSON 转义、模板 | 脚本发消息 |
| `references/04-modular.md` | 主脚本+同名子目录、cmd_xxx 路由、auto 递归、拆分阈值 | 大脚本或拆分 |
| `references/05-tools.md` | 子工具脚本、CLI 参数、dry-run、双模式工具库 | 抽工具 |
| `references/06-daemon.md` | 守护进程：多实例检测、PID trap、crontab 保活、日志清理、自检 | 守护进程 |
| `references/07-info-cards.md` | `scripts/tools/` 信息卡片：`card_utils.sh` 公共库、stdout 路径契约、SVG 渲染坑 | 动 tools/ 下卡片脚本 |

## 核心规则（展开看 references）

1. **路径初始化**：`SCRIPT_DIR` + `source project_config.sh`
2. **日志**：用 `log_info/log_success/log_warning/log_error` 而非 `echo`——log_utils 支持日志级别、文件轮转和 JSON 格式
3. **配置加载顺序**：`weather → holiday → LOG_FILE → log_utils → 其他`
4. **按需加载**：未调用就不 source；纯数据输出工具不载 log_utils
5. **启动/结束横幅**：38 个 `=` 分割线 + 脚本名 + 时间
6. **消息发送**：`send_wecom_message` + `python3` JSON 转义 + 签名 `💡 *此消息由智能提醒系统发送*`
7. **模块化**：主脚本超 300 行或含 ≥3 独立函数组就拆分为「主脚本 + 同名子目录」；子模块不设 SCRIPT_DIR/LOG_FILE；`auto` 用 `exec "$0" <子命令>` 自递归
8. **守护进程**：
   - 多实例检测用 `ps -eo pid,args | grep ...`（`pgrep -f` 会匹配自身命令行，不可靠）
   - PID trap 先自检 `[ "$(cat PID)" = "$$" ]` 再删（防止旧进程 trap 误删新实例 PID）
   - crontab 需有 `@reboot` + `*/5 * * * *` 两条
9. **信息卡片脚本**（`scripts/tools/` 下）：必须 `source card_utils.sh` 复用渲染；成功时 stdout 只打印 PNG 路径（勿用 log_info）；不加载通用 log_utils；SVG 禁 emoji、`date` 带 `TZ=Asia/Shanghai`

> 每条规则的原因、写法、踩过的坑都在 references 里——动手前先读对应文件。

## 自检命令

一键自检见 `references/06-daemon.md` 文末《自检命令》小节（冗余加载 / echo 违规 / 守护进程反模式三类）。修改完跑一次。
