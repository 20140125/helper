---
name: info-cards
version: 2.1.0
description: "生成 1080px 深色风格 PNG 信息卡片并推送到企业微信。Use this skill whenever the user wants to generate information cards, render cards, push images to WeCom, or display real-time data as images. 触发关键词：卡片、信息卡片、生成图片、推送图片、出图、热搜榜、行情、天气预报、空气质量、星座运势、老黄历、新闻、股价、黄金、汇率、油价、GitHub Trending、Steam 热门。当用户希望把某一类实时数据『出成一张图 / 推一张卡片 / 渲染成卡片图片 / 发到群里』时使用本技能；覆盖天气预报、空气质量 AQI、日历农历、每日一言、星座运势、老黄历宜忌、AI 新闻、微博热搜、娱乐新闻、国际新闻、A 股/港股/美股大盘、黄金白银、汇率、今日油价、B 站/腾讯/爱奇艺/抖音热搜榜、GitHub Trending、Steam 热门游戏。注意：纯文字问答不要触发本技能，只在用户明确想要『图/卡片/推送』时启用。Make sure to use this skill when the user asks about generating cards, creating images, information visualization, or pushing to WeCom."
---

# 信息卡片推送系统

生成 1080px 宽、深色风格 PNG 信息卡片的脚本集合。脚本平铺在 `scripts/tools/` 下，每个脚本一次运行产出一张 PNG。

## 目录结构

**代码与知识分离**：脚本代码留在工程 `scripts/tools/`，SKILL 与 references 统一归到 `.codebuddy/skills/info-cards/` 以便 AI 按需加载。

### 代码区（工程内，运行时被 cron / AI 调用）

```
scripts/tools/
├── card.sh               # ★ 关键字路由统一入口（优先使用）
├── card_utils.sh         # 公共渲染库（source 引入，勿直接执行）
├── <业务脚本>.sh ...     # 30+ 个业务脚本，见下方路由表
└── <业务脚本>_card.png   # 脚本生成的 PNG（产物落盘到 web/public/skill-images/）
```

### 知识区（本目录，AI 按需读取）

```
.codebuddy/skills/info-cards/
├── SKILL.md              # 本文件（关键字路由表 + 使用方式）
└── references/
    ├── card-spec.md      # 卡片视觉规格、card_utils.sh API、SVG 坑位
    ├── dependencies.md   # 系统依赖、字体、环境变量
    └── schedule.md       # cron 定时任务、油价缓存、工作日判断
```

## 使用方式

**首选：统一路由入口 `card.sh`**（关键字 → 脚本的确定性映射，**优先使用**）：

```bash
bash scripts/tools/card.sh "<关键字>"   # 如："B 站热搜" / "今日油价" / "A 股大盘"
bash scripts/tools/card.sh --list        # 列出已注册关键字
bash scripts/tools/card.sh --help
```

`card.sh` 内部维护关键字表（与本文件下方的「关键字 → 脚本路由」同源），归一化大小写/空格后查表，命中即透传调用子脚本（注：实际是 `bash` 调用 + tee 捕获，并非 `exec`，以便在 stderr 落统一日志），stdout / 退出码 100% 透传。新增关键字或脚本时**两处同步修改**：先改 `card.sh::KEYWORD_MAP`，再同步本文件路由表。

**直接调用子脚本**（仅当用户明确点名、或 cron 定时场景）：

```bash
bash scripts/tools/<脚本名>.sh
```

成功：stdout 输出 PNG 绝对路径，退出码 0；失败：输出 `FAILED` 并以非零码退出。产出的 PNG 通过 `MEDIA: /path/to/xxx_card.png` 指令下发。

**两种触发通道并存**：

| 通道 | 触发方 | 闸门（工作日 / 价格变动 / ...） |
|------|--------|----------------------------------|
| cron 定时 | OpenClaw cron 配置 | 写在 cron 命令行（`is_cn_workday.sh && bash xxx.sh`） |
| AI 即时 | 用户对话命中 SKILL 关键字 | AI pipeline 自行判断，脚本无感 |

脚本本身永远是"调我我就出图"，闸门**不进脚本**。

## 日志与推送约定

- `log_utils.sh` **可以 source**——它的 `log_info/log_success` 走 stderr + `tools.log`，**不污染 stdout**，所以不会破坏上面的路径契约。实际 33 个脚本里 31 个都 source 了。
- **唯一硬约束**：最后那行写 PNG 路径到 stdout **必须是裸 `echo "$OUTPUT_FILE"`**——不能包 `log_*`（`log_*` 会加 `[时间] [INFO]` 前缀，而且 `_log` 写 stderr，调用方根本读不到）。
- 推送由 `card_utils.sh::send_card_image <png> [webhook_ids]` 统一完成，脚本内部别拼企微请求。

