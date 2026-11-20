/** 日志文件信息 */
export interface LogFileInfo {
  key: string;
  filename: string;
  exists: boolean;
  size: number;
  mtime: string | null;
}

/**
 * 「接口访问日志（历史）」的 key
 * @description 该 key 不指向固定文件：历史日志按天归档在 scripts/logs 目录，
 *   实际路径动态解析为「最新一份归档」（见 utils/logs.ts resolveLogFile），
 *   此处保留旧路径 scripts/web_access.log.1 仅作兜底
 */
export const ACCESS_LOG_BACKUP_KEY = 'access_log_backup';

/** 日志文件映射表 key → 文件名 */
export const LOG_FILES: Record<string, string> = {
  daemon: 'scripts/reminder_daemon.log',
  workday: 'scripts/workday_manager.log',
  birthday: 'scripts/birthday_reminder.log',
  weekly: 'scripts/weekly_summary.log',
  monthly: 'scripts/monthly_reminder.log',
  festival: 'scripts/festival_greetings.log',
  daily_data: 'scripts/daily_data_manager.log',
  custom_rules: 'scripts/custom_rules.log',
  holiday_countdown: 'scripts/holiday_countdown.log',
  get_holidays: 'scripts/update-tools/get_holidays.log',
  generate_holiday_config: 'scripts/update-tools/generate_holiday_config.log',
  update_month_config: 'scripts/update-tools/update_month_config.log',
  send_update_notification: 'scripts/update-tools/send_update_notification.log',
  web_server: 'web/.runtime/web_server.jsonl',
  web_launcher: 'scripts/web_launcher.log',
  access_log: 'scripts/web_access.log',
  [ACCESS_LOG_BACKUP_KEY]: 'scripts/web_access.log.1',
  reminder: 'scripts/reminder.log',
  tools: 'scripts/tools/tools.log',
};

/**
 * 日志 key 对应的中文显示标签
 * @description 与 LOG_FILES 一一对应，主要用途：
 *   1. AI 工具向 LLM 介绍可用日志时，让 LLM 看懂用户口语（如"生日提醒" → birthday）
 *   2. 前端列表展示中文名（前端 types/log.ts 可直接复用此常量）
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
};

