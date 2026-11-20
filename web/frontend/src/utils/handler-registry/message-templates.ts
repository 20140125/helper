import type { HandlerRegistry, MessageTemplatesHandlerOptions } from '@/types/handler-registry';

export type { MessageTemplatesHandlerOptions } from '@/types/handler-registry';

/** 默认 onChange 为 noop */
const noop = () => {};

/**
 * 创建消息模板页面的 handler 注册表
 * @description 将消息模板选择器的动态逻辑集中注册，供消息模板页面和 playground 等场景复用。
 *              类型/风格选项由调用方从 model 传入，确保数据统一由 model 管理。
 *              默认 onChange 为 noop：auto-form 的 handleChange 已通过 [field.name]: value 正确设值，
 *              不应在此处用硬编码的 data.type / data.style 写入，否则字段名不同时会覆盖错误的字段。
 * @param options - 配置项
 * @returns HandlerRegistry 消息模板相关的 handler 注册表
 */
export const createMessageTemplatesHandlers = (
  options: MessageTemplatesHandlerOptions,
): HandlerRegistry => ({
  'messageTemplates.typeOptions': options.getTypeOptions,
  'messageTemplates.styleOptions': options.getStyleOptions,
  'messageTemplates.onTypeChange': options.onTypeChange ?? noop,
  'messageTemplates.onStyleChange': options.onStyleChange ?? noop,
});
