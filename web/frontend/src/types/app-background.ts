// ==============================
// 系统背景图相关类型
// @description 与后端 /api/app-background 的响应结构保持一致
// ==============================

/** 系统背景配置 */
export interface AppBackgroundConfig {
  /** 背景图地址，空串表示使用默认主题 */
  url: string;
}

/** 读取背景配置响应 */
export interface AppBackgroundResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { result: AppBackgroundConfig };
  /** 提示信息 */
  message: string;
}

/** 上传背景图响应 */
export interface AppBackgroundUploadResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { url: string; name: string };
  /** 提示信息 */
  message: string;
}

/** 保存背景响应（返回库内图片的站内短地址） */
export interface AppBackgroundSaveResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { url: string };
  /** 提示信息 */
  message: string;
}

/** 设置 / 清除背景响应 */
export interface AppBackgroundMutationResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: Record<string, unknown>;
  /** 提示信息 */
  message: string;
}
