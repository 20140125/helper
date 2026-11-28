#!/bin/bash
# ======================================
# 架构图 / 序列图卡片生成
# ======================================
#
# 功能说明：
#   1. 输入一段 JSON 图描述，渲染成 1080px 深色风格的架构图 / 序列图 PNG
#   2. 图片落到 web/public/skill-images/，stdout 输出图片路径
#   3. data / json 模式输出解析后的图结构（分组 / 节点 / 连线 或 角色 / 步骤清单）
#
# 数据源：无（纯本地渲染，不依赖任何外部接口）
#
# 使用方式：
#   bash scripts/tools/diagram_card.sh '<json>'
#   bash scripts/tools/diagram_card.sh --file /tmp/spec.json
#   bash scripts/tools/diagram_card.sh data '<json>'
#
# JSON 结构：
#   架构图：
#     {"type":"architecture","title":"Helper 系统架构","subtitle":"2026-10-12",
#      "groups":[{"title":"定时任务层","accent":"#FFD700","nodes":[{"name":"crontab","desc":"@reboot"}]}],
#      "edges":[{"from":"crontab","to":"watchdog.sh","label":"保活"}]}
#   序列图：
#     {"type":"sequence","title":"提问流程","subtitle":"2026-10-12",
#      "actors":["用户","前端","后端"],
#      "steps":[{"from":"用户","to":"前端","label":"输入问题","style":"solid|dash"}]}
#
# 说明：
#   - from / to 写节点名（architecture）或角色名（sequence），与 nodes / actors 中的名称一致
#   - SVG 内禁止 emoji（rsvg-convert 会渲染成豆腐块），图标一律用纯文字或几何字符
#
# 作者：智能提醒系统
# 更新：2026-10-12
# ======================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/diagram_card.png"
SVG_FILE="${CARD_OUTPUT_DIR}/.diagram_card.svg"

# ── 图描述 → SVG 的渲染器（python3 内嵌；JSON 经 stdin 传入，规避命令行长度与转义问题）──
read -r -d '' DIAGRAM_PY <<'PYEOF'
import html
import json
import math
import os
import sys

FONT = os.environ.get('CARD_FONT', 'Noto Sans CJK SC, sans-serif')
X0, X1 = 50, 1030          # 内容区左右边界（对齐 svg_list_row 的 50 / 1030）
TOP_Y = 200                # 标题分隔线在 y=170，图区从 200 起
BOTTOM_PAD = 90            # 底部留给 footer 的空间

# ── 架构图布局常量 ──
NODE_H = 52                # 节点块高
NODE_GAP = 10              # 节点间距
GROUP_HEAD = 44            # 分组标题条高
GROUP_PAD = 14             # 分组内边距
GAP_X, GAP_Y = 22, 44      # 分组之间的横纵间距（纵向留出连线走廊）
CORRIDOR = 14              # 连线走廊距组框的偏移

# ── 序列图布局常量 ──
ACTOR_H = 54               # 角色头高
STEP_H = 62                # 每步行高
STEP_TOP = 300             # 第一步的 y


def esc(s):
    return html.escape(str(s if s is not None else ''), quote=True)


def text(x, y, s, size=22, fill='#ffffffdd', weight='600', anchor='middle'):
    return ('  <text x="%.1f" y="%.1f" font-family="%s" font-size="%d" font-weight="%s" '
            'fill="%s" text-anchor="%s">%s</text>' % (x, y, FONT, size, weight, fill, anchor, esc(s)))


def rect(x, y, w, h, fill='#ffffff0a', stroke='#ffffff20', sw=1, rx=10):
    return ('  <rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%d" fill="%s" '
            'stroke="%s" stroke-width="%d"/>' % (x, y, w, h, rx, fill, stroke, sw))


def clip(s, per_line):
    """单行截断（超出部分用省略号，避免撑破节点框）"""
    lines = wrap_cjk(s, per_line)
    return (lines[0] + '…') if len(lines) > 1 else lines[0]


