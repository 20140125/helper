#!/bin/bash

# ======================================
# 自定义规则 - 规则数据读取
# ======================================
#
# 提供统一的规则数据读取函数：
#   read_rule_data             - 读取单条规则数据（通用）
#   read_rule_data_full        - 读取单条规则数据（含 enabled 字段，测试用）
#   is_duplicate_trigger       - 检查规则是否在本分钟已触发过
#   update_last_triggered_at   - 更新规则的 lastTriggeredAt 字段
#   get_enabled_rule_ids       - 获取所有已启用规则的 ID 列表
#   get_enabled_rule_count     - 获取已启用规则的数量
#   get_rule_name_by_id        - 根据规则 ID 获取规则名称
#   get_matching_rule_ids      - 获取当前时间窗口内待触发的规则 ID 列表
#
# 输出变量：
#   RULE_NAME, RULE_TYPE, RULE_CONDITION, RULE_MESSAGE,
#   RULE_TIME, RULE_WEBHOOK_IDS, RULE_TEMPLATE_ID, RULE_CUSTOM_CONTENT
#   （read_rule_data_full 额外输出 RULE_ENABLED）
#
# 作者：智能提醒系统
# 更新：2026-03-24
# ======================================

# ======================================
# 读取单条规则数据
# ======================================
# 参数：$1 - 规则 ID
# 返回：0=成功, 1=失败
# 通过全局变量输出结果

