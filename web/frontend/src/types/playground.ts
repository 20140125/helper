import type { ApiResponse } from '@/types/api';

/**
 * Playground 模板项
 */
export interface TemplateItem {
  id: string;
  label: string;
  fields: unknown[];
  category?: string;
}

// ==============================
// API 响应类型
// ==============================

/** 保存/删除模板结果 */
export type PlaygroundSaveResult = ApiResponse<{ id?: string }>;

/** 获取全部模板列表响应 */
export type PlaygroundTemplatesResponse = ApiResponse<{ data: TemplateItem[] }>;

/** 获取单个模板响应 */
export type PlaygroundTemplateResponse = ApiResponse<{ data: TemplateItem }>;
