#!/bin/bash

# ======================================
# 假期倒计时脚本
# ======================================
# 
# 功能说明：
#   1. 假期前3天、2天、1天发送倒计时提醒
#   2. 假期中间天发送"假期进行中"进度提醒
#   3. 假期最后一天发送"余额不足"提醒
#   4. 自动从节假日配置读取假期信息
#   5. 提供假期准备建议和收心提示
#   6. 节假日期间不发送早安数据（由工作日提醒脚本负责）
# 
# 注意：假期第一天的祝福由 festival_greetings.sh holiday 负责，避免重复发送
# 
# 触发时机：
#   - 假期前3天：提醒做好工作收尾
#   - 假期前2天：提醒最后冲刺
#   - 假期前1天：提醒明天放假
#   - 假期中间天：发送假期进度提醒
#   - 假期最后一天：提醒假期余额不足
# 
# 数据来源：
#   - 节假日配置：holiday_config.sh
# 
# 作者：智能提醒系统
# 更新：2026-03-23
# ======================================

# ======================================
# 加载配置文件
# ======================================

# 获取脚本所在目录，加载项目路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 加载统一配置（包含 TZ 和 WECOM_WEBHOOK）
source "${PROJECT_DIR}/weather_config.sh" 2>/dev/null

LOG_FILE="${PROJECT_DIR}/holiday_countdown.log"

# 引入统一日志工具
source "${PROJECT_DIR}/log_utils.sh"

# 引入消息模板工具
source "${SCRIPT_DIR}/template_utils.sh"

current_date=$(date '+%Y-%m-%d')

# 计算当前日期到目标日期的天数差
# 参数：$1 - 目标日期（YYYY-MM-DD）
# 返回：输出天数差（正数表示未来，负数表示过去）
days_until() {
    local target_date="$1"
    local current_epoch=$(date -d "$current_date" '+%s')
    local target_epoch=$(date -d "$target_date" '+%s')
    echo $(( (target_epoch - current_epoch) / 86400 ))
}

