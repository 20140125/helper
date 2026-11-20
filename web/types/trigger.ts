import { Permission } from './permission';

// ==============================
// 脚本分类
// ==============================

/** 脚本分类标识 */
export type ScriptCategory = 'daily' | 'festival' | 'system';

// ==============================
// 脚本元数据定义
// ==============================

/**
 * 脚本完整元数据
 * @description label/desc 等用户可见文案由前端 locale 维护（按 key 索引），
 * 后端仅保留行为相关字段（路径、参数、图标、分类、权限）
 */
export interface ScriptMeta {
  /** 脚本唯一标识（也是前端 locale 索引键） */
  key: string;
  /** 脚本文件路径 */
  scriptPath: string;
  /** 脚本子命令参数 */
  args?: string[];
  /** 图标 */
  icon: string;
  /** 卡片主题色 */
  scriptName: string;
  /** 所属分类 */
  category: ScriptCategory;
  /** 查看权限码 */
  viewPermission: Permission;
  /** 执行权限码 */
  editPermission: Permission;
}

/** 所有脚本元数据（唯一数据源） */
export const SCRIPT_METAS: ScriptMeta[] = [
  // ── 日常提醒 ──
  {
    key: 'workday',
    scriptName: 'workday_manager.sh',
    scriptPath: 'scripts/workday_manager.sh',
    args: ['auto'],
    icon: '💼',
    category: 'daily',
    viewPermission: Permission.TRIGGER_WORKDAY_VIEW,
    editPermission: Permission.TRIGGER_WORKDAY_EDIT,
  },
  {
    key: 'birthday',
    scriptName: 'birthday_reminder.sh',
    scriptPath: 'scripts/birthday_reminder.sh',
    icon: '🎂',
    category: 'daily',
    viewPermission: Permission.TRIGGER_BIRTHDAY_VIEW,
    editPermission: Permission.TRIGGER_BIRTHDAY_EDIT,
  },
  {
    key: 'weekly',
    scriptName: 'weekly_summary.sh',
    scriptPath: 'scripts/weekly_summary.sh',
    icon: '📊',
    category: 'daily',
    viewPermission: Permission.TRIGGER_WEEKLY_VIEW,
    editPermission: Permission.TRIGGER_WEEKLY_EDIT,
  },
  {
    key: 'monthly',
    scriptName: 'monthly_reminder.sh',
    scriptPath: 'scripts/monthly_reminder.sh',
    icon: '📅',
    category: 'daily',
    viewPermission: Permission.TRIGGER_MONTHLY_VIEW,
    editPermission: Permission.TRIGGER_MONTHLY_EDIT,
  },
  {
    key: 'prefetch',
    scriptName: 'daily_data_manager.sh',
    scriptPath: 'scripts/daily_data_manager.sh',
    args: ['prefetch'],
    icon: '🔄',
    category: 'daily',
    viewPermission: Permission.TRIGGER_PREFETCH_VIEW,
    editPermission: Permission.TRIGGER_PREFETCH_EDIT,
  },
  // ── 节日与节气 ──
  {
    key: 'festival',
    scriptName: 'festival_greetings.sh',
    scriptPath: 'scripts/festival_greetings.sh',
    args: ['all'],
    icon: '🎉',
    category: 'festival',
    viewPermission: Permission.TRIGGER_FESTIVAL_VIEW,
    editPermission: Permission.TRIGGER_FESTIVAL_EDIT,
  },
  {
    key: 'holiday_countdown',
    scriptName: 'holiday_countdown.sh',
    scriptPath: 'scripts/holiday_countdown.sh',
    icon: '⏳',
    category: 'festival',
    viewPermission: Permission.TRIGGER_HOLIDAY_COUNTDOWN_VIEW,
    editPermission: Permission.TRIGGER_HOLIDAY_COUNTDOWN_EDIT,
  },
  // ── 系统与工具 ──
  {
    key: 'annual_update',
    scriptName: 'annual_update.sh',
    scriptPath: 'scripts/annual_update.sh',
    icon: '🛠️',
    category: 'system',
    viewPermission: Permission.TRIGGER_ANNUAL_UPDATE_VIEW,
    editPermission: Permission.TRIGGER_ANNUAL_UPDATE_EDIT,
  },
];

// ==============================
// 便捷查找工具
// ==============================

/** 按 key 快速查找脚本元数据 */
export const SCRIPT_META_MAP: Map<string, ScriptMeta> = new Map(
  SCRIPT_METAS.map((m) => [m.key, m]),
);