def wrap_cjk(s, per_line):
    """按显示宽度折行（中文 1 字 = 2 个单位宽度）"""
    lines, cur, w = [], '', 0
    for ch in str(s):
        cw = 2 if ord(ch) > 0x2E80 else 1
        if w + cw > per_line and cur:
            lines.append(cur)
            cur, w = '', 0
        cur += ch
        w += cw
    if cur:
        lines.append(cur)
    return lines


# ══════════════ 架构图 ══════════════
def layout_architecture(spec):
    groups = spec.get('groups') or []
    if not groups:
        raise ValueError('architecture 缺少 groups')
    for idx, g in enumerate(groups):
        g['title'] = str(g.get('title') or '分组 %d' % (idx + 1))
        g['accent'] = str(g.get('accent') or '#5DADE2')
        nodes = []
        for n in (g.get('nodes') or []):
            if isinstance(n, str):
                n = {'name': n}
            name = str(n.get('name') or '').strip()
            if not name:
                continue
            nodes.append({'name': name, 'desc': str(n.get('desc') or '')})
        if not nodes:
            nodes = [{'name': g['title'], 'desc': ''}]
        g['nodes'] = nodes
        g['h'] = GROUP_HEAD + len(nodes) * (NODE_H + NODE_GAP) - NODE_GAP + GROUP_PAD * 2 + 8

    n = len(groups)
    cols = n if n <= 2 else (2 if n <= 4 else 3)
    rows = int(math.ceil(n / float(cols)))
    gw = (X1 - X0 - (cols - 1) * GAP_X) / float(cols)

    row_heights = []
    for r in range(rows):
        row_heights.append(max(g['h'] for g in groups[r * cols:(r + 1) * cols]))

    for gi, g in enumerate(groups):
        g['g_id'] = gi

    y = TOP_Y
    for r in range(rows):
        row = groups[r * cols:(r + 1) * cols]
        x = X0
        for g in row:
            g['x'], g['y'], g['w'], g['box_h'] = x, y, gw, row_heights[r]
            nodes_y = y + GROUP_HEAD + GROUP_PAD
            for nd in g['nodes']:
                nd['x'] = x + GROUP_PAD
                nd['y'] = nodes_y
                nd['w'] = gw - GROUP_PAD * 2
                nd['h'] = NODE_H
                nd['g_id'] = g['g_id']
                nd['g_top'] = y
                nd['g_bottom'] = y + row_heights[r]
                nodes_y += NODE_H + NODE_GAP
            x += gw + GAP_X
        y += row_heights[r] + GAP_Y

    node_index = {}
    for g in groups:
        for nd in g['nodes']:
            node_index.setdefault(nd['name'], nd)
    return groups, node_index, int(y + BOTTOM_PAD - GAP_Y)


