#!/bin/bash

# ======================================
# 生成公司节假日配置文件（年度更新子工具）
# ======================================
#
# 功能说明：
#   1. 解析JSON数据，提取节假日和调休日
#   2. 应用公司特别假（将指定调休日改为放假）
#   3. 生成 holiday_config.sh 配置文件
#   4. 如该年份数据已存在，则跳过更新
#
# 使用方式：
#   bash scripts/update-tools/generate_holiday_config.sh <年份> [缓存 key] [特别假日期]
#   bash scripts/update-tools/generate_holiday_config.sh 2026 holiday_data.json
#   bash scripts/update-tools/generate_holiday_config.sh 2026 holiday_data.json "2026-01-25,2026-01-26"
#
# 作者：智能提醒系统
# 更新：2026-11-28
# ======================================

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_SELF_DIR="$SCRIPT_DIR"

# 加载项目路径配置
source "${SCRIPT_DIR}/../project_config.sh"

# 缓存数据库通道（放在 project_config.sh 之后）
source "${PROJECT_DIR}/cache_db.sh"

# 加载统一配置（包含 WECOM_WEBHOOK 等环境变量）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

# 设置日志文件（仅在直接执行且未设置 LOG_FILE 时生效）
if [ -z "$LOG_FILE" ]; then
    LOG_FILE="${_SELF_DIR}/generate_holiday_config.log"
fi

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"
# 参数：
#   $1 - 年份
#   $2 - 缓存 key（默认 holiday_data.json）
#   $3 - 特别假日期（可选，逗号分隔）；不传则自动识别春节前调休日
# 返回：
#   成功：返回0
#   失败：返回1
generate_company_holiday_config() {
    local year="$1"
    local cache_key="${2:-holiday_data.json}"
    local custom_dates="$3"  # 可选：用户指定的日期，逗号分隔
    local config_file="${PROJECT_DIR}/holiday_config.sh"

    # 从缓存库读取节假日数据（KV，运行时不落盘）
    if ! cache_db_exists "${cache_key}"; then
        log_error "缓存条目不存在: ${cache_key}"
        return 1
    fi

    log_info "📝 生成 ${year} 年公司节假日配置..."

    # 使用 Python 解析 JSON 数据，同时输出 after 字段用于自动识别
    # 缓存全文走 stdin，避免把大 JSON 拼进命令行参数
    local python_script='
import json
import sys

try:
    data = json.loads(sys.stdin.read())

    if "holiday" in data:
        for key, info in data["holiday"].items():
            date = info.get("date", "")
            name = info.get("name", "")
            is_holiday = info.get("holiday", False)
            wage = info.get("wage", 0)
            after = info.get("after", True)
            # target 是纯节日名（如 "元旦"/"春节"），name 可能是 "元旦后补班" 等完整描述
            target = info.get("target", name)

            if is_holiday:
                print(f"HOLIDAY|{date}|{name}")
            elif not is_holiday and wage == 1:
                print(f"ADJUST|{date}|{name}|{after}|{target}")

except Exception as e:
    print(f"ERROR|{e}", file=sys.stderr)
    sys.exit(1)
'

    local parse_result
    if ! parse_result=$(cache_db_read "${cache_key}" | python3 -c "$python_script" 2>&1); then
        log_error "JSON 解析失败: $parse_result"
        return 1
    fi

    # 确定特别假日期
    local special_holiday=""
    if [ -n "$custom_dates" ]; then
        # 用户指定了日期，直接使用（取第一个，逗号分隔时取首个）
        special_holiday=$(echo "$custom_dates" | cut -d',' -f1 | xargs)
        log_info "📌 使用用户指定的特别假日期: $special_holiday"
    else
        # 自动识别：找春节前调休日（after=False）
        log_info "🔍 未指定日期，自动识别春节前调休日..."
        while IFS='|' read -r type date name after target; do
            if [ "$type" = "ADJUST" ] && [ "$after" = "False" ]; then
                special_holiday="$date"
                log_info "✅ 自动识别到春节前调休日: $special_holiday，将应用公司特别假政策"
                break
            fi
        done <<< "$parse_result"
        if [ -z "$special_holiday" ]; then
            log_warning "未找到春节前调休日，不应用公司特别假政策"
        fi
    fi

    # 处理节假日数据
    declare -A holidays_map
    declare -A adjust_workdays_map
    local holiday_count=0
    local adjust_count=0

    while IFS='|' read -r type date name after target; do
        if [ "$type" = "HOLIDAY" ] && [ -n "$date" ]; then
            holidays_map["$date"]="$name|2"
            ((holiday_count++))
            log_success "节假日: $date ($name)"
        elif [ "$type" = "ADJUST" ] && [ -n "$date" ]; then
            # 检查是否是公司特别假（原调休日改为放假）
            if [ -n "$special_holiday" ] && [ "$date" = "$special_holiday" ]; then
                holidays_map["$date"]="公司特别假|2"
                log_info "🎁 公司特别假: $date (原调休日，公司改为放假)"
            else
                # target 是纯节日名（如 "元旦"/"春节"/"劳动节"），用它拼接更干净
                # 若 target 缺失则退回 name（兜底）
                local holiday_label="${target:-$name}"
                adjust_workdays_map["$date"]="${holiday_label}调休上班|3"
                ((adjust_count++))
                log_warning "调休上班: $date (${holiday_label})"
            fi
        fi
    done <<< "$parse_result"
    
    log_info "📊 统计: 节假日 $holiday_count 天，调休上班 $adjust_count 天"
    
    # 生成配置文件
    if [ $holiday_count -gt 0 ]; then
        # 检查配置文件是否已存在该年份的数据
        if grep -q "HOLIDAYS_${year}" "$config_file" 2>/dev/null; then
            log_info "🔄 配置文件已包含 ${year} 年数据，删除旧数据并重新生成..."
            
            # 删除旧的年份数据块
            local temp_backup="${config_file}.backup.$(date +%s)"
            cp "$config_file" "$temp_backup"
            
            # 使用 awk 删除该年份的整个数据块（从年份注释到右括号及后续空行）
            awk -v year="$year" '
                BEGIN { skip=0 }
                # 匹配年份注释行（如 "# 2026年节假日配置" 或 "# 公司2026年节假日配置"）
                skip==0 && $0 ~ ("^#.*" year ".*节假日配置") {
                    skip=1
                    next
                }
                # 匹配 declare -A HOLIDAYS_年份 行
                skip==0 && $0 ~ ("^declare -A HOLIDAYS_" year) {
                    skip=1
                    next
                }
                # 在跳过模式中，遇到右括号则结束跳过
                skip==1 && /^\)/ {
                    skip=0
                    next
                }
                # 跳过中间所有行
                skip==1 { next }
                # 正常输出
                { print }
            ' "$config_file" > "${config_file}.tmp"
            
            mv "${config_file}.tmp" "$config_file"
            rm -f "$temp_backup"
            log_success "已删除旧数据"
        fi
        
        # 创建新年份数据块
        local temp_file="${config_file}.tmp"
        
        cat > "$temp_file" << NEWDATA

