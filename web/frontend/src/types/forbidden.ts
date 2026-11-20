/**
 * 403 无权限页面相关类型定义
 */

export interface ForbiddenPageState {
  /** 当前无权限的页面路径 */
  fromPath: string;
  /** 触发原因：route（路由守卫拦截）| api（API 返回 403） */
  reason: 'route' | 'api';
}
