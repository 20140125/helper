/** 日志表格默认每页条数 */
export const DEFAULT_LOG_PAGE_SIZE = 15;

/** 级别筛选项（对应 hp_run_logs.level 注释中的取值） */
export const LOG_LEVEL_OPTIONS = ['DEBUG', 'INFO', 'SUCCESS', 'WARNING', 'WARN', 'ERROR', 'LOG'] as const;

/** 来源类型筛选项（对应 hp_run_logs.source_type 注释中的取值） */
export const LOG_SOURCE_TYPE_OPTIONS = ['script', 'web', 'access', 'daemon', 'ai', 'system'] as const;

/** 级别标签主题 */
export const LOG_LEVEL_THEME: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  DEBUG: 'default',
  INFO: 'primary',
  SUCCESS: 'success',
  WARNING: 'warning',
  WARN: 'warning',
  ERROR: 'danger',
  LOG: 'default',
};
