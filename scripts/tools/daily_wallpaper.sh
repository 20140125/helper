#!/bin/bash
# ======================================
# 必应每日壁纸
# ======================================
#
# 功能说明：
#   1. 获取必应每日一图（免费公开接口，无需 API Key）
#   2. 直接把壁纸原图落到 web/public/skill-images/，stdout 输出图片路径
#   3. data / json 模式输出接口原始 JSON（含版权说明）
#
# 说明：
#   本脚本不渲染 SVG——图片本身就来自上游，直接下载即可。
#   与其它卡片脚本一样支持输出模式开关。
#
# 使用方式：
#   bash scripts/tools/daily_wallpaper.sh
#
# 作者：智能提醒系统
# 更新：2026-10-12
# ======================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../project_config.sh"
LOG_FILE="${SCRIPT_DIR}/tools.log"
source "${PROJECT_DIR}/log_utils.sh"
source "${SCRIPT_DIR}/card_utils.sh"

OUTPUT_FILE="${CARD_OUTPUT_DIR}/daily_wallpaper_card.png"

fetch_meta() {
    local url="https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1"
    local cache_file
    cache_file=$(api_cache_path bingwallpaper)

    local result
    result=$(cached_curl "${cache_file}" -s --max-time 15 "$url" 2>/dev/null)

    if [ -z "$result" ]; then
        log_error "必应壁纸元数据获取失败"
        return 1
    fi
    echo "$result"
}

main() {
    log_info "======================================"
    log_info "必应每日壁纸获取启动"
    log_info "当前时间: $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    local meta
    meta=$(fetch_meta) || exit 1

    # 原始数据模式（data / json）：只吐接口返回的原始 JSON（含壁纸地址与版权说明），
    # 不再下载本地图片 —— 预览展示的是上游接口地址，而非本地固定路径的卡片图。
    # card 模式下 flush_raw_output 返回 1，继续走下面的下载与出图流程。
    emit_raw "$meta"
    flush_raw_output

    local img_path copyright
    img_path=$(echo "$meta" | jq -r '.images[0].url // empty')
    copyright=$(echo "$meta" | jq -r '.images[0].copyright // empty')
    if [ -z "$img_path" ]; then
        log_error "壁纸地址解析失败"
        exit 1
    fi
    log_info "壁纸说明: ${copyright}"

    # url 字段是相对路径，需拼接必应域名
    curl -s --max-time 25 "https://cn.bing.com${img_path}" -o "$OUTPUT_FILE" 2>/dev/null
    if [ ! -s "$OUTPUT_FILE" ]; then
        log_error "壁纸下载失败"
        exit 1
    fi

    log_success "壁纸保存完成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