read_rule_data() {
    local rule_id="$1"
    local rule_data
    rule_data=$(python3 -c "
import json, sys, base64
rules = json.load(open('$RULES_FILE'))
r = next((x for x in rules if x['id']=='$rule_id'), None)
if not r:
    sys.exit(1)
# 每行输出 base64 编码后的字段值，绕开 message 含换行符导致的错位问题
fields = [
    r['name'],
    r['type'],
    r['condition'],
    r.get('message',''),
    r.get('time',''),
    ','.join(r.get('webhookIds',[])),
    r.get('template_id',''),
    'true' if r.get('custom_content',False) else 'false',
    # 卡片技能的输出形态：text=数据文本（默认）/ card=图片卡片
    r.get('output_mode','') or 'text',
]
for f in fields:
    sys.stdout.write(base64.b64encode(f.encode('utf-8')).decode('ascii') + '\n')
" 2>/dev/null)

    if [ $? -ne 0 ] || [ -z "$rule_data" ]; then
        return 1
    fi

    # 按行取 base64，解码后赋值（base64 输出是单行 ASCII，行号稳定）
    RULE_NAME=$(echo "$rule_data"  | sed -n '1p' | base64 -d 2>/dev/null)
    RULE_TYPE=$(echo "$rule_data"  | sed -n '2p' | base64 -d 2>/dev/null)
    RULE_CONDITION=$(echo "$rule_data" | sed -n '3p' | base64 -d 2>/dev/null)
    RULE_MESSAGE=$(echo "$rule_data" | sed -n '4p' | base64 -d 2>/dev/null)
    RULE_TIME=$(echo "$rule_data"     | sed -n '5p' | base64 -d 2>/dev/null)
    RULE_WEBHOOK_IDS=$(echo "$rule_data" | sed -n '6p' | base64 -d 2>/dev/null)
    RULE_TEMPLATE_ID=$(echo "$rule_data" | sed -n '7p' | base64 -d 2>/dev/null)
    RULE_CUSTOM_CONTENT=$(echo "$rule_data" | sed -n '8p' | base64 -d 2>/dev/null)
    RULE_OUTPUT_MODE=$(echo "$rule_data" | sed -n '9p' | base64 -d 2>/dev/null)

    return 0
}

# ======================================
# 读取单条规则数据（含 enabled 字段）
# ======================================
# 参数：$1 - 规则 ID
# 返回：0=成功, 1=失败

read_rule_data_full() {
    local rule_id="$1"
    local rule_data
    rule_data=$(python3 -c "
import json, sys, base64
rules = json.load(open('$RULES_FILE'))
r = next((x for x in rules if x['id']=='$rule_id'), None)
if not r:
    sys.exit(1)
# 每行输出 base64 编码后的字段值，绕开 message 含换行符导致的错位问题
fields = [
    r['name'],
    r['type'],
    r['condition'],
    r.get('message',''),
    str(r.get('enabled',False)).lower(),
    r.get('time',''),
    ','.join(r.get('webhookIds',[])),
    r.get('template_id',''),
    'true' if r.get('custom_content',False) else 'false',
    # 卡片技能的输出形态：text=数据文本（默认）/ card=图片卡片
    r.get('output_mode','') or 'text',
]
for f in fields:
    sys.stdout.write(base64.b64encode(f.encode('utf-8')).decode('ascii') + '\n')
" 2>/dev/null)

    if [ $? -ne 0 ] || [ -z "$rule_data" ]; then
        return 1
    fi

    # 按行取 base64，解码后赋值（base64 输出是单行 ASCII，行号稳定）
    RULE_NAME=$(echo "$rule_data"      | sed -n '1p' | base64 -d 2>/dev/null)
    RULE_TYPE=$(echo "$rule_data"      | sed -n '2p' | base64 -d 2>/dev/null)
    RULE_CONDITION=$(echo "$rule_data" | sed -n '3p' | base64 -d 2>/dev/null)
    RULE_MESSAGE=$(echo "$rule_data"   | sed -n '4p' | base64 -d 2>/dev/null)
    RULE_ENABLED=$(echo "$rule_data"   | sed -n '5p' | base64 -d 2>/dev/null)
    RULE_TIME=$(echo "$rule_data"      | sed -n '6p' | base64 -d 2>/dev/null)
    RULE_WEBHOOK_IDS=$(echo "$rule_data" | sed -n '7p' | base64 -d 2>/dev/null)
    RULE_TEMPLATE_ID=$(echo "$rule_data" | sed -n '8p' | base64 -d 2>/dev/null)
    RULE_CUSTOM_CONTENT=$(echo "$rule_data" | sed -n '9p' | base64 -d 2>/dev/null)
    RULE_OUTPUT_MODE=$(echo "$rule_data" | sed -n '10p' | base64 -d 2>/dev/null)

    return 0
}

# ======================================
# 检查规则是否在本分钟内已触发过（防重）
# ======================================
# 参数：
#   $1 - 规则 ID
# 返回：
#   0 - 是重复触发（本分钟已触发过）
#   1 - 不是重复触发（可以继续执行）

is_duplicate_trigger() {
    local rule_id="$1"

    local current_minute
    current_minute=$(date '+%Y-%m-%dT%H:%M')

    local last_triggered
    last_triggered=$(python3 -c "import json; r=next((x for x in json.load(open('$RULES_FILE')) if x['id']=='$rule_id'), None); print(r.get('lastTriggeredAt','') if r else '')" 2>/dev/null)

    local last_triggered_minute
    last_triggered_minute=$(echo "$last_triggered" | cut -c1-16)

    if [ "$last_triggered_minute" = "$current_minute" ]; then
        log_info "  规则本分钟已触发过，跳过（lastTriggeredAt: ${last_triggered}）"
        return 0
    fi

    return 1
}

# ======================================
# 更新规则的 lastTriggeredAt 字段
# ======================================
# 参数：
#   $1 - 规则 ID
# 返回：
#   0 - 更新成功
#   1 - 更新失败

update_last_triggered_at() {
    local rule_id="$1"

    local current_datetime
    current_datetime=$(date '+%Y-%m-%dT%H:%M:%S')

    python3 -c "
import json
with open('$RULES_FILE', 'r', encoding='utf-8') as f:
    rules = json.load(f)
for r in rules:
    if r['id'] == '$rule_id':
        r['lastTriggeredAt'] = '$current_datetime'
        break
with open('$RULES_FILE', 'w', encoding='utf-8') as f:
    json.dump(rules, f, ensure_ascii=False, indent=2)
" 2>/dev/null
}

# ======================================
# 获取所有已启用规则的 ID 列表
# ======================================
# 参数：无
# 返回：每行一个规则 ID（stdout）

get_enabled_rule_ids() {
    python3 -c "
import json
try:
    rules = json.load(open('$RULES_FILE'))
    for r in rules:
        if r.get('enabled', False):
            print(r['id'])
except Exception:
    pass
" 2>/dev/null
}

# ======================================
# 获取已启用规则的数量
# ======================================
# 参数：无
# 返回：数量（stdout）

get_enabled_rule_count() {
    python3 -c "
import json
try:
    rules = json.load(open('$RULES_FILE'))
    print(len([r for r in rules if r.get('enabled', False)]))
except Exception:
    print(0)
" 2>/dev/null
}

# ======================================
# 根据规则 ID 获取规则名称
# ======================================
# 参数：$1 - 规则 ID
# 返回：规则名称（stdout），找不到时返回规则 ID 本身

get_rule_name_by_id() {
    local rule_id="$1"
    python3 -c "
import json
try:
    r = next((x for x in json.load(open('$RULES_FILE')) if x['id']=='$rule_id'), None)
    print(r['name'] if r else '$rule_id')
except Exception:
    print('$rule_id')
" 2>/dev/null
}

# ======================================
# 获取当前时间窗口内待触发的规则 ID 列表
# ======================================
# 参数：
#   $1 - 当前分钟数（HH*60+MM）
#   $2 - 当前日期（YYYY-MM-DD），用于过滤今天已触发的规则
# 返回：每行一个规则 ID（stdout）

get_matching_rule_ids() {
    local now_minutes="$1"
    local current_date="$2"
    python3 -c "
import json
from datetime import datetime
try:
    rules = json.load(open('$RULES_FILE'))
    now_min = $now_minutes
    for r in rules:
        last = r.get('lastTriggeredAt', '')
        last_date = ''
        if last:
            try:
                last_date = datetime.strptime(last, '%Y-%m-%dT%H:%M:%S').strftime('%Y-%m-%d')
            except Exception:
                pass
        t = r.get('time', '')
        if t and r.get('enabled', False) and last_date != '$current_date':
            parts = t.split(':')
            target_min = int(parts[0]) * 60 + int(parts[1])
            if now_min >= target_min and now_min <= target_min + 2:
                print(r['id'])
except Exception:
    pass
" 2>/dev/null
}
