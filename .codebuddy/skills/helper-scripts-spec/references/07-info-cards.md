# 7. 信息卡片脚本（`scripts/tools/`）

`scripts/tools/` 下是一类特殊的"信息卡片"脚本——抓数据 → 渲染 SVG → `rsvg-convert` 输出 1080px PNG。这类脚本与常规提醒脚本有几点显著不同，独立约定如下。

## 何时遵循本文件

- 在 `scripts/tools/` 下新增任何卡片生成脚本（天气、排行、行情、新闻等）
- 修改 `card_utils.sh` 公共库
- 修 SVG 渲染相关 bug（字体乱码、tofu、emoji 乱码）

仅改 `is_cn_workday.sh` 这类纯数据工具不需要遵循这里，回到通用规范即可。

## 1. 必须用 `card_utils.sh` 而非手写 SVG

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/card_utils.sh"
```

原因：30+ 个卡片的视觉一致性（字体、渐变、水印、行高）全靠这一个文件。任何想"只改我这个卡片的行高"的冲动都应该被压制——要改就改 `card_utils.sh` 的默认值，影响全局。

常用 API（详细签名见 `../../info-cards/references/card-spec.md`）：

| 函数 | 作用 |
|------|------|
| `svg_header h bg1 bg2 title subtitle` | 渐变头部（含标题 / 副标题 / 分隔线） |
| `svg_list_row num y title right` | 单行列表项 |
| `svg_footer h source` | 数据来源 + 水印 + 闭合 |
| `calc_list_height count` | 根据条目数计算总高度 |
| `render_card svg_file png_file` | 调 `rsvg-convert` 输出 PNG |
| `fetch_url url [timeout]` | 带 UA 和超时的 curl |
| `get_date_str` / `get_datetime_str` | 中文日期串 |

## 2. 输出契约

```bash
# CARD_OUTPUT_DIR 由 card_utils.sh 导出，统一指向 web/public/skill-images/
OUTPUT_FILE="${CARD_OUTPUT_DIR}/<name>_card.png"
# ...渲染...
if render_card "$svg_file" "$OUTPUT_FILE"; then
  log_success "卡片生成完成: $OUTPUT_FILE"  # 进日志（stderr + tools.log）
  echo "$OUTPUT_FILE"                       # 唯一写 stdout 的一行
  exit 0
fi
echo "FAILED"
exit 1
```

调用方（bot / cron）依赖 `stdout 路径` + `退出码 0` 这个契约拼 `MEDIA:` 指令。**绝不要用 `log_info / log_success` 输出 PNG 路径本身**——最后那一行 `echo "$OUTPUT_FILE"` 必须是裸 echo，才能保持 stdout 仅 1 行路径。

写入 `web/public/skill-images/` 是为了让 Express 静态托管直接命中，Web 访问路径 `/skill-images/xxx_card.png`。**不要再用 `${SCRIPT_DIR}/<name>_card.png` 这种旧写法**。

## 3. log_utils.sh 可以 source（但最后 echo 路径要裸写）

卡片脚本**可以且推荐** `source log_utils.sh`——helper 的 `log_utils._log` 实现把日志写到 **stderr** 和 `tools.log` 文件，**不走 stdout**，所以不会破坏上面的契约。33 个现存卡片脚本里 31 个都 source 了。

```bash
source "${PROJECT_DIR}/log_utils.sh"     # ✅ 可以
log_info "开始抓取 xxx"                 # 写 stderr + tools.log
log_success "卡片生成完成: $OUTPUT_FILE" # 写 stderr + tools.log
echo "$OUTPUT_FILE"                      # ✅ 真正走 stdout 的只有这一行
```

唯一铁律：**打 PNG 路径那一行必须是裸 `echo`，不能用任何 `log_*` 包装**——`log_*` 会加时间/级别前缀，让调用方拼不出 `MEDIA:` 指令。

## 4. SVG 渲染必踩的坑

- **禁止 emoji**：`rsvg-convert` 不支持彩色 emoji 字体，会渲染成方块。符号用 Unicode 几何字符（▲ ▼ ● ★）或实体引用。
- **时区显式**：所有 `date` 命令加 `TZ=Asia/Shanghai`，cron 被 systemd 启动时继承的是 UTC。
- **XML 特殊字符转义**：API 返回的标题里的 `& < > " '` 要在拼进 SVG 前转义。
- **影视综艺去重**：`中配版` / `中文版` / `国语版` 是同一部剧，按主标题去重保留第一个。

## 5. 定时任务不在脚本里

这类脚本的"工作日才推""价格变动才推"等闸门**不写在脚本内部**，由 cron 外层控制（通过 `is_cn_workday.sh` 等工具脚本的退出码判断）。脚本本身永远是"调我我就出图"。这样手动触发不会被业务规则误拦。

详情（当前 cron 配置、油价缓存机制）见 `../../info-cards/references/schedule.md`。