def svg_architecture(spec, groups, node_index):
    out = ['  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
           'markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" '
           'fill="#ffffff70"/></marker></defs>']

    # 分组容器 + 节点
    for g in groups:
        out.append(rect(g['x'], g['y'], g['w'], g['box_h'], fill='#ffffff06',
                        stroke=g['accent'] + '55', sw=1, rx=14))
        out.append(text(g['x'] + GROUP_PAD, g['y'] + 30, g['title'], size=20,
                        fill=g['accent'], weight='700', anchor='start'))
        for nd in g['nodes']:
            out.append(rect(nd['x'], nd['y'], nd['w'], nd['h'], fill='#ffffff10',
                            stroke='#ffffff18', sw=1, rx=8))
            if nd['desc']:
                out.append(text(nd['x'] + nd['w'] / 2, nd['y'] + 23,
                                clip(nd['name'], int(nd['w'] / 11)), size=20,
                                fill='#ffffffee'))
                d = wrap_cjk(nd['desc'], int(nd['w'] / 8))
                out.append(text(nd['x'] + nd['w'] / 2, nd['y'] + 42, d[0], size=15,
                                fill='#ffffff80', weight='400'))
            else:
                out.append(text(nd['x'] + nd['w'] / 2, nd['y'] + 33,
                                clip(nd['name'], int(nd['w'] / 11)), size=20,
                                fill='#ffffffee'))

    # 连线（组间走廊正交路由：水平段走在组框之间的空隙，避免穿过节点）
    nodes_all = [nd for g in groups for nd in g['nodes']]
    for e in (spec.get('edges') or []):
        a = node_index.get(str(e.get('from') or ''))
        b = node_index.get(str(e.get('to') or ''))
        if not a or not b or a is b:
            continue
        label = str(e.get('label') or '')
        ax, ay = a['x'] + a['w'] / 2, a['y'] + a['h'] / 2
        bx, by = b['x'] + b['w'] / 2, b['y'] + b['h'] / 2

        def h_blocked(sx, ex, y):
            """水平线段 (sx,y)-(ex,y) 是否穿过某个节点矩形"""
            lo, hi = min(sx, ex), max(sx, ex)
            for n in nodes_all:
                if n is a or n is b:
                    continue
                if n['x'] < hi - 2 and n['x'] + n['w'] > lo + 2 and n['y'] - 2 < y < n['y'] + n['h'] + 2:
                    return True
            return False

        if a['g_id'] == b['g_id'] and abs(ax - bx) < 4:
            # 同组垂直对齐：直接短直线
            if by > ay:
                path = 'M %.1f %.1f L %.1f %.1f' % (ax, a['y'] + a['h'], bx, b['y'])
                lx, ly = ax + 12, (a['y'] + a['h'] + b['y']) / 2 + 5
            else:
                path = 'M %.1f %.1f L %.1f %.1f' % (ax, a['y'], bx, b['y'] + b['h'])
                lx, ly = ax + 12, (a['y'] + b['y'] + b['h']) / 2 + 5
        elif abs(ay - by) < 24:
            # 近似同高：水平直连；中间隔有节点时沿组框外侧走廊绕行
            if bx > ax:
                sx, sy, ex, ey = a['x'] + a['w'], ay, b['x'], by
            else:
                sx, sy, ex, ey = a['x'], ay, b['x'] + b['w'], by
            if not h_blocked(sx, ex, sy):
                path = 'M %.1f %.1f L %.1f %.1f' % (sx, sy, ex, ey)
                lx, ly = (sx + ex) / 2, sy - 8
            else:
                head_room = a['y'] - a['g_top']
                foot_room = a['g_bottom'] - (a['y'] + a['h'])
                if foot_room >= head_room:
                    cy = a['g_bottom'] + CORRIDOR
                    path = ('M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f'
                            % (ax, a['y'] + a['h'], ax, cy, bx, cy, bx, b['y'] + b['h']))
                else:
                    cy = a['g_top'] - CORRIDOR
                    path = ('M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f'
                            % (ax, a['y'], ax, cy, bx, cy, bx, b['y']))
                lx, ly = (ax + bx) / 2, cy - 6
        elif by > ay:
            # 目标在下方：源出底 → 组间走廊 → 目标入顶
            sx, sy = ax, a['y'] + a['h']
            cy = b['g_top'] - CORRIDOR
            if cy <= sy + 4:
                cy = sy + CORRIDOR
            path = ('M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f'
                    % (sx, sy, sx, cy, bx, cy, bx, b['y']))
            lx, ly = (sx + bx) / 2, cy - 6
        else:
            # 目标在上方：源出顶 → 组间走廊 → 目标入底
            sx, sy = ax, a['y']
            cy = b['g_bottom'] + CORRIDOR
            if cy >= sy - 4:
                cy = sy - CORRIDOR
            path = ('M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f'
                    % (sx, sy, sx, cy, bx, cy, bx, b['y'] + b['h']))
            lx, ly = (sx + bx) / 2, cy + 4
        out.append('  <path d="%s" fill="none" stroke="#ffffff55" stroke-width="2" '
                   'marker-end="url(#arrow)" stroke-linejoin="round"/>' % path)
        if label:
            lines = wrap_cjk(label, 24)
            lw = max(len(l) for l in lines) * 8 + 16
            out.append(rect(lx - lw / 2, ly - 15, lw, 15 * len(lines) + 6,
                            fill='#1a1a2ecc', stroke='none', sw=0, rx=4))
            for i, l in enumerate(lines[:2]):
                out.append(text(lx, ly - 3 + i * 15, l, size=15, fill='#ffffffaa', weight='400'))
    return '\n'.join(out)


