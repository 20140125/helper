#!/bin/bash

# ======================================
# 定时任务调度配置（统一从 .env 读取，支持热更新）
# ======================================
#
# 功能说明：
#   1. 所有定时任务的时间点 / 开关 / 轮询间隔统一从 ENV_FILE（web/.env）读取
#   2. 守护进程每轮循环开头调用 sched_reload() 重读，改完配置无需重启即生效
#   3. 取值一律走 sched_get <键> <默认值>：没配就用默认值，保证永不为空
#
# 取值优先级：
#   ENV_FILE（web/.env） > 进程环境变量 > 调用方传入的默认值
#   —— 文件优先是为了热更新：进程启动时若已 source 过 .env，
#      只有「以文件为准」才能让「页面改了 → 下一轮循环生效」成立
#
# 停用方式：把对应时间点留空即可（SCHED_LUNCH_TIME=），不需要单独的 ENABLED 开关。
#   时间为空 → 该任务永不触发；整个键不配 → 使用下面的默认值。
#
# 配置项一览（默认值即改造前的线上行为，不配就是原地不动）：
#   SCHED_POLL_SECONDS=30            提醒守护进程主循环节拍（秒）
#   SCHED_WINDOW_MINUTES=2           触发窗口：目标时间 ~ 目标时间+N 分钟
#   SCHED_PREFETCH_TIME=01:00        当日数据预取（凌晨，只缓存不发消息）
#   SCHED_PREFETCH_BACKUP_TIME=07:55 备用预取（当天缓存缺失才跑）
# 推送类提醒已全部迁到 custom_rules.json（早安 / 节日节气 / 月度 / 假期倒计时
# / 生日 / 午餐 / 下班 / 明日调休预告 / 每周总结），此处只剩下面这些非推送任务：
#   SCHED_ANNUAL_POLL_SECONDS=60     年度调度器主循环节拍（秒）
#   SCHED_ANNUAL_UPDATE_DATE=12-31   年度数据更新（MM-DD，留空停用）
#   SCHED_ANNUAL_UPDATE_TIME=23:59
#   SCHED_LOG_CLEAN_DAYS=01,15       日志清理（每月哪几号，逗号分隔）
#   SCHED_LOG_CLEAN_TIME=00:01
#
# 使用方式（需先 source project_config.sh 拿到 ENV_FILE）：
#   source "${PROJECT_DIR}/schedule_config.sh"
#   sched_reload                                  # 每轮循环开头调一次
#   sched_get SCHED_PREFETCH_TIME 01:00
#   sched_due SCHED_PREFETCH_TIME 01:00 && echo 到点
#   sched_in_window "08:00" && echo 到点
#
# 作者：智能提醒系统
# 更新：2026-10-22
# ======================================

# -----------------------------------------
# 重读配置：把 ENV_FILE 里 SCHED_ 开头的键同步为同名 shell 变量
# -----------------------------------------
# 只认 SCHED_[A-Z0-9_]+ 形式的键名，键名受控后 printf -v 赋值无注入风险；
# 文件不存在或没有相关键时什么都不做——各取值点用默认值兜底。
# -----------------------------------------
sched_reload() {
    [ -n "${ENV_FILE:-}" ] && [ -f "${ENV_FILE}" ] || return 0

    local key value
    while IFS='=' read -r key value; do
        case "${key}" in
            SCHED_[A-Z0-9_]*) ;;
            *) continue ;;
        esac
        # 去掉成对引号与可能的行尾 \r（Windows 编辑过的 .env）
        value="${value%$'\r'}"
        value="${value#\"}"; value="${value%\"}"
        value="${value#\'}"; value="${value%\'}"
        printf -v "${key}" '%s' "${value}"
    done < <(grep -E '^SCHED_[A-Z0-9_]+=' "${ENV_FILE}" 2>/dev/null)

    return 0
}

# -----------------------------------------
# 取一个配置项
# 参数：
#   $1 - 配置键（如 SCHED_PREFETCH_TIME）
#   $2 - 缺省值（文件与环境变量都没配时返回它）
# 输出：配置值（stdout，供调用方 $( ) 捕获）
# -----------------------------------------
sched_get() {
    local key="${1:-}"
    local fallback="${2:-}"
    local value=""

    [ -n "${key}" ] && value="${!key:-}"

    if [ -n "${value}" ]; then
        printf '%s' "${value}"
    else
        printf '%s' "${fallback}"
    fi
}

# -----------------------------------------
# 判断某个定时任务当前是否该触发
# 参数：
#   $1 - 时间点键（如 SCHED_PREFETCH_TIME）
#   $2 - 缺省时间点（键未配置时用它；键配了但留空则停用，不再回落到这里）
# 返回：0 到点该跑；1 未到点或已停用
# 说明：停用靠「把时间点留空」，不再需要 ENABLED 开关——
#       用 ${!key+set} 区分「键未配置」与「显式留空」两种状态
# -----------------------------------------
sched_due() {
    local key="${1:-}"
    local fallback="${2:-}"
    local value=""

    if [ -n "${key}" ] && [ -n "${!key+set}" ]; then
        value="${!key}"
    else
        value="${fallback}"
    fi

    # 时间点留空 = 该任务停用
    [ -n "${value}" ] || return 1

    sched_in_window "${value}"
}

# -----------------------------------------
# 判断当前时间是否落在「目标时间 ~ 目标时间+N 分钟」窗口内
# 参数：
#   $1 - 目标时间 HH:mm（如 08:00）
#   $2 - 窗口分钟数（省略则取 SCHED_WINDOW_MINUTES，默认 2）
# 返回：0 命中；1 未命中
# 说明：用窗口而非精确相等，是因为守护进程有轮询间隔，
#       精确相等会在节拍漂移时整点漏触发
# -----------------------------------------
sched_in_window() {
    local target_hh="${1%%:*}"
    local target_mm="${1##*:}"
    local window="${2:-$(sched_get SCHED_WINDOW_MINUTES 2)}"

    case "${window}" in
        ''|*[!0-9]*) window=2 ;;
    esac

    local now_minutes=$(( 10#$(date '+%H') * 60 + 10#$(date '+%M') ))
    local target_minutes=$(( 10#${target_hh} * 60 + 10#${target_mm} ))

    [ "${now_minutes}" -ge "${target_minutes}" ] && [ "${now_minutes}" -le $((target_minutes + window)) ]
}

# source 即加载一次：调用方不显式 reload 也能拿到配置
sched_reload
