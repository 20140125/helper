import type { ApiResponse } from './api';
import { useLocaleStore } from '@/stores/locale';

/** 日志文件信息 */
export interface LogItem {
  /** 日志 key（业务维度唯一标识，用于查表取标签） */
  key: string;
  /** 实际文件名 */
  filename: string;
  /** 文件是否存在 */
  exists: boolean;
  /** 文件大小（字节） */
  size: number;
  /** 最后修改时间，不存在时为 null */
  mtime: string | null;
}

/**
 * 日志 key 对应的显示标签（中文 fallback）
 * 注意：中英文双语显示请使用 `getLogLabels()`，此常量仅作为：
 *   1. key 白名单（LOG_LABELS[key] 用于判断 key 是否合法）
 *   2. locale 未就绪时的兜底文案
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
  reminder: 'AI提醒日志',
  tools: '技能图谱日志',
};

/**
 * 获取当前 locale 下的日志 key → 显示标签映射
 * 随语言切换自动变化，在 Model/Component 中通过 `computed(() => getLogLabels())` 使用
 */
export function getLogLabels(): Record<string, string> {
  const localeStore = useLocaleStore();
  const localized = localeStore.t?.logs?.labels ?? {};
  // 以静态 LOG_LABELS 为 key 集合基准，localized 优先，缺省回退中文
  const result: Record<string, string> = {};
  for (const key of Object.keys(LOG_LABELS)) {
    result[key] = localized[key] ?? LOG_LABELS[key];
  }
  return result;
}

/** 获取日志列表响应 */
export type LogsResponse = ApiResponse<{ logs: LogItem[] }>;

/** 获取日志内容响应 */
export type LogContentResponse = ApiResponse<{ content: string }>;

/** 日志操作结果（无数据返回） */
export type LogResult = ApiResponse;