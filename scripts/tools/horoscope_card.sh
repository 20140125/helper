#!/bin/bash
# ======================================
# 星座运势卡片
# ======================================
#
# 功能说明：
#   1. 复用 fetch_real_horoscope.sh 的原始 API 数据（命中归档不重复请求）
#   2. 生成 1080px 宽的深色风格星座运势 PNG 卡片
#   3. 遵循 info-cards 规范：SVG 不含 emoji，stdout 仅输出 PNG 路径
#
# 使用方式：
#   bash scripts/tools/horoscope_card.sh                       # 默认星座·今日
#   bash scripts/tools/horoscope_card.sh 水瓶座                 # 指定星座·今日
#   bash scripts/tools/horoscope_card.sh 水瓶座 tomorrow        # 明日
#   bash scripts/tools/horoscope_card.sh 水瓶座 week            # 本周
#   bash scripts/tools/horoscope_card.sh 水瓶座 month           # 本月
#   bash scripts/tools/horoscope_card.sh 水瓶座 year            # 今年
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
# 引入星座专属缓存读写函数（horoscope_read_cache / horoscope_write_cache / horoscope_cache_path）
source "${PROJECT_DIR}/fetch_real_horoscope/fetcher.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/horoscope_card.png"
SVG_FILE="/tmp/horoscope_card.svg"

# type 中文标签
type_label() {
    case "$1" in
        today)    echo "今日" ;;
        tomorrow) echo "明日" ;;
        week)     echo "本周" ;;
        month)    echo "本月" ;;
        year)     echo "今年" ;;
        *)        echo "今日" ;;
    esac
}

# 拿星座原始 JSON（仅走归档；若归档无则现调 API）
fetch_raw() {
    local zodiac="$1" type="$2"

    local body=""
    if body=$(horoscope_read_cache "${zodiac}" "${type}"); then
        # 原始输出模式（data / json）：暂存星座接口原始返回，供最后统一输出
        emit_raw "$body"
        printf '%s' "$body"
        return 0
    fi

    # 未命中 → 通过 fetch_real_horoscope.sh 触发请求并归档
    bash "${PROJECT_DIR}/fetch_real_horoscope.sh" show "$zodiac" "$type" >/dev/null 2>&1 || true
    # 请求完再读一次归档
    if body=$(horoscope_read_cache "${zodiac}" "${type}"); then
        # 原始输出模式（data / json）：暂存星座接口原始返回，供最后统一输出
        emit_raw "$body"
        printf '%s' "$body"
        return 0
    fi

    return 1
}

