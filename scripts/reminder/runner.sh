#!/bin/bash
# ======================================
# reminder.sh 子模块：执行阶段
# ======================================
#
# 职责：
#   - run_builtin        ：处理 __builtin__ 分支（按需加载 project_config，调用内部函数）
#   - run_child_script   ：fork 子脚本 + tee 透传 stdout/stderr + 回显 + 企微推送概要
#
# 契约（与主脚本共享）：
#   - 被调脚本的 stdout / stderr / 退出码原样透传给上层（AI / crontab）
#   - 入口 reminder.log 额外记录：路由详情、用户响应回显、企微推送成功/失败次数
#
# 依赖（由主脚本提供）：
#   - SCRIPT_DIR / PROJECT_DIR
#   - log_info / log_warn / log_error
# ======================================

# ---------- 内部命令分支 ----------
# 参数：$1=内部函数名 $2=关键字 $3=DRY_RUN(0|1)
run_builtin() {
    local builtin_fn="$1"
    local keyword="$2"
    local dry_run="$3"

    if [[ "$dry_run" == "1" ]]; then
        log_info "reminder.sh 路由 → builtin ${builtin_fn}（关键字: $keyword, dry-run）"
        echo "DRY-RUN: builtin ${builtin_fn}"
        return 0
    fi
    if ! declare -F "$builtin_fn" >/dev/null 2>&1; then
        log_error "内部函数不存在: ${builtin_fn}"
        echo "FAILED: 内部函数不存在: ${builtin_fn}" >&2
        return 3
    fi
    log_info "reminder.sh 路由 → builtin ${builtin_fn}（关键字: $keyword）"

    # 按需加载推送依赖（仅内部命令需要主动 send_wecom_message；其他关键字由子脚本自己 source）
    # log_utils.sh 已在主脚本 source，这里只补 project_config / weather_config
    # shellcheck disable=SC1091
    if source "${SCRIPT_DIR}/project_config.sh" 2>/dev/null; then
        log_info "已加载 project_config.sh"
    else
        log_warn "project_config.sh 加载失败或不存在，send_wecom_message 可能不可用"
    fi
    # shellcheck disable=SC1091
    source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null || true

    "$builtin_fn"
    local rc=$?
    if [[ $rc -eq 0 ]]; then
        log_info "builtin ${builtin_fn} 执行完成（退出码: 0)"
    else
        log_error "builtin ${builtin_fn} 执行失败（退出码: $rc）"
    fi
    return $rc
}

# ---------- 执行子脚本 ----------
# 参数：$1=脚本文件名（相对 SCRIPT_DIR） $2=默认参数字符串（可空） $3=关键字 $4=DRY_RUN(0|1)
run_child_script() {
    local script_name="$1"
    local default_args="$2"
    local keyword="$3"
    local dry_run="$4"

    local target="${SCRIPT_DIR}/${script_name}"
    if [[ ! -f "$target" ]]; then
        log_error "目标脚本不存在: $target"
        echo "FAILED: 目标脚本不存在: $target" >&2
        return 3
    fi

    # 记录路由成功日志（fork 之前就要写，dry-run 也记录，便于排查）
    if [[ -n "$default_args" ]]; then
        log_info "reminder.sh 路由 → ${script_name} ${default_args}（关键字: $keyword${dry_run:+, dry-run}）"
    else
        log_info "reminder.sh 路由 → ${script_name}（关键字: $keyword${dry_run:+, dry-run}）"
    fi

    # --dry-run：仅打印将要执行的命令后退出（不推送企微）
    if [[ "$dry_run" == "1" ]]; then
        if [[ -n "$default_args" ]]; then
            echo "DRY-RUN: bash $target $default_args"
        else
            echo "DRY-RUN: bash $target"
        fi
        return 0
    fi

    # 不使用 exec：我们需要在子脚本退出后，把它的 stdout 回显 + 企微推送结果写入入口日志
    # 为了不破坏对上层的契约（AI/crontab 仍应该看到原始 stdout / stderr / 退出码），
    # 这里用 tee 同时把 stdout 透传到终端并落盘，stderr 同样 tee 一份用于探测企微推送结果
    # 被调脚本内部会自行调用 send_wecom_message 推送企微，无需额外开关
    local stdout_cap stderr_cap
    stdout_cap="$(mktemp -t reminder_stdout.XXXXXX)"
    stderr_cap="$(mktemp -t reminder_stderr.XXXXXX)"
    # 保证临时文件一定被清理（叠加到现有 EXIT trap 上）
    trap 'rm -f "$stdout_cap" "$stderr_cap"' RETURN

    # 运行子脚本：stdout/stderr 照常透传，同时各自落一份到 *_cap 文件
    local child_rc
    set +e
    if [[ -n "$default_args" ]]; then
        # shellcheck disable=SC2086
        bash "$target" $default_args \
            > >(tee "$stdout_cap") \
            2> >(tee "$stderr_cap" >&2)
    else
        bash "$target" \
            > >(tee "$stdout_cap") \
            2> >(tee "$stderr_cap" >&2)
    fi
    child_rc=$?
    set -e
    # 等 tee 子进程把数据冲出来（process substitution 是异步的）
    wait 2>/dev/null || true

    # ---------- 回显：把子脚本"给用户的响应"（stdout）写进入口日志 ----------
    if [[ -s "$stdout_cap" ]]; then
        local stdout_bytes stdout_lines
        stdout_bytes="$(wc -c <"$stdout_cap" | tr -d ' ')"
        stdout_lines="$(wc -l <"$stdout_cap" | tr -d ' ')"
        log_info "[用户响应] 子脚本 ${script_name} 输出：${stdout_lines} 行 / ${stdout_bytes} 字节 ↓↓↓"
        # 每行加 [INFO] 前缀写入日志；保留原样内容，便于排查"到底给用户回了什么"
        local _line
        while IFS= read -r _line || [[ -n "$_line" ]]; do
            log_info "  │ $_line"
        done <"$stdout_cap"
        log_info "[用户响应] ↑↑↑ 结束"
    else
        log_info "[用户响应] 子脚本 ${script_name} 无 stdout 输出"
    fi

    # ---------- 企微推送概要：根据 stderr 里的标志行判断是否真发 ----------
    # send_wecom_message 成功/失败都会在 stderr 打标记：
    #   [企微推送] 消息发送成功   / [企微推送] 消息发送失败
    # 注意：不能用 `grep -c xxx || echo 0`——grep 无匹配返回 1，会触发 echo 0 再追加一行，
    #       造成变量值变成 "0\n0"，后续数值比较报 syntax error。这里用 awk 一次性计数。
    local push_ok_count=0 push_fail_count=0
    if [[ -s "$stderr_cap" ]]; then
        push_ok_count=$(awk '/\[企微推送\] 消息发送成功/{c++} END{print c+0}' "$stderr_cap")
        push_fail_count=$(awk '/\[企微推送\] 消息发送失败/{c++} END{print c+0}' "$stderr_cap")
    fi
    if [[ "$push_ok_count" -gt 0 || "$push_fail_count" -gt 0 ]]; then
        log_info "[企微推送] 概要：成功 ${push_ok_count} 次，失败 ${push_fail_count} 次（消息正文详见子脚本自身日志）"
    else
        log_info "[企微推送] 概要：未触发企微推送（子脚本未调用 send_wecom_message）"
    fi

    if [[ $child_rc -eq 0 ]]; then
        log_info "reminder.sh 子脚本 ${script_name} 执行完成（退出码: 0）"
    else
        log_error "reminder.sh 子脚本 ${script_name} 执行失败（退出码: $child_rc）"
    fi

    return $child_rc
}
