# Shell 脚本开发规范摘要

本文件是 helper 项目 `scripts/` 目录 Shell 规范的可检索摘要，供贾维斯 / `query_knowledge` 回答“怎么写脚本、怎么拆分、怎么发消息、守护进程怎么写、卡片脚本有什么约束”时使用。

**完整规范以 `.codebuddy/skills/helper-scripts-spec/references/` 为准。** 本摘要只保留高频、项目特有、容易漏的规则。CodeBuddy IDE 在改 `scripts/` 下任何文件时会自动按场景加载对应 skill 文档。

## 适用范围

- 所有 `scripts/` 下的 `.sh` 脚本：主脚本、子工具、子模块、守护进程。
- `scripts/tools/` 下的信息卡片脚本有额外约束，见本文件“信息卡片脚本”章节。
- 纯数据工具如果只用 `echo` 输出供 `$()` 捕获，不加载 `log_utils.sh`，避免污染 stdout 数据通道。

## 文件头与路径初始化

文件头统一 38 个 `=` 分隔线，作者统一“智能提醒系统”，包含功能说明、使用方式、更新日期。

主脚本路径初始化：

- `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`
- `source "${SCRIPT_DIR}/project_config.sh"`

`update-tools/` 子工具脚本：

- 先设 `SCRIPT_DIR` 和 `_SELF_DIR`
- 再 `source "${SCRIPT_DIR}/../project_config.sh"`

`project_config.sh` 提供 `PROJECT_DIR`、`ROOT_DIR`、`CACHE_DIR`、`ENV_FILE`（其中 `CACHE_DIR` 仅保留给一次性迁移/兼容用途，脚本运行时通过 `scripts/cache_db.sh` 按缓存键读写数据库，不再读写 `.cache/` 文件）。环境变量文件优先级是 `web/.env` 优先，缺失时才回退 `scripts/.env`，Web 服务和脚本读同一份配置。

## 配置加载顺序

固定顺序不可乱：

1. `weather_config.sh`：TZ、Webhook、`JUHE_*_KEY`
2. `holiday_config.sh`：节假日判断
3. `LOG_FILE="${PROJECT_DIR}/脚本名.log"`（仅作来源标识，日志已入库，不再落文件）
4. `log_utils.sh`
5. 其他业务配置

子工具脚本避免覆盖父脚本日志：

`if [ -z "$LOG_FILE" ]; then LOG_FILE="${_SELF_DIR}/脚本名.log"; fi`

## 按需加载

不使用就不 source，减少启动开销和副作用：

- `project_config.sh`：所有脚本
- `weather_config.sh`：用到 `send_wecom_message`、`WECOM_WEBHOOKS`、`JUHE_*_KEY`、`TZ` 时
- `holiday_config.sh`：用到 `is_holiday`、`is_workday`、`is_adjust_workday`、`HOLIDAYS_YYYY` 时
- `log_utils.sh`：调用任一 `log_*` 函数时
- `cache_db.sh`：需要按缓存键读写缓存 JSON 时（缓存数据以数据库为唯一真源，运行时不再读写 `.cache/` 文件）
- `template_utils.sh`：调用 `get_message`、`load_template`、`render_template` 时
- `greetings_loader.sh`：调用 `get_*_greeting` 时
- `inspirational_quotes.sh`：调用 `get_quote_*` 时

模块化脚本的判定要覆盖主脚本和所有同名子目录。

## 日志规范

用 `log_utils.sh` 而不是直接 `echo` 输出日志。

常用函数：

- `log_info`：普通信息
- `log_success`：成功
- `log_warning`：警告
- `log_error`：错误，必须写清具体原因
- `log_debug`：调试，仅 DEBUG 级别
- `log_duration`：耗时，超过 5000ms 自动升级为 WARNING
- `log_separator`：分隔线

环境变量：`LOG_FORMAT`（text/json，仅影响终端输出）、`LOG_FILE`（仅推导 `source`）、`LOG_LEVEL`、`LOG_RETENTION_DAYS`。

