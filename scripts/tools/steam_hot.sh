#!/bin/bash
# ======================================
# Steam 榜单（热销 / 特惠 / 新品 / 即将推出）
# ======================================
#
# 功能说明：
#   1. 获取 Steam 商店 featuredcategories 接口的多组榜单
#   2. 展示游戏名称和价格
#   3. 生成 Steam 榜单卡片
#
# 使用方式：
#   bash scripts/tools/steam_hot.sh                    # 全部榜单（默认每组 Top10）
#   bash scripts/tools/steam_hot.sh card 特惠           # 只出「特惠」榜单的卡片
#   bash scripts/tools/steam_hot.sh data [特惠]         # 出精简后的榜单数据（供 AI / 调度器）
# 说明：接口一次返回 4 个可用榜单 —— top_sellers（热销）/ specials（特惠）/
#       new_releases（新品）/ coming_soon（即将推出），以前只取 top_sellers，其余整组丢弃。
#       不传榜单名时四组全出；传了就只保留该组。每组条数可用 STEAM_HOT_PER_GROUP 覆盖。
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

OUTPUT_FILE="${CARD_OUTPUT_DIR}/steam_hot_card.png"
SVG_FILE="/tmp/steam_hot_card.svg"

fetch_data() {
    local url="https://store.steampowered.com/api/featuredcategories/"
    # 日内缓存：Steam 榜单按天更新，同一天只打一次远端接口
    local result
    result=$(API_ARCHIVE_SLOT=hour fetch_url_cached steamhot "" "$url")
    if [ -z "$result" ]; then
        log_error "Steam数据获取失败"
        return 1
    fi

    echo "$result"
}

parse_data() {
    local data="$1"
    # $2 = 榜单名（可空）：「热销 / 特惠 / 新品 / 即将推出」；空表示全量
    local category="${2:-}"
    local per_group="${STEAM_HOT_PER_GROUP:-10}"
    echo "$data" | CATEGORY="$category" PER_GROUP="$per_group" node -e "
const raw = require('fs').readFileSync(0, 'utf8');
let json;
try { json = JSON.parse(raw); } catch { process.stderr.write('响应不是合法 JSON'); process.exit(1); }
const perGroup = Number(process.env.PER_GROUP || 10);
const wanted = String(process.env.CATEGORY || '').trim();
const pick = (key, name) => ({
    name,
    items: ((json?.[key]?.items) ?? []).map((it) => ({
        title: String(it?.name ?? '').trim(),
        price: Number(it?.final_price ?? it?.discount_price ?? 0),
        // 接口价格是「最小货币单位 × 100」，币种在 item.currency（实测为 USD），
        // 卡片必须按真实币种出符号，否则会把美元价标成人民币
        currency: String(it?.currency ?? 'USD'),
    })).filter((it) => it.title).slice(0, perGroup),
});
let groups = [
    pick('top_sellers', '热销'),
    pick('specials', '特惠'),
    pick('new_releases', '新品'),
    pick('coming_soon', '即将推出'),
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
    # $3 = 榜单名（可空）：指定时标题带上榜单名，避免「只要特惠榜」却出个总榜标题
    local category="${3:-}"

    # 渲染行：每个分组一个标题行 + 组内条目行；num 在组内重新编号
    local rows_json
    rows_json=$(node -e "
const groups = JSON.parse(process.argv[1]);
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : (s || ''); }
// 币种 → 符号：接口实测返回 USD，卡片按真实币种出符号（以前一律标 ¥，把美元价显示成了人民币）
const SYMBOLS = { USD: '$', CNY: '¥', EUR: '€', GBP: '£', JPY: '¥' };
const symbolOf = (c) => SYMBOLS[c] ?? '';
const out = [];
for (const g of groups) {
    out.push({ kind: 'group', name: g.name, count: g.items.length + ' 条' });
    g.items.forEach((item, i) => {
        out.push({
            kind: 'item',
            num: String(i + 1).padStart(2, '0'),
            title: trunc(item.title, 32),
            price: item.price === 0 ? '免费' : symbolOf(item.currency) + (item.price / 100).toFixed(2),
        });
    });
}
console.log(JSON.stringify(out));
" "$groups_json")

    local count; count=$(echo "$rows_json" | jq 'length')
    local group_h=52 item_h=78 row_gap=14 start_y=195  # 原版 y += 92，即行高 78 + 间距 14
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
        local card_title="Steam 热销榜"
        local card_sub="${date_str}  ${total_items} 条 · 多榜单"
        if [ -n "$category" ]; then
            card_title="Steam ${category}榜"
            card_sub="${date_str}  ${total_items} 条"
        fi
        svg_header "$h" "#1B2838" "#171A21" "$card_title" "$card_sub"

        local y=$start_y
        i=0
        while [ "$i" -lt "$count" ]; do
            local row name title num price
            row=$(echo "$rows_json" | jq -c ".[$i]")
            kind=$(echo "$row" | jq -r '.kind')
            if [ "$kind" = "group" ]; then
                name=$(echo "$row" | jq -r '.name')
                svg_group_title "$y" "$name" "$(echo "$row" | jq -r '.count')" "$group_h"
                y=$((y + group_h + row_gap))
            else
                num=$(echo "$row"   | jq -r '.num')
                title=$(echo "$row" | jq -r '.title')
                price=$(echo "$row" | jq -r '.price')
                svg_list_row "$num" "$y" "$title" "$price" "#4CAF50" "#ffffff0a" "#ffffffdd" "$item_h"
                y=$((y + item_h + row_gap))
            fi
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：Steam"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    # $1 = 榜单名（可空）：「热销 / 特惠 / 新品 / 即将推出」
    # 位置参数顺序：card_utils.sh 已把 data / json 模式位参数 shift 掉，这里 $1 就是榜单名；
    # 手工 bash 调用常会顺手写上 card，这里一并吃掉（它就是默认模式，不是榜单名）
    [ "${1:-}" = "card" ] && shift
    local category="${1:-}"

    log_info "======================================"
    log_info "Steam 榜单卡片生成启动${category:+（榜单：${category}）}"
    log_info "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local date_str
    date_str=$(get_date_str)

    local data
    data=$(fetch_data) || exit 1
    log_info "数据获取成功"

    local items_json
    items_json=$(parse_data "$data" "$category") || exit 1
    log_info "数据解析完成"

    # ── data / json 模式：用「精简后的分组数据」替换默认的整份接口原始返回 ──
    # 原始响应带大量图片 URL（featuredcategories 单日归档上百 KB），AI 只能看到开头 6000 字符，
    # 于是问「特惠榜」拿到的永远排在最前面的「热销」组。换成去噪后的分组 JSON，四组都能进上下文。
    if [ "${CARD_OUTPUT_MODE:-card}" != "card" ]; then
        printf '%s' "$items_json" > "$CARD_RAW_FILE"
        printf 'json' > "${CARD_RAW_FILE}.fmt"
        flush_raw_output
    fi

    generate_card "$items_json" "$date_str" "$category"

    log_success "卡片生成完成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
