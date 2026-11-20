import type { ApiResponse } from './api';

// ==============================
// 类型定义
// ==============================

/** auto-form validate 方法返回值类型 */
export type AutoFormRef = { validate: () => Promise<boolean | Record<string, unknown>> } | null;

/**
 * 配置获取结果接口
 * @description 描述获取配置的返回结果
 */
export type ConfigResult = ApiResponse<{ config: Record<string, string> }>;

/**
 * 配置保存结果接口
 * @description 描述保存配置的返回结果（无数据返回）
 */
export type ConfigSaveResult = ApiResponse;

export interface ConfigWebHook extends Record<string, unknown> {
  id?: string;
  name: string;
  url: string;
  style: string;
}

/**
 * Webhook 行内表单数据类型
 * @description 用于 Webhook 行内新增/编辑表单的 v-model 绑定值
 */
export interface IWebhookInlineFormData {
  name: string;
  url: string;
  style: string;
}
