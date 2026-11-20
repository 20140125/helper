#!/bin/bash
# ======================================
# fetch_real_horoscope - 渲染器子模块
# ======================================
# 由主脚本 fetch_real_horoscope.sh source 加载
# 不设置 SCRIPT_DIR / LOG_FILE（由主脚本统一管理）
# 依赖：log_utils
#
# 4 个渲染器按 type 分发：today/tomorrow/week/month/year
# ======================================

# -----------------------------------------
# 渲染器：today / tomorrow（结构相同，仅标题不同）
# 聚合数据字段：summary, all, love, work, money, health, color, number, QFriend
# -----------------------------------------
_render_horoscope_day() {
    local zodiac_cn="$1"
    local label="$2"
    local response="$3"

    log_info "🧩 解析日度运势字段..."
    local summary=$(echo "$response" | grep -oP '"summary":\s*"\K[^"]+')
    local love=$(echo "$response"    | grep -oP '"love":\s*"\K[^"]+')
    local work=$(echo "$response"    | grep -oP '"work":\s*"\K[^"]+')
    local money=$(echo "$response"   | grep -oP '"money":\s*"\K[^"]+')
    local health=$(echo "$response"  | grep -oP '"health":\s*"\K[^"]+')
    local color=$(echo "$response"   | grep -oP '"color":\s*"\K[^"]+')
    local number=$(echo "$response"  | grep -oP '"number":\s*[0-9]+' | grep -oP '[0-9]+')
    local QFriend=$(echo "$response" | grep -oP '"QFriend":\s*"\K[^"]+')
    local all=$(echo "$response"     | grep -oP '"all":\s*"\K[^"]+')

    if [ -z "$summary" ] && [ -z "$all" ]; then
        log_warning "⚠️  关键字段（summary/all）均为空，API 结构可能已变更"
    fi

    cat << HOROSCOPE
## ✨ ${label}星座运势（${zodiac_cn}）

> **综合运势**：${all:-运势平稳}

**详细运势**：
- 💕 爱情运：${love}
- 💼 事业运：${work}
- 💰 财运：${money}
- 💪 健康运：${health}

**幸运提示**：
- 🎨 幸运色：${color}
- 🔢 幸运数字：${number}
- 🤝 速配星座：${QFriend}

**${label}概述**：${summary}
HOROSCOPE
}

# -----------------------------------------
# 渲染器：week（周运）
# 聚合数据返回字段：date, weekth(本周期), health, job, love, money, work
# -----------------------------------------
_render_horoscope_week() {
    local zodiac_cn="$1"
    local label="$2"
    local response="$3"

    log_info "🧩 解析周运字段..."
    local date_str=$(echo "$response" | grep -oP '"date":\s*"\K[^"]+' | head -1)
    local weekth=$(echo "$response"   | grep -oP '"weekth":\s*"\K[^"]+' | head -1)
    local health=$(echo "$response"   | grep -oP '"health":\s*"\K[^"]+' | head -1)
    local job=$(echo "$response"      | grep -oP '"job":\s*"\K[^"]+' | head -1)
    local love=$(echo "$response"     | grep -oP '"love":\s*"\K[^"]+' | head -1)
    local money=$(echo "$response"    | grep -oP '"money":\s*"\K[^"]+' | head -1)
    local work=$(echo "$response"     | grep -oP '"work":\s*"\K[^"]+' | head -1)

    cat << HOROSCOPE
## ✨ ${label}星座运势（${zodiac_cn}）

> 周期：${date_str}${weekth:+（第${weekth}周）}

- 💕 爱情：${love}
- 💼 工作：${work}
- 💰 财运：${money}
- 💪 健康：${health}
- 🧩 求职：${job}
HOROSCOPE
}

# -----------------------------------------
# 渲染器：month（月运）
# 聚合数据返回字段：date, mN(本月第几月), all, love, money, work, happyMagic(开运秘籍)
# -----------------------------------------
_render_horoscope_month() {
    local zodiac_cn="$1"
    local label="$2"
    local response="$3"

    log_info "🧩 解析月运字段..."
    local date_str=$(echo "$response"   | grep -oP '"date":\s*"\K[^"]+' | head -1)
    local month_n=$(echo "$response"    | grep -oP '"mN":\s*"\K[^"]+' | head -1)
    local all=$(echo "$response"        | grep -oP '"all":\s*"\K[^"]+' | head -1)
    local love=$(echo "$response"       | grep -oP '"love":\s*"\K[^"]+' | head -1)
    local money=$(echo "$response"      | grep -oP '"money":\s*"\K[^"]+' | head -1)
    local work=$(echo "$response"       | grep -oP '"work":\s*"\K[^"]+' | head -1)
    local happy_magic=$(echo "$response"| grep -oP '"happyMagic":\s*"\K[^"]+' | head -1)

    cat << HOROSCOPE
## ✨ ${label}星座运势（${zodiac_cn}）

> 周期：${date_str}${month_n:+（${month_n}月）}

**综合**：${all}

- 💕 爱情：${love}
- 💼 事业：${work}
- 💰 财运：${money}

**开运秘籍**：${happy_magic}
HOROSCOPE
}

# -----------------------------------------
# 渲染器：year（年运）
# 聚合数据返回字段：date, name, career(事业), love, health, finance(财务), mima(幸运密码)
# -----------------------------------------
_render_horoscope_year() {
    local zodiac_cn="$1"
    local label="$2"
    local response="$3"

    log_info "🧩 解析年运字段..."
    local date_str=$(echo "$response" | grep -oP '"date":\s*"\K[^"]+' | head -1)
    local career=$(echo "$response"   | grep -oP '"career":\s*"\K[^"]+' | head -1)
    local love=$(echo "$response"     | grep -oP '"love":\s*"\K[^"]+' | head -1)
    local health=$(echo "$response"   | grep -oP '"health":\s*"\K[^"]+' | head -1)
    local finance=$(echo "$response"  | grep -oP '"finance":\s*"\K[^"]+' | head -1)
    local mima=$(echo "$response"     | grep -oP '"mima":\s*"\K[^"]+' | head -1)

    cat << HOROSCOPE
## ✨ ${label}星座运势（${zodiac_cn}）

> 周期：${date_str}

- 💼 事业：${career}
- 💕 爱情：${love}
- 💰 财务：${finance}
- 💪 健康：${health}

**幸运密码**：${mima}
HOROSCOPE
}
