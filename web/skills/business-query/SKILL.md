---
name: business-query
description: 查系统里「配了什么」——规则、配置、消息模板、祝福语、提醒寄语、机器人、权限申请、工作日；用户问「有哪些 / 配了什么 / 内容是什么」时加载
effect: read
permissions:
  - rules:view
  - config:view
  - templates:view
  - greetings:view
  - reminder-quotes:view
  - webhook:view
  - rbac:requests:view
  - cache:view
tools:
  - query_rules
  - query_config
  - query_message_templates
  - query_greetings
  - query_reminder_quotes
  - query_webhooks
  - query_permission_requests
  - query_workday
---

# 业务配置查询

## 什么时候用

用户想知道系统里**当前配了什么**（而不是某个时刻的运行数据）：有哪些规则、模板长什么样、
机器人配了几个、某天要不要上班。单条查询（如"今天上班吗"）直接调工具即可，不必加载本技能；
要**跨多类配置**汇总、或不确定该用哪个工具时才加载。

## 查什么用什么

| 想查什么 | 工具 | 关键参数 |
|---------|------|---------|
| 自定义规则（触发时间 / 行为） | `query_rules` | `enabled_only: true` 只看启用的；要改规则先拿到 `rule_id` |
| 系统配置（`.env`） | `query_config` | `keyword` 按键名模糊过滤（`LLM` / `EMAIL` / `CITY`）；敏感值自动脱敏 |
| 消息模板 | `query_message_templates` | 不传 `type` 出类型清单 → 传 `type` 出风格预览 → `type`+`style` 出全文 |
| 节日祝福语 | `query_greetings` | `group`（`solar_terms` 节气 / `holidays` 节日 / `lunar_festivals` 农历节日 / `special_days` 特殊日子 / `birthday` 生日模板）、`keyword`、`limit`（≤50） |
| 提醒寄语 | `query_reminder_quotes` | `bucket_keyword`（`breakfast` / `weekend` 等）、`limit`（≤100） |
| 企微机器人 | `query_webhooks` | 无参数；URL 一律脱敏，不要追问 key |
| 权限申请 | `query_permission_requests` | `status`（默认 `pending`，另有 `approved` / `rejected` / `all`）、`email` 模糊匹配 |
| 工作日 / 调休 / 假期 | `query_workday` | `date`（`YYYY-MM-DD`，默认今天）、`days`（连续天数，≤31） |

## 步骤

1. 判断属于上表哪一类，**只查需要的那一类**，不要把八类全查一遍
2. 取值不确定时先走清单模式（不传关键参数）确认有哪些取值，再精确查
3. 汇总作答：结论先行，数据用列表或表格，依据放在结论之后

## 纪律

- 查不到就说"查不到"并给排查建议，不要用模型知识编造配置内容
- 返回里 `truncated: true` 表示还有更多，如实告知条数并建议加过滤条件，别假装是全部
- 不贴原始 JSON，提炼成人话；敏感配置只说"已配置 / 未配置"，脱敏值不复述
- 本技能覆盖的全是只读工具：用户要改配置、改规则，需另走 `update_config` / `manage_rule`，
  且严格模式下会先建审批单
