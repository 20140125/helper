#!/bin/bash

# ======================================
# 日志清理模块
# ======================================
#
# 功能说明：
#   1. 交互式清空所有日志文件
#   2. 非交互式批量清空（供 Web/脚本调用）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 清空所有日志（交互式）
clean_logs() {
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}    🧹 清空所有日志文件${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    read -p "确定要清空所有日志文件吗？(y/N) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        while IFS= read -r -d '' log_file; do
            > "$log_file"
            echo -e "${GREEN}✅ 已清空: ${log_file#${LOG_DIR}/}${NC}"
        done < <(find "${LOG_DIR}" -type f -name "*.log" -print0)
        echo ""
        echo -e "${GREEN}✅ 所有日志已清空${NC}"
    else
        echo -e "${YELLOW}⚠️  操作已取消${NC}"
    fi
}

# 非交互式批量清空所有日志
# 适用于 Web 界面触发或脚本调用
force_clean_logs() {
    # 加载日志工具以记录操作本身
    LOG_FILE="${LOG_DIR}/view_logs.log"
    source "${SCRIPT_DIR}/log_utils.sh" 2>/dev/null

    log_info "======================================"
    log_info "🧹 清除所有日志记录脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local cleared_count=0
    local failed_count=0

    # 递归查找 LOG_DIR 及其所有子目录（如 tools/、update-tools/）下的 .log 文件
    while IFS= read -r -d '' log_file; do
        # 展示用的相对路径，方便辨识子目录下的日志
        local rel_path="${log_file#${LOG_DIR}/}"
        # 跳过自身日志文件，避免清空后立即写入导致的竞争
        if [ "$log_file" = "$LOG_FILE" ]; then
            continue
        fi
        if > "$log_file" 2>/dev/null; then
            log_success "已清空: ${rel_path}"
            cleared_count=$((cleared_count + 1))
        else
            log_error "清空失败: ${rel_path}"
            failed_count=$((failed_count + 1))
        fi
    done < <(find "${LOG_DIR}" -type f -name "*.log" -print0)

    log_info "======================================"
    if [ "$failed_count" -eq 0 ]; then
        log_success "清除完成，共清空 ${cleared_count} 个日志文件"
    else
        log_warning "清除完成，成功 ${cleared_count} 个，失败 ${failed_count} 个"
    fi
    log_info "======================================"
}
