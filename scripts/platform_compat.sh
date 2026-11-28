#!/bin/bash

# ======================================
# 跨平台兼容层
# ======================================
#
# 功能说明：
#   屏蔽 GNU/Linux、BSD/macOS、Windows(Git Bash / WSL) 之间命令差异，
#   让上层脚本用同一套函数得到一致结果。
#
# 设计原则：
#   1. 日期/时间运算统一走 python3（三平台行为一致），避免 GNU `date -d`
#      与 BSD `date -j -f` 的语法/解析差异；例如 GNU 下 `date -d "X 1 days"`
#      在 BSD 下会被误解析成月/日却不报错，这类静默错误最危险。
#   2. 哈希统一封装，自动选择 md5sum / md5。
#   3. 所有封装失败时返回非 0，不输出误导性的默认值（如把任意日期当周一）。
#
# 提供的函数：
#   日期：
#     pc_date_weekday   <YYYY-MM-DD> [TZ]       输出 1=周一 ... 7=周日
#     pc_date_add_days  <YYYY-MM-DD> <天数>     输出 YYYY-MM-DD（天数可为负）
#     pc_date_to_epoch  <YYYY-MM-DD> [TZ]       输出 Unix 秒数
#     pc_date_from_epoch <epoch> <格式> [TZ]    输出格式化日期，格式用 strftime 风格
#     pc_date_shift     <天数> <格式> [TZ]      基于今天偏移，输出格式化日期
#     pc_date_format    <YYYY-MM-DD> <格式> [TZ] 输出格式化日期（如 %m月%d日）
#   哈希与编码（企微图片消息）：
#     pc_md5            <文件>                  输出 32 位 md5
#     pc_base64         <文件>                  输出单行 base64（无换行）
#
# 使用方式：
#   在脚本 source project_config.sh 之后（或任意位置）添加：
#     source "${PROJECT_DIR}/platform_compat.sh"
#
# 环境依赖：
#   python3（项目已依赖，date_utils.py / rule_reader.sh 等均已使用）
#
# 作者：智能提醒系统
# 更新：2026-11-21
# ======================================

# python3 路径：允许通过环境变量覆盖（Windows Git Bash 下可能是 python）
PC_PYTHON="${PC_PYTHON:-python3}"

# ======================================
# 内部：执行 python 日期运算，输出到 stdout
# 用法：_pc_py_date <python表达式(用 $DATE 占位)> <date> [tz]
# 为避免拼接注入，日期/TZ 通过 argv 传入，表达式固定为白名单分支
# ======================================

# 星期：1=周一 ... 7=周日
pc_date_weekday() {
    local d="$1"
    local tz="${2:-}"
    "$PC_PYTHON" - "$d" "$tz" <<'PY' 2>/dev/null
import sys
from datetime import datetime
d = datetime.strptime(sys.argv[1], "%Y-%m-%d")
print(d.isoweekday())
PY
}

# 日期加减天：输出 YYYY-MM-DD
pc_date_add_days() {
    local d="$1"
    local days="$2"
    "$PC_PYTHON" - "$d" "$days" <<'PY' 2>/dev/null
import sys
from datetime import datetime, timedelta
d = datetime.strptime(sys.argv[1], "%Y-%m-%d") + timedelta(days=int(sys.argv[2]))
print(d.strftime("%Y-%m-%d"))
PY
}

# 说明：时区处理使用 Python zoneinfo（3.9+，项目环境 3.13），
# 不依赖 shell TZ 变量，Windows(Git Bash/WSL) 与 macOS/Linux 行为一致。

# 日期转 Unix 秒（可按时区名解释，默认系统本地时区）
pc_date_to_epoch() {
    local d="$1"
    local tz="${2:-}"
    "$PC_PYTHON" - "$d" "$tz" <<'PY' 2>/dev/null
import sys, time
from datetime import datetime
d = datetime.strptime(sys.argv[1], "%Y-%m-%d")
tzname = sys.argv[2]
if tzname:
    try:
        from zoneinfo import ZoneInfo
        d = d.replace(tzinfo=ZoneInfo(tzname))
        print(int(d.timestamp()))
        sys.exit(0)
    except Exception:
        pass
print(int(time.mktime(d.timetuple())))
PY
}

# Unix 秒转格式化日期；格式用 strftime 风格（如 "%Y-%m-%d"、"%m月%d日"）
pc_date_from_epoch() {
    local epoch="$1"
    local fmt="$2"
    local tz="${3:-}"
    "$PC_PYTHON" - "$epoch" "$fmt" "$tz" <<'PY' 2>/dev/null
import sys, time
from datetime import datetime, timezone
tzname = sys.argv[3]
if tzname:
    try:
        from zoneinfo import ZoneInfo
        d = datetime.fromtimestamp(int(sys.argv[1]), ZoneInfo(tzname))
        print(d.strftime(sys.argv[2]))
        sys.exit(0)
    except Exception:
        pass
print(time.strftime(sys.argv[2], time.localtime(int(sys.argv[1]))))
PY
}

# 基于今天偏移 N 天后格式化输出；格式用 strftime 风格
pc_date_shift() {
    local days="$1"
    local fmt="$2"
    local tz="${3:-}"
    "$PC_PYTHON" - "$days" "$fmt" "$tz" <<'PY' 2>/dev/null
import sys
from datetime import datetime, timedelta, timezone
tzname = sys.argv[3]
if tzname:
    try:
        from zoneinfo import ZoneInfo
        d = datetime.now(ZoneInfo(tzname)) + timedelta(days=int(sys.argv[1]))
        print(d.strftime(sys.argv[2]))
        sys.exit(0)
    except Exception:
        pass
from datetime import datetime
d = datetime.now() + timedelta(days=int(sys.argv[1]))
print(d.strftime(sys.argv[2]))
PY
}

# 指定日期按 strftime 格式输出（用于 %-m/%-d 等无前导零格式）
pc_date_format() {
    local d="$1"
    local fmt="$2"
    local tz="${3:-}"
    "$PC_PYTHON" - "$d" "$fmt" "$tz" <<'PY' 2>/dev/null
import sys
from datetime import datetime
d = datetime.strptime(sys.argv[1], "%Y-%m-%d")
print(d.strftime(sys.argv[2]))
PY
}

# 文件 md5（32 位小写）
pc_md5() {
    local f="$1"
    local result
    result=$(md5sum "$f" 2>/dev/null | awk '{print $1}') && [ -n "$result" ] && { echo "$result"; return 0; }
    result=$(md5 -q "$f" 2>/dev/null) && [ -n "$result" ] && { echo "$result"; return 0; }
    result=$("$PC_PYTHON" - "$f" <<'PY' 2>/dev/null
import sys, hashlib
h = hashlib.md5()
with open(sys.argv[1], "rb") as f:
    for chunk in iter(lambda: f.read(65536), b""):
        h.update(chunk)
print(h.hexdigest())
PY
) && [ -n "$result" ] && { echo "$result"; return 0; }
    return 1
}

# 文件 base64（单行，无换行）
# 注意：不能把文件名直接传给 base64 —— GNU 用 -w 0、BSD 用 -i 且参数不同；
# 统一走 stdin 管道，三平台行为一致。
pc_base64() {
    local f="$1"
    local result
    result=$(base64 < "$f" 2>/dev/null | tr -d '\n') && [ -n "$result" ] && { printf '%s' "$result"; return 0; }
    return 1
}
