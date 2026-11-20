#!/bin/bash

# ======================================
# 日志统计与报告模块
# ======================================
#
# 功能说明：
#   1. 显示日志统计信息（行数、成功/失败/警告计数）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 显示日志统计信息
show_states() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📊 日志统计信息${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    local total_size=0
    local total_lines=0
    
    # 递归查找 LOG_DIR 及其所有子目录（如 tools/、update-tools/）下的 .log 文件
    while IFS= read -r -d '' log_file; do
        filename="${log_file#${LOG_DIR}/}"
        size=$(du -k "$log_file" | cut -f1)
        lines=$(wc -l < "$log_file")
        success=$(grep -c "✅" "$log_file" 2>/dev/null | tr -d '[:space:]')
        error=$(grep -c "❌" "$log_file" 2>/dev/null | tr -d '[:space:]')
        warning=$(grep -c "⚠" "$log_file" 2>/dev/null | tr -d '[:space:]')
        success=${success:-0}
        error=${error:-0}
        warning=${warning:-0}
        
        total_size=$((total_size + size))
        total_lines=$((total_lines + lines))
        
        echo -e "${GREEN}📄 $filename${NC}"
        echo "   行数: $lines"
        echo -e "   成功: ${GREEN}${success}${NC}"
        echo -e "   失败: ${RED}${error}${NC}"
        echo -e "   警告: ${YELLOW}${warning}${NC}"
        echo ""
    done < <(find "${LOG_DIR}" -type f -name "*.log" -print0 | sort -z)
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}总计：${NC}"
    echo "   总大小: $(echo "scale=2; $total_size/1024" | bc) MB"
    echo "   总行数: $total_lines"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 生成日志分析报告
generate_report() {
    local today=$(date +%Y-%m-%d)

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}    📊 生成日志分析报告${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    {
        
        # 递归查找 LOG_DIR 及其所有子目录（如 tools/、update-tools/）下的 .log 文件
        while IFS= read -r -d '' log_file; do
            filename="${log_file#${LOG_DIR}/}"
            size=$(du -h "$log_file" | cut -f1)
            lines=$(wc -l < "$log_file")
            success=$(grep -c "✅" "$log_file" 2>/dev/null | tr -d '[:space:]')
            error=$(grep -c "❌" "$log_file" 2>/dev/null | tr -d '[:space:]')
            warning=$(grep -c "⚠" "$log_file" 2>/dev/null | tr -d '[:space:]')
            success=${success:-0}
            error=${error:-0}
            warning=${warning:-0}
            today_lines=$(grep -c "$today" "$log_file" 2>/dev/null | tr -d '[:space:]')
            today_lines=${today_lines:-0}
            
            echo "📄 $filename"
            echo "   大小: $size"
            echo "   总行数: $lines"
            echo "   今日行数: $today_lines"
            echo "   成功: $success"
            echo "   失败: $error"
            echo "   警告: $warning"
            echo ""
            
            # 显示最近的错误
            if [ $error -gt 0 ]; then
                echo "   最近错误："
                grep "❌" "$log_file" | tail -3 | sed 's/^/     /'
                echo ""
            fi
        done < <(find "${LOG_DIR}" -type f -name "*.log" -print0 | sort -z)
        
    }
}