# ══════════════ 序列图 ══════════════
def layout_sequence(spec):
    actors = [str(a) for a in (spec.get('actors') or []) if str(a).strip()]
    steps = []
    for s in (spec.get('steps') or []):
        f = str(s.get('from') or '')
        t = str(s.get('to') or '')
        if not f or not t:
            continue
        steps.append({'from': f, 'to': t, 'label': str(s.get('label') or ''),
                      'style': str(s.get('style') or 'solid')})
    if not actors:
        raise ValueError('sequence 缺少 actors')
    # 步骤里出现但未声明的角色自动补上，避免连线画不出来
    for s in steps:
        for name in (s['from'], s['to']):
            if name not in actors:
                actors.append(name)

    n = len(actors)
    slot = (X1 - X0) / float(n)
    aw = min(170.0, slot - 16)
    pos = {}
    for i, a in enumerate(actors):
        cx = X0 + slot * (i + 0.5)
        pos[a] = {'cx': cx, 'x': cx - aw / 2, 'w': aw}

    h = STEP_TOP + len(steps) * STEP_H + BOTTOM_PAD
    return actors, steps, pos, int(h)


def svg_sequence(actors, steps, pos):
    out = ['  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
           'markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" '
           'fill="#ffffff70"/></marker></defs>']
    life_bottom = STEP_TOP + max(len(steps), 1) * STEP_H

    for a in actors:
        p = pos[a]
        out.append(rect(p['x'], TOP_Y, p['w'], ACTOR_H, fill='#5DADE222',
                        stroke='#5DADE288', sw=1, rx=10))
        out.append(text(p['cx'], TOP_Y + 34, clip(a, int(p['w'] / 11)), size=20,
                        fill='#ffffffee'))
        out.append('  <line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="#ffffff25" '
                   'stroke-width="1" stroke-dasharray="5 5"/>'
                   % (p['cx'], TOP_Y + ACTOR_H + 6, p['cx'], life_bottom))

    for i, s in enumerate(steps):
        y = STEP_TOP + i * STEP_H
        a, b = pos[s['from']], pos[s['to']]
        dash = ' stroke-dasharray="7 5"' if s['style'] == 'dash' else ''
        if a is b or s['from'] == s['to']:
            cx = a['cx']
            out.append('  <path d="M %.1f %.1f L %.1f %.1f L %.1f %.1f" fill="none" '
                       'stroke="#ffffff55" stroke-width="2" marker-end="url(#arrow)"%s/>'
                       % (cx - 8, y, cx + 26, y, cx + 8, y + 16, dash))
            lx = cx + 34
        else:
            x1 = a['cx'] + a['w'] / 2 - 4 if b['cx'] > a['cx'] else a['cx'] - a['w'] / 2 + 4
            x2 = b['cx'] - b['w'] / 2 + 4 if b['cx'] > a['cx'] else b['cx'] + b['w'] / 2 - 4
            out.append('  <line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="#ffffff66" '
                       'stroke-width="2" marker-end="url(#arrow)"%s/>' % (x1, y, x2, y, dash))
            lx = (x1 + x2) / 2
        label = ('%d. %s' % (i + 1, s['label'])) if s['label'] else str(i + 1)
        lines = wrap_cjk(label, 40)
        lw = min(520, max(len(l) for l in lines) * 8 + 18)
        out.append(rect(lx - lw / 2, y - 30, lw, 15 * len(lines) + 6,
                        fill='#1a1a2ecc', stroke='none', sw=0, rx=4))
        for j, l in enumerate(lines[:2]):
            out.append(text(lx, y - 18 + j * 15, l, size=16, fill='#ffffffcc', weight='400'))
    return '\n'.join(out)


