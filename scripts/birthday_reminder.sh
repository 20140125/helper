#!/bin/bash

# ======================================
# 生日提醒脚本
# ======================================
# 
# 功能说明：
#   1. 检查今天是否有人生日（支持公历和农历）
#   2. 发送生日祝福消息到企业微信
#   3. 支持提前 N 天倒计时提醒（使用 birthday_countdown 模板）
#   4. 精确计算倒计时天数（利用 date_utils.py）
#   5. 从JSON文件动态加载祝福语，丰富祝福内容
#   6. 自动转换农历生日为公历日期（单次转换，避免重复调用）
#   7. 内联生日配置（从 .env 读取生日列表）
# 
# 生日格式：
#   - 公历：YYYY-MM-DD 或 MM-DD
#   - 农历：lunar:MM-DD（每年自动转换）
#
# 配置来源：
#   - 环境变量：.env 文件中的 BIRTHDAY_LIST
#   - 祝福语：greetings.json 对应的已有业务表（birthday 分类）
#   - 祝福语加载器：greetings_loader.sh
#   - 消息模板：template_utils.sh
#
# 模块拆分：
#   birthday_reminder/parser.sh   - 生日解析（公历/农历）
#   birthday_reminder/sender.sh   - 消息发送（祝福/倒计时）
#   birthday_reminder/checker.sh  - 生日检查（遍历列表）
#
# 命令行用法：
#   ./birthday_reminder.sh check      - 检查并发送生日提醒（默认）
#   ./birthday_reminder.sh test       - 显示生日列表及倒计时详情
#   ./birthday_reminder.sh dry-run    - 模拟运行，渲染消息但不发送
# 
# 作者：智能提醒系统
# 更新：2026-04-22
# ======================================

# ======================================
# 加载配置文件
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 加载统一配置（包含 TZ 和 WECOM_WEBHOOK）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

# 设置日志文件路径
LOG_FILE="${PROJECT_DIR}/birthday_reminder.log"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# ======================================
# 内联生日配置（从 .env 读取）
# ======================================

# 加载 .env 文件（ENV_FILE 由 project_config.sh 解析：web/.env 优先，缺失时回退 scripts/.env）
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env}"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
else
    log_warning "未找到 .env 文件，使用默认配置"
fi

MANUAL_MODE="true"

# 从 .env 读取生日列表（格式：姓名|生日|企业微信ID，多个用分号分隔）
# 生日格式支持：MM-DD / YYYY-MM-DD / lunar:MM-DD
if [ -n "$BIRTHDAY_LIST" ]; then
    IFS=';' read -ra BIRTHDAY_ARRAY <<< "$BIRTHDAY_LIST"
    BIRTHDAY_LIST=("${BIRTHDAY_ARRAY[@]}")
else
    BIRTHDAY_LIST=(
        "方龙|lunar:10-16|v_llongfang"
    )
fi

# 配置参数
ADVANCE_DAYS="${BIRTHDAY_ADVANCE_DAYS:-1}"
SEND_ON_BIRTHDAY="${BIRTHDAY_SEND_ON_BIRTHDAY:-true}"
BIRTHDAY_REMINDER_TIME="${BIRTHDAY_REMINDER_TIME:-09:00}"
BIRTHDAY_WEBHOOK="${WECOM_WEBHOOK}"
BIRTHDAY_LOG_FILE="${LOG_FILE}"

export MANUAL_MODE BIRTHDAY_LIST BIRTHDAY_TEMPLATE ADVANCE_DAYS
export SEND_ON_BIRTHDAY BIRTHDAY_REMINDER_TIME BIRTHDAY_WEBHOOK
export BIRTHDAY_LOG_FILE

# ======================================
# 加载祝福语和模板工具
# ======================================

# 加载祝福语加载器
source "${PROJECT_DIR}/greetings_loader.sh" 2>/dev/null

# 加载消息模板工具
source "${SCRIPT_DIR}/template_utils.sh" 2>/dev/null

# dry-run 模式标志（默认关闭）
DRY_RUN=false

# ======================================
# 加载子模块
# ======================================

source "${SCRIPT_DIR}/birthday_reminder/parser.sh"
source "${SCRIPT_DIR}/birthday_reminder/sender.sh"
source "${SCRIPT_DIR}/birthday_reminder/checker.sh"

# ======================================
# 主逻辑
# ======================================

main() {
    log_info "======================================"
    log_info "🚀 生日提醒脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    if [ "$DRY_RUN" = true ]; then
        log_info "🔧 模式: DRY-RUN（不实际发送）"
    fi
    log_info "======================================"

    # 检查生日
    check_today_birthday

    log_success "脚本执行完成"
    log_info "======================================"
}

# ======================================
# 命令行参数处理
# ======================================
case "${1:-check}" in
    check)
        main
        ;;
    dry-run|dryrun)
        # 模拟运行模式：渲染消息但不发送
        DRY_RUN=true
        main
        ;;
    test)
        # 测试模式：显示生日列表详情（含公历转换、精确倒计时）
        log_info "======================================"
        log_info "📅 生日列表详情"
        log_info "======================================"
        for entry in "${BIRTHDAY_LIST[@]}"; do
            IFS='|' read -r name birthday_str userid <<< "$entry"

            parsed=$(parse_birthday_entry "$birthday_str")

            if [ "$parsed" = "ERROR" ]; then
                log_error "  ❌ ${name}: ${birthday_str} → 转换失败"
                continue
            fi

            IFS='|' read -r birth_md birthday_display days_remaining <<< "$parsed"

            # 判断提醒状态
            status=""
            if [ "$days_remaining" -eq 0 ] 2>/dev/null; then
                status="🎂 今天生日！"
            elif [ "$days_remaining" -le "$ADVANCE_DAYS" ] 2>/dev/null && [ "$days_remaining" -gt 0 ] 2>/dev/null; then
                status="🔔 在提醒范围内"
            else
                status="⏳ 未到提醒日"
            fi

            log_info "  🎂 ${name}"
            log_info "     原始: ${birthday_str}"
            log_info "     公历: ${birth_md}"
            log_info "     展示: ${birthday_display}"
            log_info "     倒计时: ${days_remaining} 天"
            log_info "     状态: ${status}"
            log_info "     ──────────────────────"
        done
        log_info "======================================"
        log_info "配置：提前 ${ADVANCE_DAYS} 天提醒 | 当天发送: ${SEND_ON_BIRTHDAY}"
        log_info "======================================"
        ;;
    *)
        log_error "用法: $0 {check|test|dry-run}"
        log_error "  check   - 检查并发送生日提醒（默认）"
        log_error "  test    - 显示生日列表及倒计时详情"
        log_error "  dry-run - 模拟运行，渲染消息但不发送"
        log_info "======================================"
        exit 1
        ;;
esac
