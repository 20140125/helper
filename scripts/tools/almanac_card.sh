#!/bin/bash
# ======================================
# 老黄历卡片
# ======================================
#
# 功能说明：
#   1. 复用 fetch_real_almanac.sh 的原始 API 数据（命中归档不重复请求）
#   2. 生成 1080px 宽的深色复古风格黄历 PNG 卡片
#   3. 遵循 info-cards 规范：SVG 不含 emoji，stdout 仅输出 PNG 路径
#
# 使用方式：
#   bash scripts/tools/almanac_card.sh               # 今日黄历
#   bash scripts/tools/almanac_card.sh 20260508      # 指定日期（YYYYMMDD）
#   bash scripts/tools/almanac_card.sh 2026-05-08    # 指定日期（YYYY-MM-DD）
#
# 作者：智能提醒系统
# 更新：2026-05-08
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"
source "${PROJECT_DIR}/api_archive.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/almanac_card.png"
SVG_FILE="/tmp/almanac_card.svg"

# 归一化日期为 YYYYMMDD
normalize_date() {
    local d="$1"
    if [ -z "$d" ]; then
        date +%Y%m%d
    elif [[ "$d" =~ ^[0-9]{8}$ ]]; then
        echo "$d"
    elif [[ "$d" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        echo "${d//-/}"
    else
        date +%Y%m%d
    fi
}

fetch_raw() {
    local date_str="$1"
    # 与 fetch_real_almanac.sh 保持一致：只有目标日期 == 今天，才走归档（一月一文件 + entries[今日]）
    local today_ymd
    today_ymd=$(TZ=Asia/Shanghai date +%Y%m%d)
    local cache_file=""
    if [ "${date_str}" = "${today_ymd}" ]; then
        cache_file=$(api_cache_path almanac)
    fi

    local body=""
    if [ -n "${cache_file}" ] && body=$(read_cached_api_response "${cache_file}"); then
        printf '%s' "$body"
        return 0
    fi

    bash "${PROJECT_DIR}/fetch_real_almanac.sh" show "$date_str" >/dev/null 2>&1 || true
    if [ -n "${cache_file}" ] && body=$(read_cached_api_response "${cache_file}"); then
        printf '%s' "$body"
        return 0
    fi
    return 1
}

generate_card() {
    local date_str="$1" raw_json="$2"

    # 解析字段（聚合数据 laohuangli/d 返回结构）
    local parsed_json
    parsed_json=$(python3 - "$raw_json" << 'PYEOF'
import json, sys
raw = sys.argv[1]
try:
    doc = json.loads(raw)
except Exception:
    doc = {}

# 聚合数据：实际数据在 doc.result 里；做多重回退
result = doc.get('result') if isinstance(doc, dict) else None
if not isinstance(result, dict):
    result = doc if isinstance(doc, dict) else {}

def pick(*keys):
    for k in keys:
        v = result.get(k)
        if v not in (None, ''):
            return str(v)
    return ''

out = {
    'yangli':    pick('yangli'),
    'yinli':     pick('yinli'),
    'wuxing':    pick('wuxing'),
    'chongsha':  pick('chongsha'),
    'baiji':     pick('baiji'),
    'jishen':    pick('jishen'),
    'xiongshen': pick('xiongshen'),
    'yi':        pick('yi'),
    'ji':        pick('ji'),
}
print(json.dumps(out, ensure_ascii=False))
PYEOF
    )

    local pretty_date="${date_str:0:4}-${date_str:4:2}-${date_str:6:2}"

    # 副标题：复用 card_utils/datetime.sh 的 get_date_str（格式如 "05月08日 周五"）
    local subtitle
    subtitle=$(get_date_str)

    # node 只负责中间正文：返回"高度\n<body片段>"
    local body_out
    body_out=$(node - "$parsed_json" "$pretty_date" << 'NODEEOF'
const data        = JSON.parse(process.argv[2]);
const prettyDate  = process.argv[3];

const FONT = 'Noto Sans CJK SC, sans-serif';

function escapeXml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(text, maxLen) {
  if (!text) return [];
  const tokens = text.split(/[\.\u3001\uFF0C,]+/).map(t => t.trim()).filter(Boolean);
  if (tokens.length > 1) {
    const lines = [];
    let buf = '';
    for (const tok of tokens) {
      const sep = buf ? '  ' : '';
      if ((buf + sep + tok).length > maxLen) {
        if (buf) lines.push(buf);
        buf = tok;
      } else {
        buf += sep + tok;
      }
    }
    if (buf) lines.push(buf);
    return lines;
  }
  const lines = [];
  let line = '';
  for (let i = 0; i < text.length; i++) {
    line += text[i];
    if (line.length >= maxLen || i === text.length - 1) {
      lines.push(line);
      line = '';
    }
  }
  return lines;
}

const yiLines = wrapText(data.yi, 42);
const jiLines = wrapText(data.ji, 42);

const BODY_TOP = 210;  // 与 svg_header 分隔线 y=170 对齐，下留 40
const ROW_H    = 58;   // 元信息行高（加大行距）

// 顶部：左=农历干支（丙午年...）/ 右=歷印章  —— 左右布局
const topBlockH = 110;

// 宜/忌 改为上下两段（不再并排）
const LINE_H      = 42;  // 宜/忌正文行距
const SECTION_H   = 50;  // 宜/忌 标题栏高度
const yiBodyH     = Math.max(1, yiLines.length) * LINE_H + 20;
const jiBodyH     = Math.max(1, jiLines.length) * LINE_H + 20;
const yiBlockH    = SECTION_H + yiBodyH;
const jiBlockH    = SECTION_H + jiBodyH;
const BLOCK_GAP   = 30;  // 宜/忌两块之间的垂直间隔

// 元信息行
const metaItems = [
  { k: '五行',     v: data.wuxing },
  { k: '冲煞',     v: data.chongsha },
  { k: '吉神',     v: data.jishen },
  { k: '凶神',     v: data.xiongshen },
  { k: '彭祖百忌', v: data.baiji },
].filter(it => it.v);

let H = BODY_TOP + topBlockH + yiBlockH + BLOCK_GAP + jiBlockH + 40 + metaItems.length * ROW_H + 40;
// 给 svg_footer 留 90px
H += 90;

let body = '';

// ========== 顶部左右布局 ==========
// 左：农历干支（丙午(马)年三月廿二）
// 右：歷 印章（金色方框）
let cy = BODY_TOP;
const yinliText = (data.yinli || '').trim();
if (yinliText) {
  body += `<text x="70" y="${cy + 55}" font-family="${FONT}" font-size="32" font-weight="600" fill="#F4E4BCdd">${escapeXml(yinliText)}</text>`;
}
// 可选副行：API 阳历（若与标题日期不同）
const yangliRaw = (data.yangli || '').trim();
const yangliExtra = (yangliRaw && yangliRaw !== prettyDate) ? yangliRaw : '';
if (yangliExtra) {
  body += `<text x="70" y="${cy + 88}" font-family="${FONT}" font-size="20" fill="#F4E4BC80">${escapeXml(yangliExtra)}</text>`;
}

// 右上印章：方框 + 歷
body += `<rect x="910" y="${cy + 10}" width="90" height="90" fill="none" stroke="#B8860B" stroke-width="2"/>`;
body += `<text x="955" y="${cy + 72}" font-family="${FONT}" font-size="48" font-weight="700" fill="#B8860B" text-anchor="middle">歷</text>`;

body += `<line x1="70" y1="${cy + topBlockH - 5}" x2="1010" y2="${cy + topBlockH - 5}" stroke="#B8860B33" stroke-width="1"/>`;
cy += topBlockH;

// ========== 宜（整行）==========
const blockW = 940;  // 整行宽度（70 → 1010）
body += `<rect x="70" y="${cy}" width="${blockW}" height="${yiBlockH}" fill="#B8860B22"/>`;
body += `<rect x="70" y="${cy}" width="${blockW}" height="${SECTION_H}" fill="#B8860B"/>`;
body += `<text x="95" y="${cy + 34}" font-family="${FONT}" font-size="26" font-weight="700" fill="#2E1810">宜 / SHOULD</text>`;
let ty = cy + SECTION_H + 32;
for (const line of (yiLines.length ? yiLines : ['—'])) {
  body += `<text x="100" y="${ty}" font-family="${FONT}" font-size="22" fill="#F4E4BCee">${escapeXml(line)}</text>`;
  ty += LINE_H;
}
cy += yiBlockH + BLOCK_GAP;

// ========== 忌（整行）==========
body += `<rect x="70" y="${cy}" width="${blockW}" height="${jiBlockH}" fill="#40000022"/>`;
body += `<rect x="70" y="${cy}" width="${blockW}" height="${SECTION_H}" fill="#7A1F1F"/>`;
body += `<text x="95" y="${cy + 34}" font-family="${FONT}" font-size="26" font-weight="700" fill="#F4E4BC">忌 / AVOID</text>`;
ty = cy + SECTION_H + 32;
for (const line of (jiLines.length ? jiLines : ['诸事皆宜'])) {
  body += `<text x="100" y="${ty}" font-family="${FONT}" font-size="22" fill="#F4E4BCee">${escapeXml(line)}</text>`;
  ty += LINE_H;
}
cy += jiBlockH + 40;

// ========== 元信息（标签 + 值）==========
for (const it of metaItems) {
  body += `<text x="70"  y="${cy + 32}" font-family="${FONT}" font-size="22" font-weight="700" fill="#B8860B">${escapeXml(it.k)}</text>`;
  body += `<text x="220" y="${cy + 32}" font-family="${FONT}" font-size="22" fill="#F4E4BCcc">${escapeXml(it.v)}</text>`;
  cy += ROW_H;
}

process.stdout.write(String(H) + '\n' + body);
NODEEOF
    )

    local card_h body
    card_h=$(printf '%s' "$body_out" | head -n1)
    body=$(printf '%s' "$body_out" | tail -n +2)

    # 用公共库组装最终 SVG
    {
        svg_header "$card_h" "#2E1810" "#14080A" "老黄历" "${subtitle}"
        printf '%s\n' "$body"
        svg_footer "$card_h" "数据来源：聚合数据老黄历  ·  仅供参考"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "老黄历卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local date_input="${1:-}"
    local date_str
    date_str=$(normalize_date "$date_input")
    log_info "目标日期: ${date_str}"

    local raw
    if ! raw=$(fetch_raw "$date_str") || [ -z "$raw" ]; then
        log_error "获取黄历 API 原始数据失败"
        exit 1
    fi

    generate_card "$date_str" "$raw"

    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
