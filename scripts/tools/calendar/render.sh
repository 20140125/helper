#!/bin/bash
# ======================================
# calendar 子模块：SVG 卡片渲染
# ======================================
# 被 calendar.sh 主入口 source，禁止直接执行
# 依赖主入口已定义/source：SVG_FILE、OUTPUT_FILE、card_utils.sh 的 render_card
# 提供：generate_card
# ======================================

# 生成卡片
# 参数: $1=农历中文  $2=今日节气  $3=工作日状态  $4=节日倒计时多行文本
generate_card() {
    local lunar_cn="$1"
    local solar_term="$2"
    local workday_info="$3"
    local holidays="$4"

    # 副标题：复用 card_utils/datetime.sh 的 get_date_str（格式如 "05月08日 周五"）
    local date_str
    date_str=$(get_date_str)
    # dow_num 仍需保留，用于下面计算本周剩余工作日的循环次数
    local dow_num
    dow_num=$(TZ=Asia/Shanghai date +%u)

    local lunar_display=""
    if [ -n "$lunar_cn" ]; then
        lunar_display="农历 ${lunar_cn}"
    fi

    local jieqi_str=""
    if [ -n "$solar_term" ]; then
        jieqi_str="今日节气: ${solar_term}"
    fi

    local remaining_workdays
    remaining_workdays=$(remaining_workdays_this_week)

    local day_of_year
    day_of_year=$(TZ=Asia/Shanghai date +%-j)
    local year_progress
    year_progress=$(echo "scale=1; $day_of_year * 100 / 365" | bc 2>/dev/null || echo "0")

    # Node 只负责 body + 总高度
    local body card_h
    body=$(node -e "
const lunarStr = '${lunar_display}';
const jieqiStr = '${jieqi_str}';
const workdayInfo = '${workday_info}';
const remainWork = ${remaining_workdays};
const yearProgress = '${year_progress}';
const dayOfYear = ${day_of_year};

const rawItems = \`${holidays}\`.trim().split('\\n').filter(Boolean).map(line => {
  const [name, date, days] = line.split('|');
  return { name, date, days };
}).slice(0, 8);

let y = 195;
let content = '';

content += \`
<rect x=\"50\" y=\"\${y}\" width=\"980\" height=\"100\" fill=\"#ffffff08\" stroke=\"#ffffff15\" stroke-width=\"1\"/>
<text x=\"85\" y=\"\${y+40}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"30\" font-weight=\"600\" fill=\"#FFD700\">\${lunarStr}</text>
<text x=\"85\" y=\"\${y+78}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"22\" fill=\"#ffffff80\">\${workdayInfo}\${jieqiStr ? '  |  ' + jieqiStr : ''}</text>
<text x=\"970\" y=\"\${y+40}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"22\" fill=\"#ffffff60\" text-anchor=\"end\">本周剩余 \${remainWork} 个工作日</text>
<text x=\"970\" y=\"\${y+78}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"22\" fill=\"#ffffff60\" text-anchor=\"end\">今年第\${dayOfYear}天 | 已过\${yearProgress}%</text>\`;
y += 120;

const barW = 900;
const barH = 16;
const filled = barW * parseFloat(yearProgress) / 100;
content += \`
<rect x=\"90\" y=\"\${y}\" width=\"\${barW}\" height=\"\${barH}\" rx=\"8\" fill=\"#ffffff15\"/>
<rect x=\"90\" y=\"\${y}\" width=\"\${filled}\" height=\"\${barH}\" rx=\"8\" fill=\"#FFD700\"/>\`;
y += 40;

content += \`
<text x=\"85\" y=\"\${y+25}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"26\" font-weight=\"600\" fill=\"#5DADE2\">节日倒计时</text>\`;
y += 45;

rawItems.forEach((item, i) => {
  const daysNum = parseInt(item.days);
  const urgency = daysNum <= 7 ? '#FF5252' : daysNum <= 30 ? '#FFD700' : '#4CAF50';
  content += \`
  <rect x=\"50\" y=\"\${y}\" width=\"980\" height=\"68\" fill=\"#ffffff06\" stroke=\"#ffffff10\" stroke-width=\"1\"/>
  <text x=\"85\" y=\"\${y+42}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"26\" font-weight=\"500\" fill=\"#ffffffcc\">\${item.name}</text>
  <text x=\"400\" y=\"\${y+42}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"22\" fill=\"#ffffff60\">\${item.date}</text>
  <text x=\"970\" y=\"\${y+42}\" font-family=\"Noto Sans CJK SC, sans-serif\" font-size=\"28\" font-weight=\"700\" fill=\"\${urgency}\" text-anchor=\"end\">\${item.days}</text>\`;
  y += 82;
});

const h = y + 70;
console.log(content);
console.log('__H__' + h);
")

    card_h=$(echo "$body" | awk -F'__H__' '/^__H__/{print $2}')
    body=$(echo "$body" | grep -v '^__H__')

    {
        svg_header "$card_h" "#1A1A2E" "#0D0D1E" "日历提醒" "${date_str}"
        echo "$body"
        svg_footer "$card_h" "珍惜每一天"
    } > "$SVG_FILE"

    render_card "$SVG_FILE" "$OUTPUT_FILE"
}