每条日志同时输出到 stderr 并写入 `hp_run_logs`；`log_db.sh` 负责读 `web/.env` 的 `DB_*`、转义与 INSERT。入库失败静默降级为仅 stderr，绝不阻塞业务。文件轮转（`LOG_MAX_BYTES` / `LOG_KEEP`）已移除。

 macOS 兼容注意：毫秒时间统一用 `now_ms()`，不要直接写 `date +%s%3N`；BSD date 不支持 `%3N`，会输出带 `N` 的字符串并导致算术运算报错。

## 函数与变量

- 函数上方写注释：功能、参数（`$1`、`$2`）、返回码。
- 函数内部变量一律 `local`，避免污染全局作用域。
- 参数赋值用具名变量，不要裸用 `$1`、`$2`。
- 默认值写 `${参数:-默认值}`。

## 主入口与启动结束日志

主脚本统一用 `main "$@"`。

启动日志格式：

- 38 个 `=` 分割线
- `🚀 脚本名启动`
- `📅 当前时间: ...`
- 38 个 `=` 分割线

成功：`log_success "脚本执行完成"` + 分割线。  
失败：`log_error "具体原因"` + 分割线 + `exit 1`。

分割线字符：代码区块 / 日志启动结束用 38 个 `=`；企微消息视觉分隔 / 日志子步骤用 38 个 `━`。

## 消息发送规范

- 用 `send_wecom_message`，不要手写 HTTP 请求散落在各处。
- 消息内容通过 `python3` 做 JSON 转义，直接拼接 JSON 遇到引号/换行会破坏结构。
- 发送结果必须检查 `"errcode":0`。
- Webhook 未配置时 `log_error` + `return 1`。
- 消息统一 Markdown：头部含标题和时间，尾部固定签名 `💡 *此消息由智能提醒系统发送*`。
- 多行内容推荐 heredoc。

模板系统使用 `template_utils.sh`：

- `get_message(type, style, key=value...)`
- `load_template(type, style)`
- `render_template(template, key=value...)`

模板渲染失败时用 `printf` 构建兜底消息。

## 模块化拆分

复杂脚本采用“主脚本 + 同名子目录”：

- 主脚本负责配置加载、`main()`、路由。
- 子模块放业务函数，不设置自己的 `SCRIPT_DIR` 和 `LOG_FILE`。
- 子模块需要独立日志时，在 `cmd_xxx()` 内单独设置 `LOG_FILE` 并 source `log_utils.sh`。

拆分阈值：

- 主脚本超过 300 行：必须拆分
- 有 3 个以上独立函数组：建议拆分
- 2 个以上脚本含重复逻辑：抽取工具脚本

拆分目标：主脚本和子模块都尽量控制在 200 行以内。

## 子命令路由

大型脚本用 `case` + `cmd_xxx()`：

- 入口函数统一 `cmd_` 前缀
- 支持别名，例如 `holiday|check)`
- 未知参数输出用法并 `exit 1`
- `auto` 子命令用 `exec "$0" <子命令>` 自递归，避免嵌套 case，保持日志与 PID 干净

入口模式选择：

- 简单单职责脚本：`main "$@"`
- 功能单一但逻辑复杂：`main "$@"` + 子目录
- 多子命令：`case` + `cmd_xxx()` + 子目录
- 兼做函数库和命令行：`BASH_SOURCE guard` + `case` + 子目录

## 子工具与 CLI

`update-tools/` 子工具命名用“功能动词 + 对象”，下划线分隔，例如 `get_holidays.sh`。

子工具规范：

- 核心业务与 `main` 分离
- 通过退出码 `exit 0` / `exit 1` 向父脚本传递状态
- 不直接修改父脚本变量，通过文件传递数据
- 参数不足输出用法和示例
- 可选参数用 `${参数:-默认值}`
- Python 调用统一 `python3`

Dry-run 模式：

- 全局 `DRY_RUN`，默认 `false`
- 所有发送经过 `do_send_message()`
- 同时接受 `dry-run` 和 `dryrun`

Source/执行双模式：

