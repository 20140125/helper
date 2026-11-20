#!/bin/bash
# ======================================
# card_utils 子模块：SVG 模板 & 渲染
# ======================================
# 被 card_utils.sh 主入口 source，禁止直接执行
# 依赖主入口导出的常量：CARD_WIDTH / CARD_FONT / CARD_WATERMARK
# 提供：svg_header / svg_footer / svg_list_row / render_card / send_card_image / calc_list_height
# ======================================

# 生成 SVG 头部（渐变背景 + 标题 + 副标题 + 分隔线）
# 参数: $1=高度 $2=渐变色1 $3=渐变色2 $4=标题 $5=副标题
svg_header() {
  local h="$1" bg1="$2" bg2="$3" title="$4" subtitle="$5"
  cat <<EOF
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${h}" viewBox="0 0 ${CARD_WIDTH} ${h}">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${bg1}"/><stop offset="100%" style="stop-color:${bg2}"/></linearGradient></defs>
  <rect width="${CARD_WIDTH}" height="${h}" fill="url(#bg)"/>
  <circle cx="960" cy="100" r="140" fill="#ffffff08"/>
  <text x="70" y="85" font-family="${CARD_FONT}" font-size="44" font-weight="700" fill="#ffffffee">${title}</text>
  <text x="70" y="135" font-family="${CARD_FONT}" font-size="26" fill="#ffffff70">${subtitle}</text>
  <line x1="70" y1="170" x2="1010" y2="170" stroke="#ffffff20" stroke-width="1"/>
EOF
}

# 生成 SVG 尾部（分隔线 + 数据来源 + 水印 + 闭合）
# 参数: $1=高度 $2=数据来源文字
svg_footer() {
  local h="$1" source="$2"
  cat <<EOF
  <line x1="70" y1="$((h-55))" x2="1010" y2="$((h-55))" stroke="#ffffff15" stroke-width="1"/>
  <text x="540" y="$((h-20))" font-family="${CARD_FONT}" font-size="22" fill="#ffffff50" text-anchor="middle">${source}</text>
  <text x="1050" y="$((h-10))" font-family="${CARD_FONT}" font-size="18" fill="#ffffff25" text-anchor="end">${CARD_WATERMARK}</text>
</svg>
EOF
}

# 生成一行列表项 SVG（序号 + 标题 + 右侧文字）
# 参数:
#   $1 = 序号(01-10)
#   $2 = y坐标
#   $3 = 标题
#   $4 = 右侧文字（可为空字符串）
#   $5 = 右侧文字颜色（可选，默认 #ffffff99）
#   $6 = 卡片背景填充色（可选，默认 #ffffff0a；传 "highlight" 可切到 #ffffff12 高亮底）
#   $7 = 标题颜色（可选，默认 #ffffffdd；Top3 场景可传 #ffffff）
#   $8 = 行高（可选，默认 78）
#   $9 = 边框描边色（可选，默认 #ffffff15）
svg_list_row() {
  local num="$1" y="$2" title="$3" right_text="$4"
  local right_color="${5:-#ffffff99}"
  local bg_color="${6:-#ffffff0a}"
  local title_color="${7:-#ffffffdd}"
  local row_h="${8:-78}"
  local stroke_color="${9:-#ffffff15}"
  # 兼容别名：调用方可传 "highlight" 快捷切到高亮底
  [ "$bg_color" = "highlight" ] && bg_color="#ffffff12"
  # 文字基线：默认行高 78 → y+48；其它行高按比例对齐（垂直居中 + 字号矫正）
  local text_y=$((y + row_h * 48 / 78))
  cat <<EOF
  <rect x="50" y="${y}" width="980" height="${row_h}" fill="${bg_color}" stroke="${stroke_color}" stroke-width="1"/>
  <text x="85" y="${text_y}" font-family="${CARD_FONT}" font-size="28" font-weight="600" fill="${title_color}">${num}  ${title}</text>
  <text x="970" y="${text_y}" font-family="${CARD_FONT}" font-size="22" fill="${right_color}" text-anchor="end">${right_text}</text>
EOF
}

