#!/bin/bash

# ======================================
# 日志清理模块（数据库版）
# ======================================
#
# 功能说明：
#   1. 交互式清空全部日志记录
#   2. 非交互式按保留天数删除过期记录（供定时调度调用）
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 清空所有日志（交互式）
clean_logs() {
    _log_db_check || return 1

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}    🧹 清空 hp_run_logs 全部记录${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    read -r -p "确定要清空所有日志记录吗？此操作不可恢复 (y/N) " -n 1
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        local removed
        removed=$(log_db_query "DELETE FROM hp_run_logs; SELECT ROW_COUNT();" | tail -1)
        echo -e "${GREEN}✅ 已删除 ${removed:-0} 条日志记录${NC}"
    else
        echo -e "${YELLOW}⚠️  操作已取消${NC}"
    fi
}

# 非交互式清理：按 LOG_RETENTION_DAYS 删除过期记录
# 适用于年度调度器定时调用（替代原先「清空所有 .log 文件」）
force_clean_logs() {
    log_info "======================================"
    log_info "🧹 日志保留期清理启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "🗓️  保留天数: ${LOG_RETENTION_DAYS:-15}"
    log_info "======================================"

    if ! log_db_available; then
        log_error "日志数据库不可用，跳过本次清理（检查 web/.env 的 DB_* 与 mysql 客户端）"
        return 1
    fi

    local days="${LOG_RETENTION_DAYS:-15}"
    case "$days" in
        ''|*[!0-9]*) days=15 ;;
    esac

    local removed
    removed=$(log_db_query "DELETE FROM hp_run_logs WHERE logged_at < DATE_SUB(NOW(), INTERVAL ${days} DAY); SELECT ROW_COUNT();" | tail -1)
    removed=${removed:-0}

    log_success "清理完成，共删除 ${removed} 条过期日志记录"
    log_info "======================================"
}
