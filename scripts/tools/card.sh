#!/bin/bash
# ======================================
# 信息卡片统一路由入口
# ======================================
#
# 功能说明：
#   1. 按自然语言关键字路由到 scripts/tools/ 下对应的卡片脚本
#   2. 透传子脚本 stdout（PNG 绝对路径）与退出码
#   3. 关键字表与 SKILL.md 保持同源（改 SKILL.md 时同步改本文件 KEYWORD_MAP）
#
# 使用方式：
#   bash scripts/tools/card.sh "<关键字>"
#   bash scripts/tools/card.sh --list            # 列出所有关键字
#   bash scripts/tools/card.sh --help            # 帮助
#
# 示例：
#   bash scripts/tools/card.sh "b站热搜"        # => bilibili_hot.sh
#   bash scripts/tools/card.sh "抖音热搜"        # => douyin_hot.sh
#   bash scripts/tools/card.sh "今日油价"        # => oil_price_card_gen.sh
#
# 输出契约（与子脚本一致）：
#   成功：stdout 输出 PNG 绝对路径，退出码 0
#   失败：stderr 输出错误信息，退出码非 0
#
# 作者：智能提醒系统
# 更新：2026-04-30
# ======================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 接入统一日志体系：stderr 输出 + tools.log 落盘，便于排查关键字路由异常
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"

