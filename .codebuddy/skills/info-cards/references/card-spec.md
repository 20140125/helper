# 卡片设计规格与渲染约定

所有信息卡片由 `card_utils.sh` 统一渲染（SVG → `rsvg-convert` → PNG）。新增卡片脚本**必须** `source card_utils.sh` 而非自己手写 SVG 头尾，保证视觉一致。

## 视觉规格

| 项 | 值 |
|---|---|
| 宽度 | 1080 px（`CARD_WIDTH`） |
| 字体 | `Noto Sans CJK SC`（`CARD_FONT`） |
| 风格 | 深色渐变背景 + 白色文字 |
| 单行列表高度 | 92 px（`calc_list_height` 默认行高） |
| 列表起始 y | 195（头部区域之下） |
| 右下水印 | `龙哥`（`CARD_WATERMARK`） |
| 条目数 | Top10（视数据源而定，≤10） |

## `card_utils.sh` 导出的能力

`card_utils.sh` 不只是渲染库——它同时扮演**渲染 + 抓数据 + 推消息 + 常用字符串/日期工具**四合一公共库。以下按用途分组。

### 1. 渲染 / 骨架

```bash
source "${SCRIPT_DIR}/card_utils.sh"

svg_header "$height" "#1a1a2e" "#16213e" "标题" "副标题"   # 高度/渐变起终色/标题/副标题
svg_list_row "01" 195 "标题" "1.2w 热度"                     # 序号/y/左文字/右文字[/右文字颜色]
svg_footer "$height" "数据来源：xxx"                         # 高度/数据来源
height=$(calc_list_height 10)                                # 条目数[/行高/起始y/底padding]
render_card "$svg_file" "$OUTPUT_FILE"                      # SVG 路径/输出 PNG
```

### 2. 推送

```bash
send_card_image "$OUTPUT_FILE" "$WEBHOOK_IDS"   # 把 PNG 以企微图片消息形式下发；原图 >1.5MB 自动告警跳过（base64 后会超 2MB 限额）
```

### 3. 日期 / 时间 / 问候

```bash
get_date_str        # "2026 年 4 月 30 日 星期四"
get_datetime_str    # "2026-04-30 13:57"
get_dow_cn          # "星期四"
get_greeting        # 按小时返回"早上好 / 下午好 / 晚上好"
```

全部已内置 `TZ=Asia/Shanghai`，调用方不用再包一层。

### 4. 数据抓取（通用 + 业务）

```bash
# 通用
fetch_url          "$url" [timeout]              # 带 UA + 超时的 curl
fetch_with_referer "$url" "$referer" [timeout]   # 带 Referer 的 curl（部分反爬接口需要）

# 业务（专供 weather / AI 新闻系列卡片复用）
fetch_weather_shenzhen            # 抓 wttr.in 深圳原始 JSON
fetch_weather_alerts              # 聚合 10 类预警检测结果
fetch_hn_ai_news_top              # Hacker News AI 频道 Top
```

### 5. 天气业务工具（仅天气类卡片用）

```bash
translate_weather_desc "$en"     # 英文天气描述 → 中文
get_weather_desc_cn   "$code"    # 天气 code → 中文
get_dress_advice "$temp"         # 温度 → 穿衣建议
get_uv_desc      "$uv_index"     # UV 指数 → 文案
get_weather_emoji "$code"        # 天气 code → Unicode 符号（非 emoji，避免 tofu）

# 10 个预警检测器（返回字符串，无预警返回空）
check_alert_high_temp / _cold_wave / _wind / _rainstorm / _thunder
check_alert_fog      / _haze      / _imminent_rain / _drought / _uv
```

> 只有 `weather_card_gen.sh` / `weather_alert_card_gen.sh` 会用到这一组。其他卡片脚本**不需要**感知它们。

### 6. 字符串工具

```bash
trunc_text "$str" 20   # 按显示宽度截断中英混排字符串，尾部加省略号
```

### 7. 导出变量

| 变量 | 值 | 用途 |
|------|----|----|
| `CARD_WIDTH` | 1080 | 卡片宽度 |
| `CARD_FONT` | `"Noto Sans CJK SC, sans-serif"` | 字体栈 |
| `CARD_WATERMARK` | `"龙哥"` | 右下水印 |
| `CARD_OUTPUT_DIR` | `<project>/web/public/skill-images` | 所有卡片 PNG 落盘目录（已 `export`） |

## 必须遵守的坑

- **禁止在 SVG 中写 emoji**：`rsvg-convert` 不支持彩色 emoji 字体，会渲染成乱码方块 / tofu。需要符号时用 Unicode 几何字符或 `&#xXXXX;` 实体。
- **所有时间相关命令加 `TZ=Asia/Shanghai`**：服务器默认 UTC，日期与周几会错一天。
- **数据源的中文字段缺失时 fallback 英文并翻译**（天气类特别容易遇到）。
- **XML 特殊字符转义**：用户或 API 返回的标题若含 `& < > " '`，要在拼进 SVG 前转义，否则 SVG 解析失败。
- **影视综艺类去重**：豆瓣 / B站 / 爱奇艺常把 `中配版`/`中文版`/`国语版` 列成独立条目，脚本应按主标题去重保留第一个。

## 输出路径约定

每个脚本定义 `OUTPUT_FILE="${CARD_OUTPUT_DIR}/<name>_card.png"`，成功后把路径 `echo` 出来供调用方拼 `MEDIA:` 指令；失败输出 `FAILED` 并以非零码退出。

`CARD_OUTPUT_DIR` 由 `card_utils.sh` 统一导出，指向项目根下的 `web/public/skill-images/`；`source card_utils.sh` 后直接使用即可，不要再用 `${SCRIPT_DIR}/images/` 这种旧写法。
