#!/bin/bash

# ======================================
# 日志统计与报告模块（数据库版）
# ======================================
#
# 功能说明：
#   1. 显示各来源的记录数、成功/失败/警告计数
#   2. 生成包含今日增量与最近错误的分析报告
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 各来源聚合统计的 SQL（列：来源 总数 成功 失败 警告 正文字节 今日数 最近时间）
LOG_STATS_SQL="SELECT source, COUNT(*), SUM(message LIKE '✅%'), SUM(level = 'ERROR'), SUM(level = 'WARNING'), COALESCE(SUM(LENGTH(message)), 0), SUM(DATE(logged_at) = CURDATE()), DATE_FORMAT(MAX(logged_at), '%Y-%m-%d %H:%i:%s') FROM hp_run_logs GROUP BY source ORDER BY MAX(logged_at) DESC"

# 显示日志统计信息
show_states() {
    _log_db_check || return 1

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📊 日志统计信息（hp_run_logs）${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    local rows
    rows=$(log_db_query "${LOG_STATS_SQL};")
    if [ -z "$rows" ]; then
        echo -e "${YELLOW}⚠️  暂无日志记录${NC}"
        return 0
    fi

    local total_lines=0 total_bytes=0
    while IFS=$'\t' read -r source count success error warning bytes today_count modified; do
        success=${success:-0}; error=${error:-0}; warning=${warning:-0}
        today_count=${today_count:-0}
        total_lines=$((total_lines + count))
        total_bytes=$((total_bytes + bytes))

        echo -e "${GREEN}📄 $source${NC}"
        echo "   记录数: $count（今日 $today_count）"
        echo "   最近写入: $modified"
        echo -e "   成功: ${GREEN}${success}${NC}  失败: ${RED}${error}${NC}  警告: ${YELLOW}${warning}${NC}"
        echo ""
    done <<< "$rows"

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}总计：${NC}"
    echo "   总记录数: $total_lines"
    echo "   正文总大小: $((total_bytes / 1024)) KB"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 生成日志分析报告
generate_report() {
    _log_db_check || return 1

    local today
    today=$(date +%Y-%m-%d)
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📊 生成日志分析报告 ($today)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    local rows
    rows=$(log_db_query "${LOG_STATS_SQL};")
    if [ -z "$rows" ]; then
        echo -e "${YELLOW}⚠️  暂无日志记录${NC}"
        return 0
    fi

    while IFS=$'\t' read -r source count success error warning bytes today_count modified; do
        success=${success:-0}; error=${error:-0}; warning=${warning:-0}
        today_count=${today_count:-0}
        echo "📄 $source"
        echo "   大小: $((bytes / 1024)) KB"
        echo "   总记录数: $count"
        echo "   今日记录数: $today_count"
        echo "   成功: $success  失败: $error  警告: $warning"
        echo "   最近写入: $modified"
        echo ""

        if [ "$error" -gt 0 ]; then
            echo "   最近错误："
            log_db_query "SELECT ${LOG_LINE_SQL} FROM (SELECT id, logged_at, level, message FROM hp_run_logs WHERE source = $(log_db_quote "$source") AND level = 'ERROR' ORDER BY id DESC LIMIT 3) t ORDER BY id ASC;" | sed 's/^/     /'
            echo ""
        fi
    done <<< "$rows"
}