# ${year}年节假日配置（自动生成于$(date '+%Y-%m-%d %H:%M:%S')）
# 数据来源: 国务院官方通知 + 公司HR特别福利
# 2 - 放假 | 3 - 调休

declare -A HOLIDAYS_${year}=(
NEWDATA
        
        # 使用Python脚本生成带详细注释的节假日数据
        local holidays_data=""
        for date in "${!holidays_map[@]}"; do
            holidays_data="${holidays_data}${date}=${holidays_map[$date]};"
        done
        
        local adjust_data=""
        for date in "${!adjust_workdays_map[@]}"; do
            adjust_data="${adjust_data}${date}=${adjust_workdays_map[$date]};"
        done
        
        python3 << PYEOF >> "$temp_file"
import sys
from datetime import datetime

# 解析节假日数据
holidays_map = {}
holidays_str = "${holidays_data}"
if holidays_str:
    for item in holidays_str.split(';'):
        if '=' in item:
            date, info = item.split('=', 1)
            holidays_map[date] = info

# 解析调休上班日数据
adjust_workdays_map = {}
adjust_str = "${adjust_data}"
if adjust_str:
    for item in adjust_str.split(';'):
        if '=' in item:
            date, info = item.split('=', 1)
            adjust_workdays_map[date] = info

# 节假日分组（按节日名称分组）
holiday_groups = {}
for date, info in sorted(holidays_map.items()):
    name = info.split('|')[0]
    if name not in holiday_groups:
        holiday_groups[name] = []
    holiday_groups[name].append(date)

# 调休日分组
adjust_groups = {}
for date, info in sorted(adjust_workdays_map.items()):
    name = info.split('|')[0]
    if name not in adjust_groups:
        adjust_groups[name] = []
    adjust_groups[name].append(date)

# 节日名称映射（用于注释）
festival_names = {
    '元旦': '元旦假期',
    '公司特别假': '春节假期',
    '除夕': '春节假期',
    '初一': '春节假期',
    '初二': '春节假期',
    '初三': '春节假期',
    '初四': '春节假期',
    '初五': '春节假期',
    '初六': '春节假期',
    '初七': '春节假期',
    '清明节': '清明节假期',
    '劳动节': '劳动节假期',
    '端午节': '端午节假期',
    '中秋节': '中秋节假期',
    '国庆节': '国庆节假期'
}

# 星期映射
weekday_names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

# 农历日期映射
lunar_dates = {
    '除夕': '农历腊月三十',
    '初一': '农历正月初一',
    '初二': '农历正月初二',
    '初三': '农历正月初三',
    '初四': '农历正月初四',
    '初五': '农历正月初五',
    '初六': '农历正月初六',
    '初七': '农历正月初七'
}

# 特殊日期标注
special_dates = {
    '元旦': '元旦当日',
    '清明节': '清明当日',
    '劳动节': '五一当日',
    '端午节': '端午当日，农历五月初五',
    '中秋节': '中秋当日，农历八月十五',
    '国庆节': '国庆当日'
}

# 生成节假日注释和数据
current_group = None
for date in sorted(holidays_map.keys()):
    info = holidays_map[date]
    name = info.split('|')[0]
    
    # 获取星期几
    dt = datetime.strptime(date, '%Y-%m-%d')
    weekday = weekday_names[dt.weekday()]
    
    # 判断是否需要输出分组注释
    group_name = festival_names.get(name, name)
    if current_group != group_name:
        if current_group is not None:
            print()  # 分组之间空一行
        
        # 计算该分组的总天数和日期范围
        group_dates = []
        for d, i in holidays_map.items():
            n = i.split('|')[0]
            if festival_names.get(n, n) == group_name:
                group_dates.append(d)
        
        if len(group_dates) > 1:
            print(f"    # {group_name} ({len(group_dates)}天): {min(group_dates)} ~ {max(group_dates)}")
        else:
            print(f"    # {group_name}")
        
        current_group = group_name
    
    # 生成详细注释
    if name in lunar_dates:
        print(f"    # {weekday} {date} ({lunar_dates[name]})")
    elif name in special_dates:
        print(f"    # {weekday} {date} ({special_dates[name]})")
    else:
        print(f"    # {weekday} {date}")
    
    # 输出数据行
    print(f"    ['{date}']='{info}'")

# 生成调休上班日数据
if adjust_workdays_map:
    print()
    print("    # 调休上班日")
    for date in sorted(adjust_workdays_map.keys()):
        info = adjust_workdays_map[date]
        dt = datetime.strptime(date, '%Y-%m-%d')
        weekday = weekday_names[dt.weekday()]
        print(f"    # {weekday} {date}")
        print(f"    ['{date}']='{info}'")

PYEOF
        
        echo ")" >> "$temp_file"
        echo "" >> "$temp_file"
        
        # 将新数据追加到配置文件末尾
        # 先移除配置文件末尾的空行，确保格式整洁（用 python 避免 GNU/BSD sed -i 差异）
        python3 - "$config_file" <<'PYEOF'
import sys
path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
with open(path, 'w', encoding='utf-8') as f:
    f.write(content.rstrip('\n') + '\n')
PYEOF

        cat "$temp_file" >> "$config_file"
        chmod +x "$config_file"
        rm -f "$temp_file"
        
        if grep -q "HOLIDAYS_${year}" "$config_file" 2>/dev/null; then
            log_success "配置文件已更新: $config_file"
            return 0
        else
            log_error "配置文件更新失败"
            return 1
        fi
    else
        log_error "未找到节假日数据，无法生成配置"
        return 1
    fi
}

# 主函数：处理命令行参数
main() {
    if [ $# -lt 2 ]; then
        log_error "用法: $0 <年份> <缓存 key> [指定特别假日期（逗号分隔）]"
        log_info "示例: $0 2026 holiday_data.json          # 自动识别春节前调休日"
        log_info "示例: $0 2026 holiday_data.json 2026-01-31  # 使用指定日期"
        exit 1
    fi

    local year="$1"
    local cache_key="$2"
    local custom_dates="${3:-}"
    
    log_info "======================================"
    log_info "🚀 节假日配置生成脚本启动"
    log_info "📅 当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "📦 处理年份: ${year}"
    log_info "======================================"

    # 调用生成配置函数
    if generate_company_holiday_config "$year" "$cache_key" "$custom_dates"; then
        log_success "脚本执行完成"
        log_info "======================================"
        exit 0
    else
        log_error "节假日配置生成失败"
        log_info "======================================"
        exit 1
    fi
}

# 如果直接运行此脚本，则执行主函数
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi