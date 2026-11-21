#!/bin/bash
# ======================================
# calendar 子模块：节假日倒计时计算
# ======================================
# 被 calendar.sh 主入口 source，禁止直接执行
# 依赖主入口已 source：project_config.sh / log_utils.sh
# 提供：calc_days_until / calculate_holidays
# ======================================

# 天数计算
# 参数: $1=目标日期(YYYY-MM-DD) $2=今日 epoch
# 输出: "已过" | "?" | "N天"
calc_days_until() {
    local target_date="$1"
    local today_epoch="$2"
    local target_epoch
    target_epoch=$(pc_date_to_epoch "$target_date" 'Asia/Shanghai')
    if [ -z "$target_epoch" ]; then echo "?"; return; fi
    local diff=$(( (target_epoch - today_epoch) / 86400 ))
    if [ "$diff" -lt 0 ]; then echo "已过"; else echo "${diff}天"; fi
}

# 从 holiday_config.sh 文件提取节假日倒计时
# 直接读文件内容，不依赖运行时关联数组
# 输出: 每行 "名称|日期范围|剩余天数"
calculate_holidays() {
    local year
    year=$(TZ=Asia/Shanghai date +%Y)
    local today_epoch
    today_epoch=$(TZ=Asia/Shanghai date +%s)

    local config_file="${PROJECT_DIR}/holiday_config.sh"
    if [ ! -f "$config_file" ]; then
        log_warning "节假日配置文件不存在: $config_file"
        echo ""
        return
    fi

    # 从文件中 grep 出当年的节假日条目
    # 格式: ['2026-05-01']='劳动节|2'
    local -A holiday_start holiday_end

    while IFS= read -r line; do
        # 提取日期
        local key
        key=$(echo "$line" | sed -n "s/.*'\(${year}-[0-9-]*\)'.*/\1/p")
        [ -z "$key" ] && continue
        # 提取值
        local val
        val=$(echo "$line" | sed -n "s/.*='\(.*\)'/\1/p")
        [ -z "$val" ] && continue

        local name="${val%%|*}"
        local type_flag="${val##*|}"

        # 只取放假类型(2)
        [ "$type_flag" != "2" ] && continue
        # 跳过公司特别假
        case "$name" in 调休*|公司*) continue ;; esac
        # 初一~初七/除夕归类为春节
        case "$name" in 初一|初二|初三|初四|初五|初六|初七|除夕) name="春节" ;; esac

        if [ -z "${holiday_start[$name]:-}" ] || [[ "$key" < "${holiday_start[$name]}" ]]; then
            holiday_start[$name]="$key"
        fi
        if [ -z "${holiday_end[$name]:-}" ] || [[ "$key" > "${holiday_end[$name]}" ]]; then
            holiday_end[$name]="$key"
        fi
    done < <(grep "\['${year}-" "$config_file")

    # 按日期排序
    local items=""
    local sorted_holidays
    sorted_holidays=$(for name in "${!holiday_start[@]}"; do
        echo "${holiday_start[$name]}|$name"
    done | sort)

    while IFS='|' read -r start_date name; do
        [ -z "$start_date" ] && continue
        local end_date="${holiday_end[$name]}"
        local d
        d=$(calc_days_until "$start_date" "$today_epoch")
        if [ "$d" = "已过" ]; then continue; fi

        # 格式化日期范围
        local start_m start_d end_m end_d date_range
        start_m=$(pc_date_format "$start_date" '%-m')
        start_d=$(pc_date_format "$start_date" '%-d')
        end_m=$(pc_date_format "$end_date" '%-m')
        end_d=$(pc_date_format "$end_date" '%-d')
        if [ "$start_date" = "$end_date" ]; then
            date_range="${start_m}月${start_d}日"
        elif [ "$start_m" = "$end_m" ]; then
            date_range="${start_m}月${start_d}日-${end_d}日"
        else
            date_range="${start_m}月${start_d}日-${end_m}月${end_d}日"
        fi

        items="${items}${name}|${date_range}|${d}\n"
    done <<< "$sorted_holidays"

    # 追加下一年元旦
    local d
    d=$(calc_days_until "$((year+1))-01-01" "$today_epoch")
    items="${items}元旦|1月1日|${d}\n"

    echo -e "$items"
}
