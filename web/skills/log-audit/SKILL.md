---
name: log-audit
description: 查日志、数据库缓存条目、外部接口原始响应来定位问题；用户问「最近有没有报错 / 某次为什么没发 / 接口返回了什么」时加载
effect: read
permissions:
  - logs:view
  - cache:view
tools:
  - query_logs
  - query_cache
  - query_api_responses
  - manage_logs
---

# 日志与缓存排查

## 什么时候用

要**回溯发生过什么**：脚本有没有报错、某次提醒为什么没发、外部接口到底返回了什么。
查当前进程 / 资源状态用 `ops-troubleshoot`，不要在这里绕。

## 三条数据通道

| 想看什么 | 工具 | 参数 |
|---------|------|------|
| 运行日志 | `query_logs` | 不传 `log_key` 先列出 `hp_run_logs` 里实际存在的来源（`source / rows / bytes / latest`）；再传清单里的 `source` 原值读末尾 N 行（`lines` 默认 50，最大 500） |
| 缓存条目（数据库，按缓存键） | `query_cache` | `target`：`holiday`、`permission_metas`、`permission_requests`、`rbac`、`api_categories`、`message_templates`、`month_config`、`greetings`、`daily_data`、`api_response`、`users`、`daemon_sent_state`；不传 `target` 出清单 |
| 外部接口原始响应 | `query_api_responses` | 查脚本抓回来的接口原始返回 |

已配了专用工具的数据**不要**用 `query_cache` 绕一遍：规则走 `query_rules`、
提醒寄语走 `query_reminder_quotes`、接口清单走 `list_apis`。

## 步骤

1. 先确定时间范围与对象（哪天、哪个脚本 / 哪类提醒）
2. 不确定日志有哪些 → 先 `query_logs` 不传参看清单，再读具体日志
3. 判定"有没有发" → 看 `daemon_sent_state`（守护进程发送状态）
4. 日志很长、只要结论 → 用 `delegate_task` 让子 Agent 提炼，别把整段日志拉回主会话
5. 想快速定位接口请求 → Web「运行日志」页列表已直接显示请求地址（`GET /api/xxx`，由 `context.method/url` 解析），可先在页面定位再回工具读正文

## 清空日志（manage_logs，高危）

`action`：`clear`（清空单个，必传清单里的 `source` 原值）、`clear_all`（清空库里全部有记录的来源）。

- 清空的是 `hp_run_logs` 里对应 `source` 的库记录，目标来自 `GROUP BY source` 聚合
- 清空后运行中的脚本仍会继续写入新记录，`clear_all` 不会删除表结构
- **不可恢复**：动手前先说清会清掉哪些日志、体积多大，用户确认后再做
- 严格模式下会自动建审批单，只回 `approval_id`，不要反复重试

## 纪律

- 只报**原文里有的**时间、级别、报错摘要；日志里没有就如实说"这段日志里没有相关记录"，不推测原因
- 引用报错保留关键行（时间 + 级别 + 消息），不要整段贴
- `lines` 只影响末尾行数：没找到目标就加大行数或换日志，不要换工具硬凑
- 排查阶段全为只读；清空是独立的写操作，只在用户明确要求"清一下日志"时才做