# ---------- 关键字 → 脚本 映射表 ----------
# 每行格式：<归一化后的关键字>|<脚本文件名[ 可选参数...]>
#   「脚本」一段支持附带空格分隔的参数（如 tencent_hot.sh card 电视剧），
#   用于「腾讯电视剧热搜」这类细分榜单词：归一化关键字精确命中后，
#   整条后半段原样交给 bash 执行（脚本名 + 参数）。
# 归一化规则：lower-case、去空格、去 /、去 -、中英文关键字同表
KEYWORD_MAP=(
    # —— 天气与生活 ——
    "天气预报|weather_card_gen.sh"
    "天气|weather_card_gen.sh"
    "weather|weather_card_gen.sh"
    "异常天气|weather_alert_card_gen.sh"
    "天气预警|weather_alert_card_gen.sh"
    "weatheralert|weather_alert_card_gen.sh"
    "空气质量|air_quality.sh"
    "aqi|air_quality.sh"
    "airquality|air_quality.sh"
    "日历|calendar.sh"
    "日历提醒|calendar.sh"
    "calendar|calendar.sh"
    "每日一言|daily_word.sh"
    "一言|daily_word.sh"
    "dailyword|daily_word.sh"
    "星座|horoscope_card.sh"
    "星座运势|horoscope_card.sh"
    "运势|horoscope_card.sh"
    "horoscope|horoscope_card.sh"
    "黄历|almanac_card.sh"
    "老黄历|almanac_card.sh"
    "今日黄历|almanac_card.sh"
    "almanac|almanac_card.sh"

    # —— 新闻资讯 ——
    "ai新闻|ai_news_card_gen.sh"
    "ainews|ai_news_card_gen.sh"
    "热搜|weibo_hot.sh"
    "微博热搜|weibo_hot.sh"
    "今日热搜|weibo_hot.sh"
    # 微博分榜单：接口还返回 hotgov（要闻置顶），独立关键词直出该组
    "微博要闻|weibo_hot.sh card 要闻"
    "娱乐新闻|ent_news.sh"
    "娱乐|ent_news.sh"
    "entnews|ent_news.sh"
    "国际新闻|intl_news.sh"
    "国际|intl_news.sh"
    "intlnews|intl_news.sh"

    # —— 财经行情 ——
    "a股|stock_market.sh"
    "a股大盘|stock_market.sh"
    "大盘|stock_market.sh"
    "沪深|stock_market.sh"
    "stockmarket|stock_market.sh"
    "港股|hk_stock.sh"
    "港股大盘|hk_stock.sh"
    "hkstock|hk_stock.sh"
    "美股|us_stock.sh"
    "美股大盘|us_stock.sh"
    "usstock|us_stock.sh"
    "黄金|gold_silver.sh"
    "白银|gold_silver.sh"
    "黄金白银|gold_silver.sh"
    "goldsilver|gold_silver.sh"
    "汇率|exchange_rate.sh"
    "exchangerate|exchange_rate.sh"
    "油价|oil_price_card_gen.sh"
    "今日油价|oil_price_card_gen.sh"
    "oilprice|oil_price_card_gen.sh"

    # —— 热搜榜 ——
    "b站热搜|bilibili_hot.sh"
    "哔哩哔哩热搜|bilibili_hot.sh"
    "bilibili热搜|bilibili_hot.sh"
    # B站分榜单：接口还返回 top_list（置顶），独立关键词直出该组
    "b站置顶|bilibili_hot.sh card 置顶"
    "b站热搜榜|bilibili_hot.sh card 热搜"
    "腾讯热搜|tencent_hot.sh"
    "腾讯视频热搜|tencent_hot.sh"
    # 腾讯视频分榜单：独立关键词直出对应榜单（路由到 tencent_hot.sh card <榜单名>）
    "腾讯电视剧热搜|tencent_hot.sh card 电视剧"
    "腾讯电影热搜|tencent_hot.sh card 电影"
    "腾讯综艺热搜|tencent_hot.sh card 综艺"
    "腾讯动漫热搜|tencent_hot.sh card 动漫"
    "腾讯少儿热搜|tencent_hot.sh card 少儿"
    "腾讯纪录片热搜|tencent_hot.sh card 纪录片"
    "腾讯游戏热搜|tencent_hot.sh card 游戏"
    "腾讯科技热搜|tencent_hot.sh card 科技"
    "爱奇艺热搜|iqiyi_hot.sh"
    "iqiyi热搜|iqiyi_hot.sh"
    "抖音热搜|douyin_hot.sh"
    "抖音|douyin_hot.sh"
    "douyin热搜|douyin_hot.sh"
    "douyin|douyin_hot.sh"
    # 抖音分榜单：接口还返回 trending_list（热点），独立关键词直出该组
    "抖音热点|douyin_hot.sh card 热点"
    "抖音热搜榜|douyin_hot.sh card 热搜"

    # —— 生活 ——
    # 二维码不注册关键词：关键词表只能路由「关键字 → 固定命令」，而二维码的内容必须由调用方
    # 传入（用户说"把 https://x 生成二维码"），硬编码进表里只会出一张内容固定的占位图。
    # 需要生成二维码请走技能入参：card_skill(skill_key=qrcode, params={content: "..."})，
    # 或直接 bash scripts/tools/qrcode.sh "<内容>" [尺寸]。

    # —— 科技 / 系统 ——
    "github|github_trending.sh"
    "githubtrending|github_trending.sh"
    "github热门|github_trending.sh"
    "steam|steam_hot.sh"
    "steam热门|steam_hot.sh"
    "steamhot|steam_hot.sh"
    # Steam 分榜单：接口一次返回热销/特惠/新品/即将推出 四组，独立关键词直出对应组
    "steam热销|steam_hot.sh card 热销"
    "steam特惠|steam_hot.sh card 特惠"
    "steam新品|steam_hot.sh card 新品"
    "steam即将推出|steam_hot.sh card 即将推出"
)

# ---------- 工具函数 ----------

# 关键字归一化：转小写 + 去空格 + 去 / 去 -
normalize_keyword() {
    local raw="$1"
    # bash 下 tr 不识别多字节字符的大小写映射，只对 ASCII 生效，符合我们诉求
    echo "$raw" | tr '[:upper:]' '[:lower:]' | tr -d ' \t/-'
}

# 按归一化关键字查找脚本名
lookup_script() {
    local key
    key="$(normalize_keyword "$1")"
    local entry k v
    for entry in "${KEYWORD_MAP[@]}"; do
        k="${entry%%|*}"
        v="${entry##*|}"
        if [[ "$k" == "$key" ]]; then
            echo "$v"
            return 0
        fi
    done
    return 1
}

# 打印帮助
print_help() {
    cat <<'EOF'
信息卡片统一路由入口

用法：
  bash scripts/tools/card.sh "<关键字>"
  bash scripts/tools/card.sh --list
  bash scripts/tools/card.sh --help

示例：
  bash scripts/tools/card.sh "b站热搜"        # => bilibili_hot.sh
  bash scripts/tools/card.sh "今日油价"
  bash scripts/tools/card.sh "A 股大盘"

关键字分组（详见 SKILL.md）：
  天气与生活 | 新闻资讯 | 财经行情 | 热搜榜(微博/B站/腾讯/爱奇艺/抖音) | 科技/系统
EOF
}

