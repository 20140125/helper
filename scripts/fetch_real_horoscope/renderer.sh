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
    local summary=$(json_get_string "$response" summary)
    local love=$(json_get_string "$response" love)
    local work=$(json_get_string "$response" work)
    local money=$(json_get_string "$response" money)
    local health=$(json_get_string "$response" health)
    local color=$(json_get_string "$response" color)
    local number=$(json_get_number "$response" number)
    local QFriend=$(json_get_string "$response" QFriend)
    local all=$(json_get_string "$response" all)

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
    local date_str=$(json_get_string "$response" date)
    local weekth=$(json_get_string "$response" weekth)
    local health=$(json_get_string "$response" health)
    local job=$(json_get_string "$response" job)
    local love=$(json_get_string "$response" love)
    local money=$(json_get_string "$response" money)
    local work=$(json_get_string "$response" work)

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
    local date_str=$(json_get_string "$response" date)
    local month_n=$(json_get_string "$response" mN)
    local all=$(json_get_string "$response" all)
    local love=$(json_get_string "$response" love)
    local money=$(json_get_string "$response" money)
    local work=$(json_get_string "$response" work)
    local happy_magic=$(json_get_string "$response" happyMagic)

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
    local date_str=$(json_get_string "$response" date)
    local career=$(json_get_string "$response" career)
    local love=$(json_get_string "$response" love)
    local health=$(json_get_string "$response" health)
    local finance=$(json_get_string "$response" finance)
    local mima=$(json_get_string "$response" mima)

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
