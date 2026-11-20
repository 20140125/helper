#!/bin/bash
# ======================================
# card_utils 子模块：日期时间工具
# ======================================
# 被 card_utils.sh 主入口 source，禁止直接执行
# 提供：get_date_str / get_datetime_str / get_dow_cn / get_greeting
# ======================================

# 获取格式化的中文日期字符串（如 "2026年04月25日 周五"）
# 时区读取 CARD_TIMEZONE（由 card_utils.sh 从 env 加载，默认 Asia/Shanghai）
get_date_str() {
  local tz="${CARD_TIMEZONE:-Asia/Shanghai}"
  local dow_num dow_cn
  dow_num=$(TZ="$tz" date +%u)
  case $dow_num in
    1) dow_cn="周一" ;; 2) dow_cn="周二" ;; 3) dow_cn="周三" ;;
    4) dow_cn="周四" ;; 5) dow_cn="周五" ;; 6) dow_cn="周六" ;;
    7) dow_cn="周日" ;;
  esac
  echo "$(TZ="$tz" date +"%Y年%m月%d日") ${dow_cn}"
}

# 获取当前时间戳（如 "2026年04月25日 01:30"）
get_datetime_str() {
  local tz="${CARD_TIMEZONE:-Asia/Shanghai}"
  TZ="$tz" date +"%Y年%m月%d日 %H:%M"
}

# 获取中文星期（参数: 可选 date 偏移，如 "+1 day"，默认今天）
get_dow_cn() {
  local tz="${CARD_TIMEZONE:-Asia/Shanghai}"
  local offset="${1:-}"
  local dow_num
  if [ -n "$offset" ]; then
    dow_num=$(TZ="$tz" date -d "$offset" +%u 2>/dev/null \
              || TZ="$tz" date -v"${offset// /}" +%u 2>/dev/null)
  else
    dow_num=$(TZ="$tz" date +%u)
  fi
  case "$dow_num" in
    1) echo "周一" ;; 2) echo "周二" ;; 3) echo "周三" ;;
    4) echo "周四" ;; 5) echo "周五" ;; 6) echo "周六" ;;
    7) echo "周日" ;; *) echo "" ;;
  esac
}

# 根据当前小时返回问候语
get_greeting() {
  local tz="${CARD_TIMEZONE:-Asia/Shanghai}"
  local hour
  hour=$(TZ="$tz" date +%H)
  if   [ "$hour" -ge 5 ] && [ "$hour" -lt 9 ];  then echo "早安"
  elif [ "$hour" -ge 9 ] && [ "$hour" -lt 12 ]; then echo "上午好"
  elif [ "$hour" -ge 12 ] && [ "$hour" -lt 14 ]; then echo "中午好"
  elif [ "$hour" -ge 14 ] && [ "$hour" -lt 18 ]; then echo "下午好"
  elif [ "$hour" -ge 18 ] && [ "$hour" -lt 22 ]; then echo "傍晚好"
  else echo "晚安"
  fi
}