# 生成卡片（传入 zodiac / type / 原始 JSON）
generate_card() {
    local zodiac="$1" type="$2" raw_json="$3"
    local label
    label=$(type_label "$type")

    local date_str
    date_str=$(get_date_str)

    # 解析字段（不同 type 字段不同，统一先给 Python 处理）
    local parsed_json
    parsed_json=$(python3 - "$raw_json" "$type" << 'PYEOF'
import json, sys
raw, type_ = sys.argv[1], sys.argv[2]
try:
    doc = json.loads(raw)
except Exception:
    doc = {}

# 聚合数据：优先 data 字段，否则把整个 doc 当 data
data = doc.get('data') if isinstance(doc, dict) else None
if not isinstance(data, dict):
    data = doc if isinstance(doc, dict) else {}

out = {}

def _flatten(v):
    """把 API 字段（可能是 str / list / dict）压成展示用纯文本。

    - str：直接返回（去首尾空白）
    - list：递归压平后用空行连接，过滤空段
    - dict：取 info / text 两个常见子段（年运势"幸运石"等用法），其它字段按 "k: v" 展开
    - 其它：转字符串
    """
    if v is None:
        return ''
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, list):
        parts = [_flatten(x) for x in v]
        return '\n\n'.join(p for p in parts if p)
    if isinstance(v, dict):
        # 年运势"幸运石"字段：{ info: '勇敢面对挑战', text: ['...'] }
        if 'info' in v or 'text' in v:
            head = _flatten(v.get('info'))
            body = _flatten(v.get('text'))
            if head and body:
                return f'{head}\n\n{body}'
            return head or body
        # 其它 dict：按 "k：v" 逐行展开（保持稳定可读）
        lines = []
        for kk, vv in v.items():
            sv = _flatten(vv)
            if sv:
                lines.append(f'{kk}：{sv}')
        return '\n'.join(lines)
    return str(v)

def pick(*keys):
    for k in keys:
        v = data.get(k)
        s = _flatten(v)
        if s:
            return s
    return ''

if type_ in ('today', 'tomorrow'):
    out['all']     = pick('all')
    out['summary'] = pick('summary')
    out['love']    = pick('love')
    out['work']    = pick('work')
    out['money']   = pick('money')
    out['health']  = pick('health')
    out['color']   = pick('color')
    out['number']  = pick('number')
    out['QFriend'] = pick('QFriend')
elif type_ == 'week':
    out['date']   = pick('date')
    out['weekth'] = pick('weekth')
    out['love']   = pick('love')
    out['work']   = pick('work')
    out['money']  = pick('money')
    out['health'] = pick('health')
    out['job']    = pick('job')
elif type_ == 'month':
    out['date']       = pick('date')
    out['mN']         = pick('mN')
    out['all']        = pick('all')
    out['love']       = pick('love')
    out['work']       = pick('work')
    out['money']      = pick('money')
    out['happyMagic'] = pick('happyMagic')
elif type_ == 'year':
    out['date']    = pick('date')
    out['career']  = pick('career')
    out['love']    = pick('love')
    out['health']  = pick('health')
    out['finance'] = pick('finance')
    out['mima']    = pick('mima')

print(json.dumps(out, ensure_ascii=False))
PYEOF
    )

    # node 只负责"中间正文"：计算高度 + 输出 body（不含根标签 / 标题 / 页脚）
    local body_out
    body_out=$(node - "$parsed_json" "$type" << 'NODEEOF'
const data  = JSON.parse(process.argv[2]);
const type_ = process.argv[3];

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
  const lines = [];
  // 先按显式换行切成段；空段保留为占位行（视觉上的段间空行）
  const paragraphs = String(text).split(/\r?\n/);
  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p];
    if (para === '') {
      lines.push('');  // 空行：拉开段间距
      continue;
    }
    let line = '';
    for (let i = 0; i < para.length; i++) {
      line += para[i];
      if (line.length >= maxLen || i === para.length - 1) {
        lines.push(line);
        line = '';
      }
    }
  }
  return lines;
}

