#!/bin/bash

# ======================================
# 日志管理工具
# ======================================
#
# 功能说明：
#   1. 快速查看和分析系统各模块日志
#   2. 支持按模块筛选（天气、生日、节假日等）
#   3. 支持按日志级别过滤（INFO/SUCCESS/WARNING/ERROR）
#   4. 支持实时跟踪日志输出（tail -f 模式）
#   5. 提供日志统计和清理功能
#
# 使用方式：
#   bash view_logs.sh              # 显示帮助信息
#   bash view_logs.sh all          # 查看所有日志
#   bash view_logs.sh errors       # 查看所有错误日志
#   bash view_logs.sh <模块名>     # 查看指定模块日志
#   bash view_logs.sh follow       # 实时跟踪日志
#   bash view_logs.sh clean        # 交互式清理日志
#
# 说明：非交互式批量清空（force_clean_logs）不再作为子命令暴露——
#   它由 annual_scheduler.sh 直接 source view_logs/log_cleaner.sh 后定时调用（清项目下所有 .log）；
#   日常清日志走「运行日志页 / 贾维斯 manage_logs」（只清已注册的日志），两者范围不同。
#
# 模块拆分：
#   view_logs/log_config.sh    - 帮助信息与日志路径映射
#   view_logs/log_viewer.sh    - 日志查看/筛选/跟踪
#   view_logs/log_reporter.sh  - 日志统计与报告生成
#   view_logs/log_cleaner.sh   - 日志清理功能
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"
source "${SCRIPT_DIR}/log_utils.sh"

# 日志目录
LOG_DIR="${PROJECT_DIR}"

# ======================================
# 加载子模块
# ======================================

source "${SCRIPT_DIR}/view_logs/log_config.sh"
source "${SCRIPT_DIR}/view_logs/log_viewer.sh"
source "${SCRIPT_DIR}/view_logs/log_reporter.sh"
source "${SCRIPT_DIR}/view_logs/log_cleaner.sh"

# ======================================
# 主入口：子命令路由
# ======================================

main() {
    local command="${1:-help}"

    log_info "======================================"
    log_info "🚀 日志查看工具启动 ($command)"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    case "$command" in
        list)
            list_logs
            ;;
        view)
            if [ -z "$2" ]; then
                echo -e "${RED}❌ 请指定日志名称${NC}"
                echo "用法: $0 view <日志名>"
                return 1
            fi
            view_log "$2" "${3:-50}"
            ;;
        tail)
            if [ -z "$2" ]; then
                echo -e "${RED}❌ 请指定日志名称${NC}"
                echo "用法: $0 tail <日志名>"
                return 1
            fi
            tail_log "$2"
            ;;
        today)
            if [ -z "$2" ]; then
                echo -e "${RED}❌ 请指定日志名称${NC}"
                echo "用法: $0 today <日志名>"
                return 1
            fi
            today_log "$2"
            ;;
        error)
            view_errors
            ;;
        success)
            view_success
            ;;
        states)
            show_states
            ;;
        report)
            generate_report
            ;;
        clean)
            clean_logs
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}❌ 未知命令: $command${NC}"
            echo ""
            show_help
            return 1
            ;;
    esac
}

# 执行主函数
main "$@"