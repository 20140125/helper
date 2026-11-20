#!/bin/bash

# ======================================
# 日志配置与帮助模块
# ======================================
#
# 功能说明：
#   1. 显示帮助信息
#   2. 日志名称到文件路径的映射
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 显示帮助信息
show_help() {
    cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    📊 日志查看工具
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

用法: $0 [命令] [参数]

命令：
  list              列出所有日志文件
  view <日志名>     查看指定日志（最近50行）
  tail <日志名>     实时查看日志
  today <日志名>    查看今天的日志
  error             查看所有错误日志
  success           查看所有成功日志
  stats             显示日志统计信息
  clean             清空所有日志文件（交互式确认）
  report            生成日志分析报告

日志名称：
  reminder_daemon   主提醒日志
  prefetch          数据预获取日志
  holiday           节假日祝福日志
  birthday          生日提醒日志
  weather           天气数据日志
  almanac           黄历数据日志
  horoscope         星座运势日志
  history           历史上的今天日志
  workday           调休上班提醒日志
  monthly           月度提醒日志
  special           特殊节日日志
  lunar             农历节日日志
  solar             二十四节气日志
  scheduler         调度器日志
  annual            年度更新日志

示例：
  $0 list                    # 列出所有日志
  $0 view reminder_daemon    # 查看主提醒日志
  $0 tail prefetch           # 实时查看预获取日志
  $0 today reminder_daemon   # 查看今天的提醒日志
  $0 error                   # 查看所有错误
  $0 stats                   # 显示统计信息
  $0 report                  # 生成分析报告

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

# 获取日志文件路径
get_log_file() {
    local log_name="$1"
    
    case "$log_name" in
        reminder_daemon)
            echo "${LOG_DIR}/reminder_daemon.log"
            ;;
        reminder)
            echo "${LOG_DIR}/reminder.log"
            ;;
        prefetch)
            echo "${LOG_DIR}/prefetch.log"
            ;;
        holiday)
            echo "${LOG_DIR}/festival_greetings.log"
            ;;
        birthday)
            echo "${LOG_DIR}/birthday_reminder.log"
            ;;
        weather)
            echo "${LOG_DIR}/weather.log"
            ;;
        almanac)
            echo "${LOG_DIR}/almanac.log"
            ;;
        horoscope)
            echo "${LOG_DIR}/horoscope.log"
            ;;
        history)
            echo "${LOG_DIR}/history_today.log"
            ;;
        workday)
            echo "${LOG_DIR}/workday_manager.log"
            ;;
        monthly)
            echo "${LOG_DIR}/monthly.log"
            ;;
        special)
            echo "${LOG_DIR}/festival_greetings.log"
            ;;
        lunar)
            echo "${LOG_DIR}/festival_greetings.log"
            ;;
        solar)
            echo "${LOG_DIR}/festival_greetings.log"
            ;;
        scheduler)
            echo "${LOG_DIR}/scheduler.log"
            ;;
        annual)
            echo "${LOG_DIR}/annual_update.log"
            ;;
        get_holidays)
            echo "${LOG_DIR}/update-tools/get_holidays.log"
            ;;
        generate_holiday_config)
            echo "${LOG_DIR}/update-tools/generate_holiday_config.log"
            ;;
        update_month_config)
            echo "${LOG_DIR}/update-tools/update_month_config.log"
            ;;
        send_update_notification)
            echo "${LOG_DIR}/update-tools/send_update_notification.log"
            ;;
        tool)
            echo "${LOG_DIR}/tools/tools.log"
            ;;
        *)
            echo ""
            ;;
    esac
}