# ══════════════ 入口 ══════════════
def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'svg'
    spec = json.loads(sys.stdin.read())
    dtype = str(spec.get('type') or 'architecture').lower()
    if dtype not in ('architecture', 'sequence'):
        raise ValueError('type 只支持 architecture / sequence，收到：%s' % dtype)

    if mode == 'normalize':
        if dtype == 'architecture':
            groups, _, _ = layout_architecture(spec)
            print(json.dumps({
                'type': dtype,
                'title': spec.get('title') or '',
                'groups': [{'title': g['title'], 'nodes': [n['name'] for n in g['nodes']]}
                           for g in groups],
                'edges': [{'from': str(e.get('from') or ''), 'to': str(e.get('to') or ''),
                           'label': str(e.get('label') or '')} for e in (spec.get('edges') or [])],
            }, ensure_ascii=False))
        else:
            actors, steps, _, _ = layout_sequence(spec)
            print(json.dumps({'type': dtype, 'title': spec.get('title') or '',
                              'actors': actors, 'steps': steps}, ensure_ascii=False))
        return

    if dtype == 'architecture':
        groups, node_index, height = layout_architecture(spec)
        body = svg_architecture(spec, groups, node_index)
    else:
        actors, steps, pos, height = layout_sequence(spec)
        body = svg_sequence(actors, steps, pos)

    print('__HEIGHT__%d' % height)
    print(body)


main()
PYEOF

main() {
    local spec=""

    # --file 便于超长 JSON / 调试；直接传字符串则由 AI 调用时使用
    if [ "${1:-}" = "--file" ]; then
        if [ -z "${2:-}" ] || [ ! -f "$2" ]; then
            log_error "图描述文件不存在：${2:-<空>}"
            exit 1
        fi
        spec=$(cat "$2")
    else
        spec="${1:-}"
    fi

    log_info "======================================"
    log_info "架构图 / 序列图生成启动"
    log_info "当前时间: $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    if [ -z "$spec" ]; then
        log_error "缺少图描述 JSON：bash scripts/tools/diagram_card.sh '<json>' 或 --file <path>"
        exit 1
    fi

    # 渲染器需要字体栈（card_utils.sh 已导出，这里兜底再 export 一次）
    export CARD_FONT="${CARD_FONT:-Noto Sans CJK SC, sans-serif}"

    # 1) 校验 + 规范化：非法 JSON / 缺字段在此终止，并给出可定位的错误
    local normalized height body title subtitle
    normalized=$(printf '%s' "$spec" | python3 -c "$DIAGRAM_PY" normalize)
    if [ -z "$normalized" ]; then
        log_error "图描述解析失败（非法 JSON 或缺少必填字段）"
        exit 1
    fi
    # 原始数据模式：吐出解析后的图结构后结束（由 flush_raw_output 统一输出）
    emit_raw "$normalized" json

    # 2) 生成 SVG 主体
    local rendered
    rendered=$(printf '%s' "$spec" | python3 -c "$DIAGRAM_PY" svg)
    if [ -z "$rendered" ]; then
        log_error "SVG 生成失败"
        exit 1
    fi
    height=$(printf '%s\n' "$rendered" | head -1 | sed 's/__HEIGHT__//')
    body=$(printf '%s\n' "$rendered" | tail -n +2)

    title=$(printf '%s' "$spec" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("title") or "系统架构图")' 2>/dev/null)
    subtitle=$(printf '%s' "$spec" | python3 -c 'import json,sys; s=json.load(sys.stdin); print(s.get("subtitle") or ("序列图" if (s.get("type") or "").lower()=="sequence" else "架构图"))' 2>/dev/null)
    [ -z "$title" ] && title="系统架构图"
    [ -z "$subtitle" ] && subtitle="架构图"

    # 3) 拼装 + 渲染
    {
        svg_header "$height" "#1a1a2e" "#16213e" "$title" "$subtitle"
        printf '%s\n' "$body"
        svg_footer "$height" "数据来源：本地渲染 · $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M')"
    } > "$SVG_FILE"

    if ! render_card "$SVG_FILE" "$OUTPUT_FILE"; then
        log_error "卡片渲染失败"
        exit 1
    fi
    rm -f "$SVG_FILE"

    log_success "图表已生成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
