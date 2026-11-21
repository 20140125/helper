---
name: tool-router
description: 语义选工具总表：意图→该用哪个工具、易混边界、副作用/审批分流；多步、易混或写操作前先加载它
effect: read
tools:
  - query_knowledge
  - query_knowledge_docs
  - manage_knowledge
  - query_project_map
  - read_project_file
  - query_system_status
  - query_service_status
  - query_config
  - query_logs
  - query_rules
  - manage_logs
  - manage_service
  - card_skill
  - web_search
  - create_rule
  - send_wecom_message
  - load_skill
  - delegate_task
---

# 工具语义路由

## 什么时候用

用户的问题**不是单条简单查询**，或出现以下任一情况时，先 `load_skill('tool-router')` 再动手：

- 意图模糊，不知道该查哪个工具
- 涉及多个工具、跨数据源汇总
- 涉及写操作、推送、启停服务、审批
- 工具名相近，容易选错
- 需要「项目内知识 vs 外部搜索 vs 代码文件」的分流

单条明确查询（如「看一下服务状态」「查一下天气」）不必加载，直接调对应工具。

## 一级路由：意图 → 工具

### 项目自身怎么用 / 规范

- 「这个项目怎么用 / 怎么配置 / 开发规范 / 某个页面在哪」→ `query_knowledge`
- 「列出知识库文档 / 读某篇文档正文 / 重建索引」→ `query_knowledge_docs`
- 「把这段结论写进知识库 / 新建规范文档 / 导入 docs 文档」→ `manage_knowledge`
- 「看某个源码文件内容 / 目录结构」→ `read_project_file` / `query_project_map`
- `query_knowledge` 只覆盖 `docs/` 与 `knowledge/`；不覆盖内网 wiki、工单或外部系统

### 系统运行数据

- 「服务 / 端口 / PID / launcher」→ `query_service_status`
- 「CPU / 内存 / 磁盘 / 守护进程 / 缓存数量」→ `query_system_status`
- 「配置项现在是什么」→ `query_config`
- 「日志 / 报错 / 最近发生什么」→ `query_logs`
- 多步排障 → `load_skill('ops-troubleshoot')`，按「进程 → 主机 → 日志 → 配置 → 规则」顺序查

### 业务数据

- 「规则 / 模板 / 文案 / 权限 / Webhook / 页面清单」→ 对应 `query_rules` / `query_message_templates` / `query_reminder_quotes` / `query_rbac` / `query_webhooks` / `query_pages`
- 跨多个业务查询汇总 → `load_skill('business-query')`
- 「系统里有哪些技能 / 某类任务怎么操作」→ `load_skill`（不传 name 列清单，传 name 取说明书）

### 外部公开信息

- 天气、行情、新闻、热搜、黄历、星座等 → `card_skill` 取数/出图，或对应查询工具
- 仅当内部工具都拿不到、且问题确属外部公开信息时才用 `web_search`
- 禁止用 `web_search` 回答本系统自身的数据问题

### 写入 / 副作用

- 新建提醒规则、定时推送 → `load_skill('reminder-rules')` → `create_rule`
- 立即推企微消息 → `load_skill('wecom-push')` → `send_wecom_message`
- 改配置 / 清日志 / 改 RBAC / 改缓存 / 改知识库 → 对应 `manage_*` 工具；严格模式会自动建审批单
- 重启 / 启停服务 → `load_skill('ops-troubleshoot')` 先查事实，用户明确要求后才 `manage_service`

## 易混边界

| 场景 | 正确工具 | 不要这么做 |
|------|----------|-----------|
| 查 Web 服务 / PID / 端口 | `query_service_status` | 不要用 `query_system_status` 猜服务状态 |
| 查主机资源 / 守护进程 | `query_system_status` | 不要只看服务状态就判断主机正常 |
| 清日志 / 日志太多 | `manage_logs` | `manage_service` 重启服务清不掉日志 |
| 定时推送 | `create_rule` | 严禁再调 `send_wecom_message` 补发 |
| 立即推送已有结果 | `send_wecom_message` | 内容必须来自上游工具或用户原文，不能自造 |
| 查项目文档 / 规范 | `query_knowledge` | 不要用 `web_search` 查本项目内容 |
| 列文档 / 读正文 / 重建索引 | `query_knowledge_docs` | 不需要写权限，不会进审批队列 |
| 生成/编辑知识文档 | `manage_knowledge` | 不要直接写 `docs/` 系统文档，先 `import` 成用户文档 |
| 查代码文件 | `read_project_file` | 不要用 `query_knowledge` 查源码 |
| 只要卡片图片 | `card_skill` 不传 mode | 不要据此编造数值；要数值传 `mode='data'` |
| 多步排障 | `load_skill('ops-troubleshoot')` | 不要上来就重启服务 |
| 返回体冗长只要结论 | `delegate_task` | 不要把整段日志/大 JSON 拉回主会话 |
| 推企微消息排版 | 列表 / 引用 / 标题 | 企微不支持 Markdown 表格，别贴表格 |
| 「明天涨跌 / 彩票号码」等预测 | 直接说做不到 | 不能查个现价就自己推断未来 |
| 默认画架构图 | 先用 Markdown 画 | `card_skill` 默认出图只给图片地址，要数值传 `mode='data'` |

## 副作用与审批分流

- 需要 `user_consent_phrase`（必须摘录用户原话）：`send_wecom_message`、`trigger_script`、`manage_service`、`annual_update`
- 严格模式 `AI_STRICT_SIDE_EFFECTS=true` 下，增删改类工具自动建审批单，不当场执行：
  `create_rule`、`manage_rule`、`update_config`、`manage_rbac`、`manage_logs`、`manage_cache`、`manage_webhook`、`annual_update`、`manage_knowledge`
- 用户说「先别执行 / 等我确认 / 走审批」→ `request_approval`，不要当场执行
- 审批权归超级管理员；模型只能建单，不能声称已批准
- 意图模糊时先做无副作用的查询/生成，并在回答里说明还能做什么，不要反问拦截

## 参数与失败纪律

- 只传工具 schema 声明过的参数；不确定时先不传关键参数走清单模式（如 `query_logs` 不传 log_key 先看列表）
- 每条消息重新判断工具与参数，不复用上一轮的选择
- `ok=false` 时如实说明原因与下一步建议，不伪装成功、不换无关工具凑答案
- 内部工具返回空：如实说「查不到 / 查询失败」并给排查建议，不要改走联网搜索凑数
- 需要连续 3 次以上同类工具调用、或只需要从冗长结果里提炼结论 → `delegate_task`

## 动态工具裁剪说明

- 本轮实际可见工具已由系统按用户语义裁剪，`## 可用工具` 里列出的才是真正能调用的
- 本文档是完整路由表，里面提到的工具不一定全在本轮可见列表里
- 用户显式说出工具名、问「有哪些工具 / 工具路由」时会返回全量工具，不必担心被裁掉
- 若确实需要当前不可见的工具，提示用户换个说法重新提问，或在输入框固定选择该工具

## 回答纪律

- 结论先行，依据随后；两条及以上数据用列表或表格
- 不贴原始 JSON；工具没返回或无法确认的信息直接说「不确定」
- 提到系统页面时，路径必须取自 `query_pages`，输出 `[页面名](/path)` 相对链接
