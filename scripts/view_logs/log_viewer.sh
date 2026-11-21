#!/bin/bash

# ======================================
# 日志查看与筛选模块
# ======================================
#
# 功能说明：
#   1. 列出所有日志文件
#   2. 查看指定日志（最近N行）
#   3. 实时跟踪日志输出（tail -f）
#   4. 查看今天的日志
#   5. 查看所有错误/成功日志
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 列出所有日志文件
list_logs() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📁 日志文件列表${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # 递归查找 LOG_DIR 及其所有子目录（如 tools/、update-tools/）下的 .log 文件
    while IFS= read -r -d '' log_file; do
        filename="${log_file#${LOG_DIR}/}"
        size=$(du -h "$log_file" | cut -f1)
        lines=$(wc -l < "$log_file")
        modified=$(stat -c %y "$log_file" 2>/dev/null || stat -f '%Sm' -t '%Y-%m-%d %H:%M:%S' "$log_file" 2>/dev/null)
        modified=${modified%%.*}
        
        echo -e "${GREEN}📄 $filename${NC}"
        echo "   大小: $size"
        echo "   行数: $lines"
        echo "   修改: $modified"
        echo ""
    done < <(find "${LOG_DIR}" -type f -name "*.log" -print0 | sort -z)
}

# 查看日志（最近N行）
view_log() {
    local log_name="$1"
    local lines="${2:-50}"
    local log_file=$(get_log_file "$log_name")
    
    if [ -z "$log_file" ]; then
        echo -e "${RED}❌ 未知的日志名称: $log_name${NC}"
        return 1
    fi
    
    if [ ! -f "$log_file" ]; then
        echo -e "${YELLOW}⚠️  日志文件不存在: $log_file${NC}"
        return 1
    fi
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📊 $(basename "$log_file") (最近${lines}行)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    tail -n "$lines" "$log_file"
}

# 实时查看日志
tail_log() {
    local log_name="$1"
    local log_file=$(get_log_file "$log_name")
    
    if [ -z "$log_file" ]; then
        echo -e "${RED}❌ 未知的日志名称: $log_name${NC}"
        return 1
    fi
    
    if [ ! -f "$log_file" ]; then
        echo -e "${YELLOW}⚠️  日志文件不存在: $log_file${NC}"
        return 1
    fi
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📊 实时查看: $(basename "$log_file")${NC}"
    echo -e "${BLUE}    按 Ctrl+C 退出${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    tail -f "$log_file"
}

# 查看今天的日志
today_log() {
    local log_name="$1"
    local log_file=$(get_log_file "$log_name")
    local today=$(date +%Y-%m-%d)
    
    if [ -z "$log_file" ]; then
        echo -e "${RED}❌ 未知的日志名称: $log_name${NC}"
        return 1
    fi
    
    if [ ! -f "$log_file" ]; then
        echo -e "${YELLOW}⚠️  日志文件不存在: $log_file${NC}"
        return 1
    fi
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📊 今天的日志: $(basename "$log_file") ($today)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    grep "$today" "$log_file" || echo -e "${YELLOW}⚠️  今天暂无日志${NC}"
}

# 查看所有错误日志
view_errors() {
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}    ❌ 所有错误日志${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # 递归查找 LOG_DIR 及其所有子目录（如 tools/、update-tools/）下的 .log 文件
    while IFS= read -r -d '' log_file; do
        errors=$(grep "❌" "$log_file" 2>/dev/null)
        if [ -n "$errors" ]; then
            echo -e "${RED}📄 ${log_file#${LOG_DIR}/}${NC}"
            echo "$errors"
            echo ""
        fi
    done < <(find "${LOG_DIR}" -type f -name "*.log" -print0 | sort -z)
}

# 查看所有成功日志
view_success() {
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}    ✅ 所有成功日志${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # 递归查找 LOG_DIR 及其所有子目录（如 tools/、update-tools/）下的 .log 文件
    while IFS= read -r -d '' log_file; do
        success=$(grep "✅" "$log_file" 2>/dev/null | tail -10)
        if [ -n "$success" ]; then
            echo -e "${GREEN}📄 ${log_file#${LOG_DIR}/}${NC}"
            echo "$success"
            echo ""
        fi
    done < <(find "${LOG_DIR}" -type f -name "*.log" -print0 | sort -z)
}
