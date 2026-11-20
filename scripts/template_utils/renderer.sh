#!/bin/bash

# ======================================
# template_utils 子模块 — 模板渲染
# ======================================
#
# 功能说明：
#   渲染模板字符串，替换占位符为实际值
#   使用 Python 进行多行安全替换
#
# 注意：
#   本文件由主脚本 template_utils.sh 加载
#   不可单独执行，不设 SCRIPT_DIR / LOG_FILE
#
# 作者：智能提醒系统
# 更新：2026-04-22
# ======================================

# 渲染模板（替换占位符）
# 参数：
#   $1 - 模板字符串
#   $2... - 键值对（格式: key=value）
# 返回：
#   成功：输出渲染后的消息到 stdout 并返回 0
#   失败：返回 1
render_template() {
    local template="$1"
    shift  # 移除第一个参数，剩余的都是键值对

    # 将所有键值对收集到数组，传给 Python 处理
    # 使用 Python 替换，避免 sed 无法处理多行 value 的问题
    local py_args=()
    while [ $# -gt 0 ]; do
        local pair="$1"
        if [[ "$pair" =~ ^([^=]+)=(.*)$ ]]; then
            py_args+=("${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
            log_debug "替换占位符: {${BASH_REMATCH[1]}} -> ${BASH_REMATCH[2]}"
        else
            log_warning "无效的键值对格式（应为 key=value）: $pair"
        fi
        shift
    done

    # 用 Python 做多行安全替换
    local message
    message=$(python3 - "$template" "${py_args[@]}" <<'PYEOF'
import sys

template = sys.argv[1]
args = sys.argv[2:]

# 按 key, value 成对解析
i = 0
while i + 1 < len(args):
    key = args[i]
    value = args[i + 1]
    template = template.replace('{' + key + '}', value)
    i += 2

print(template, end='')
PYEOF
)

    if [ $? -ne 0 ]; then
        log_error "Python 模板渲染失败"
        return 1
    fi

    # 检查是否还有未替换的占位符
    if echo "$message" | grep -q "{.*}"; then
        local unresolved
        unresolved=$(echo "$message" | grep -o "{[^}]*}" | sort -u | tr '\n' ' ')
        log_warning "存在未替换的占位符: $unresolved"
    fi

    echo "$message"
}
