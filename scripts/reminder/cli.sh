#!/bin/bash
# ======================================
# reminder.sh 子模块：命令行辅助展示
# ======================================
#
# 职责：
#   - print_help：打印 --help 文档（here-doc）
#   - print_list：打印 --list 分组清单（静态 + 动态）
#
# 依赖（由主脚本提供）：
#   - KEYWORD_MAP                （数组，来自 keyword_map.sh）
#   - read_custom_rule_entries   （函数，来自 router.sh）
#   - is_reserved_static_keyword （函数，来自 router.sh）
# ======================================

# 打印帮助
print_help() {
    cat <<'EOF'
提醒类脚本统一路由入口

用法：
  bash scripts/reminder.sh "<关键字>"
  bash scripts/reminder.sh --list
  bash scripts/reminder.sh --help

示例：
  bash scripts/reminder.sh "生日提醒"
  bash scripts/reminder.sh "周报"
  bash scripts/reminder.sh "工作日管理"     # 默认 auto：按当前时间选 morning/lunch/evening
  bash scripts/reminder.sh "早安提醒"       # 显式选 morning
  bash scripts/reminder.sh "晚餐提醒"       # 动态：匹配数据库 已有业务表（缓存键 custom_rules.json）里的 name
  bash scripts/reminder.sh --dry-run "周报" # 仅打印将要执行的命令，不真正触发

关键字分组：
  工作日管理 | 生日提醒 | 每周总结 | 每月提醒 | 节日与节气提醒 | 假期倒计时 | 自定义规则
  + 动态：自定义规则中每条 enabled=true 的规则 name

说明：
  - 每个被路由的脚本都会直接推送企微消息，"执行即推送"是其自带语义。
  - 动态关键字路由到 custom_rules.sh test <ruleId>，忽略触发条件直接发送一次。
  - crontab / 守护进程直接调用子脚本的既有路径不受本入口影响。
EOF
}

# 列出所有可用关键字（按脚本分组）：静态 + 动态
print_list() {
    local static_count="${#KEYWORD_MAP[@]}"
    local dynamic_lines
    dynamic_lines="$(read_custom_rule_entries)"
    local dynamic_count=0
    [[ -n "$dynamic_lines" ]] && dynamic_count="$(printf '%s\n' "$dynamic_lines" | wc -l | tr -d ' ')"

    echo "已注册关键字（静态 ${static_count} 条 + 动态 ${dynamic_count} 条）："
    echo

    # —— 静态部分 ——
    local prev_script="" entry
    local sorted
    sorted="$(
        for entry in "${KEYWORD_MAP[@]}"; do
            echo "${entry##*|}|${entry%%|*}"
        done | sort
    )"
    while IFS='|' read -r script_with_args kw; do
        if [[ "$script_with_args" != "$prev_script" ]]; then
            [[ -n "$prev_script" ]] && echo
            echo "[$script_with_args]"
            prev_script="$script_with_args"
        fi
        echo "  - $kw"
    done <<<"$sorted"

    # —— 动态部分（custom_rules.json 中 enabled=true 的规则 name）——
    if [[ -n "$dynamic_lines" ]]; then
        echo
        echo "[custom_rules.sh test <ruleId>]（动态：来自数据库 已有业务表，缓存键 custom_rules.json）"
        local norm id orig_name status_hint
        while IFS=$'\t' read -r norm id orig_name; do
            [[ -n "$norm" ]] || continue
            status_hint=""
            if is_reserved_static_keyword "$norm"; then
                status_hint="  ⚠ 与静态关键字冲突，已被静态占用（不会路由到 custom_rules）"
            fi
            echo "  - ${orig_name}  => ${id}${status_hint}"
        done <<<"$dynamic_lines"
    fi
}
