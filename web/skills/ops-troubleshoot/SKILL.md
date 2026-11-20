---
name: ops-troubleshoot
description: 服务起不来、脚本没跑、提醒没发的排障套路：按「进程 → 主机 → 日志 → 配置 → 规则」五步定位，别上来就重启
effect: read
permissions:
  - dashboard:view
  - daemon:view
  - web-service:view
  - logs:view
  - config:view
  - rules:view
tools:
  - query_system_status
  - query_service_status
  - manage_service
  - query_logs
  - query_config
  - query_rules
---

# 运维排障

## 什么时候用

用户报"服务挂了 / 脚本没执行 / 提醒没发 / 某个功能没生效"。按下面的顺序查，
**先把事实查全再下结论**，不要第一轮就猜原因或直接重启。

## 五步法

1. **进程**：`query_service_status` —— 9527 主服务与 3001 launcher 存活状态与 PID
2. **主机**：`query_system_status` —— 内存 / 磁盘占用、运行时长、
   提醒守护进程 `reminder_daemon` 与年度调度进程 `annual_scheduler` 是否在跑、缓存文件数量
3. **日志**：`query_logs` —— 先不传 `log_key` 拿到可用日志清单（含中文名），
   再读具体日志末尾 N 行（`lines` 默认 50、最大 500；`log_key` 传中文名也认）
4. **配置**：`query_config` —— 用 `keyword` 过滤（`LLM` / `EMAIL` / `CITY`），确认关键项有没有配
5. **规则**：`query_rules` —— 确认触发时间与启用状态（`enabled_only: true` 只看启用的）

日志很长、只要结论时，用 `delegate_task` 让子 Agent 提炼，别把整段日志拉回主会话。

## 症状 → 大概率原因 → 下一步

| 症状 | 先怀疑 | 下一步 |
|------|--------|--------|
| 页面打不开 / 9527 不通 | Web 进程没起来 | 看 launcher 是否存活；要重启必须用户明确要求（会中断当前会话） |
| 提醒到点没发 | `reminder_daemon` 未运行，或规则未启用 | 查 `query_system_status` + `query_rules` |
| 提醒发了但内容不对 | 模板或文案配置 | `query_message_templates` / `query_reminder_quotes` |
| 脚本报失败 | 脚本自身执行错误 | `query_logs` 找对应日志看末尾报错 |
| 卡片出不来 | 外部接口抓取失败或 Key 未配置 | `query_config` 看 `LLM` / 接口相关配置（只说已配置与否） |

## 纪律

- 本技能覆盖的全是**只读**工具：重启、改配置、清日志都不在本技能范围内
- 重启需用户明确说出意图并给 consent；增删改在严格模式下会自动建审批单，不要反复重试
- 重启 Web 会中断当前会话，动手前必须提醒用户
- 只报查到的事实：进程状态、资源数值、日志原文摘要；查不到就如实说"查不到"，不猜
