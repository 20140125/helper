#!/bin/bash
# ======================================
# 卡片生成公共工具库（入口）
# ======================================
#
# 功能说明：
#   1. 提供卡片生成的通用工具函数
#   2. SVG 模板生成（头部、尾部、列表行）
#   3. 日期格式化工具
#   4. 数据抓取封装（curl + 超时控制）
#   5. SVG 渲染为 PNG（rsvg-convert）
#   6. 企微图片消息推送（msgtype=image）
#
# 模块结构：
#   card_utils.sh            入口，定义常量 + 按顺序加载子模块
#   card_utils/datetime.sh       日期/问候
#   card_utils/weather_data.sh   天气数据抓取 & 文案
#   card_utils/weather_alerts.sh 9 条异常天气预警规则 + 统一入口
#   card_utils/svg.sh            SVG 模板 + PNG 渲染 + 企微图片推送
#   card_utils/misc.sh           通用 curl + HN AI 新闻 + 文本截断 + node PATH 兜底
#   card_utils/city_map.sh       城市名归一化（中文/拼音 → 统一 slug，防缓存重复落盘）
#   card_utils/quote.sh          腾讯行情统一取数（多市场一次请求 + 分钟级共享缓存）
#
# 使用方式（所有卡片脚本照旧 source 本文件即可，对外 API 完全兼容）：
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "${SCRIPT_DIR}/card_utils.sh"
#
# 作者：智能提醒系统
# 更新：2026-04-30（拆分子模块重构）
# ======================================

# ========== 加载 .env 全局配置 ==========
# 背景：卡片脚本多由 cron / Web 调度器启动，环境中不包含 helper/.env 中的变量，
# 导致用户在 《系统配置 → 卡片全局配置》 保存的水印/超时/时区不生效。这里集中加载一次，
# 并用 _HELPER_ENV_LOADED 守卫幂等：如果 weather_config.sh 等上游脚本已加载过，则不重复加载。
# ⚠️ 先保存调用方（cron / 规则 runner）显式传入的推送开关：
# 下面 source .env 时开了 set -a，.env 里的同名默认值（如 SKILL_CARD_SEND_ON_WECHAT=false）
# 会把调用方传的值覆盖掉，导致「规则触发的卡片生成了却不推送企微」（A股 15:00 那次就栽在这）。
# 统一在这里保存 + 加载后恢复，所有卡片脚本一次性受益，无需每个脚本各写一遍。
_CARD_ENV_PUSH_CARD_IMAGE="${PUSH_CARD_IMAGE-}"
_CARD_ENV_SEND_ON_WECHAT="${SKILL_CARD_SEND_ON_WECHAT-}"
_CARD_ENV_CRON_MODE="${CRON_MODE-}"

if [ -z "${_HELPER_ENV_LOADED:-}" ]; then
  # 自包含解析路径：卡片脚本常由 cron / Web 直接拉起，调用方未必加载过 project_config.sh
  _CARD_UTILS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "${_CARD_UTILS_DIR}/../project_config.sh" ]; then
    source "${_CARD_UTILS_DIR}/../project_config.sh"
  fi
  # 与全局优先级一致：web/.env 优先，缺失时回退 scripts/.env
  _CARD_ENV_FILE="${ENV_FILE:-${_CARD_UTILS_DIR}/../web/.env}"
  if [ ! -f "${_CARD_ENV_FILE}" ]; then
    _CARD_ENV_FILE="${_CARD_UTILS_DIR}/.env"
  fi
  if [ -f "${_CARD_ENV_FILE}" ]; then
    set -a
    # shellcheck disable=SC1091
    source "${_CARD_ENV_FILE}"
    set +a
    export _HELPER_ENV_LOADED=1
  fi
fi

# 恢复调用方显式传入的开关（仅当调用方确实传过，未传时保持 .env 的语义）
# 用 if 而非 `[ -n x ] && export`：后者在 set -e 脚本中条件为假时返回 1，会直接把脚本打断
if [ -n "${_CARD_ENV_PUSH_CARD_IMAGE}" ]; then
  export PUSH_CARD_IMAGE="${_CARD_ENV_PUSH_CARD_IMAGE}"
fi
if [ -n "${_CARD_ENV_SEND_ON_WECHAT}" ]; then
  export SKILL_CARD_SEND_ON_WECHAT="${_CARD_ENV_SEND_ON_WECHAT}"
