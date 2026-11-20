#!/bin/bash
# ======================================
# fetch_real_almanac - 老黄历子模块（聚合数据老黄历 API）
# ======================================
# 由主脚本 fetch_real_almanac.sh source 加载
# 不设置 SCRIPT_DIR / LOG_FILE（由主脚本统一管理）
# 依赖：log_utils / api_archive / JUHE_ALMANAC_API_KEY
# ======================================

# 获取真实黄历
# 参数：
#   $1 - 日期字符串（可选，YYYYMMDD 或 YYYY-MM-DD，默认今天）
# 返回：
#   成功：返回0，stdout 输出 Markdown 文本
#   失败：返回1，stdout 输出错误标记
get_real_almanac() {
    local date_str="${1:-$(date +%Y%m%d)}"
    local orig_input="$date_str"

    # 如果传入的是YYYY-MM-DD格式，转换为YYYYMMDD
    if [[ "$date_str" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        date_str=$(echo "$date_str" | tr -d '-')
        log_info "📆 日期格式转换: ${orig_input} → ${date_str}"
    fi
    log_info "🔍 准备获取黄历数据（目标日期: ${date_str}）"

    # 如果没有配置API Key，返回提示
    if [ -z "$JUHE_ALMANAC_API_KEY" ]; then
        log_warning "未配置聚合数据API Token，请在 .env 中设置 JUHE_ALMANAC_KEY"
        echo "API_TOKEN_NOT_CONFIGURED"
        return 1
    fi
    log_info "🔑 API Key 已加载（长度: ${#JUHE_ALMANAC_API_KEY}）"

    # 归档策略：只有目标日期 == 今天时才走 “一月一文件 + entries[今日]” 归档，
    # 否则直接实调 API，避免用历史日期数据覆盖 entries[today] 槽位
    local today_ymd
    today_ymd=$(TZ=Asia/Shanghai date +%Y%m%d)
    local cache_file=""
    local response=""
    if [ "${date_str}" = "${today_ymd}" ]; then
        cache_file=$(api_cache_path almanac)
        if response=$(read_cached_api_response "${cache_file}"); then
            log_info "🗂  命中今日归档缓存: ${cache_file}（bytes=${#response}），跳过 API 请求"
        fi
    fi
    if [ -z "${response}" ]; then
        # 调用聚合数据老黄历API
        # API文档：https://www.juhe.cn/docs/api/id/65
        local api_url="http://v.juhe.cn/laohuangli/d"
        log_info "🌐 调用聚合数据老黄历API: ${api_url}"
        local start_ts
        start_ts=$(now_ms)
        response=$(curl -s -m 10 "${api_url}?key=${JUHE_ALMANAC_API_KEY}&date=${date_str}" 2>/dev/null)
        local curl_exit=$?

        if [ $curl_exit -ne 0 ] || [ -z "$response" ]; then
            local end_ts=$(now_ms)
            local cost=$((end_ts - start_ts))
            log_error "API请求失败（curl_exit=${curl_exit}, 响应为空: $([ -z "$response" ] && echo yes || echo no), 耗时: ${cost}ms）"
            echo "API_REQUEST_FAILED"
            return 1
        fi
        log_info "📥 API 响应已接收（bytes=${#response}）"
        log_duration "$start_ts" "聚合数据老黄历API 调用完成"

        # 先校验接口状态再归档：错误响应（如 10001 错误的请求KEY）不能写入缓存，
        # 否则坏数据会被固化成"当日归档"，之后每次都命中这份错误内容
        local api_error_code
        api_error_code=$(json_get_number "$response" error_code)
        if [ "${api_error_code:-0}" != "0" ]; then
            local api_reason
            api_reason=$(json_get_string "$response" reason)
            log_error "API返回错误（error_code=${api_error_code}, reason=${api_reason}），不写入归档"
            echo "API_ERROR: ${api_reason}"
            return 1
        fi

        # 归档原始 JSON（失败不阻断主流程）；只有 “目标日期==今天” 时 cache_file 非空
        if [ -n "${cache_file}" ]; then
            if archive_api_response "${cache_file}" "${response}"; then
                log_info "🗂  原始 JSON 已归档: ${cache_file}"
            else
                log_warning "⚠️  归档失败（${cache_file}），不影响本次展示"
            fi
        else
            log_info "🗂  非今日查询（date_str=${date_str}），不写入归档以免覆盖今日槽位"
        fi
    fi

    # 检查API返回状态
    local error_code
    error_code=$(json_get_number "$response" error_code)
    if [ "$error_code" != "0" ]; then
        local reason
        reason=$(json_get_string "$response" reason)
        log_error "API返回错误（error_code=${error_code}, reason=${reason}）"
        echo "API_ERROR: $reason"
        return 1
    fi
    log_info "✅ API 返回状态正常（error_code=0）"

    # 解析JSON数据（根据实际API返回结构）
    log_info "🧩 开始解析黄历字段..."
    local yangli=$(json_get_string "$response" yangli)
    local yinli=$(json_get_string "$response" yinli)
    local wuxing=$(json_get_string "$response" wuxing)
    local chongsha=$(json_get_string "$response" chongsha)
    local baiji=$(json_get_string "$response" baiji)
    local jishen=$(json_get_string "$response" jishen)
    local yi=$(json_get_string "$response" yi)
    local xiongshen=$(json_get_string "$response" xiongshen)
    local ji=$(json_get_string "$response" ji)

    log_info "   阳历: ${yangli:-<空>}"
    log_info "   农历: ${yinli:-<空>}"
    log_info "   五行: ${wuxing:-<空>}"
    log_info "   冲煞: ${chongsha:-<空>}"
    log_info "   宜:   ${yi:-<空>}"
    log_info "   忌:   ${ji:-<空>}"

    # 关键字段缺失告警
    if [ -z "$yangli" ] && [ -z "$yinli" ]; then
        log_warning "⚠️  关键字段（yangli/yinli）均为空，API 结构可能已变更"
    fi

    # 生成Markdown格式
    log_info "📝 生成 Markdown 输出..."
    cat << ALMANAC
## 📅 今日黄历

**阳历**：${yangli}
**农历**：${yinli}
**五行**：${wuxing}

✅ **宜**：${yi}
❌ **忌**：${ji}

**冲煞**：${chongsha}
**吉神**：${jishen}
**凶神**：${xiongshen}
**彭祖百忌**：${baiji}

💡 黄历仅供参考，理性对待
ALMANAC

    log_success "真实黄历获取成功（${date_str}）"
    return 0
}
