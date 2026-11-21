#!/bin/bash

# ======================================
# 缓存数据读取模块
# ======================================
#
# 功能说明：
#   按类型读取缓存的每日数据
#   支持类型：weather / history / almanac / horoscope / inspirational_quote
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# 函数版本：读取指定类型的缓存数据
# 参数：$1 - 数据类型（weather|history|almanac|horoscope|inspirational_quote）
# 返回：数据内容（stdout），成功返回 0，失败返回 1
read_cached_data() {
    local data_type="${1:-weather}"

    # 检查缓存文件是否存在
    if [ ! -f "$CACHE_FILE" ]; then
        echo "CACHE_NOT_FOUND"
        return 1
    fi

    # 检查缓存是否过期（超过24小时）
    local mtime
    mtime=$(stat -c %Y "$CACHE_FILE" 2>/dev/null || stat -f %m "$CACHE_FILE" 2>/dev/null || echo 0)
    local cache_age=$(($(date +%s) - mtime))
    if [ $cache_age -gt 86400 ]; then
        echo "CACHE_EXPIRED"
        return 1
    fi

    # 读取并解析JSON（使用 jq 自动处理 \n 等转义字符）
    local data=""
    case "$data_type" in
        weather|history|almanac|horoscope|inspirational_quote)
            data=$(jq -r ".${data_type} // empty" "$CACHE_FILE" 2>/dev/null)
            ;;
        *)
            echo "INVALID_TYPE"
            return 1
            ;;
    esac

    if [ -n "$data" ] && [ "$data" != "FETCH_REALTIME" ] && [ "$data" != "SCRIPT_NOT_FOUND" ] && \
       [ "$data" != "API_FAILED" ] && [ "$data" != "FETCH_FAILED" ]; then
        # 清理 JSON 转义残留的 \/ → /
        echo "$data" | sed 's/\\\//\//g'
        return 0
    else
        echo "CACHE_EMPTY"
        return 1
    fi
}

cmd_read() {
    local data_type="${1:-weather}"
    read_cached_data "$data_type"
    exit $?
}