# 分组小标题行（多 channel 榜单用：如「热搜」「电视剧」）
# 参数：
#   $1 = y坐标
#   $2 = 分组名
#   $3 = 右侧说明（可为空，如条数）
#   $4 = 行高（可选，默认 52）
#   $5 = 标题色（可选，默认 #ffffffcc）
svg_group_title() {
  local y="$1" name="$2" right_text="${3:-}" row_h="${4:-52}" color="${5:-#ffffffcc}"
  local text_y=$((y + row_h * 34 / 52))
  cat <<EOF
  <rect x="50" y="${y}" width="980" height="${row_h}" fill="#ffffff14" stroke="#ffffff20" stroke-width="1"/>
  <text x="85" y="${text_y}" font-family="${CARD_FONT}" font-size="30" font-weight="700" fill="${color}">${name}</text>
  <text x="970" y="${text_y}" font-family="${CARD_FONT}" font-size="20" fill="#ffffff80" text-anchor="end">${right_text}</text>
EOF
}

# SVG → PNG 渲染
# 参数: $1=SVG文件路径 $2=输出PNG路径 $3=宽度(可选) $4=高度(可选)
#
# 自动推送钩子：若环境变量 PUSH_CARD_IMAGE=1 且渲染成功，则自动调用 send_card_image
# 将 PNG 推送到企微。该能力仅在 web 前端"生成图片"按钮触发时由后端注入 env 打开，
# crontab / 命令行直接执行脚本时默认关闭，避免定时批量生成造成刷屏。
# 推送失败仅记录 log_error，不影响 render_card 自身的退出码（图片生成才是主责）。
render_card() {
  local svg_file="$1" output="$2" w="${3:-$CARD_WIDTH}" h="${4:-}"

  # 原始输出模式（data / json）：跳过渲染，直接吐出取数阶段暂存的接口原始返回并结束脚本。
  # 放在渲染器检查之前——原始数据查询不应受 rsvg-convert 是否安装影响。
  if [ "${CARD_OUTPUT_MODE:-card}" != "card" ] && command -v flush_raw_output >/dev/null 2>&1; then
    flush_raw_output
  fi

  # 日志函数按需降级（卡片脚本一般都 source 过 log_utils.sh，这里做兜底）
  local _log_error="true"
  command -v log_error >/dev/null 2>&1 && _log_error="log_error"

  # 渲染器前置检查：缺失时给出明确指引，而不是让 set -e 以 127 静默退出
  if ! command -v rsvg-convert >/dev/null 2>&1; then
    $_log_error "[render_card] 缺少 SVG 渲染器 rsvg-convert，请安装：apt-get install -y librsvg2-bin"
    echo "FAILED: 缺少渲染器 rsvg-convert"
    return 127
  fi

  local cmd="rsvg-convert -w ${w}"
  [ -n "$h" ] && cmd="$cmd -h ${h}"

  # 不再 2>/dev/null 吞掉渲染报错：捕获 stderr，失败时写日志，便于定位字体缺失/非法 SVG 等问题
  local render_err
  render_err=$($cmd "$svg_file" -o "$output" 2>&1)
  if [ -f "$output" ]; then
    # 可选：自动推送图片到企微（由 web 后端通过 env 变量开启）
    if [ "${PUSH_CARD_IMAGE:-0}" = "1" ] && [ "${SKILL_CARD_SEND_ON_WECHAT:-false}" = "true" ]; then
      send_card_image "$output" || true
    fi
    return 0
  fi
  [ -n "$render_err" ] && $_log_error "[render_card] 渲染失败：$render_err"
  echo "FAILED: 渲染失败"
  return 1
}

