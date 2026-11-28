// ==============================
// 高德地理编码缓存独立页相关类型
// @description 与后端 /api/amap-geocode 的响应结构保持一致
// ==============================

/** 一条地址坐标记录 */
export interface AmapGeocodeEntry {
  /** 地址文本 */
  address: string;
  /** 坐标「经度,纬度」 */
  coordinates: string;
  /** 更新时间（毫秒） */
  updatedAt: number;
}

/** 新增 / 更新请求体 */
export interface AmapGeocodeWritePayload {
  /** 地址文本 */
  address: string;
  /** 坐标「经度,纬度」 */
  coordinates: string;
  /** 编辑时的原地址；与新地址不同时执行重命名 */
  originalAddress?: string;
}

/** 列表响应 */
export interface AmapGeocodeListResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { items: AmapGeocodeEntry[] };
  /** 提示信息 */
  message: string;
}

/** 写入 / 删除响应 */
export interface AmapGeocodeMutationResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: Record<string, unknown>;
  /** 提示信息 */
  message: string;
}
