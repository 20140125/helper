---
name: api-navigation
description: 接口管理与页面导航：list_apis 查预设接口、query_api_categories 查分类、query_pages 查页面入口路径；用户问「接了哪些接口 / 接口分几类 / XX 功能在哪个页面」时加载
effect: read
permissions:
  - api-management:view
  - api-category:view
tools:
  - list_apis
  - query_api_categories
  - query_pages
---

# 接口与页面导航

## 什么时候用

用户想知道系统**接入了哪些预设接口**（接口管理页配置的），或**某个功能在哪个页面**。
系统配置（.env）走 `query_config`，外部数据抓取走 `card_skill`。

## 接口管理

| 想知道 | 工具 |
|--------|------|
| 有哪些接口条目（id / 名称 / 方法 / 路径） | `list_apis`，`keyword` 按名称 / 描述 / 路径模糊过滤 |
| 接口分了哪些类、每类几个 | `query_api_categories`，`keyword` 按分类名 / 描述过滤 |

两个都只列**已配置**的接口元数据，不发起真实请求；要看接口原始返回用 `query_api_responses`
（log-audit 技能）。

## query_pages：页面入口

`keyword`（中文名 / 路径 / 用途）过滤，不传返回全部。返回每页的 `path`、中文名、
`in_menu`（是否在侧边栏可见）、所需权限、`covered_by_tools`（哪些贾维斯工具能直接代劳）。

**回答时必须遵守**：

- 入口写成 Markdown 链接 `[页面中文名](/path)`，一律相对路径，不要拼 `http://IP:端口` 完整地址
- `in_menu=false` 说明入口已收起：告诉用户「菜单里没有，直接访问 /xxx」
- `covered_by_tools` 非空时优先说「这事我可以直接帮你做」，页面入口只作兜底

## 纪律

- 【不编页面】path 只能取自 query_pages 返回值，凭印象写路径等于编造
- 【不发起真实调用】本技能的工具全是只读元数据，测接口连通性不在这里
