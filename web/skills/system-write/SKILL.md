---
name: system-write
description: 改系统数据的写操作套路：update_config 改 .env 键、manage_cache 覆盖数据库缓存条目、manage_webhook 增删改机器人；用户说「把配置改成 / 把缓存换成 / 加个机器人」时加载
effect: mutation
permissions:
  - config:edit
  - cache:edit
  - webhook:edit
tools:
  - update_config
  - manage_cache
  - manage_webhook
---

# 系统写操作（配置 / 缓存 / 机器人）

## 什么时候用

用户要**改动**系统配置、缓存条目（Web「缓存文件」页背后的数据库条目）或企微机器人。只看不改走 `query_config` / `query_cache` /
`query_webhooks`（business-query 技能），不用加载本技能。

## update_config：改 web/.env

- 只能改**已存在**的键：凭空新增会被拒绝（配置写错可能让服务起不来）；不确定键名先 `query_config`
- `value` 传空串表示清空该配置
- 敏感键（KEY / SECRET / TOKEN / PASSWORD / WEBHOOK）写入后只回显脱敏值，不要追问原文
- **多数配置要重启 Web 才生效**：改完必须提醒用户，重启需用户明确同意（会中断当前会话）

## manage_cache：覆盖数据库缓存条目

- `action` 只有 `write`：必传 `filename`（缓存键，`.json` 结尾，可带子目录，如 `api_responses/xxx.json`）与 `content`（JSON 字符串或对象）
- 只能改**已存在**的缓存条目，不能新建；不确定缓存键先 `query_cache` 不带参数看列表
- **不可撤销**：写之前跟用户复述要改哪个缓存条目、影响什么
- 改角色 / 用户授权用 `manage_rbac`，不要绕过权限码直接改数据库 `hp_roles` / `hp_users`

## manage_webhook：企微机器人增删改

| action | 必填 | 说明 |
|--------|------|------|
| `create` | `name` + `url` | 新增机器人 |
| `update` | `id` | 再传要改的 `name` / `url` / `style` |
| `delete` | `id` | **不可恢复**，动手前先跟用户确认删的是哪一个 |

- `id` 形如 `webhook_xxx`：不确定先 `query_webhooks` 查清单，**不要用名称猜 id**
- `url` 必须是完整地址：带 `*` 的脱敏串会被拒绝保存

## 纪律（不遵守就会出错）

- 【审批】严格模式下本技能三类工具都不当场执行，系统自动建审批单：只回 `approval_id`，
  说明需超级管理员在「AI 审批」页通过，不要反复重试
- 【先查后写】配置键 / 缓存键 / webhook id 三样都先查再写，禁止猜
- 【影响面先说】改配置会影响全局行为、删机器人会让相关规则推送失败——动手前说清楚
- 【反馈】完成后回显改了什么（哪个配置键 / 哪个缓存条目 / 哪个机器人），不要只说"已修改"