fi
if [ -n "${_CARD_ENV_CRON_MODE}" ]; then
  export CRON_MODE="${_CARD_ENV_CRON_MODE}"
fi
unset _CARD_ENV_PUSH_CARD_IMAGE _CARD_ENV_SEND_ON_WECHAT _CARD_ENV_CRON_MODE

# ========== 全局常量 ==========
# 画布及基础参数
CARD_WIDTH=1080
CARD_FONT="Noto Sans CJK SC, sans-serif"

# 以下 4 项可由用户在 Web 表单（系统配置 → 卡片全局配置）调整，从同名 env 读取，
# env 未设置时均有合理默认值，避免破坏后端脚本能独立运行的能力。
CARD_WATERMARK="${CARD_WATERMARK:-龙哥}"
CARD_CURL_TIMEOUT="${CARD_CURL_TIMEOUT:-10}"
CARD_TIMEZONE="${CARD_TIMEZONE:-Asia/Shanghai}"
# 全局推送总闸：false 时即使上游传了 PUSH_CARD_IMAGE=1 也不会推送到企微
SKILL_CARD_SEND_ON_WECHAT="${SKILL_CARD_SEND_ON_WECHAT:-false}"
export CARD_WATERMARK CARD_CURL_TIMEOUT CARD_TIMEZONE SKILL_CARD_SEND_ON_WECHAT

# 设计系统（色彩 / 字号 / 边距）——作为代码常量集中管理，不暴露给表单，
# 避免终端用户误改后导致设计体系崩坏；后续 svg.sh 及业务脚本会逐步引用这些常量。
CARD_PADDING_X=70                       # 左右安全边距
CARD_PADDING_Y=30                       # 上下安全边距
CARD_TITLE_FONT_SIZE=44                 # 主标题字号
CARD_SUBTITLE_FONT_SIZE=26              # 副标题字号
CARD_BODY_FONT_SIZE=22                  # 正文默认字号
CARD_FOOTER_FONT_SIZE=22                # 页脚文字字号
CARD_TEXT_COLOR_PRIMARY="#ffffffee"     # 主文字色
CARD_TEXT_COLOR_SECONDARY="#ffffff99"   # 次文字色
CARD_TEXT_COLOR_MUTED="#ffffff50"       # 弱化文字色

# 卡片 PNG 统一落盘目录：web/public/skill-images/
# ROOT_DIR 由 project_config.sh 导出，指向项目根目录（scripts/ 的上一级）
# 业务脚本应使用：OUTPUT_FILE="${CARD_OUTPUT_DIR}/<name>_card.png"
# 物理位置选用 web/public/ 是为了让 Vite/Express 静态托管直接命中，无需额外配置代理
if [ -n "${ROOT_DIR:-}" ]; then
  CARD_OUTPUT_DIR="${ROOT_DIR}/web/public/skill-images"
else
  # 兜底：若调用方未 source project_config.sh，则从 card_utils.sh 自身位置反推
  CARD_OUTPUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/web/public/skill-images"
fi
mkdir -p "${CARD_OUTPUT_DIR}"
export CARD_OUTPUT_DIR

# ========== 原始输出模式（出图 or 出数据）==========
# 所有卡片脚本统一支持三种输出：
#   bash scripts/tools/xxx.sh            # card（默认）渲染 PNG，stdout 仅一行图片路径
#   bash scripts/tools/xxx.sh data       # 输出原始数据（接口原始返回，终端可读）
#   bash scripts/tools/xxx.sh json       # 输出原始数据（合法 JSON 美化，否则包成 {"raw": ...}）
#   CARD_OUTPUT_MODE=json bash ...       # 等价的环境变量写法，便于调度器/AI 调用
# 识别为模式的位置参数会被 shift 掉，不影响脚本自身的其它参数。
case "${1:-}" in
  data|json) export CARD_OUTPUT_MODE="$1"; shift ;;
esac
export CARD_OUTPUT_MODE="${CARD_OUTPUT_MODE:-card}"