## 什么时候读哪份 reference

| 场景 | 读哪份 |
|------|--------|
| 新增 / 改一个卡片脚本、查 `card_utils.sh` 任何 API | **`references/card-spec.md`** |
| 脚本跑不出图、字体乱码、tofu、`rsvg-convert` 报错 | `references/dependencies.md` |
| 改定时任务、排查 cron、油价为什么没推 | `references/schedule.md` |
| 需要完整的 Shell 规范（文件头、配置加载、log_utils、模块化拆分等） | 同级 `../helper-scripts-spec/SKILL.md`，特别是 `references/07-info-cards.md` 专门对比了"卡片脚本"与"通用提醒脚本"的形态差异 |

新增卡片脚本时务必 `source card_utils.sh`，而不是自己手写 SVG 头尾——视觉一致性全靠它。

## 关键字 → 脚本路由

### 天气与生活

| 关键字 | 脚本 | 数据源 |
|--------|------|--------|
| 天气预报（自适应早/午/晚） | `weather_card_gen.sh` | wttr.in |
| 异常天气预警 | `weather_alert_card_gen.sh` | wttr.in |
| 空气质量 | `air_quality.sh` | WAQI |
| 日历提醒 | `calendar.sh` | APIHubs 农历 |
| 每日一言 | `daily_word.sh` | 金山词霸 + 一言 |
| 星座运势（today/tomorrow/week/month/year） | `horoscope_card.sh` | 聚合数据星座 |
| 老黄历（宜忌/五行/吉神凶煞） | `almanac_card.sh` | 聚合数据老黄历 |

### 新闻资讯

| 关键字 | 脚本 | 数据源 |
|--------|------|--------|
| AI 新闻 | `ai_news_card_gen.sh` | Hacker News |
| 热搜 | `weibo_hot.sh` | 今日头条 |
| 娱乐新闻 | `ent_news.sh` | 今日头条 |
| 国际新闻 | `intl_news.sh` | 今日头条 |

### 财经行情

| 关键字 | 脚本 | 数据源 |
|--------|------|--------|
| A 股大盘 | `stock_market.sh` | 腾讯财经（GBK→UTF-8） |
| 港股大盘 | `hk_stock.sh` | 腾讯财经 |
| 美股大盘 | `us_stock.sh` | 腾讯财经 |
| 黄金白银 | `gold_silver.sh` | 腾讯财经 / COMEX |
| 汇率 | `exchange_rate.sh` | ExchangeRate API |
| 今日油价 | `oil_price_card_gen.sh` | qiyoujiage.com |

### 平台热搜榜

| 关键字 | 脚本 | 数据源 |
|--------|------|--------|
| B 站热搜（哔哩哔哩 / bilibili 热搜） | `bilibili_hot.sh` | bilibili 热搜接口 |
| 腾讯热搜（腾讯视频热搜） | `tencent_hot.sh` | 腾讯视频热搜接口 |
| 爱奇艺热搜（iqiyi 热搜） | `iqiyi_hot.sh` | 爱奇艺热搜接口 |
| 抖音热搜（抖音 / douyin） | `douyin_hot.sh` | 抖音热搜接口 |

> 历史上的「影视综艺排行」（剧集/动漫/综艺 × 4 平台 = 12 个脚本）和「知识图谱」已下线，不要再以路由关键字暴露；如需恢复请先补回对应脚本再回 SKILL 注册。

### 科技 / 系统

| 关键字 | 脚本 | 数据源 |
|--------|------|--------|
| GitHub Trending | `github_trending.sh` | GitHub API |
| Steam 热门 | `steam_hot.sh` | Steam API |

## 产出文件命名

所有卡片 PNG 统一落盘到 **`web/public/skill-images/`**（由 `card_utils.sh` 暴露的 `CARD_OUTPUT_DIR` 变量控制），文件名为 `<脚本名去 _card_gen / _morning / _check 等后缀>_card.png`，例如：

- `weather_card_gen.sh` → `web/public/skill-images/weather_card_gen_card.png`
- `horoscope_card.sh` → `web/public/skill-images/horoscope_card.png`
- `oil_price_card_gen.sh` → `web/public/skill-images/oil_price_card.png`

新增脚本必须使用：`OUTPUT_FILE="${CARD_OUTPUT_DIR}/<name>_card.png"`（`CARD_OUTPUT_DIR` 已由 `card_utils.sh` 导出，`source` 后即可直接使用）。
写入 `web/public/` 是为了让 Express 静态托管直接命中，Web 访问路径为 `/skill-images/xxx_card.png`。