# 列出所有可用关键字（按脚本分组）
print_list() {
    echo "已注册关键字（共 ${#KEYWORD_MAP[@]} 条）："
    echo
    local prev_script="" entry k v
    # 按脚本名排序后输出
    local sorted
    sorted="$(
        for entry in "${KEYWORD_MAP[@]}"; do
            echo "${entry##*|}|${entry%%|*}"
        done | sort
    )"
    while IFS='|' read -r script kw; do
        if [[ "$script" != "$prev_script" ]]; then
            [[ -n "$prev_script" ]] && echo
            echo "[$script]"
            prev_script="$script"
        fi
        echo "  - $kw"
    done <<<"$sorted"
}

# ---------- 参数解析 ----------

if [[ $# -eq 0 || "$1" == "-h" || "$1" == "--help" ]]; then
    print_help
    exit 0
fi

if [[ "$1" == "--list" || "$1" == "-l" ]]; then
    print_list
    exit 0
fi

# --strict：明确要求"必须命中关键字"的调用方可加此开关；默认静默放行，交由 AI 处理
STRICT=0
if [[ "$1" == "--strict" ]]; then
    STRICT=1
    shift
    if [[ $# -eq 0 ]]; then
        log_error "--strict 需要一个关键字参数"
        echo "FAILED: --strict 需要一个关键字参数" >&2
        exit 2
    fi
fi

KEYWORD="$1"

# ---------- 路由并执行 ----------
# 契约：
#   - 命中关键字 → 交给子脚本处理，stdout 输出渲染/执行结果（供 AI 直接透传）
#   - 未命中关键字 → 静默退出 0，stdout 完全为空；AI 侧据此判定"脚本不接管，我来答"
#     （若调用方希望"未命中 = 失败"，请显式加 --strict）

SCRIPT_NAME="$(lookup_script "$KEYWORD")" || {
    if [[ "$STRICT" == "1" ]]; then
        log_error "未识别的关键字（--strict）: $KEYWORD"
        echo "FAILED: 未识别的关键字: $KEYWORD" >&2
        echo "可用关键字请运行: bash scripts/tools/card.sh --list" >&2
        exit 2
    fi
    log_info "未命中关键字，交由 AI 处理（非脚本关键字）: $KEYWORD"
    exit 0
}

# SCRIPT_NAME 可为 "脚本名" 或 "脚本名 参数1 参数2..."（分榜单路由）；
# 先拆出脚本路径（第一个词）校验存在性，再原样透传全部参数执行。
TARGET="${SCRIPT_DIR}/${SCRIPT_NAME%% *}"

if [[ ! -f "$TARGET" ]]; then
    log_error "目标脚本不存在: $TARGET"
    echo "FAILED: 目标脚本不存在: $TARGET" >&2
    exit 3
fi

# AI 关键字触发路径：【不推送 PNG 到企微群】
# - AI 关键字场景的消息来源无法区分（群聊 / 私聊 / 微信），若一律推群会造成私聊触发
#   却把图推到群里的窘境。图片的回传由上层 OpenClaw 网关自行处理（原路返回）。
# - 因此本入口【不】注入 PUSH_CARD_IMAGE，子脚本仅负责生成 PNG 到磁盘并在 stdout
#   输出路径即可。
# - 其他入口不受影响：
#   * crontab / 提醒脚本直接调用 tools/*.sh 子脚本时，不经过此处，保持"条件满足才
#     推送"的既有语义，由上游自行 export PUSH_CARD_IMAGE=1 或显式调用 send_card_image。
#   * web 后端"生成图片"按钮另行在 skill-map 里注入了同名 env，保持不变。
# 故此处显式不设置 PUSH_CARD_IMAGE。

log_info "card.sh 路由 → $SCRIPT_NAME （关键字: $KEYWORD）"

# 不使用 exec：需要在子脚本退出后，把它的 stdout 回显 + 企微推送结果写入 card.sh 日志
# （日志走 log_utils.sh，默认落在 scripts/tools/tools.log）
# 注意：TARGET 已指向脚本文件本身；若路由带参数（如 tencent_hot.sh card 电视剧），
# 用 bash -c 执行完整 SCRIPT_NAME（工作目录切到 tools/，与无参路径行为一致）。
STDOUT_CAP="$(mktemp -t card_stdout.XXXXXX)"
STDERR_CAP="$(mktemp -t card_stderr.XXXXXX)"
trap 'rm -f "$STDOUT_CAP" "$STDERR_CAP"' EXIT

set +e
if [[ "$SCRIPT_NAME" == "${SCRIPT_NAME%% *}" ]]; then
    bash "$TARGET" \
        > >(tee "$STDOUT_CAP") \
        2> >(tee "$STDERR_CAP" >&2)
else
    (cd "$SCRIPT_DIR" && bash $SCRIPT_NAME) \
        > >(tee "$STDOUT_CAP") \
        2> >(tee "$STDERR_CAP" >&2)
fi
CHILD_RC=$?
set -e
wait 2>/dev/null || true

# ---------- 用户响应回显 ----------
if [[ -s "$STDOUT_CAP" ]]; then
    STDOUT_BYTES="$(wc -c <"$STDOUT_CAP" | tr -d ' ')"
    STDOUT_LINES="$(wc -l <"$STDOUT_CAP" | tr -d ' ')"
    log_info "[用户响应] 子脚本 ${SCRIPT_NAME} 输出：${STDOUT_LINES} 行 / ${STDOUT_BYTES} 字节 ↓↓↓"
    while IFS= read -r _line || [[ -n "$_line" ]]; do
        log_info "  │ $_line"
    done <"$STDOUT_CAP"
    log_info "[用户响应] ↑↑↑ 结束"
else
    log_info "[用户响应] 子脚本 ${SCRIPT_NAME} 无 stdout 输出"
fi

# ---------- 企微推送概要（文本消息 + 图片消息）----------
# 说明：card.sh 路径既可能发 Markdown（send_wecom_message），也可能通过 PUSH_CARD_IMAGE=1
# 触发 send_card_image 发图片；两者在 stderr 都会留下可识别的标记行，这里一并统计。
# 用 awk 计数，避免 `grep -c || echo 0` 的 "0\n0" 坑。
PUSH_TEXT_OK=0
PUSH_TEXT_FAIL=0
PUSH_IMAGE_OK=0
PUSH_IMAGE_FAIL=0
if [[ -s "$STDERR_CAP" ]]; then
    PUSH_TEXT_OK=$(awk '/\[企微推送\] 消息发送成功/{c++} END{print c+0}' "$STDERR_CAP")
    PUSH_TEXT_FAIL=$(awk '/\[企微推送\] 消息发送失败/{c++} END{print c+0}' "$STDERR_CAP")
    # 与 svg.sh::send_card_image 实际输出对齐：
    #   成功："[企微图片] 推送成功 (url...)"
    #   失败："[企微图片] 推送失败 (url...): resp"
    PUSH_IMAGE_OK=$(awk '/\[企微图片\] 推送成功/{c++} END{print c+0}' "$STDERR_CAP")
    PUSH_IMAGE_FAIL=$(awk '/\[企微图片\] 推送失败/{c++} END{print c+0}' "$STDERR_CAP")
fi
TOTAL_OK=$((PUSH_TEXT_OK + PUSH_IMAGE_OK))
TOTAL_FAIL=$((PUSH_TEXT_FAIL + PUSH_IMAGE_FAIL))
if [[ $TOTAL_OK -gt 0 || $TOTAL_FAIL -gt 0 ]]; then
    log_info "[企微推送] 概要：文本 成功${PUSH_TEXT_OK}/失败${PUSH_TEXT_FAIL}，图片 成功${PUSH_IMAGE_OK}/失败${PUSH_IMAGE_FAIL}"
else
    log_info "[企微推送] 概要：未触发企微推送（子脚本未调用 send_wecom_message / send_card_image）"
fi

if [[ $CHILD_RC -eq 0 ]]; then
    log_info "card.sh 子脚本 ${SCRIPT_NAME} 执行完成（退出码: 0）"
else
    log_error "card.sh 子脚本 ${SCRIPT_NAME} 执行失败（退出码: $CHILD_RC）"
fi

exit $CHILD_RC