# 原始数据暂存文件（data / json 模式用）
# 说明：脚本的取数函数多在 $() 子 shell 中调用，那里 exit 无法终止主脚本，
#       故先把原始响应落到临时文件，最后统一由 render_card 拦截输出并退出。
CARD_RAW_FILE="/tmp/card_raw_$$.txt"
# 预清理：文件名按 PID 命名，PID 复用时会撞上上一次运行遗留的文件，
# 而 emit_raw 遇到已存在的文件会直接跳过写入 —— 结果就是吐出上一次的旧数据。
# 这里先删掉，保证本次一定写的是本次的响应。
rm -f "${CARD_RAW_FILE}" "${CARD_RAW_FILE}.fmt"

# 暂存原始数据（card 模式下为空操作）
# 参数：
#   $1 - 原始数据字符串
#   $2 - 数据格式：json（尝试美化）| text（原样输出），默认 json
# 返回：始终 0，不打断调用方的正常流程
emit_raw() {
  local raw="$1" fmt="${2:-json}"
  if [ "${CARD_OUTPUT_MODE}" = "card" ]; then return 0; fi
  # 多数据源脚本只保留第一个数据源的原始返回
  if [ -s "$CARD_RAW_FILE" ]; then return 0; fi
  printf '%s' "$raw" > "$CARD_RAW_FILE"
  printf '%s' "$fmt" > "${CARD_RAW_FILE}.fmt"
  return 0
}

# 输出暂存的原始数据并结束脚本（由 render_card 调用，card 模式下为空操作）
# 返回：card 模式返回 1（未输出，调用方继续渲染）；已输出时 exit 0
flush_raw_output() {
  if [ "${CARD_OUTPUT_MODE}" = "card" ]; then return 1; fi
  if [ ! -s "$CARD_RAW_FILE" ]; then
    log_error "当前脚本未接入原始数据输出（未捕获到接口原始返回）"
    exit 1
  fi
  local fmt
  fmt=$(cat "${CARD_RAW_FILE}.fmt" 2>/dev/null || echo json)
  if [ "$CARD_OUTPUT_MODE" = "json" ] && [ "$fmt" = "json" ]; then
    python3 -c 'import json,sys
raw = open(sys.argv[1], encoding="utf-8").read()
try:
    print(json.dumps(json.loads(raw), ensure_ascii=False, indent=2))
except Exception:
    print(json.dumps({"raw": raw}, ensure_ascii=False, indent=2))' "$CARD_RAW_FILE" \
      || cat "$CARD_RAW_FILE"
  else
    cat "$CARD_RAW_FILE"
    printf '\n'
  fi
  rm -f "$CARD_RAW_FILE" "${CARD_RAW_FILE}.fmt"
  exit 0
}

# ========== 原始 API 响应归档库 ==========
# 提供 api_cache_path / read_cached_api_response / archive_api_response / cached_curl，
# 让所有卡片脚本具备"日内复用"能力（同一天同一接口只打一次远端，省免费额度）。
# 归档统一走 hp_cache_res_* 分类表，由库内部按需加载 cache_db.sh，不再依赖磁盘路径。
source "${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}/api_archive.sh"

# ========== 加载子模块 ==========
# 顺序说明：
#   1) datetime.sh       无外部依赖
#   2) weather_data.sh   无外部依赖（被 alerts 复用）
#   3) weather_alerts.sh 依赖 fetch_weather_shenzhen（来自 weather_data.sh）
#   4) svg.sh            依赖全局常量 CARD_WIDTH / CARD_FONT / CARD_WATERMARK
#   5) misc.sh           无外部依赖
#   6) city_map.sh       无外部依赖
_CARD_UTILS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/card_utils"
source "${_CARD_UTILS_DIR}/datetime.sh"
source "${_CARD_UTILS_DIR}/weather_data.sh"
source "${_CARD_UTILS_DIR}/weather_alerts.sh"
source "${_CARD_UTILS_DIR}/svg.sh"
source "${_CARD_UTILS_DIR}/misc.sh"
source "${_CARD_UTILS_DIR}/city_map.sh"
source "${_CARD_UTILS_DIR}/quote.sh"
unset _CARD_UTILS_DIR

# ========== 运行环境兜底 ==========
# source 本库时自动探测一次 node：
# - 命中则后续所有 `node -e` 直接可用，调用方无感知
# - 未命中也不报错，留给真正要用 node 的脚本（或 trunc_text）在调用时自行决定降级/报错策略
ensure_node_in_path || true

# ========== Bash Source Guard ==========
# 防止该文件被直接执行，只允许 source 引入
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  echo "错误：card_utils.sh 是工具库，不能直接执行，请通过 source 引入。"
  exit 1
fi
