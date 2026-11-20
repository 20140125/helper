---
name: external-lookup
description: 查外部公开信息：联网搜索（engine/recency 取值）、IP 归属地与出口 IP、短句翻译；站内工具覆盖不了、用户问「搜一下 / 最新动态 / 这个 IP 哪的 / 帮我翻译」时加载
effect: read
permissions:
  - ai-web-search:view
  - cache:view
tools:
  - web_search
  - query_ip
  - translate
---

# 外部信息查询

## 什么时候用

问题属于**站外公开信息**且站内工具查不到：新闻、行情背景、技术资料、IP 归属、翻译。
系统自身的状态 / 规则 / 日志 / 缓存**禁止**走这里，用对应 `query_*` 工具。

## web_search：联网搜索

| 参数 | 取值 |
|------|------|
| `query` | 检索词或自然语言问题（必填） |
| `engine` | `search-std`（默认，性价比高）/ `search-pro`（质量更高）/ `search-pro-quark` / `search-pro-sogou`（特定渠道） |
| `count` | 返回条数，默认 5，最大 10 |
| `recency` | `oneDay` / `oneWeek` / `oneMonth` / `oneYear` / `noLimit`（默认）；问"今天 / 最新"类问题传 oneDay 或 oneWeek |

## query_ip：IP 归属

不传 `ip` 查**本机出口公网 IP** 及其归属；传入则查该 IPv4/IPv6 的国家 / 地区 / 城市 / 运营商 / 时区。
数据源为免费公开接口（ip-api.com / bigdatacloud），无需 Key。
问"我的公网 IP / 这个 IP 哪的 / 访问来源是哪"时用它，**禁止凭模型知识猜归属**。

## translate：短句翻译

`text`（必填，≤500 字符，超长会被拒绝——长文请分段调用）、`target`（默认 `zh-CN`，译英文填 `en`）、
`source`（默认 `auto` 自动识别）。适合翻译报错信息、英文标题、接口返回的英文内容；
不是文档级翻译工具，不要拿它翻整篇文章。

## 纪律

- 【站内问题不走外网】问"系统怎么样 / 有哪些规则"时禁止用 web_search 凑答案
- 【优先级】先内部工具 → 再 web_search → 最后才是模型知识，顺序不能倒
- 【失败如实】外部接口失败就说"查询失败"，不要换模型知识顶上
