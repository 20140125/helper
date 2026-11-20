import type { HandlerRegistry } from '@/types/handler-registry';

/**
 * 合并多个 handler 注册表为一个
 * @param registries - handler 注册表列表
 * @returns 合并后的 HandlerRegistry
 */
export const mergeHandlerRegistries = (...registries: HandlerRegistry[]): HandlerRegistry =>
  Object.assign({}, ...registries);
