---
name: reminder-rules
description: 新建 / 改 / 停用 / 删除提醒规则的套路与字段口径；用户说「加一条提醒、把某条提醒改到几点、停掉某提醒」时加载
effect: mutation
permissions:
  - rules:edit
tools:
  - create_rule
  - manage_rule
  - query_rules
---

# 提醒规则增删改

## 什么时候用

用户要**改动**提醒规则（新建、改时间、停启用、删除）。只是问"有哪些规则"用 `query_rules`，不用加载本技能。

## 新建：create_rule（先预览，再确认）

必填 `name`、`type`、`time`；`message` 与 `template_id` 至少给一个。

**两步确认（默认流程）**：
1. 把用户原话解析成字段，先以 `preview: true` 调用 `create_rule`（只解析、不写入、不建审批单），把返回的 `preview` 原文展示给用户，问「是否按这个建？」
2. 用户确认后，用**完全相同的字段**并带上返回的 `preview_token` 再次调用 `create_rule` 正式写入。字段与预览不一致会被拒绝；token 10 分钟内有效且只能用一次。
3. 用户明确说「直接建 / 不用确认」时才可跳过预览；严格模式下第 2 步仍会建审批单，按既有审批流程等超管通过。

`type` 与 `condition` 的搭配：

| type | condition | 例 |
|------|-----------|-----|
| `daily` | 不填 | 每天 09:00 |
| `workday` | 不填 | 每个工作日 09:00（按节假日配置判） |
| `weekday` | 1-7 | `condition: "5"` = 每周五 |
| `monthly` | 日号 | `condition: "15"` = 每月 15 号 |
| `date` | MM-DD | `condition: "12-25"` = 每年 12 月 25 日 |
| `lunar_date` | 农历日期 | 农历生日 |
| `countdown` | 目标日期 | 倒计时 |

`time` 必须是 24 小时制 `HH:mm`。

**推实时数据 / 卡片必须用 `template_id`**（到点由脚本取最新数据再推），不要把当下查到的数值写死进 `message`——那样以后每天推的都是旧数据。

常用 `template_id`：

- 天气：`weather_card_gen`、`weather_alert_card`、`air_quality`
- 日历：`calendar`、`almanac_card`
- 财经：`stock_market`、`hk_stock`、`us_stock`、`exchange_rate`、`gold_silver`、`oil_price_card`、`crypto_price`
- 新闻：`ai_news_card`、`ent_news`、`intl_news`、`weibo_hot`
- 影视：`bilibili_hot`、`tencent_hot`、`iqiyi_hot`、`douyin_hot`
- 科技：`github_trending`、`steam_hot`、`earthquake`
- 生活：`daily_word`、`history_today`、`daily_wallpaper`、`horoscope_card`、`holiday_nager`
- 提醒类：`morning`、`lunch`、`evening`、`breakfast`、`dinner`、`weekend`、`birthday`、`holiday`、`update_report`

`output_mode`：默认 `text`（数据文本）；用户明确要"图片 / 卡片"才传 `card`。

## 改 / 停用 / 删除：manage_rule

`action`：`update`（只传要改的字段）、`toggle`（`enabled` 不传则取反）、`delete`（不可恢复）。

**必须要有 `rule_id`**：不确定就先 `query_rules` 查清单拿 id，不要用名称猜。删除前跟用户确认是哪一条（报出规则名与时间）。

## 纪律（不遵守就会出错）

- 【定时推送 ≠ 立即推送】建完规则就结束，**禁止**再调 `send_wecom_message` 补发一条，否则用户在设定时间之前就收到了
- 【审批】严格模式下本类操作不当场执行，系统自动建审批单；只回 `approval_id` 并说明需超级管理员在「AI 审批」页通过，不要反复重试
- 【文案】企微不支持表格，`message` 用列表排版；不要编造 `{xxx}` 占位符，自定义 `message` 会原样发送
- 【反馈】创建/修改成功后，把规则名、触发时间与生效状态回给用户，不要只说"已创建"
