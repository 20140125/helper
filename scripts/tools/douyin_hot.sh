#!/bin/bash
# ======================================
# 抖音 热搜榜 Top15
# ======================================
#
# 数据源：抖音 Web 热搜 API
#
# 使用方式：
#   bash scripts/tools/douyin_hot.sh                  # 全部榜单（热搜 + 热点）
#   bash scripts/tools/douyin_hot.sh card 热点         # 只出「热点」榜单的卡片
#   bash scripts/tools/douyin_hot.sh data [热点]       # 出精简后的榜单数据（供 AI / 调度器）
# 说明：接口一次返回两个榜单 —— word_list（热搜，约 50 条）与 trending_list（热点，约 5 条），
#       以前只取 word_list，热点整组丢弃。不传榜单名时两组全出；传了就只保留该组。
#
# 作者：智能提醒系统
# 更新：2026-10-26
# ======================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/douyin_hot_card.png"
SVG_FILE="/tmp/douyin_hot_card.svg"

fetch_data() {
    local url="https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web"
    # 日内缓存：同一天只打一次远端接口
    local cache_file
    cache_file=$(api_cache_path douyinhot)
    local result
    result=$(API_ARCHIVE_SLOT=hour cached_curl "${cache_file}" -s --max-time 10 "$url" \
        -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
        -H "Referer: https://www.douyin.com/" 2>/dev/null)

    if [ -z "$result" ]; then
        log_error "抖音热搜数据获取失败"
        return 1
    fi

    # 两个榜单任一有数据就算成功（只判 word_list 会在热搜为空、热点有货时误判失败）
    local count
    count=$(echo "$result" | jq '((.data.word_list | length) + (.data.trending_list | length))' 2>/dev/null)
    if [ "$count" = "0" ] || [ -z "$count" ]; then
        log_error "抖音热搜数据为空"
        return 1
    fi

    echo "$result"
}

parse_data() {
    local data="$1"
    # $2 = 榜单名（可空）：「热搜」= word_list、「热点」= trending_list；空表示全量
    local channel="${2:-}"
    local per_group="${DOUYIN_HOT_PER_GROUP:-15}"
    echo "$data" | CHANNEL="$channel" PER_GROUP="$per_group" node -e "
const raw = require('fs').readFileSync(0, 'utf8');
let json;
try { json = JSON.parse(raw); } catch { process.stderr.write('响应不是合法 JSON'); process.exit(1); }
const perGroup = Number(process.env.PER_GROUP || 15);
const wanted = String(process.env.CHANNEL || '').trim();
const pick = (list) => (list ?? []).map((it) => ({
    title: String(it.word ?? '').trim(),
    hot: Number(it.hot_value ?? 0),
})).filter((it) => it.title).slice(0, perGroup);
let groups = [
    { name: '热搜', items: pick(json?.data?.word_list) },
    { name: '热点', items: pick(json?.data?.trending_list) },
].filter((g) => g.items.length > 0);
if (wanted) {
    groups = groups.filter((g) => g.name === wanted);
    if (groups.length === 0) { process.stderr.write('未找到榜单：' + wanted); process.exit(1); }
}
if (groups.length === 0) { process.stderr.write('解析失败：没有可用的榜单'); process.exit(1); }
console.log(JSON.stringify(groups));
"
}

