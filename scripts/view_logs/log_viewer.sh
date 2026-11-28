#!/bin/bash

# ======================================
# 日志查看与筛选模块（数据库版）
# ======================================
#
# 功能说明：
#   1. 列出所有日志来源及记录数
#   2. 查看指定来源（最近 N 条）
#   3. 实时跟踪新日志（轮询 hp_run_logs）
#   4. 查看今天的日志
#   5. 查看最近的错误 / 成功日志
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 列出所有日志来源
list_logs() {
    _log_db_check || return 1

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📁 日志来源列表（hp_run_logs）${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    local rows
    rows=$(log_db_query "SELECT source, COUNT(*), COALESCE(SUM(LENGTH(message)), 0), DATE_FORMAT(MAX(logged_at), '%Y-%m-%d %H:%i:%s') FROM hp_run_logs GROUP BY source ORDER BY MAX(logged_at) DESC;")
    if [ -z "$rows" ]; then
        echo -e "${YELLOW}⚠️  暂无日志记录${NC}"
        return 0
    fi

    while IFS=$'\t' read -r source count bytes modified; do
        echo -e "${GREEN}📄 $source${NC}"
        echo "   记录数: $count"
        echo "   正文大小: ${bytes} 字节"
        echo "   最近写入: $modified"
        echo ""
    done <<< "$rows"
}

# 查看日志（最近 N 条）
view_log() {
    local log_name="$1"
    local lines="${2:-50}"
    _log_db_check || return 1

    local source
    source=$(get_log_source "$log_name")
    if [ -z "$source" ]; then
        echo -e "${RED}❌ 未知的日志名称: $log_name${NC}"
        return 1
    fi
    case "$lines" in
        ''|*[!0-9]*) lines=50 ;;
    esac

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📊 $source (最近${lines}条)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    log_db_query "SELECT ${LOG_LINE_SQL} FROM (SELECT id, logged_at, level, message FROM hp_run_logs WHERE source = $(log_db_quote "$source") ORDER BY id DESC LIMIT ${lines}) t ORDER BY id ASC;"
}

# 实时查看日志（按自增 id 轮询新增记录）
tail_log() {
    local log_name="$1"
    _log_db_check || return 1

    local source
    source=$(get_log_source "$log_name")
    if [ -z "$source" ]; then
        echo -e "${RED}❌ 未知的日志名称: $log_name${NC}"
        return 1
    fi
    local quoted_source
    quoted_source=$(log_db_quote "$source")

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📊 实时查看: $source（每 2 秒轮询）${NC}"
    echo -e "${BLUE}    按 Ctrl+C 退出${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    local last_id
    last_id=$(log_db_query "SELECT COALESCE(MAX(id), 0) FROM hp_run_logs WHERE source = ${quoted_source};")
    last_id=${last_id:-0}

    while true; do
        log_db_query "SELECT ${LOG_LINE_SQL} FROM hp_run_logs WHERE source = ${quoted_source} AND id > ${last_id} ORDER BY id ASC LIMIT 200;"
        last_id=$(log_db_query "SELECT COALESCE(MAX(id), ${last_id}) FROM hp_run_logs WHERE source = ${quoted_source};")
        last_id=${last_id:-0}
        sleep 2
    done
}

# 查看今天的日志
today_log() {
    local log_name="$1"
    _log_db_check || return 1

    local source
    source=$(get_log_source "$log_name")
    if [ -z "$source" ]; then
        echo -e "${RED}❌ 未知的日志名称: $log_name${NC}"
        return 1
    fi

    local today
    today=$(date +%Y-%m-%d)
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📊 今天的日志: $source ($today)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    local rows
    rows=$(log_db_query "SELECT ${LOG_LINE_SQL} FROM hp_run_logs WHERE source = $(log_db_quote "$source") AND DATE(logged_at) = CURDATE() ORDER BY id ASC;")
    if [ -z "$rows" ]; then
        echo -e "${YELLOW}⚠️  今天暂无日志${NC}"
    else
        echo "$rows"
    fi
}

# 查看最近的错误日志
view_errors() {
    _log_db_check || return 1

    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}    ❌ 最近 50 条错误日志${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    local rows
    rows=$(log_db_query "SELECT CONCAT('[', source, '] ', ${LOG_LINE_SQL}) FROM (SELECT id, source, logged_at, level, message FROM hp_run_logs WHERE level = 'ERROR' ORDER BY id DESC LIMIT 50) t ORDER BY id ASC;")
    if [ -z "$rows" ]; then
        echo -e "${GREEN}✅ 没有错误日志${NC}"
    else
        echo "$rows"
    fi
}

# 查看最近的成功日志
view_success() {
    _log_db_check || return 1

    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}    ✅ 最近 50 条成功日志${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    local rows
    rows=$(log_db_query "SELECT CONCAT('[', source, '] ', ${LOG_LINE_SQL}) FROM (SELECT id, source, logged_at, level, message FROM hp_run_logs WHERE message LIKE '✅%' ORDER BY id DESC LIMIT 50) t ORDER BY id ASC;")
    if [ -z "$rows" ]; then
        echo -e "${YELLOW}⚠️  暂无成功日志${NC}"
    else
        echo "$rows"
    fi
}
