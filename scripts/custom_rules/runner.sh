#!/bin/bash

# ======================================
# 自定义规则 - 规则执行调度
# ======================================
#
# 提供规则执行的核心调度逻辑：
#   run_rule  - 根据模板/消息类型分发执行
#
# 调度策略：
#   1. 有 template_id 且在 TEMPLATE_SCRIPT_MAP 中
#      → 委托给对应脚本执行
#   2. 有 template_id 但无独立脚本
#      → 本地渲染模板消息（template_renderer.sh）
#   3. 无 template_id
#      → 使用 custom_rule 模板构建消息（message_builder.sh）
#
# 依赖模块：
#   sender.sh            - send_wecom_message
#   message_builder.sh   - build_custom_rule_message
#   template_renderer.sh - build_template_message_local
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# ======================================
# 模板 → 脚本映射表
# ======================================
# 格式: ["template_id"]="脚本文件名:子命令"
# 这些模板直接委托给对应脚本执行
#
# template_id 说明：
#   - 提醒类沿用消息模板库的 type（morning / birthday / holiday …）
#   - 卡片技能类直接复用 web/types/skill-map.ts 里的技能 key（stock_market / weibo_hot …），
#     与 card_skill 工具的 skill_key 完全一致，模型/前端无需再做一层名字转换
#
# 卡片技能（脚本位于 scripts/tools/ 下）由 run_rule 统一开推送闸门，见下方委托逻辑

declare -A TEMPLATE_SCRIPT_MAP=(
    # workday_manager.sh 内置
    ["morning"]="workday_manager.sh:morning"
    ["lunch"]="workday_manager.sh:lunch"
    ["evening"]="workday_manager.sh:evening"
    ["adjustment"]="workday_manager.sh:adjust"
    # birthday_reminder.sh（check 会自动判断发送 birthday / birthday_countdown）
    ["birthday"]="birthday_reminder.sh:check"
    ["birthday_countdown"]="birthday_reminder.sh:check"
    # festival_greetings.sh（festival_all = 一次跑完节日/农历/节气/特殊节日，脚本内部判断当天有没有）
    ["festival_all"]="festival_greetings.sh:all"
    ["holiday"]="festival_greetings.sh:holiday"
    ["lunar_festival"]="festival_greetings.sh:lunar"
    ["solar_term"]="festival_greetings.sh:solar_term"
    ["special_day"]="festival_greetings.sh:special"
    # holiday_countdown.sh（main 函数统一判断 countdown/progress/end）
    ["holiday_countdown"]="holiday_countdown.sh:"
    ["holiday_progress"]="holiday_countdown.sh:"
    ["holiday_end"]="holiday_countdown.sh:"
    # weekly_summary.sh
    ["weekend"]="weekly_summary.sh:"
    # tools/commute_card.sh：家↔公司驾车通勤卡片（方向按触发时间自动判断）
    ["commute"]="tools/commute_card.sh:"
    # monthly_reminder.sh（main 函数统一判断 monthly_start/monthly_end）
    ["monthly_start"]="monthly_reminder.sh:"
    ["monthly_end"]="monthly_reminder.sh:"
    # update-tools/send_update_notification.sh
    ["update_report"]="update-tools/send_update_notification.sh:"

    # ── 卡片技能类（template_id = 技能 key，脚本位于 scripts/tools/ 下）──
    # 未纳入的：qrcode（content 必填）、diagram_card（spec 必填）——参数无法在规则里表达
    # ── 天气 ──
    ["weather_card_gen"]="tools/weather_card_gen.sh:"
    ["weather_alert_card"]="tools/weather_alert_card_gen.sh:"
    ["air_quality"]="tools/air_quality.sh:"
    # ── 日历 ──
    ["calendar"]="tools/calendar.sh:"
    ["almanac_card"]="tools/almanac_card.sh:"
    # ── 财经 ──
    ["stock_market"]="tools/stock_market.sh:"
    ["hk_stock"]="tools/hk_stock.sh:"
    ["us_stock"]="tools/us_stock.sh:"
    ["exchange_rate"]="tools/exchange_rate.sh:"
    ["gold_silver"]="tools/gold_silver.sh:"
    ["oil_price_card"]="tools/oil_price_card_gen.sh:"
    ["crypto_price"]="tools/crypto_price.sh:"
    # ── 新闻 ──
    ["ai_news_card"]="tools/ai_news_card_gen.sh:"
    ["ent_news"]="tools/ent_news.sh:"
    ["intl_news"]="tools/intl_news.sh:"
    ["weibo_hot"]="tools/weibo_hot.sh:"
    # ── 影视 ──
    ["bilibili_hot"]="tools/bilibili_hot.sh:"
    ["tencent_hot"]="tools/tencent_hot.sh:"
    ["iqiyi_hot"]="tools/iqiyi_hot.sh:"
    ["douyin_hot"]="tools/douyin_hot.sh:"
    # ── 科技 ──
    ["github_trending"]="tools/github_trending.sh:"
    ["steam_hot"]="tools/steam_hot.sh:"
    ["earthquake"]="tools/earthquake.sh:"
    # ── 生活 ──
    ["daily_word"]="tools/daily_word.sh:"
    ["history_today"]="tools/history_today_card.sh:"
    ["daily_wallpaper"]="tools/daily_wallpaper.sh:"
    ["horoscope_card"]="tools/horoscope_card.sh:"
    ["holiday_nager"]="tools/holiday_nager.sh:"
)

