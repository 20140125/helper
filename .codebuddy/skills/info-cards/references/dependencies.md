# 依赖与环境

## 系统依赖

| 命令 | 包 | 用途 |
|------|----|----|
| `rsvg-convert` | `librsvg2-bin` / `librsvg2` | SVG → PNG 渲染核心 |
| `jq` | `jq` | JSON 解析 |
| `node` | Node.js | SVG 模板拼装、HTML 解析、中文字符串截断 |
| `curl` | `curl` | 数据抓取 |
| `iconv` | `libc` | GBK → UTF-8（A股腾讯财经接口） |
| `python3` | `python3` | JSON 转义、个别脚本的结构化处理 |

## 字体

`Noto Sans CJK SC` **必须**安装，否则 PNG 中的中文会变成 `tofu`（方框）。

```bash
# Debian/Ubuntu
apt-get install fonts-noto-cjk
# macOS
brew install --cask font-noto-sans-cjk-sc
```

安装后验证：`fc-list :lang=zh | grep -i noto`。

## 环境变量

- `TZ=Asia/Shanghai` — 所有脚本内部时间命令必须显式加，不能依赖进程环境，否则被 cron 调起时会用 UTC。
- 一些脚本需要 API Key（如 `air_quality.sh` 的 WAQI token），通过 `project_config.sh` 加载，不硬编码。

## 可选依赖

- `node-fetch` / `cheerio`（仅在依赖 HTML 解析的脚本里按需）：这些通过脚本内 `node -e` 内联使用，无需 `npm install` 全局包，因 Node.js 18+ 自带 `fetch`。