# 动态获取主要假期配置（从holiday_config.sh读取）
# 返回：输出假期列表，每行格式为 "开始日期|结束日期|假期名称|天数"
get_holidays() {
    local config_file="${PROJECT_DIR}/holiday_config.sh"
    
    if [ ! -f "$config_file" ]; then
        log_warning "节假日配置文件不存在: $config_file"
        return 1
    fi
    
    # 直接读取数组定义，避免执行配置文件中的case语句
    local current_year=$(date '+%Y')
    local var_name="HOLIDAYS_${current_year}"
    
    # 从配置文件中提取指定年份的数组定义并在子shell中执行
    # 修复：使用更灵活的正则，支持前导空格
    local holidays_data=$(grep -A 100 "^[[:space:]]*declare -A ${var_name}=" "$config_file" | sed -n '/^[[:space:]]*declare/,/^[[:space:]]*)/p')
    
    if [ -z "$holidays_data" ]; then
        log_warning "未找到${current_year}年的节假日配置"
        return 1
    fi
    
    # 在子shell中解析数据
    (
        eval "$holidays_data"
        eval "declare -p $var_name" > /dev/null 2>&1 || exit 1
        
        # 解析并返回主要节假日（类型为2的节假日）
        # 策略：将连续的假期天数合并为一个假期段
        local holiday_start=""
        local holiday_end=""
        local holiday_days=0
        local holiday_names=()
        local last_date=""
        
        # 获取所有键并排序
        eval "local keys=(\"\${!${var_name}[@]}\")"
        
        for h_date in $(printf '%s\n' "${keys[@]}" | sort); do
            eval "local h_info=\"\${${var_name}[\$h_date]}\""
            local h_name=$(echo "$h_info" | cut -d'|' -f1)
            local h_type=$(echo "$h_info" | cut -d'|' -f2)
            
            # 类型2表示节假日
            if [ "$h_type" = "2" ]; then
                # 检查是否是连续的日期（包括周末）
                if [ -z "$last_date" ]; then
                    # 第一个假期日
                    holiday_start="$h_date"
                    holiday_end="$h_date"
                    holiday_days=1
                    holiday_names=("$h_name")
                else
                    # 计算日期差
                    local last_epoch=$(date -d "$last_date" '+%s')
                    local curr_epoch=$(date -d "$h_date" '+%s')
                    local days_diff=$(( (curr_epoch - last_epoch) / 86400 ))
                    
                    if [ "$days_diff" -le 3 ]; then
                        # 连续假期（允许间隔1-2天，因为可能有周末）
                        holiday_end="$h_date"
                        holiday_days=$(( (curr_epoch - $(date -d "$holiday_start" '+%s')) / 86400 + 1 ))
                        # 添加新的假期名称（去重）
                        if [[ ! " ${holiday_names[@]} " =~ " ${h_name} " ]]; then
                            holiday_names+=("$h_name")
                        fi
                    else
                        # 新的假期段，保存上一个
                        if [ -n "$holiday_start" ]; then
                            # 生成假期名称（合并多个名称）
                            local combined_name="${holiday_names[0]}"
                            if [ ${#holiday_names[@]} -gt 1 ]; then
                                # 如果有多个名称，选择最有代表性的
                                for name in "${holiday_names[@]}"; do
                                    if [[ "$name" =~ (春节|国庆|劳动节|元旦|清明|端午|中秋) ]]; then
                                        combined_name="$name"
                                        break
                                    fi
                                done
                            fi
                            echo "${holiday_start}|${holiday_end}|${combined_name}|${holiday_days}天"
                        fi
                        # 开始新假期段
                        holiday_start="$h_date"
                        holiday_end="$h_date"
                        holiday_days=1
                        holiday_names=("$h_name")
                    fi
                fi
                last_date="$h_date"
            fi
        done
        
        # 保存最后一个假期段
        if [ -n "$holiday_start" ]; then
            local combined_name="${holiday_names[0]}"
            if [ ${#holiday_names[@]} -gt 1 ]; then
                for name in "${holiday_names[@]}"; do
                    if [[ "$name" =~ (春节|国庆|劳动节|元旦|清明|端午|中秋) ]]; then
                        combined_name="$name"
                        break
                    fi
                done
            fi
            echo "${holiday_start}|${holiday_end}|${combined_name}|${holiday_days}天"
        fi
    )
}

# 主函数
main() {
    log_info "======================================"
    log_info "🚀 假期倒计时脚本启动"
    log_info "📅 当前日期: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "======================================"
    log_debug " 检查假期倒计时（${current_date}）"

    # 获取假期列表
    holidays_list=$(get_holidays)

    if [ -z "$holidays_list" ]; then
        log_warning "无法获取假期配置"
        exit 1
    fi

    # 遍历假期
    while IFS='|' read -r holiday_start holiday_end holiday_name holiday_days; do
        
        days=$(days_until "$holiday_start")
        
        # 假期前3天倒计时
        if [ "$days" -eq 3 ] || [ "$days" -eq 2 ] || [ "$days" -eq 1 ]; then
            log_info "⏰ ${holiday_name}倒计时${days}天（${holiday_start}至${holiday_end}，共${holiday_days}）"
            local date_time
            date_time=$(date '+%Y年%m月%d日 %H:%M')
            msg=$(get_message 'holiday_countdown' "$MESSAGE_STYLE" \
                "date_time=${date_time}" \
                "holiday_name=${holiday_name}" \
                "holiday_start=${holiday_start}" \
                "holiday_end=${holiday_end}" \
                "holiday_days=${holiday_days}" \
                "days=${days}")
            send_wecom_message "$msg"
        fi
        
        # 节假日中间天提醒（不含第一天和最后一天）
        # 注意：假期第一天的祝福由 festival_greetings.sh holiday 负责，此处不重复发送
        current_epoch=$(date -d "$current_date" '+%s')
        start_epoch=$(date -d "$holiday_start" '+%s')
        end_epoch=$(date -d "$holiday_end" '+%s')
        if [ "$current_epoch" -gt "$start_epoch" ] && [ "$current_epoch" -lt "$end_epoch" ]; then
            days_passed=$(( (current_epoch - start_epoch) / 86400 ))
            days_left=$(( (end_epoch - current_epoch) / 86400 ))
            log_info "🏖️ ${holiday_name}假期进行中（已过${days_passed}天，还剩${days_left}天）"
            local date_time
            date_time=$(date '+%Y年%m月%d日 %H:%M')
            msg=$(get_message 'holiday_progress' "$MESSAGE_STYLE" \
                "date_time=${date_time}" \
                "holiday_name=${holiday_name}" \
                "holiday_start=${holiday_start}" \
                "holiday_end=${holiday_end}" \
                "holiday_days=${holiday_days}" \
                "days_passed=${days_passed}" \
                "days_left=${days_left}")
            send_wecom_message "$msg"
        fi
        
        # 假期最后一天提醒
        if [ "$current_date" = "$holiday_end" ]; then
            log_warning "${holiday_name}最后一天（${holiday_start}至${holiday_end}，共${holiday_days}）"
            local date_time
            date_time=$(date '+%Y年%m月%d日 %H:%M')
            msg=$(get_message 'holiday_end' "$MESSAGE_STYLE" \
                "date_time=${date_time}" \
                "holiday_name=${holiday_name}" \
                "holiday_days=${holiday_days}")
            send_wecom_message "$msg"
        fi
    done <<< "$holidays_list"

    log_success "假期倒计时检查完成"
    log_info "======================================"
}

main "$@"
