#!/bin/bash
# ======================================
# 腾讯视频 热搜榜 Top15
# ======================================
#
# 数据源：腾讯视频热搜 JSON 接口（pbaccess.video.qq.com）
#   说明：原 SSR 页面 https://v.qq.com/biu/ranks/ 已 301 到 SPA 壳页，无法再抓 HTML 解析，
#         改用页面前端实际调用的 getSearchHotListHttp 接口（2026-10 验证可用）
#
# 使用方式：
#   bash scripts/tools/tencent_hot.sh                  # 全部 9 个榜单（默认）
#   bash scripts/tools/tencent_hot.sh card 电视剧       # 只出「电视剧」榜单的卡片
#   bash scripts/tools/tencent_hot.sh data [电视剧]     # 出精简后的榜单数据（供 AI / 调度器）
# 说明：接口一次返回 9 个 channel（热搜 / 电视剧 / 电影 / 综艺 / 动漫 / 少儿 / 纪录片 /
#       游戏 / 科技）。不传榜单名时全量输出；传了就只保留该组（组名不存在则报错退出）。
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

OUTPUT_FILE="${CARD_OUTPUT_DIR}/tencent_hot_card.png"
SVG_FILE="/tmp/tencent_hot_card.svg"

fetch_data() {
    local url="https://pbaccess.video.qq.com/trpc.tencentvideohotlistdata.hotlistdata.DoSearchHotListHttp/getSearchHotListHttp?ChannelID=&PageSize=20&PageNum=0&SceneID=2"
    # 日内缓存：同一天只打一次远端接口
    local cache_file
    cache_file=$(api_cache_path tencenthot)
    local result
    result=$(API_ARCHIVE_SLOT=hour cached_curl "${cache_file}" -s --max-time 15 "$url" \
        -H "Referer: https://v.qq.com/" \
        -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" 2>/dev/null)

    if [ -z "$result" ]; then
        log_error "腾讯视频热搜数据获取失败"
        return 1
    fi

    echo "$result"
}

parse_data() {
    local data="$1"
    # $2 = 榜单名（可空）：接口里的 ChannelName，如「电视剧」；空表示全量
    # 接口一次返回 9 个 channel（热搜 / 电视剧 / 电影 / 动漫 / 综艺 / 少儿 / 纪录片 / 游戏 / 科技），
    # 以前只取 Results[0]（热搜），其余 8 组全丢。这里按 channel 分组全量产出，
    # 每组取前 PER_GROUP 条（默认 10，可用 TENCENT_HOT_PER_GROUP 覆盖），最多 MAX_GROUPS 组。
    local channel="${2:-}"
    local per_group="${TENCENT_HOT_PER_GROUP:-10}"
    local max_groups="${TENCENT_HOT_MAX_GROUPS:-9}"
    echo "$data" | CHANNEL="$channel" PER_GROUP="$per_group" MAX_GROUPS="$max_groups" node -e "
const raw = require('fs').readFileSync(0, 'utf8');
let json;
try { json = JSON.parse(raw); } catch { process.stderr.write('响应不是合法 JSON'); process.exit(1); }
const perGroup = Number(process.env.PER_GROUP || 10);
const maxGroups = Number(process.env.MAX_GROUPS || 9);
const wanted = String(process.env.CHANNEL || '').trim();
let groups = (json?.data?.Results ?? [])
    .map((r) => ({
        name: String(r?.ChannelName ?? '').trim(),
        items: (r?.Result?.ListInfo ?? []).map((it) => ({
            title: String(it.Query ?? '').trim(),
            hot: Number(it.HotLevel ?? 0),
        })).filter((it) => it.title).slice(0, perGroup),
    }))
    .filter((g) => g.name && g.items.length > 0);
// 指定榜单时只留该组：用户问「电视剧热搜」就该只拿到电视剧榜，而不是整份总榜
if (wanted) {
    groups = groups.filter((g) => g.name === wanted);
    if (groups.length === 0) { process.stderr.write('未找到榜单：' + wanted); process.exit(1); }
}
groups = groups.slice(0, maxGroups);
if (groups.length === 0) { process.stderr.write('解析失败：没有可用的 channel'); process.exit(1); }
console.log(JSON.stringify(groups));
"
}

generate_card() {
    local groups_json="$1"
    local date_str="$2"
    # $3 = 榜单名（可空）：指定时标题带上榜单名，避免「只要电视剧榜」却出个总榜标题
    local channel="${3:-}"

    # 渲染行：每个分组一个标题行 + 组内条目行；num 在组内重新编号
    local rows_json
    rows_json=$(node -e "
const groups = JSON.parse(process.argv[1]);
function trunc(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : (s || ''); }
const out = [];
for (const g of groups) {
    out.push({ kind: 'group', name: g.name, count: g.items.length + ' 条' });
    g.items.forEach((item, i) => {
        out.push({
            kind: 'item',
            num: String(i + 1).padStart(2, '0'),
            title: trunc(item.title, 28),
            hot: item.hot >= 10000 ? (item.hot / 10000).toFixed(1) + '万' : String(item.hot || ''),
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
        local card_title="腾讯视频 热搜榜"
        local card_sub="${date_str}  ${total_items} 条 · 多榜单"
        if [ -n "$channel" ]; then
            card_title="腾讯视频 ${channel}榜"
            card_sub="${date_str}  ${total_items} 条"
        fi
        svg_header "$h" "#1A237E" "#0D1642" "$card_title" "$card_sub"

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
                svg_list_row "$num" "$y" "$title" "$hot" "#ffffff80" "$bg" "$title_color" "$item_h" "#ffffff12"
                y=$((y + item_h + row_gap))
            fi
            i=$((i + 1))
        done

        svg_footer "$h" "数据来源：腾讯视频"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}

main() {
    # $1 = 榜单名（可空）：「热搜 / 电视剧 / 电影 / 综艺 / 动漫 / 少儿 / 纪录片 / 游戏 / 科技」
    # 位置参数顺序：card_utils.sh 已把 data / json 模式位参数 shift 掉，这里 $1 就是榜单名；
    # 手工 bash 调用常会顺手写上 card，这里一并吃掉（它就是默认模式，不是榜单名）
    [ "${1:-}" = "card" ] && shift
    local channel="${1:-}"

    log_info "======================================"
    log_info "腾讯视频 热搜榜卡片生成启动${channel:+（榜单：${channel}）}"
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
    # 原始响应带 HzImgURL 等噪音，单日归档就 2 MB：AI 只能看到开头 6000 字符，
    # 结果问「电视剧热搜」拿到的永远排在最前面的「热搜」组。换成去噪后的分组 JSON，
    # 9 组全在 6000 字符内，AI 才能按用户点名的榜单作答。
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
