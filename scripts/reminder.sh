#!/bin/bash
# ======================================
# 提醒类脚本统一路由入口
# ======================================
#
# 功能说明：
#   1. 按自然语言关键字路由到 scripts/ 下对应的"提醒类"脚本
#   2. 透传子脚本 stdout / stderr / 退出码
#   3. 覆盖范围：执行即推送企微文本消息的 7 个脚本（见 reminder/keyword_map.sh::KEYWORD_MAP）
#
# 使用方式：
#   bash scripts/reminder.sh "<关键字>"
#   bash scripts/reminder.sh --list            # 列出所有关键字
#   bash scripts/reminder.sh --dry-run "<关键字>"  # 只解析路由，不真正执行子脚本
#   bash scripts/reminder.sh --help            # 帮助
#
# 示例：
#   bash scripts/reminder.sh "生日提醒"        # => birthday_reminder.sh
#   bash scripts/reminder.sh "周报"            # => weekly_summary.sh
#   bash scripts/reminder.sh "工作日管理"      # => workday_manager.sh auto
#   bash scripts/reminder.sh "晚餐提醒"        # => custom_rules.sh test <ruleId>（按 name 动态匹配）
#   bash scripts/reminder.sh "快捷指令"        # => 推送当前所有可用关键字清单到企微
#
# 关键字来源：
#   1) 静态映射表 KEYWORD_MAP：7 个提醒脚本的预设关键字（中英文、简写等）
#   2) 动态关键字：实时读取 .cache/custom_rules.json，把每条 enabled=true 规则的 name
#      作为关键字，映射到 custom_rules.sh test <ruleId>（忽略触发条件直接发送一次）
#      - 动态关键字优先级高于静态的 "自定义规则/规则/custom"（它们仍保留，用于 run_all_enabled）
#      - 动态关键字不会覆盖其他 6 个脚本的静态关键字（防止规则命名为"周报"造成路由错乱）
#   3) 内部自省关键字："快捷指令/指令列表/关键字/help" 走内部函数 cmd_help_push，
#      把 reminder.sh + tools/card.sh 两张关键字表整理成 Markdown 消息推送到企微
#
# 与 scripts/tools/card.sh 的区别：
#   - card.sh 路由的是"信息卡片脚本"（产出 PNG，走 PUSH_CARD_IMAGE 图片推送）
#   - reminder.sh 路由的是"提醒类脚本"（内部自行 send_wecom_message 推送文本）
#     因此本入口【不】注入 PUSH_CARD_IMAGE，也不额外做推送动作，"执行即推送"是被调
#     脚本的自带语义。crontab 直调子脚本的既有路径不受影响。
#
# 输出契约：
#   成功命中：退出码 0（被调脚本的 stdout 原样透传，通常是 log 信息）
#   未命中：退出码 0，stdout/stderr 完全为空（交给 AI 侧处理）；加 --strict 时改为退出 2
#   错误：stderr 输出错误信息，退出码非 0
#
# 结构：主脚本 + 同名子目录（scripts/reminder/）
#   - reminder/keyword_map.sh  静态 KEYWORD_MAP + script_display_name
#   - reminder/router.sh       normalize_keyword / read_custom_rule_entries /
#                              is_reserved_static_keyword / lookup_script
#   - reminder/help_push.sh    cmd_help_push 及其辅助函数
#   - reminder/cli.sh          print_help / print_list
#   - reminder/runner.sh       run_builtin / run_child_script
#
# 作者：智能提醒系统
# 更新：2026-04-30
# ======================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CUSTOM_RULES_JSON="${PROJECT_DIR}/.cache/custom_rules.json"

# 接入统一日志体系：stderr 彩色输出 + reminder.log 落盘，便于排查关键字路由异常
# 与 scripts/tools/card.sh 保持一致的日志风格
LOG_FILE="${SCRIPT_DIR}/reminder.log"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/log_utils.sh" 2>/dev/null || {
    # log_utils.sh 不可用时提供最小降级实现，保证脚本自身不挂
    log_info()  { echo "[INFO] $*" >&2; }
    log_warn()  { echo "[WARN] $*" >&2; }
    log_error() { echo "[ERROR] $*" >&2; }
}

# ======================================
# 加载子模块
# ======================================
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/reminder/keyword_map.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/reminder/router.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/reminder/help_push.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/reminder/cli.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/reminder/runner.sh"

# ======================================
# 参数解析
# ======================================

if [[ $# -eq 0 || "$1" == "-h" || "$1" == "--help" ]]; then
    print_help
    exit 0
fi

if [[ "$1" == "--list" || "$1" == "-l" ]]; then
    print_list
    exit 0
fi

# --dry-run：只解析路由，不执行子脚本；便于 CI / 人工验证关键字映射
DRY_RUN=0
if [[ "$1" == "--dry-run" || "$1" == "-n" ]]; then
    DRY_RUN=1
    shift
    if [[ $# -eq 0 ]]; then
        log_error "--dry-run 需要一个关键字参数"
        echo "FAILED: --dry-run 需要一个关键字参数" >&2
        exit 2
    fi
fi

# --strict：明确要求"必须命中关键字"的调用方（如 crontab/测试）可加此开关
#           未命中时仍然会报错退出 2；默认行为是"静默放行，交由 AI 处理"
STRICT=0
if [[ "${1:-}" == "--strict" ]]; then
    STRICT=1
    shift
    if [[ $# -eq 0 ]]; then
        log_error "--strict 需要一个关键字参数"
        echo "FAILED: --strict 需要一个关键字参数" >&2
        exit 2
    fi
fi

KEYWORD="$1"

# ======================================
# 路由并执行
# ======================================
# 契约：
#   - 命中关键字 → 交给脚本处理，stdout 输出执行结果（供 AI 直接透传给用户）
#   - 未命中关键字 → 静默退出 0，stdout 完全为空；AI 侧据此判定"脚本不接管，我来答"
#     （若调用方希望"未命中 = 失败"，请显式加 --strict）

MAPPED="$(lookup_script "$KEYWORD")" || {
    if [[ "$STRICT" == "1" ]]; then
        log_error "未识别的关键字（--strict）: $KEYWORD"
        echo "FAILED: 未识别的关键字: $KEYWORD" >&2
        echo "可用关键字请运行: bash scripts/reminder.sh --list" >&2
        exit 2
    fi
    # 非严格模式：静默放行，仅留一条 INFO 日志用于排查，stdout/stderr 均不输出
    log_info "未命中关键字，交由 AI 处理（非脚本关键字）: $KEYWORD"
    exit 0
}

# 拆分脚本名与默认参数（参数可能为空）
SCRIPT_NAME="${MAPPED%% *}"
DEFAULT_ARGS=""
if [[ "$MAPPED" == *" "* ]]; then
    DEFAULT_ARGS="${MAPPED#* }"
fi

# 内部命令分支：目标为 __builtin__ 时，不执行子脚本，改为调用本文件内同名函数
if [[ "$SCRIPT_NAME" == "__builtin__" ]]; then
    run_builtin "$DEFAULT_ARGS" "$KEYWORD" "$DRY_RUN"
    exit $?
fi

# 普通子脚本分支：fork + tee 透传 + 回显 + 企微推送概要
run_child_script "$SCRIPT_NAME" "$DEFAULT_ARGS" "$KEYWORD" "$DRY_RUN"
exit $?