generate_card() {
    local groups_json="$1"
    local date_str="$2"
    # $3 = 榜单名（可空）：指定时标题带上榜单名，避免「只要热点榜」却出个总榜标题
    local channel="${3:-}"

    # 渲染行：每个分组一个标题行 + 组内条目行；num 在组内重新编号
    local rows_json
    rows_json=$(node -e "
const groups = JSON.parse(process.argv[1]);
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : (s || ''); }
function fmtHot(v) {
    if (!v || v <= 0) return '';
    if (v >= 10000) return (v / 10000).toFixed(1) + 'w';
    return String(v);
}
const out = [];
for (const g of groups) {
    out.push({ kind: 'group', name: g.name, count: g.items.length + ' 条' });
    g.items.forEach((item, i) => {
        out.push({
            kind: 'item',
            num: String(i + 1).padStart(2, '0'),
            title: trunc(item.title, 28),
            hot: fmtHot(item.hot),
            top3: i < 3,
        });
    });
}
console.log(JSON.stringify(out));
" "$groups_json")

    local count; count=$(echo "$rows_json" | jq 'length')
    local group_h=52 item_h=72 row_gap=10 start_y=195
    # 高度按行类型累加（分组标题行与条目行高度不同）
    local h=$start_y
    local i=0 kind
    while [ "$i" -lt "$count" ]; do
        kind=$(echo "$rows_json" | jq -r ".[$i].kind")
        if [ "$kind" = "group" ]; then
            h=$((h + group_h + row_gap))
        else
            h=$((h + item_h + row_gap))
        fi
        i=$((i + 1))
    done
    h=$((h + 70))

    {
        local total_items
        total_items=$(echo "$rows_json" | jq '[.[] | select(.kind == "item")] | length')
        local card_title="抖音 热搜榜"
        local card_sub="${date_str}  ${total_items} 条 · 多榜单"
        if [ -n "$channel" ]; then
            card_title="抖音 ${channel}榜"
            card_sub="${date_str}  ${total_items} 条"
        fi
        svg_header "$h" "#E65100" "#7A2B00" "$card_title" "$card_sub"

        local y=$start_y
        i=0
        while [ "$i" -lt "$count" ]; do
            local row name title num hot top3 title_color bg
            row=$(echo "$rows_json" | jq -c ".[$i]")
            kind=$(echo "$row" | jq -r '.kind')
            if [ "$kind" = "group" ]; then
                name=$(echo "$row" | jq -r '.name')
                svg_group_title "$y" "$name" "$(echo "$row" | jq -r '.count')" "$group_h"
                y=$((y + group_h + row_gap))
            else
                num=$(echo "$row"   | jq -r '.num')
                title=$(echo "$row" | jq -r '.title')
                hot=$(echo "$row"   | jq -r '.hot')
                top3=$(echo "$row"  | jq -r '.top3')
                if [ "$top3" = "true" ]; then
                    title_color="#ffffff"; bg="highlight"
                else
                    title_color="#ffffff99"; bg="#ffffff08"
                fi
                svg_list_row "$num" "$y" "$title" "$hot" "#FF9800" "$bg" "$title_color" "$item_h" "#ffffff12"
                y=$((y + item_h + row_gap))
            fi
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：抖音"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    # $1 = 榜单名（可空）：「热搜」或「热点」
    # 位置参数顺序：card_utils.sh 已把 data / json 模式位参数 shift 掉，这里 $1 就是榜单名；
    # 手工 bash 调用常会顺手写上 card，这里一并吃掉（它就是默认模式，不是榜单名）
    [ "${1:-}" = "card" ] && shift
    local channel="${1:-}"

    log_info "======================================"
    log_info "抖音 热搜榜卡片生成启动${channel:+（榜单：${channel}）}"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local date_str
    date_str=$(get_date_str)
    log_info "生成日期: $date_str"

    local data
    data=$(fetch_data) || exit 1
    log_info "数据获取成功"

    local items_json
    items_json=$(parse_data "$data" "$channel") || exit 1
    log_info "数据解析完成"

    # ── data / json 模式：用「精简后的分组数据」替换默认的整份接口原始返回 ──
    # 原始响应带 word_cover 等图片字段，单日归档几十 KB：AI 只能看到开头 6000 字符，
    # 结果问「热点榜」拿到的永远排在最前面的「热搜」组。换成去噪后的分组 JSON，
    # 两组都能进上下文，AI 才能按用户点名的榜单作答。
    if [ "${CARD_OUTPUT_MODE:-card}" != "card" ]; then
        printf '%s' "$items_json" > "$CARD_RAW_FILE"
        printf 'json' > "${CARD_RAW_FILE}.fmt"
        flush_raw_output
    fi

    generate_card "$items_json" "$date_str" "$channel"
    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"

    echo "$OUTPUT_FILE"
}

main "$@"
