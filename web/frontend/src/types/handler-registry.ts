/**
 * Handler Registry 相关类型定义
 * @description 集中管理 handler 注册表、表单数据、谓词等通用类型
 */

/**
 * Handler 注册表类型
 * @description 键为 handler 名称（如 "config.passwordToggle"），值为任意值（函数、字符串、数组等）
 */
export type HandlerRegistry = Record<string, unknown>;

/** 通用 data 形状：auto-form 传入的表单数据 */
export type FormData = Record<string, unknown>;

/** 通用的谓词函数签名 */
export type Predicate = (data: FormData) => boolean;

/** 消息模板 handler 的配置签名 */
export interface MessageTemplatesHandlerOptions {
  getTypeOptions: () => Array<{ value: string; label: string }>;
  getStyleOptions: () => Array<{ value: string; label: string }>;
  onTypeChange?: (val: unknown, data: FormData) => void;
  onStyleChange?: (val: unknown, data: FormData) => void;
}