# ======================================
# 执行单条规则（发送消息）
# ======================================
# 参数：
#   $1 - 规则名称
#   $2 - 消息内容（自定义内容模式使用）
#   $3 - 规则类型（可选）
#   $4 - 触发条件（可选）
#   $5 - 规则时间（可选）
#   $6 - webhookIds（逗号分隔，可选）
#   $7 - template_id（可选）
#   $8 - custom_content（true 时直接用 message，false 时用模板）
#   $9 - output_mode（text=数据文本【默认】/ card=图片卡片，仅对卡片技能生效）
# 返回：
#   成功：返回 0
#   失败：返回 1

run_rule() {
    local name="$1"
    local message="$2"
    local rule_type="${3:-}"
    local rule_condition="${4:-}"
    local rule_time="${5:-}"
    local webhook_ids="${6:-}"
    local template_id="${7:-}"
    local custom_content="${8:-false}"
    local output_mode="${9:-text}"

    log_info "▶ 触发规则: ${name}"

    local content

    if [ "$custom_content" = "true" ]; then
        # ── 自定义内容模式：直接使用 message 字段，不走模板 ──
        log_info "  ✏️ 使用自定义内容（custom_content=true）"
        if [ -z "$message" ]; then
            log_error "已开启自定义内容但 message 为空"
            return 1
        fi
        content=$(build_custom_rule_message "$name" "$message" "$rule_type" "$rule_condition" "$rule_time")
    elif [ -n "$template_id" ]; then
        # ── 使用消息模板推送 ──
        log_info "  📋 使用消息模板: ${template_id}"

        if [[ -n "${TEMPLATE_SCRIPT_MAP[$template_id]:-}" ]]; then
            # 已有脚本支持 → 直接委托给对应脚本
            local script_entry="${TEMPLATE_SCRIPT_MAP[$template_id]}"
            local script_file="${script_entry%%:*}"    # 冒号前：脚本文件名
            local sub_cmd="${script_entry#*:}"          # 冒号后：子命令（可为空）
            local script_path="${SCRIPT_DIR}/${script_file}"

            if [ ! -f "$script_path" ]; then
                log_error "脚本不存在: ${script_path}，回退到本地构建"
            else
                # ── 卡片技能：默认发数据文本，output_mode=card 时才出图片 ──
                # 文本形态由 LLM 排版产出（skill_text.sh → skill_text_llm.sh）；
                # 排版失败的技能自动回退到卡片模式（保证功能不丢）。
                if [[ "$script_file" == tools/* ]] && [ "$output_mode" != "card" ] \
                    && skill_text_supported "$template_id"; then
                    content=$(render_skill_text "$template_id")
                    if [ -n "$content" ]; then
                        send_wecom_message "$content" "$webhook_ids"
                        return $?
                    fi
                    log_warning "  ⚠️ 文本渲染未产出内容，回退卡片模式"
                fi

                log_info "  🚀 委托给 ${script_file}${sub_cmd:+ ${sub_cmd}} 执行"
                local out rc=0
                if [[ "$script_file" == tools/* ]]; then
                    # ── 卡片类技能：脚本位于 scripts/tools/ 下 ──
                    # render_card 默认只渲染 PNG 不推送，需显式开闸才会调用 send_card_image；
                    # 天气预警在 CRON_MODE 下无异常天气静默跳过，避免每天刷屏。
                    # 用子 shell 承载这些 export，避免污染同批次后续规则。
                    out=$(
                        export PUSH_CARD_IMAGE=1
                        export SKILL_CARD_SEND_ON_WECHAT=true
                        if [ "$template_id" = "weather_alert_card" ]; then
                            export CRON_MODE=1
                        fi
                        bash "$script_path" ${sub_cmd:+"$sub_cmd"}
                    ) || rc=$?
                else
                    out=$(bash "$script_path" ${sub_cmd:+"$sub_cmd"}) || rc=$?
                fi
                [ -n "$out" ] && log_info "  📄 脚本输出: ${out}"
                if [ "$rc" -ne 0 ]; then
                    log_error "委托脚本执行失败（exit=${rc}）: ${script_file}"
                fi
                return "$rc"
            fi
        fi

        # 没有独立脚本 / 脚本不存在 → 本地构建消息
        log_info "  🔧 本地构建模板消息: ${template_id}"
        content=$(build_template_message_local "$template_id" "$name")
        if [ $? -ne 0 ] || [ -z "$content" ]; then
            log_error "消息模板 [${template_id}] 渲染失败，回退到自定义消息"
            if [ -n "$message" ]; then
                content=$(build_custom_rule_message "$name" "$message" "$rule_type" "$rule_condition" "$rule_time")
            else
                log_error "无消息内容可发送"
                return 1
            fi
        fi
    else
        # ── 使用 custom_rule 模板 + message 字段 ──
        content=$(build_custom_rule_message "$name" "$message" "$rule_type" "$rule_condition" "$rule_time")
    fi

    if [ $? -ne 0 ] || [ -z "$content" ]; then
        log_error "消息内容构建失败"
        return 1
    fi

    send_wecom_message "$content" "$webhook_ids"
}
