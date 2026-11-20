#!/bin/bash
# ======================================
# reminder.sh 子模块：关键字映射数据
# ======================================
#
# 职责：
#   - 定义静态关键字 → 脚本映射数组 KEYWORD_MAP
#   - 提供脚本名 → 中文分组标题的映射函数 script_display_name（用于快捷指令清单展示）
#
# 本文件是**纯数据层**，不做任何 I/O、不写日志、不依赖 jq / network。
#
# 约定：
#   - 每行格式：<归一化后的关键字>|<脚本文件名>[ <默认参数>]
#   - 归一化规则：lower-case、去空格、去 /、去 -（与 card.sh 一致）
#   - workday_manager.sh 必须带子命令才会工作，默认追加 auto
#   - 其他脚本无参即可执行，保持空默认参数
#   - 特殊目标 "__builtin__ <fn>" 会被主脚本路由到内部函数（不执行子进程）
# ======================================

KEYWORD_MAP=(
    # —— 工作日管理（早安/午餐/下班，默认 auto）——
    "工作日管理|workday_manager.sh auto"
    "工作日|workday_manager.sh auto"
    "早安提醒|workday_manager.sh morning"
    "早安|workday_manager.sh morning"
    "午餐提醒|workday_manager.sh lunch"
    "午餐|workday_manager.sh lunch"
    "下班提醒|workday_manager.sh evening"
    "下班|workday_manager.sh evening"
    "workday|workday_manager.sh auto"
    "workdaymanager|workday_manager.sh auto"

    # —— 生日提醒 ——
    "生日提醒|birthday_reminder.sh"
    "生日|birthday_reminder.sh"
    "birthday|birthday_reminder.sh"
    "birthdayreminder|birthday_reminder.sh"

    # —— 每周总结 ——
    "每周总结|weekly_summary.sh"
    "周报|weekly_summary.sh"
    "周总结|weekly_summary.sh"
    "weekly|weekly_summary.sh"
    "weeklysummary|weekly_summary.sh"

    # —— 每月提醒 ——
    "每月提醒|monthly_reminder.sh"
    "月度提醒|monthly_reminder.sh"
    "月报|monthly_reminder.sh"
    "monthly|monthly_reminder.sh"
    "monthlyreminder|monthly_reminder.sh"

    # —— 节日与节气提醒 ——
    "节日与节气|festival_greetings.sh"
    "节日与节气提醒|festival_greetings.sh"
    "节日提醒|festival_greetings.sh"
    "节气提醒|festival_greetings.sh"
    "节日问候|festival_greetings.sh"
    "节日|festival_greetings.sh"
    "节气|festival_greetings.sh"
    "festival|festival_greetings.sh"
    "festivalgreetings|festival_greetings.sh"

    # —— 假期倒计时 ——
    "假期倒计时|holiday_countdown.sh"
    "假期提醒|holiday_countdown.sh"
    "假期|holiday_countdown.sh"
    "holidaycountdown|holiday_countdown.sh"
    "countdown|holiday_countdown.sh"

    # —— 自定义规则 ——
    "自定义规则|custom_rules.sh"
    "自定义提醒|custom_rules.sh"
    "规则|custom_rules.sh"
    "customrules|custom_rules.sh"
    "custom|custom_rules.sh"

    # —— 黄历 ——
    "黄历|fetch_real_almanac.sh"
    "今日黄历|fetch_real_almanac.sh"
    "老黄历|fetch_real_almanac.sh"
    "almanac|fetch_real_almanac.sh"

    # —— 星座运势 ——
    "星座运势|fetch_real_horoscope.sh"
    "星座|fetch_real_horoscope.sh"
    "今日运势|fetch_real_horoscope.sh"
    "运势|fetch_real_horoscope.sh"
    "horoscope|fetch_real_horoscope.sh"
    "明日运势|fetch_real_horoscope.sh show _ tomorrow"
    "本周运势|fetch_real_horoscope.sh show _ week"
    "本月运势|fetch_real_horoscope.sh show _ month"
    "今年运势|fetch_real_horoscope.sh show _ year"

    # —— 内部自省：推送可用关键字清单到企微（目标脚本 __builtin__ 走内部函数，不执行子进程）——
    "快捷指令|__builtin__ cmd_help_push"
    "指令列表|__builtin__ cmd_help_push"
    "关键字|__builtin__ cmd_help_push"
    "关键字列表|__builtin__ cmd_help_push"
    "help|__builtin__ cmd_help_push"
    "帮助|__builtin__ cmd_help_push"
)

# 脚本名 → 中文分组标题（仅用于消息可读性）
# 同时覆盖 reminder.sh 侧和 tools/card.sh 侧的常用脚本
script_display_name() {
    case "$1" in
        # —— reminder.sh 侧 ——
        "workday_manager.sh auto")     echo "🌞 工作日管理（早安/午餐/下班 自动）" ;;
        "workday_manager.sh morning")  echo "🌅 早安提醒" ;;
        "workday_manager.sh lunch")    echo "🍚 午餐提醒" ;;
        "workday_manager.sh evening")  echo "🌆 下班提醒" ;;
        "birthday_reminder.sh")        echo "🎂 生日提醒" ;;
        "weekly_summary.sh")           echo "📊 每周总结" ;;
        "monthly_reminder.sh")         echo "📅 每月提醒" ;;
        "festival_greetings.sh")       echo "🎉 节日与节气" ;;
        "holiday_countdown.sh")        echo "🏖️ 假期倒计时" ;;
        "custom_rules.sh")             echo "⚙️ 自定义规则（全量执行）" ;;
        "fetch_real_almanac.sh")        echo "📜 今日黄历" ;;
        "fetch_real_horoscope.sh")      echo "✨ 星座运势" ;;
        # —— tools/card.sh 侧 ——
        "weather_card_gen.sh")         echo "☀️ 天气预报" ;;
        "weather_alert_card_gen.sh")   echo "⚠️ 异常天气预警" ;;
        "air_quality.sh")              echo "🌫️ 空气质量" ;;
        "calendar.sh")                 echo "📆 日历提醒" ;;
        "daily_word.sh")               echo "💭 每日一言" ;;
        "ai_news_card_gen.sh")         echo "🤖 AI 新闻" ;;
        "weibo_hot.sh")                echo "🔥 微博热搜" ;;
        "ent_news.sh")                 echo "🎬 娱乐新闻" ;;
        "intl_news.sh")                echo "🌍 国际新闻" ;;
        "stock_market.sh")             echo "📈 A 股大盘" ;;
        "hk_stock.sh")                 echo "🇭🇰 港股大盘" ;;
        "us_stock.sh")                 echo "🇺🇸 美股大盘" ;;
        "gold_silver.sh")              echo "🥇 黄金白银" ;;
        "exchange_rate.sh")            echo "💱 汇率" ;;
        "oil_price_card_gen.sh")       echo "⛽ 今日油价" ;;
        "bilibili_hot.sh")         echo "🔥 B 站热搜" ;;
        "tencent_hot.sh")          echo "🔥 腾讯视频热搜" ;;
        "iqiyi_hot.sh")            echo "🔥 爱奇艺热搜" ;;
        "douyin_hot.sh")            echo "🔥 抖音热搜" ;;
        "github_trending.sh")          echo "⭐ GitHub Trending" ;;
        "steam_hot.sh")                echo "🎮 Steam 热门" ;;
        # —— 兜底 ——
        *)                             echo "📎 $1" ;;
    esac
}
