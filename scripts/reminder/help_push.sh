#!/bin/bash
# ======================================
# reminder.sh 子模块：快捷指令清单推送
# ======================================
#
# 职责：
#   把所有可用关键字整理成分类 Markdown 表格，
#   格式固定、分类清晰，便于在微信/企微查看。
#
# 对外入口：
#   cmd_help_push
#
# 依赖（由主脚本提供）：
#   - KEYWORD_MAP / CUSTOM_RULES_KEY / SCRIPT_DIR
#   - read_custom_rule_entries / is_reserved_static_keyword
#   - script_display_name / log_info / log_warn / log_error
#   - send_wecom_message
#
# 环境变量：
#   - REMINDER_HELP_DRY_PUSH=1 时只打印消息、不真发
# ======================================

# 核心：构造固定分类表格 Markdown 并输出/推送
cmd_help_push() {
    log_info "======================================"
    log_info "📋 收集快捷指令清单"
    log_info "======================================"

    # ---------- 收集动态规则关键字 ----------
    local dynamic_kws=""
    local dynamic_lines
    REMINDER_LOG_RULE_SOURCE=1 dynamic_lines="$(read_custom_rule_entries 2>/dev/null)" || true
    if [[ -n "$dynamic_lines" ]]; then
        local _n _i _on
        while IFS=$'\t' read -r _n _i _on; do
            [[ -z "$_on" ]] && continue
            is_reserved_static_keyword "$_n" && continue
            if [[ -z "$dynamic_kws" ]]; then
                dynamic_kws="\`${_on}\`"
            else
                dynamic_kws="${dynamic_kws} \`${_on}\`"
            fi
        done <<<"$dynamic_lines"
    fi

    # ---------- 构造 Markdown ----------
    local md=""

    md+="## 🎯 快捷指令清单"$'\n\n'

    # —— 提醒类 ——
    md+="**📋 提醒类**"$'\n\n'
    md+="| 分类 | 关键字 |"$'\n'
    md+="|---|---|"$'\n'
    md+="| 🌞 工作日管理 | \`工作日管理\` \`工作日\` |"$'\n'
    md+="| 🌅 早安提醒 | \`早安提醒\` \`早安\` |"$'\n'
    md+="| 🍚 午餐提醒 | \`午餐提醒\` \`午餐\` |"$'\n'
    md+="| 🌆 下班提醒 | \`下班提醒\` \`下班\` |"$'\n'
    md+="| 🎂 生日提醒 | \`生日提醒\` \`生日\` |"$'\n'
    md+="| 📊 每周总结 | \`周报\` \`每周总结\` \`周总结\` |"$'\n'
    md+="| 📅 每月提醒 | \`月报\` \`每月提醒\` \`月度提醒\` |"$'\n'
    md+="| 🎉 节日与节气 | \`节日\` \`节气\` \`节日提醒\` \`节气提醒\` |"$'\n'
    md+="| 🏖️ 假期倒计时 | \`假期\` \`假期提醒\` \`假期倒计时\` |"$'\n'
    if [[ -n "$dynamic_kws" ]]; then
        md+="| 🧩 动态规则 | ${dynamic_kws} |"$'\n'
    fi

    # —— 天气与生活 ——
    md+=$'\n'"**🌤️ 天气与生活**"$'\n\n'
    md+="| 分类 | 关键字 |"$'\n'
    md+="|---|---|"$'\n'
    md+="| ☀️ 天气预报 | \`天气\` \`天气预报\` |"$'\n'
    md+="| ⚠️ 天气预警 | \`异常天气\` \`天气预警\` |"$'\n'
    md+="| 🌫️ 空气质量 | \`空气质量\` |"$'\n'
    md+="| 📆 日历 | \`日历\` \`日历提醒\` |"$'\n'
    md+="| 📜 黄历 | \`黄历\` \`今日黄历\` \`老黄历\` |"$'\n'
    md+="| ✨ 星座运势 | \`星座\` \`星座运势\` \`今日运势\` \`运势\` \`明日运势\` \`本周运势\` \`本月运势\` \`今年运势\` |"$'\n'
    md+="| 💭 每日一言 | \`一言\` \`每日一言\` |"$'\n'

    # —— 新闻资讯 ——
    md+=$'\n'"**📰 新闻资讯**"$'\n\n'
    md+="| 分类 | 关键字 |"$'\n'
    md+="|---|---|"$'\n'
    md+="| 🤖 AI 新闻 | \`ai新闻\` |"$'\n'
    md+="| 🎬 娱乐新闻 | \`娱乐\` \`娱乐新闻\` |"$'\n'
    md+="| 🌍 国际新闻 | \`国际\` \`国际新闻\` |"$'\n'

    # —— 财经行情 ——
    md+=$'\n'"**💰 财经行情**"$'\n\n'
    md+="| 分类 | 关键字 |"$'\n'
    md+="|---|---|"$'\n'
    md+="| 📈 A 股 | \`a股\` \`大盘\` \`沪深\` |"$'\n'
    md+="| 🇭🇰 港股 | \`港股\` \`港股大盘\` |"$'\n'
    md+="| 🇺🇸 美股 | \`美股\` \`美股大盘\` |"$'\n'
    md+="| 🥇 黄金白银 | \`黄金\` \`白银\` \`黄金白银\` |"$'\n'
    md+="| 💱 汇率 | \`汇率\` |"$'\n'
    md+="| ⛽ 油价 | \`油价\` \`今日油价\` |"$'\n'

    # —— 热搜榜 ——
    md+=$'\n'"**🔥 热搜榜**"$'\n\n'
    md+="| 平台 | 关键字 |"$'\n'
    md+="|---|---|"$'\n'
    md+="| 🔥 微博热搜 | \`热搜\` \`微博热搜\` \`今日热搜\` |"$'\n'
    md+="| 🔥 B站热搜 | \`b站热搜\` \`哔哩哔哩热搜\` |"$'\n'
    md+="| 🔥 腾讯热搜 | \`腾讯热搜\` \`腾讯视频热搜\` |"$'\n'
    md+="| 🔥 爱奇艺热搜 | \`爱奇艺热搜\` |"$'\n'
    md+="| 🔥 抖音热搜 | \`抖音热搜\` \`抖音\` |"$'\n'

    # —— 科技 ——
    md+=$'\n'"**🔧 科技**"$'\n\n'
    md+="| 分类 | 关键字 |"$'\n'
    md+="|---|---|"$'\n'
    md+="| ⭐ GitHub | \`github热门\` |"$'\n'
    md+="| 🎮 Steam | \`steam热门\` |"$'\n'

    # ---------- 输出/推送 ----------
    local md_bytes
    md_bytes="$(printf '%s' "$md" | wc -c | tr -d ' ')"
    log_info "Markdown 构造完成：${md_bytes} 字节"

    if [[ "${REMINDER_HELP_DRY_PUSH:-0}" == "1" ]]; then
        log_info "REMINDER_HELP_DRY_PUSH=1，仅输出到 stdout"
        printf '%s\n' "$md"
        return 0
    fi
    if ! declare -F send_wecom_message >/dev/null 2>&1; then
        log_error "send_wecom_message 未加载"
        # 即使不能推企微，也输出到 stdout 供调用方使用
        printf '%s\n' "$md"
        return 0
    fi
    log_info "推送企微 markdown 消息..."
    # 成功/失败的按 webhook 粒度日志由 send_wecom_notify 内部统一打印，
    # 这里不再重复写一条外层成功日志（避免与失败分支不对称）。
    send_wecom_message "$md" || true
    # 同时输出到 stdout
    printf '%s\n' "$md"
    return 0
}