// 归一化 0-100 分数（兼容 "75" / "75%" / "75分" 等）
function toScore(v) {
  if (v === null || v === undefined || v === '') return null;
  const m = String(v).match(/-?\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

const BODY_TOP = 210;  // 与 svg_header 分隔线 y=170 对齐，下留 40

let H = BODY_TOP;
let body = '';

// ========== today / tomorrow：进度条 + 网格排版 ==========
if (type_ === 'today' || type_ === 'tomorrow') {
  // 1) 5 项分数：2 列网格，每项 = 标签 + 进度条 + 分数
  const scoreItems = [
    { label: '综合', score: toScore(data.all) },
    { label: '爱情', score: toScore(data.love) },
    { label: '事业', score: toScore(data.work) },
    { label: '财运', score: toScore(data.money) },
    { label: '健康', score: toScore(data.health) },
  ].filter(it => it.score !== null);

  const COL_W    = 455;      // 单列宽度（2 列共 910，+中间 40 gap + 左右 70 边距 → 70 + 455 + 40 + 455 + 70 = 1090 取 1080）
  const COL_GAP  = 40;
  const ROW_H    = 74;       // 每行高度
  const BAR_W    = 280;      // 进度条总宽
  const BAR_H    = 10;

  // 分数色阶（低 < 60 红；60-79 黄；≥ 80 绿/紫）
  function scoreColor(s) {
    if (s >= 85) return '#9b87f5';   // 主题紫
    if (s >= 70) return '#5DADE2';   // 蓝
    if (s >= 50) return '#F5B041';   // 黄
    return '#E74C3C';                // 红
  }

  let y = BODY_TOP;
  for (let i = 0; i < scoreItems.length; i++) {
    const it  = scoreItems[i];
    const col = i % 2;
    const x   = 70 + col * (COL_W + COL_GAP);
    if (col === 0 && i > 0) y += ROW_H;

    // 左侧装饰条 + 标签
    body += `<rect x="${x}" y="${y}" width="6" height="26" fill="#9b87f5"/>`;
    body += `<text x="${x + 18}" y="${y + 22}" font-family="${FONT}" font-size="22" font-weight="700" fill="#ffffffdd">${escapeXml(it.label)}</text>`;

    // 进度条（背景 + 前景）
    const barY   = y + 42;
    const barX   = x + 18;
    const fillW  = Math.round(BAR_W * it.score / 100);
    const color  = scoreColor(it.score);
    body += `<rect x="${barX}" y="${barY}" width="${BAR_W}" height="${BAR_H}" rx="5" fill="#ffffff1a"/>`;
    body += `<rect x="${barX}" y="${barY}" width="${fillW}" height="${BAR_H}" rx="5" fill="${color}"/>`;

    // 右侧分数数字
    body += `<text x="${barX + BAR_W + 14}" y="${barY + BAR_H + 2}" font-family="${FONT}" font-size="26" font-weight="700" fill="${color}">${it.score}</text>`;
  }
  // 最后一行占位（奇数项时）
  y += ROW_H;
  H = y + 10;

  // 2) 概述（整行）
  if (data.summary) {
    H += 20;
    body += `<line x1="70" y1="${H}" x2="1010" y2="${H}" stroke="#ffffff1a" stroke-width="1"/>`;
    H += 30;
    body += `<rect x="70" y="${H - 10}" width="6" height="26" fill="#9b87f5"/>`;
    body += `<text x="92" y="${H + 10}" font-family="${FONT}" font-size="22" font-weight="700" fill="#ffffffdd">概述</text>`;
    H += 48;
    const lines = wrapText(data.summary, 46);
    for (const line of lines) {
      body += `<text x="92" y="${H}" font-family="${FONT}" font-size="20" fill="#ffffffcc">${escapeXml(line)}</text>`;
      H += 36;
    }
  }

  // 3) 幸运色 / 幸运数字 / 速配（并排三卡）
  const tri = [];
  if (data.color)   tri.push({ label: '幸运色',   value: data.color });
  if (data.number)  tri.push({ label: '幸运数字', value: data.number });
  if (data.QFriend) tri.push({ label: '速配',     value: data.QFriend });

  if (tri.length > 0) {
    H += 30;
    const TRI_W   = Math.floor((940 - (tri.length - 1) * 20) / tri.length);
    const TRI_H   = 90;
    for (let i = 0; i < tri.length; i++) {
      const t  = tri[i];
      const x  = 70 + i * (TRI_W + 20);
      body += `<rect x="${x}" y="${H}" width="${TRI_W}" height="${TRI_H}" rx="10" fill="#ffffff0f" stroke="#9b87f555" stroke-width="1"/>`;
      body += `<text x="${x + TRI_W/2}" y="${H + 34}" font-family="${FONT}" font-size="18" fill="#ffffff99" text-anchor="middle">${escapeXml(t.label)}</text>`;
      body += `<text x="${x + TRI_W/2}" y="${H + 70}" font-family="${FONT}" font-size="26" font-weight="700" fill="#ffffffee" text-anchor="middle">${escapeXml(t.value)}</text>`;
    }
    H += TRI_H + 10;
  }

  H += 20;

} else {
  // ========== week / month / year：保留原有分节文本排版 ==========
  let sections = [];
  if (type_ === 'week') {
    sections = [
      { label: '爱情', value: data.love || '' },
      { label: '工作', value: data.work || '' },
      { label: '财运', value: data.money || '' },
      { label: '健康', value: data.health || '' },
      { label: '求职', value: data.job || '' },
    ];
  } else if (type_ === 'month') {
    sections = [
      { label: '综合', value: data.all || '', wide: true },
      { label: '爱情', value: data.love || '' },
      { label: '事业', value: data.work || '' },
      { label: '财运', value: data.money || '' },
    ];
    if (data.happyMagic) sections.push({ label: '开运', value: data.happyMagic, wide: true });
  } else if (type_ === 'year') {
    sections = [
      { label: '事业', value: data.career || '',  wide: true },
      { label: '爱情', value: data.love || '',    wide: true },
      { label: '财务', value: data.finance || '', wide: true },
      { label: '健康', value: data.health || '',  wide: true },
    ];
    if (data.mima) sections.push({ label: '幸运石', value: data.mima });
  }

  const LINE_H    = 38;
  const LABEL_H   = 42;
  const BLOCK_GAP = 18;

  let cy = BODY_TOP;
  const rendered = [];
  for (const sec of sections) {
    const maxLen = sec.wide ? 40 : 38;
    const lines = wrapText(sec.value, maxLen);
    if (lines.length === 0) continue;
    rendered.push({ label: sec.label, lines });
    cy += LABEL_H + lines.length * LINE_H + BLOCK_GAP;
  }

  H = cy;

  let y = BODY_TOP;
  for (const item of rendered) {
    body += `<rect x="70" y="${y}" width="6" height="26" fill="#9b87f5"/>`;
    body += `<text x="92" y="${y + 22}" font-family="${FONT}" font-size="24" font-weight="700" fill="#ffffffdd">${escapeXml(item.label)}</text>`;
    y += LABEL_H;
    for (const line of item.lines) {
      body += `<text x="92" y="${y + 15}" font-family="${FONT}" font-size="22" fill="#ffffffbb">${escapeXml(line)}</text>`;
      y += LINE_H;
    }
    y += BLOCK_GAP;
  }
}
// 为 svg_footer 留出空间：分隔线 55px + 文字区 35px ≈ 90
H += 90;

// 第一行输出高度（供 bash 读取），第二行起为 SVG body 片段
process.stdout.write(String(H) + '\n' + body);
NODEEOF
    )

    local card_h body
    card_h=$(printf '%s' "$body_out" | head -n1)
    body=$(printf '%s' "$body_out" | tail -n +2)

    # 用公共库组装最终 SVG：头 + body + 脚
    {
        svg_header "$card_h" "#1A1240" "#0D1230" "${label}星座运势" "${zodiac}  ·  ${date_str}"
        printf '%s\n' "$body"
        svg_footer "$card_h" "数据来源：聚合数据星座运势"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    log_info "======================================"
    log_info "星座运势卡片生成启动"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local zodiac="${1:-}"
    local type="${2:-today}"

    # 若未指定星座，自动判断当前日期所属星座
    if [ -z "$zodiac" ]; then
        if [ -f "${PROJECT_DIR}/get_zodiac_sign.sh" ]; then
            zodiac=$(bash "${PROJECT_DIR}/get_zodiac_sign.sh" 2>/dev/null || echo "水瓶座")
        else
            zodiac="水瓶座"
        fi
    fi

    # type 合法性
    case "$type" in
        today|tomorrow|week|month|year) ;;
        *) log_warning "未识别 type=${type}，回退为 today"; type="today" ;;
    esac

    log_info "星座: ${zodiac}, 周期: ${type}"

    local raw
    if ! raw=$(fetch_raw "$zodiac" "$type") || [ -z "$raw" ]; then
        log_error "获取星座 API 原始数据失败"
        exit 1
    fi

    generate_card "$zodiac" "$type" "$raw"

    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
