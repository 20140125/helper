#!/bin/bash

# ======================================
# 日志配置与帮助模块
# ======================================
#
# 功能说明：
#   1. 显示帮助信息
#   2. 日志名称到 hp_run_logs.source 的映射
#
# 说明：日志已全量入库，不再有「日志名 → 文件路径」的映射；
#   这里的每个名称对应库里的一个来源标识。
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 显示帮助信息
show_help() {
    cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    📊 日志查看工具（数据库版）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

用法: $0 [命令] [参数]

命令：
  list              列出所有日志来源及记录数
  view <日志名>     查看指定来源（最近50条）
  tail <日志名>     实时跟踪新日志（每 2 秒轮询）
  today <日志名>    查看今天的日志
  error             查看最近的错误日志
  success           查看最近的成功日志
  states            显示日志统计信息
  clean             清空全部日志记录（交互式确认）
  report            生成日志分析报告

日志名称（对应 hp_run_logs.source）：
  reminder_daemon   主提醒日志
  prefetch          数据预获取日志
  holiday           节假日祝福日志
  birthday          生日提醒日志
  weather           实时天气抓取
  almanac           实时黄历抓取
  horoscope         实时星座抓取
  history           历史上的今天
  workday           调休上班提醒
  monthly           月度提醒
  special           特殊节日日志
  lunar             农历节日日志
  solar             二十四节气日志
  scheduler         年度调度器
  annual            年度更新日志
  web_server        Web 服务日志
  web_access        接口访问日志
  tools             技能图谱日志

示例：
  $0 list                    # 列出所有来源
  $0 view reminder_daemon    # 查看主提醒日志
  $0 tail prefetch           # 实时跟踪预获取日志
  $0 error                   # 查看最近错误
  $0 states                  # 显示统计信息
  $0 report                  # 生成分析报告

数据来自 hp_run_logs；连接参数取 web/.env 的 DB_*。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

# 获取日志名称对应的库来源标识（输出为空表示未知名称）
get_log_source() {
    local log_name="$1"

    case "$log_name" in
        reminder_daemon|daemon) echo "reminder_daemon" ;;
        reminder) echo "reminder" ;;
        prefetch|daily_data) echo "daily_data_manager" ;;
        holiday|festival) echo "festival_greetings" ;;
        birthday) echo "birthday_reminder" ;;
        weather) echo "fetch_real_weather" ;;
        almanac) echo "fetch_real_almanac" ;;
        horoscope) echo "fetch_real_horoscope" ;;
        history) echo "history_today" ;;
        workday) echo "workday_manager" ;;
        monthly) echo "monthly_reminder" ;;
        weekly) echo "weekly_summary" ;;
        special|lunar|solar) echo "festival_greetings" ;;
        scheduler) echo "annual_scheduler" ;;
        annual) echo "annual_update" ;;
        custom_rules) echo "custom_rules" ;;
        holiday_countdown) echo "holiday_countdown" ;;
        get_holidays) echo "get_holidays" ;;
        generate_holiday_config) echo "generate_holiday_config" ;;
        update_month_config) echo "update_month_config" ;;
        send_update_notification) echo "send_update_notification" ;;
        web_server|web_launcher|web_access|tools) echo "$log_name" ;;
        *)
            # 允许直接传库里出现的任意来源名，保证「所有日志」都能查到
            case "$log_name" in
                *[!a-zA-Z0-9_-]*) echo "" ;;
                *) echo "$log_name" ;;
            esac
            ;;
    esac
}

# 渲染一行日志（供各查询 SQL 复用）
# 说明：mysql --batch 会把正文里的换行转义成 \n，页面/终端都能正常阅读
LOG_LINE_SQL="CONCAT('[', DATE_FORMAT(logged_at, '%Y-%m-%d %H:%i:%s'), '] [', level, '] ', message)"

# 数据库可用性检查（失败时给可操作的提示）
_log_db_check() {
    if ! log_db_available; then
        echo -e "${RED}❌ 日志数据库不可用：检查 web/.env 的 DB_* 配置与 mysql 客户端${NC}"
        return 1
    fi
    return 0
}
