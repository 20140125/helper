import type { HandlerRegistry } from '@/types/handler-registry';
import { HTTP_METHODS } from '@/constants/api-management';

/**
 * 创建 API 管理页面的 handler 注册表
 * @description 将 API 表单中的动态选项集中注册，供 field-enhancer 解析 $handler:apiManagement.* 标记
 * @param options - 配置项
 * @param options.getCategoryOptions - 获取分类下拉选项的函数
 * @returns HandlerRegistry API 管理相关的 handler 注册表
 */
export const createApiManagementHandlers = (options: {
  getCategoryOptions: () => Array<{ value: string; label: string }>;
}): HandlerRegistry => ({
  'apiManagement.methodOptions': HTTP_METHODS.map((m) => ({ value: m, label: m })),
  'apiManagement.categoryOptions': options.getCategoryOptions,
});
