// ==============================
// 按用户外观偏好相关类型
// @description 与后端 /api/user-appearance 的响应结构保持一致
// ==============================

/** 按用户外观偏好配置 */
export interface UserAppearanceConfig {
  /** 背景图遮挡层（卡片 / 顶栏 / 侧栏）不透明度，取值 20–100 */
  surfaceOpacity: number;
}

/** 读取外观偏好响应 */
export interface UserAppearanceResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { result: UserAppearanceConfig };
  /** 提示信息 */
  message: string;
}

/** 保存外观偏好响应 */
export interface UserAppearanceMutationResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { result: UserAppearanceConfig };
  /** 提示信息 */
  message: string;
}
