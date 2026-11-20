---
name: card-skill
description: 出信息卡片与取外部实时数据（天气/热搜/行情/黄历/汇率…）的 card_skill 完整用法：技能 key、mode 取值、多榜单参数、别名与常见踩坑
effect: action
permissions:
  - skill-map:view
  - skill-map:edit
tools:
  - card_skill
---

# 卡片与数据技能（card_skill）

## 什么时候用

用户要看**外部实时数据**（天气、热搜、行情、黄历、汇率、运势…）或要一张**卡片图**。
查系统自身配置（规则 / 模板 / 日志）不走这里，走 `query_*` 系列。

## 三个模式

| 用法 | 参数 | 拿到什么 |
|------|------|---------|
| 看清单 | 不传 `skill_key` | 全部可用技能：key / 分类 / 是否出图 / 声明的 params |
| 出图 | `{ skill_key }` | PNG 图片地址，**看不到具体数值** |
| 看数据 | `{ skill_key, mode: "data" }` | 脚本抓到的原始数据（榜单第一名在开头） |

**用户要看具体数值（"上证多少点""热搜第一条是什么""黄金涨了多少"）必须传 `mode: "data"`**；
只传 `skill_key` 会去渲染图片，你只能拿到图片地址，回答不出数值。用户明确要图片时才不传 `mode`。

## 常用 key

- 天气：`weather_card_gen`（`city`）、`weather_alert_card`（`city`）、`air_quality`（`city`）
- 日历 / 老黄历 / 节气：**一律 `almanac_card`**（不要直译成 calendar / huangli）
- 财经：`stock_market`、`hk_stock`、`us_stock`、`exchange_rate`（`base`，如 EUR）、`gold_silver`、`oil_price_card`、`crypto_price`
- 新闻：`ai_news_card`、`ent_news`、`intl_news`、`weibo_hot`
- 影视（各平台独立技能）：`tencent_hot`、`iqiyi_hot`、`bilibili_hot`、`douyin_hot`
- 科技：`github_trending`、`steam_hot`
- 生活：`daily_word`、`history_today`、`horoscope_card`（`zodiac` + `period`）、`daily_wallpaper`、`holiday_nager`
- 图表：`diagram_card`（架构图 / 序列图，图结构 JSON 放 `params.spec`）
- 其它：`qrcode`（`params.content` 必填，`size` 可选 200/400/600/800/1000）、`commute`（`params.from` / `params.to`）

## 多榜单技能：点名了就必须传

用户点名某个分榜单时**必须**传对应参数，否则拿到的是含全部榜单的整份数据：

| 技能 | 参数 | 取值 |
|------|------|------|
| `tencent_hot` | `params.channel` | 电视剧 / 电影 / 综艺 / 动漫 / 少儿 / 纪录片 / 游戏 / 科技 |
| `douyin_hot` | `params.channel` | 热搜 / 热点 |
| `bilibili_hot` | `params.channel` | 置顶 / 热搜 |
| `weibo_hot` | `params.channel` | 要闻 / 热搜 |
| `steam_hot` | `params.category` | 热销 / 特惠 / 新品 / 即将推出 |

腾讯的**分榜单不是独立技能**：key 仍是 `tencent_hot`，榜单名走 `params.channel`。

## 纪律（不遵守就会报错）

- 【不要直译 key】`tencent_hot_search`、`weather` 这类直译会自动归一，但更稳妥的做法是先不传 `skill_key` 看清单
- 【不要复用上一轮的 key】每条消息重新选，别把"爱奇艺"当 keyword 塞给 `tencent_hot`
- 【未声明 params 就别传】给一个 `args=[]` 的技能传了 `params` 会被直接拒绝并提示——说明 `skill_key` 选错了，换 key 而不是加伪参数
- 【架构图默认用 Markdown】分层用表格、流程用 ```mermaid；只有用户明确要 PNG 或要推企微时才用 `diagram_card`
- 【只出图拿不到数值】`card` 模式下不要编数字，要数值就用 `mode: "data"`
- 【无权限】执行模式需要 `skill-map:edit`，清单模式 `skill-map:view` 即可
