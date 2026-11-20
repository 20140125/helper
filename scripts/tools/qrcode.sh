#!/bin/bash
# ======================================
# 二维码生成
# ======================================
#
# 功能说明：
#   1. 把任意文本 / 链接生成二维码 PNG（免费公开接口，无需 API Key）
#   2. 图片落到 web/public/skill-images/，stdout 输出图片路径
#   3. data 模式输出接口原始响应（PNG 二进制不便于展示，故提示改用 json 看元信息）
#
# 数据源：https://api.qrserver.com/v1/create-qr-code/（GoQR.me 免费接口）
#
# 使用方式：
#   bash scripts/tools/qrcode.sh "https://example.com"
#   bash scripts/tools/qrcode.sh "任意文本内容" 600
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

OUTPUT_FILE="${CARD_OUTPUT_DIR}/qrcode_card.png"

main() {
    # 手工 bash 调用常会顺手写上 card（它就默认模式，不是二维码内容）；
    # 不吃掉的话「qrcode.sh card https://x」会把字面量 card 编成二维码、把 URL 当成尺寸
    [ "${1:-}" = "card" ] && shift
    local content="${1:-}"
    local size="${2:-600}"

    log_info "======================================"
    log_info "二维码生成启动"
    log_info "当前时间: $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"

    if [ -z "$content" ]; then
        log_error "缺少内容参数：bash scripts/tools/qrcode.sh <文本或链接> [尺寸]"
        exit 1
    fi

    # 尺寸做范围约束，避免接口被塞超大值
    if ! [[ "$size" =~ ^[0-9]+$ ]] || [ "$size" -lt 100 ] || [ "$size" -gt 1000 ]; then
        log_warning "尺寸 ${size} 不合法，回退为 600"
        size=600
    fi

    local encoded
    encoded=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$content")
    local url="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}"

    # 原始数据模式：PNG 二进制无法直接展示，退回说明 + 请求地址
    if [ "${CARD_OUTPUT_MODE:-card}" != "card" ]; then
        emit_raw "{\"content\": \"$(printf '%s' "$content" | sed 's/"/\\"/g')\", \"size\": ${size}, \"source_url\": \"${url}\", \"note\": \"二维码为 PNG 二进制，请去掉 mode 参数生成图片\"}" json
    fi

    curl -s --max-time 20 "$url" -o "$OUTPUT_FILE" 2>/dev/null
    if [ ! -s "$OUTPUT_FILE" ]; then
        log_error "二维码生成失败"
        exit 1
    fi

    log_success "二维码已生成: $OUTPUT_FILE"
    log_info "======================================"
    echo "$OUTPUT_FILE"
}

main "$@"
