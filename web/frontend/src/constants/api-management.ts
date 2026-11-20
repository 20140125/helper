/**
 * API 管理模块常量
 * @description 集中管理 API 管理页面使用的 UI 展示相关常量
 */

/** HTTP 方法选项 */
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

/** HTTP 方法对应的主题色（用于 TDesign Tag 等组件展示） */
export const METHOD_THEME: Record<string, string> = {
  GET: 'success',
  POST: 'primary',
  PUT: 'warning',
  DELETE: 'danger',
  PATCH: 'warning',
};
