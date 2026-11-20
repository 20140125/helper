#!/bin/bash
# ======================================
# reminder.sh 子模块：路由核心
# ======================================
#
# 职责：
#   - 关键字归一化（lower-case、去空格、去 /、去 -）
#   - 动态读取 .cache/custom_rules.json 中 enabled=true 的规则 name 作为关键字
#   - 判断某归一化关键字是否已被静态表占用（防止规则命名撞名 "周报" 等）
#   - 按关键字查找对应脚本及默认参数
#
# 依赖（由主脚本提供）：
#   - KEYWORD_MAP          （数组）
#   - CUSTOM_RULES_JSON    （路径）
#   - log_warn             （函数，可降级）
#
# 环境变量：
#   - REMINDER_LOG_RULE_SOURCE=1 时，读 custom_rules.json 失败会 warn；默认静默
# ======================================

# 关键字归一化：转小写 + 去空格 + 去 / 去 -
normalize_keyword() {
    local raw="$1"
    # tr 的大小写映射只对 ASCII 生效（中文不受影响，符合预期）
    echo "$raw" | tr '[:upper:]' '[:lower:]' | tr -d ' \t/-'
}

# 读取 custom_rules.json 中所有 enabled=true 的规则，输出 "<归一化name>\t<id>\t<原始name>"
# 静默降级：文件不存在 / jq 不可用时，输出空（不会报错，退化为"只有静态关键字"）
# 注意：本函数可能被 lookup_script 频繁调用（每次关键字路由都会走一次），因此
#   日志只记录"异常降级"和"首次读取"，避免刷屏。首次读取的统计由调用方打印。
read_custom_rule_entries() {
    if [[ ! -f "$CUSTOM_RULES_JSON" ]]; then
        # 仅在明确需要动态规则的调用链里（REMINDER_LOG_RULE_SOURCE=1）打 warn，默认静默
        [[ "${REMINDER_LOG_RULE_SOURCE:-0}" == "1" ]] && \
            log_warn "custom_rules.json 不存在：$CUSTOM_RULES_JSON（动态关键字将为空）"
        return 0
    fi
    if ! command -v jq >/dev/null 2>&1; then
        [[ "${REMINDER_LOG_RULE_SOURCE:-0}" == "1" ]] && \
            log_warn "jq 不可用，跳过 custom_rules.json 解析（动态关键字将为空）"
        return 0
    fi
    jq -r '.[] | select(.enabled == true) | [.name, .id] | @tsv' "$CUSTOM_RULES_JSON" 2>/dev/null \
        | while IFS=$'\t' read -r name id; do
            [[ -n "$name" && -n "$id" ]] || continue
            local norm
            norm="$(normalize_keyword "$name")"
            [[ -n "$norm" ]] || continue
            printf '%s\t%s\t%s\n' "$norm" "$id" "$name"
        done
}

# 判断一个归一化关键字是否已被静态表占用（不含 custom_rules.sh 自己）
# 规则命名为 "周报" 等已有静态关键字时，不应被动态映射劫持到 custom_rules.sh test
is_reserved_static_keyword() {
    local key="$1"
    local entry k v
    for entry in "${KEYWORD_MAP[@]}"; do
        k="${entry%%|*}"
        v="${entry##*|}"
        if [[ "$k" == "$key" && "${v%% *}" != "custom_rules.sh" ]]; then
            return 0
        fi
    done
    return 1
}

# 按归一化关键字查找脚本及默认参数
# 查找顺序：
#   1) 动态关键字（custom_rules.json 里 enabled 规则的 name）——跳过被静态保留的词
#   2) 静态 KEYWORD_MAP
# 返回："<脚本文件名> <默认参数>"（参数可能为空）
lookup_script() {
    local key
    key="$(normalize_keyword "$1")"
    local entry k v

    # 1) 动态规则 name
    local norm id _name
    while IFS=$'\t' read -r norm id _name; do
        [[ -n "$norm" ]] || continue
        if [[ "$norm" == "$key" ]] && ! is_reserved_static_keyword "$key"; then
            echo "custom_rules.sh test ${id}"
            return 0
        fi
    done < <(read_custom_rule_entries)

    # 2) 静态映射
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