# 推送 PNG 图片到企业微信（msgtype=image，需要 base64 + md5）
# 参数: $1=PNG 文件路径  $2=webhook_ids（逗号分隔，可选；为空则发送到全部已配置机器人）
# 返回: 全部成功=0；有任一失败=1；webhook 未配置=1
#
# 依赖：
#   - CACHE_DIR（由 project_config.sh 导出）下存在 webhooks.json
#   - python3、base64、md5sum
# 日志：
#   - 若上游已 source log_utils.sh，使用 log_info/log_success/log_error；否则静默
send_card_image() {
  local img="$1" webhook_ids="${2:-}"

  # 日志函数按需降级（卡片脚本一般都 source 过 log_utils.sh，这里做兜底）
  local _log_info="true" _log_success="true" _log_error="true"
  command -v log_info    >/dev/null 2>&1 && _log_info="log_info"
  command -v log_success >/dev/null 2>&1 && _log_success="log_success"
  command -v log_error   >/dev/null 2>&1 && _log_error="log_error"

  if [ ! -f "$img" ]; then
    $_log_error "[企微图片] 文件不存在：$img"
    return 1
  fi

  # 企微图片消息硬限制：base64 后 ≤ 2MB；base64 体积 ≈ 原图 × 4/3，
  # 所以原始文件超过 1.5MB 时就一定会超限，直接告警跳过，避免白白做 base64 后被企微拒收。
  local img_size_bytes
  img_size_bytes=$(wc -c < "$img" | tr -d ' ')
  local max_bytes=1572864 # 1.5 * 1024 * 1024
  if [ "${img_size_bytes:-0}" -gt "$max_bytes" ]; then
    $_log_error "[企微图片] 图片过大，跳过推送（bytes=${img_size_bytes}, limit=${max_bytes}, file=$(basename "$img")）"
    return 1
  fi

  local webhooks_json="${CACHE_DIR:-}/webhooks.json"
  if [ ! -f "$webhooks_json" ]; then
    $_log_error "[企微图片] webhooks.json 未找到：$webhooks_json"
    return 1
  fi

  # 计算 base64（去除换行）+ md5（企微图片消息协议要求）
  local img_base64 img_md5
  img_base64=$(base64 -w 0 "$img" 2>/dev/null || base64 "$img" | tr -d '\n')
  img_md5=$(md5sum "$img" 2>/dev/null | awk '{print $1}')
  if [ -z "$img_base64" ] || [ -z "$img_md5" ]; then
    $_log_error "[企微图片] base64/md5 计算失败"
    return 1
  fi

  # 构造 image 消息 payload（python3 统一组装，避免 shell 拼 JSON 踩引号坑）
  local json_payload
  json_payload=$(python3 -c "
import json, sys
b64 = sys.stdin.read().strip()
payload = {'msgtype': 'image', 'image': {'base64': b64, 'md5': '${img_md5}'}}
print(json.dumps(payload, ensure_ascii=False))
" <<< "$img_base64")

  # 根据 webhook_ids 过滤目标 URL；为空则取全部
  local target_urls
  target_urls=$(python3 -c "
import json, sys, os
webhooks_file = '${webhooks_json}'
ids_str = '''${webhook_ids}'''
try:
    hooks = json.load(open(webhooks_file))
except Exception:
    sys.exit(1)
if ids_str.strip():
    ids = [i.strip() for i in ids_str.split(',') if i.strip()]
    urls = [h['url'] for h in hooks if h.get('id') in ids and h.get('url')]
else:
    urls = [h['url'] for h in hooks if h.get('url')]
print('\n'.join(urls))
" 2>/dev/null)

  if [ -z "$target_urls" ]; then
    $_log_error "[企微图片] 未找到可用的 Webhook 地址"
    return 1
  fi

  local img_size
  img_size="$img_size_bytes"
  $_log_info "[企微图片] 准备推送图片（bytes=${img_size}, md5=${img_md5}, file=$(basename "$img")）"

  local success=0 fail=0
  while IFS= read -r url; do
    [ -z "$url" ] && continue
    local response
    # 大图片的 base64 很长（100KB+），用 -d 传参会触发 "Argument list too long"（E2BIG）。
    # 改用 --data-binary @- 从 stdin 读 body，绕过命令行参数长度限制。
    response=$(curl -s -X POST "$url" \
      -H 'Content-Type: application/json' \
      --data-binary @- <<< "$json_payload")
    if echo "$response" | grep -q '"errcode":0'; then
      $_log_success "[企微图片] 推送成功 (${url:0:60}...)"
      success=$((success + 1))
    else
      $_log_error "[企微图片] 推送失败 (${url:0:60}...): $response"
      fail=$((fail + 1))
    fi
  done <<< "$target_urls"

  [ "$fail" -eq 0 ] && return 0 || return 1
}

# 计算 Top10 列表卡片高度
# 参数: $1=条目数量 $2=行高(可选,默认92) $3=起始y(可选,默认195) $4=底部留白(可选,默认70)
calc_list_height() {
  local count="${1:-10}" row_h="${2:-92}" start_y="${3:-195}" padding="${4:-70}"
  echo $(( start_y + count * row_h + padding ))
}
