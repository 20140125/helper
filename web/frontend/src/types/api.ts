/**
 * 通用 API 响应类型
 * @description 所有后端接口统一返回 { code, data, message } 结构，
 *              通过泛型参数 T 指定 data 的具体类型
 * @template T - data 字段的类型，默认为 Record<string, never>（无数据返回）
 */
export interface ApiResponse<T = Record<string, never>> {
  /** 响应状态码（0 = 成功） */
  code: number;
  /** 响应数据 */
  data: T;
  /** 提示信息 */
  message: string;
}