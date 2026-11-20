import type { ApiResponse } from './api';

/** 脚本分类标识 */
export type ScriptCategory = 'daily' | 'festival' | 'system';

/** 后端返回的脚本列表项（label/desc 由前端按 key 从 locale 获取） */
export interface ScriptItem {
  /** 脚本唯一标识（同时作为 locale 索引键） */
  key: string;
  /** 脚本名称 */
  scriptName: string;
  /** 图标 */
  icon: string;
  /** 所属分类 */
  category: ScriptCategory;
  /** 当前用户是否有执行权限 */
  canEdit: boolean;
}

/** GET /api/trigger 响应 */
export type TriggerScriptsResponse = ApiResponse<{ scripts: ScriptItem[] }>;

/** 脚本触发结果 */
export type TriggerResult = ApiResponse<{ label: string; stdout: string; stderr: string; time: string }>;

/** 更新工具执行结果 */
export type ToolResult = ApiResponse<{ stdout: string; stderr: string; time: string }>;

// ==============================
// 前端本地结果类型（由 Model 层构造，非后端直接返回）
// ==============================

/** 前端脚本/工具执行结果的最小公共字段（用于 UI 展示组件入参） */
export interface ScriptResultBase {
  /** 状态码，0 表示成功 */
  code: number;
  /** 执行时间文本 */
  time: string;
  /** 标准错误输出 */
  stderr: string;
  /** 标准输出（部分场景由父组件单独提供，故设为可选） */
  stdout?: string;
}

/** 前端脚本执行结果项（存储在 scriptResults 中） */
export interface ScriptResultItem extends ScriptResultBase {
  /** 脚本展示名称 */
  label: string;
  /** 标准输出（结果项中必填） */
  stdout: string;
}

/** 前端工具执行结果项（存储在 toolResults 中） */
export interface ToolResultItem extends ScriptResultBase {
  /** 标准输出（结果项中必填） */
  stdout: string;
}
