import path from 'path';
import { CACHE_DIR } from '@/utils/paths';
import {
  getDayOfYear,
  readJsonFile,
  pickByDaySeed,
  getWeekdayKey,
  unescapePipe,
  type HolidayInfo,
  type QuotesData,
  type GreetingsData,
} from './helpers';
import { parseHolidayConfig } from './holiday-parser';

/**
 * 从 daily_data_YYYY-MM-DD.json + reminder_quotes.json + greetings.json
 * 动态读取当天真实数据，构建全量占位符映射。
 *
 * 所有占位符值的来源与脚本推送时完全一致：
 * - 时间类：实时计算
 * - 天气/黄历/星座/历史/语录：从 daily_data 缓存读取
 * - 餐食 greeting/suggestion/tips：从 reminder_quotes.json 动态随机读取
 * - 节气/节日/生日/特殊日等问候语：从 greetings.json 动态读取
 *
 * @returns {Promise<Record<string, string>>} 占位符键值映射
 */
export const loadDailyPlaceholders = async (type?: string): Promise<Record<string, string>> => {
  const now = new Date();
  const today = now.toLocaleDateString('sv-SE'); // YYYY-MM-DD
  const dayOfYear = getDayOfYear(now);
  const weekdayKey = getWeekdayKey(now);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[now.getDay()];
  const currentYear = String(now.getFullYear());
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const dateTime = `${now.getFullYear()}年${currentMonth}月${String(now.getDate()).padStart(2, '0')}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const city = process.env.WEATHER_CITY_NAME ?? '深圳';

  // ── 本周起止日期 ──
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now); monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const fmtDate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;

  // ── 本月相关 ──
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthNames = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const monthName = monthNames[now.getMonth() + 1] ?? '';
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = `${nextMonthDate.getFullYear()}年${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}月`;
  const estimatedWorkdays = Math.min(22, lastDay - 8);
  const restDays = lastDay - estimatedWorkdays;
  const workdayRatio = ((estimatedWorkdays / lastDay) * 100).toFixed(1);

  // ── 明天（用于调休日期） ──
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}年${String(tomorrow.getMonth() + 1).padStart(2, '0')}月${String(tomorrow.getDate()).padStart(2, '0')}日（${weekdays[tomorrow.getDay()]}）`;

  // ══════════════════════════════════════
  // 并行读取所有缓存文件
  // ══════════════════════════════════════
  const [dailyData, quotesData, greetingsData, holidayConfig] = await Promise.all([
    readJsonFile<Record<string, string>>(path.join(CACHE_DIR, `daily_data_${today}.json`)),
    readJsonFile<QuotesData>(path.join(CACHE_DIR, 'reminder_quotes.json')),
    readJsonFile<GreetingsData>(path.join(CACHE_DIR, 'greetings.json')),
    parseHolidayConfig(),
  ]);
  const holidayList = holidayConfig.holidays;
  const adjustDaysList = holidayConfig.adjustDays;

  // ══════════════════════════════════════
  // 从 daily_data 缓存提取（天气/黄历/星座/历史/语录）
  // ══════════════════════════════════════
  const weatherContent = dailyData?.weather ? unescapePipe(dailyData.weather) : '';
  const almanacContent = dailyData?.almanac ? unescapePipe(dailyData.almanac) : '';
  const horoscopeContent = dailyData?.horoscope ? unescapePipe(dailyData.horoscope) : '';
  const historyContent = dailyData?.history ? unescapePipe(dailyData.history) : '';
  const quoteFromCache = dailyData?.inspirational_quote ? unescapePipe(dailyData.inspirational_quote).trim() : '';

  // ══════════════════════════════════════
  // 从 reminder_quotes.json 动态选取（与脚本逻辑一致）
  // ══════════════════════════════════════

  // 每日励志语录：day_of_year % len（与脚本 inspirational_quotes.sh random 策略一致）
  const allQuotes = quotesData?.quotes?.quotes ?? [];
  const dynamicQuote = allQuotes.length > 0 ? pickByDaySeed(allQuotes, dayOfYear) : '';
  // 优先使用缓存中的语录，没有再用语录库
  const finalQuote = quoteFromCache || dynamicQuote || '成功不是终点，失败也不是末日，唯有勇气才能永续。';

  // 早餐：tips 随机 + nutrition_advice 按星期选取
  const breakfastTips = quotesData?.breakfast?.tips ?? [];
  const breakfastAdvice = quotesData?.breakfast?.nutrition_advice?.[weekdayKey] ?? [];
  const dynamicBreakfastGreeting = breakfastTips.length > 0 ? pickByDaySeed(breakfastTips, dayOfYear) : '';
  const dynamicBreakfastSuggestion = breakfastAdvice.length > 0 ? pickByDaySeed(breakfastAdvice, dayOfYear) : '';

  // 午餐：tips 随机 + nutrition_advice 按星期选取
  const lunchTips = quotesData?.lunch?.tips ?? [];
  const lunchAdvice = quotesData?.lunch?.nutrition_advice?.[weekdayKey] ?? [];
  const dynamicLunchGreeting = lunchTips.length > 0 ? pickByDaySeed(lunchTips, dayOfYear) : '';
  const dynamicLunchSuggestion = lunchAdvice.length > 0 ? pickByDaySeed(lunchAdvice, dayOfYear) : '';

  // 晚餐：tips 随机 + nutrition_advice 按星期选取
  const dinnerTips = quotesData?.dinner?.tips ?? [];
  const dinnerAdvice = quotesData?.dinner?.nutrition_advice?.[weekdayKey] ?? [];
  const dynamicDinnerGreeting = dinnerTips.length > 0 ? pickByDaySeed(dinnerTips, dayOfYear) : '';
  const dynamicDinnerSuggestion = dinnerAdvice.length > 0 ? pickByDaySeed(dinnerAdvice, dayOfYear) : '';

  // 周末寄语
  const weekendMessages = quotesData?.weekend?.messages ?? [];
  const dynamicWeekendGreeting = weekendMessages.length > 0 ? pickByDaySeed(weekendMessages, dayOfYear) : '';

  // 调休提醒寄语
  const advanceReminders = quotesData?.workday_adjust?.advance_reminders ?? [];
  const todayReminders = quotesData?.workday_adjust?.today_reminders ?? [];
  const dynamicAdjustTips = advanceReminders.length > 0 ? pickByDaySeed(advanceReminders, dayOfYear) : '';

  // ══════════════════════════════════════
  // 从 greetings.json 动态读取节日/节气/特殊日/生日问候语
  // ══════════════════════════════════════

  // 节气：使用24节气近似日期表，找到当前日期之后最近的节气
  const solarTermDates: Array<[number, number, string]> = [
    [1, 5, '小寒'], [1, 20, '大寒'],
    [2, 4, '立春'], [2, 19, '雨水'],
    [3, 5, '惊蛰'], [3, 20, '春分'],
    [4, 4, '清明'], [4, 20, '谷雨'],
    [5, 5, '立夏'], [5, 21, '小满'],
    [6, 5, '芒种'], [6, 21, '夏至'],
    [7, 7, '小暑'], [7, 22, '大暑'],
    [8, 7, '立秋'], [8, 23, '处暑'],
    [9, 7, '白露'], [9, 23, '秋分'],
    [10, 8, '寒露'], [10, 23, '霜降'],
    [11, 7, '立冬'], [11, 22, '小雪'],
    [12, 7, '大雪'], [12, 22, '冬至'],
  ];
  const currentMMDD = (now.getMonth() + 1) * 100 + now.getDate();
  let nearestTermName = solarTermDates[0][2]; // 默认取明年小寒作为 fallback
  for (const [m, d, name] of solarTermDates) {
    if (m * 100 + d >= currentMMDD) {
      nearestTermName = name;
      break;
    }
  }
  const termGreeting = greetingsData?.solar_terms?.[nearestTermName] ?? '';

  // 农历节日：按当前月份选取合适的节日预览
  const lunarFestivalNames = Object.keys(greetingsData?.lunar_festivals ?? {});
  const dynamicFestivalName = lunarFestivalNames.length > 0 ? pickByDaySeed(lunarFestivalNames, now.getMonth()) : '元宵节';
  const lunarFestivalGreeting = greetingsData?.lunar_festivals?.[dynamicFestivalName] ?? '';

  // 节假日：按当前月份选取合适的节日预览（作为 fallback）
  const monthToHoliday: Record<number, string> = {
    1: '元旦', 2: '春节', 3: '清明节', 4: '清明节', 5: '劳动节',
    6: '端午节', 7: '端午节', 8: '中秋节', 9: '中秋节', 10: '国庆节', 11: '国庆节', 12: '元旦',
  };
  const nearestHolidayName = monthToHoliday[now.getMonth() + 1] ?? '春节';
  let holidayGreeting = '';
  const holidayTipsContent = '✅ 享受假期，放松身心\n✅ 注意出行安全\n✅ 合理安排假期时间';

  // 特殊日期：找到距今最近的特殊日期
  const specialDayDates: Record<string, string> = {
    '02-14': '情人节',
    '03-08': '妇女节',
    '06-01': '儿童节',
    '09-10': '教师节',
    '10-24': '程序员节',
    '12-25': '圣诞节',
  };
  const todayMMDD = `${currentMonth}-${String(now.getDate()).padStart(2, '0')}`;
  let dynamicDayName = '程序员节';
  {
    const sortedDates = Object.keys(specialDayDates).sort();
    let found = sortedDates.find(d => d >= todayMMDD);
    if (!found) {
      found = sortedDates[0];
    }
    dynamicDayName = specialDayDates[found];
  }
  const specialDayGreeting = greetingsData?.special_days?.[dynamicDayName] ?? '';

  // 生日：从模板中随机选取并替换 {name}
  const birthdayTemplates = greetingsData?.birthday?.templates ?? [];
  const previewName = '小明';
  let dynamicBirthdayWish = '';
  if (birthdayTemplates.length > 0) {
    const nameHash = Array.from(previewName).reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const idx = (dayOfYear * 17 + nameHash) % birthdayTemplates.length;
    dynamicBirthdayWish = birthdayTemplates[idx].replace(/\{name\}/g, previewName);
  }

  // ══════════════════════════════════════
  // 从 holiday_config.sh 动态计算假期倒计时相关字段
  // ══════════════════════════════════════
  const todayEpoch = new Date(today).getTime();
  let nearestFutureHoliday: HolidayInfo | null = null;
  let currentOngoingHoliday: HolidayInfo | null = null;

  for (const h of holidayList) {
    const startEpoch = new Date(h.start).getTime();
    const endEpoch = new Date(h.end).getTime();
    if (todayEpoch >= startEpoch && todayEpoch <= endEpoch) {
      currentOngoingHoliday = h;
      break;
    }
    if (startEpoch > todayEpoch) {
      nearestFutureHoliday = h;
      break;
    }
  }

  const targetHoliday = currentOngoingHoliday || nearestFutureHoliday || (holidayList.length > 0 ? holidayList[holidayList.length - 1] : null);

  const dynamicHolidayStart = targetHoliday?.start ?? '';
  const dynamicHolidayEnd = targetHoliday?.end ?? '';
  const dynamicHolidayDays = targetHoliday ? `${targetHoliday.days}天` : '';
  const dynamicHolidayName = targetHoliday?.name ?? nearestHolidayName;
  holidayGreeting = greetingsData?.holidays?.[dynamicHolidayName] ?? '';

  let dynamicDaysPassed = '0';
  let dynamicDaysLeft = '0';
  let dynamicCountdownDays = '0';

  if (currentOngoingHoliday) {
    const startEpoch = new Date(currentOngoingHoliday.start).getTime();
    const endEpoch = new Date(currentOngoingHoliday.end).getTime();
    dynamicDaysPassed = String(Math.floor((todayEpoch - startEpoch) / 86400000));
    dynamicDaysLeft = String(Math.floor((endEpoch - todayEpoch) / 86400000));
    dynamicCountdownDays = '0';
  } else if (nearestFutureHoliday) {
    const startEpoch = new Date(nearestFutureHoliday.start).getTime();
    dynamicCountdownDays = String(Math.floor((startEpoch - todayEpoch) / 86400000));
    dynamicDaysPassed = '0';
    dynamicDaysLeft = String(nearestFutureHoliday.days);
  }

  // ══════════════════════════════════════
  // 调休日动态计算
  // ══════════════════════════════════════
  let dynamicAdjustDate = '';
  let dynamicAdjustReason = '';

  const nearestAdjust = adjustDaysList.find(a => new Date(a.date).getTime() > todayEpoch);
  if (nearestAdjust) {
    const adjDate = new Date(nearestAdjust.date);
    const adjWeekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    dynamicAdjustDate = `${adjDate.getFullYear()}年${String(adjDate.getMonth() + 1).padStart(2, '0')}月${String(adjDate.getDate()).padStart(2, '0')}日（${adjWeekdays[adjDate.getDay()]}）`;
    const adjEpoch = adjDate.getTime();
    for (let i = holidayList.length - 1; i >= 0; i--) {
      if (new Date(holidayList[i].end).getTime() < adjEpoch) {
        dynamicAdjustReason = holidayList[i].name;
        break;
      }
    }
    if (!dynamicAdjustReason) {
      for (const h of holidayList) {
        if (new Date(h.start).getTime() > adjEpoch) {
          dynamicAdjustReason = h.name;
          break;
        }
      }
    }
    if (!dynamicAdjustReason) dynamicAdjustReason = dynamicHolidayName;
  } else {
    dynamicAdjustDate = tomorrowStr;
    dynamicAdjustReason = dynamicHolidayName;
  }

  // ══════════════════════════════════════
  // 清明节 / 中元节特殊用语处理
  // ══════════════════════════════════════
  const SOLEMN_HOLIDAYS = ['清明', '清明节', '中元节'];
  const isSolemnHoliday = SOLEMN_HOLIDAYS.some(s => dynamicHolidayName.includes(s));

  // ══════════════════════════════════════
  // greeting 占位符根据 type 动态设定
  // ══════════════════════════════════════
  let dynamicGreeting: string;
  switch (type) {
    case 'breakfast':
      dynamicGreeting = dynamicBreakfastGreeting || '☀️ 早上好！新的一天从一顿营养早餐开始';
      break;
    case 'lunch':
      dynamicGreeting = dynamicLunchGreeting || '🍜 中午了，记得吃午餐哦！工作再忙也要好好吃饭';
      break;
    case 'dinner':
      dynamicGreeting = dynamicDinnerGreeting || '🌙 下班时间到，记得吃晚餐哦！别让胃空着回家';
      break;
    case 'weekend':
      dynamicGreeting = dynamicWeekendGreeting || '一周辛苦了！周末好好休息，给自己充充电 🔋';
      break;
    case 'holiday':
      dynamicGreeting = holidayGreeting || '🎉 节日快乐，愿您度过美好的假期！';
      break;
    case 'solar_term':
      dynamicGreeting = termGreeting || '🌸 节气到，注意养生！';
      break;
    case 'lunar_festival':
      dynamicGreeting = lunarFestivalGreeting || '🎉 传统佳节，祝您快乐！';
      break;
    case 'special_day':
      dynamicGreeting = specialDayGreeting || '🎉 特殊的日子，祝您快乐！';
      break;
    default:
      dynamicGreeting = dynamicWeekendGreeting || dynamicLunchGreeting || '🍜 忙碌的日子也要好好吃饭，你值得被好好对待！';
      break;
  }

  // ══════════════════════════════════════
  // 构建全量占位符映射
  // ══════════════════════════════════════
  const placeholders: Record<string, string> = {
    // ── 通用时间 ──
    date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    date_time: dateTime,
    weekday, week_day: weekday,
    city,
    week_start: fmtDate(monday), week_end: fmtDate(sunday),
    current_year: currentYear, current_month: currentMonth, year: currentYear,

    // ── 天气/黄历/星座/历史/语录（来自 daily_data 缓存）──
    weather: weatherContent || '## 🌤️ 天气预报\n\n**当前温度**：25℃\n**天气状况**：多云\n**湿度**：65%\n\n💡 天气数据暂未获取',
    history: historyContent || '## 📜 历史上的今天\n\n暂无数据',
    history_content: historyContent || '## 📜 历史上的今天\n\n暂无数据',
    almanac: almanacContent || '## 📅 今日黄历\n\n暂无数据',
    almanac_content: almanacContent || '## 📅 今日黄历\n\n暂无数据',
    almanac_title: '',
    horoscope: horoscopeContent || '## ✨ 今日星座运势\n\n暂无数据',
    horoscope_content: horoscopeContent || '## ✨ 今日星座运势\n\n暂无数据',
    horoscope_title: '',
    inspirational_quote: finalQuote,
    quote: finalQuote,

    // ── 餐食提醒（动态从 reminder_quotes.json 读取）──
    greeting: dynamicGreeting,
    breakfast_suggestion: dynamicBreakfastSuggestion || '🥚 蛋白质 + 🍞 碳水 + 🥗 果蔬，营养均衡的早餐最重要',
    lunch_suggestion: dynamicLunchSuggestion || '🥗 荤素搭配，少油少盐，午餐吃到七八分饱最健康',
    dinner_suggestion: dynamicDinnerSuggestion || '🍵 晚餐宜清淡，少油少盐，搭配蔬菜和优质蛋白更健康',
    tips: (() => {
      const tipsSeed = dayOfYear + 7;
      switch (type) {
        case 'breakfast':
          return breakfastTips.length > 0 ? pickByDaySeed(breakfastTips, tipsSeed) : '7:00-9:00 是最佳早餐时间，别错过';
        case 'lunch':
          return lunchTips.length > 0 ? pickByDaySeed(lunchTips, tipsSeed) : '细嚼慢咽，不要吃太饱（7-8分饱最佳）';
        case 'dinner':
          return dinnerTips.length > 0 ? pickByDaySeed(dinnerTips, tipsSeed) : '晚餐别太晚，睡前2小时吃完最健康';
        case 'adjustment':
          return dynamicAdjustTips || (todayReminders.length > 0 ? pickByDaySeed(todayReminders, dayOfYear) : '虽然是周末，但明天需要上班哦！记得调闹钟，今晚早点休息 💤');
        default:
          return dynamicAdjustTips || '细嚼慢咽，不要吃太饱（7-8分饱最佳）';
      }
    })(),

    // ── 晚间问候 ──
    wish: '辛苦了一天，该下班啦！',
    tomorrow_tips: '',

    // ── 生日（动态从 greetings.json 读取模板）──
    name: previewName,
    birthday_wish: dynamicBirthdayWish || '🎁 愿你的每一天都充满欢笑与惊喜！\n\n🌟 在这个特别的日子里，祝你生日快乐，心想事成！\n\n🎈 新的一岁，新的开始，愿所有美好如期而至！',
    days: dynamicCountdownDays !== '0' ? dynamicCountdownDays : String(Math.max(1, 30 - now.getDate())),
    birthday_date: `${currentYear}-${currentMonth}-${String(Math.min(28, now.getDate() + 15)).padStart(2, '0')}`,

    // ── 节假日（动态从 greetings.json + holiday_config.sh 读取）──
    holiday_name: isSolemnHoliday
      ? `${dynamicHolidayName}安康`
      : `${dynamicHolidayName}快乐`,
    holiday_tips: isSolemnHoliday
      ? '✅ 文明祭扫，注意防火\n✅ 缅怀先人，珍惜当下\n✅ 踏青养生，注意安全'
      : holidayTipsContent,

    // ── 周末/周报（动态读取）──
    week_summary: `> 📍 **本周工作日**: **5天**\n> 🎯 **周末休息**: **2天**\n> 📊 **工作强度**: ${(5 / 7 * 100).toFixed(1)}%`,
    next_monday_reminder: `下周一（${fmtDate(new Date(sunday.getTime() + 86400000))}）早上8:00，我们继续！\n🎉 *祝您周末愉快！下周见！*`,
    next_week_preview: '下周正常工作，继续加油！',

    // ── 调休提醒（从 holiday_config.sh 动态读取最近调休日）──
    adjustment_date: dynamicAdjustDate,
    reason: dynamicAdjustReason,

    // ── 月度（实时计算）──
    month_name: monthName,
    last_day: String(lastDay),
    monthly_workdays: String(estimatedWorkdays),
    rest_days: String(restDays),
    workday_ratio: workdayRatio,
    next_month: nextMonth,

    // ── 节气（动态从 greetings.json 读取）──
    term_name: nearestTermName,

    // ── 农历节日（动态从 greetings.json 读取）──
    festival_name: dynamicFestivalName,

    // ── 假期倒计时（从 holiday_config.sh 动态计算）──
    holiday_start: dynamicHolidayStart,
    holiday_end: dynamicHolidayEnd,
    holiday_days: dynamicHolidayDays,
    days_passed: dynamicDaysPassed,
    days_left: dynamicDaysLeft,

    // ── 自定义规则 ──
    rule_name: '每日站会提醒',
    condition_text: '每周一至周五',
    type_label: '工作日',
    rule_time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    message: '📋 今日站会即将开始，请准备好昨日工作总结和今日计划。',

    // ── 特殊日期（动态从 greetings.json 读取）──
    day_name: dynamicDayName,

    // ── 年度更新报告 ──
    holiday_status: '✅ 成功生成',
    special_holiday_detail: '   - 日期：待国务院发布通知',
    month_status: '✅ 成功更新',
    solar_terms_status: `✅ 成功计算24个节气`,
    lunar_festivals_status: `✅ 成功转换${lunarFestivalNames.length || 8}个农历节日`,
  };

  return placeholders;
};