- 函数定义无论 source 还是执行都加载
- 直接执行时才通过 `main "$@"` 处理 CLI
- 用 `if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi` 判断

## 守护进程规范

守护进程必须解决多实例和 PID 竞态。

多实例检测：

- 用 `ps -eo pid,args | grep ... | grep -v grep`，不要用 `pgrep -f`
- `pgrep -f` 会匹配自身命令行，导致误判

PID 管理：

- 启动时 `echo $$ > "$PID_FILE"`
- trap 回收前必须自检 PID 文件内容等于 `$$`，防止旧实例误删新实例 PID

Crontab 保活：

- `@reboot` 延迟 60 秒启动
- `*/5 * * * *` 检查存活，未运行才拉起

日志清理：

- 集中在 `annual_scheduler.sh`，不要分散到各守护进程
- 每月 1/15 号 00:01 清理
- 用 `last_cleanup_month` 防止重复执行

## 信息卡片脚本

`scripts/tools/` 下的信息卡片脚本有特殊约束：

- 必须 source `card_utils.sh`，不要手写 SVG 公共结构。
- 常用 API：`svg_header`、`svg_list_row`、`svg_footer`、`calc_list_height`、`render_card`、`fetch_url`、`get_date_str`。
- 输出目录统一 `CARD_OUTPUT_DIR`，即 `web/public/skill-images/`。
- 成功时 stdout 只输出一行 PNG 路径，失败输出 `FAILED`。
- 打印 PNG 路径必须裸 `echo "$OUTPUT_FILE"`，不能用 `log_*` 包装。
- `log_*` 写 stderr 并入库，不产生日志文件，也不会污染 stdout。
- SVG 禁止 emoji，用 Unicode 几何字符或实体引用。
- 所有 `date` 显式加 `TZ=Asia/Shanghai`。
- XML 特殊字符 `& < > " '` 拼进 SVG 前必须转义。
- 业务闸门（工作日才推、价格变动才推）由 cron 外层控制，脚本本身“调我就出图”。

## macOS 兼容踩坑

这是实际踩过的坑，完整 skill 文档未必收录：

- 毫秒时间戳统一用 `now_ms()`；不要直接用 `date +%s%3N`。
- JSON 字段提取用 `api_archive.sh` 的 `json_get_string` / `json_get_number`；不要用 GNU 专有 `grep -oP` 和 `\K`。
- 正则提取优先用 `grep -Eo`、`sed -E`，避免 GNU 专有语法。
- 聚合数据接口在 macOS 上曾因上述两点被整体误判为失败，实际 Key 是正确的。

## 自检命令

改完脚本后跑三类自检：

1. 冗余加载：source 了 `log_utils.sh` 但没调用任何 `log_*`
2. `echo` 违规：用 `echo` 输出日志（数据协议工具和卡片脚本 stdout 路径除外）
3. 守护进程反模式：`pgrep -f`、trap 删除 PID 前未自检

完整命令见 `.codebuddy/skills/helper-scripts-spec/references/06-daemon.md` 文末。

## 完整规范索引

- `01-basics.md`：文件头、路径初始化、配置加载、按需加载、log_utils
- `02-function-style.md`：函数注释、变量、主入口、启动结束日志、分割线
- `03-messaging.md`：企微消息、JSON 转义、模板系统
- `04-modular.md`：主脚本 + 同名子目录、cmd 路由、auto 递归、拆分阈值
- `05-tools.md`：子工具脚本、CLI 参数、dry-run、source/执行双模式
- `06-daemon.md`：守护进程、多实例、PID trap、crontab 保活、日志清理、自检命令
- `07-info-cards.md`：卡片脚本、`card_utils.sh`、stdout 路径契约、SVG 渲染坑

完整路径前缀：`.codebuddy/skills/helper-scripts-spec/references/`。

## 维护原则

本摘要是检索入口，不是规范唯一真相源。若完整规范更新，应同步更新本摘要；若两者冲突，以 `.codebuddy/skills/helper-scripts-spec/references/` 下的完整文档为准。
