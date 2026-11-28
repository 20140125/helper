/**
 * 日志来源注册表
 * @description 日志唯一真源是 hp_run_logs。这里的 key 保留前端 / AI 工具已有的标识，
 *   值改成库里的 source 字段；未注册的 source 也会被日志列表自动发现并展示。
 */

/** 日志文件信息（字段名沿用旧接口，语义改为数据库来源统计） */
export interface LogFileInfo {
  /** 日志标识 */
  key: string;
  /** 展示用的来源位置（hp_run_logs:xxx） */
  filename: string;
  /** 该来源是否有记录 */
  exists: boolean;
  /** 正文总字节数 */
  size: number;
  /** 最近一条日志时间，无记录时为 null */
  mtime: string | null;
}

/**
 * 「接口访问日志（历史）」的 key
 * @description 不再指向归档文件，改为读取同一来源更早的记录（见 LOG_SOURCE_OFFSETS）
 */
export const ACCESS_LOG_BACKUP_KEY = 'access_log_backup';

/** 日志 key → hp_run_logs.source */
export const LOG_SOURCES: Record<string, string> = {
  daemon: 'reminder_daemon',
  workday: 'workday_manager',
  birthday: 'birthday_reminder',
  weekly: 'weekly_summary',
  monthly: 'monthly_reminder',
  festival: 'festival_greetings',
  daily_data: 'daily_data_manager',
  custom_rules: 'custom_rules',
  holiday_countdown: 'holiday_countdown',
  get_holidays: 'get_holidays',
  generate_holiday_config: 'generate_holiday_config',
  update_month_config: 'update_month_config',
  send_update_notification: 'send_update_notification',
  web_server: 'web_server',
  web_launcher: 'web_launcher',
  access_log: 'web_access',
  [ACCESS_LOG_BACKUP_KEY]: 'web_access',
  reminder: 'reminder',
  tools: 'tools',
  fetch_real_weather: 'fetch_real_weather',
  fetch_real_almanac: 'fetch_real_almanac',
  fetch_real_horoscope: 'fetch_real_horoscope',
  history_today: 'history_today',
  annual_scheduler: 'annual_scheduler',
};

/**
 * 读取时跳过的条数（历史视图）
 * @description 访问日志没有归档文件了，「历史」= 同一来源里更早的一批记录
 */
export const LOG_SOURCE_OFFSETS: Record<string, number> = {
  [ACCESS_LOG_BACKUP_KEY]: 100,
};

/**
 * 日志 key 对应的中文显示标签
 * @description 与 LOG_SOURCES 一一对应，主要用途：
 *   1. AI 工具向 LLM 介绍可用日志时，让 LLM 看懂用户口语（如「生日提醒」→ birthday）
 *   2. 前端列表展示中文名
 */
export const LOG_LABELS: Record<string, string> = {
  daemon: '守护进程',
  workday: '工作日提醒',
  birthday: '生日提醒',
  weekly: '每周总结',
  monthly: '每月提醒',
  festival: '节日祝福',
  daily_data: '每日数据',
  custom_rules: '自定义规则',
  holiday_countdown: '节假日倒计时',
  get_holidays: '获取节假日数据',
  generate_holiday_config: '生成节假日配置',
  update_month_config: '更新月份配置',
  send_update_notification: '发送更新通知',
  web_server: 'Web 服务日志',
  web_launcher: 'Web 启动器日志',
  access_log: '接口访问日志',
  access_log_backup: '接口访问日志（历史）',
  reminder: 'AI 提醒日志',
  tools: '技能图谱日志',
  fetch_real_weather: '实时天气抓取',
  fetch_real_almanac: '实时黄历抓取',
  fetch_real_horoscope: '实时星座抓取',
  history_today: '历史上的今天',
  annual_scheduler: '年度调度器',
};
