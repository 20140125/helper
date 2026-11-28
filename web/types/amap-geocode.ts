// ==============================
// 高德地理编码缓存（hp_cache_amap_geocode）相关类型与常量
// @description 独立管理页按「地址 → 经纬度」读写展平表，与运行时缓存键 amap_geocode.json 共用同一张表
// ==============================

/** 地址文本最大长度（与 hp_cache_amap_geocode.section VARCHAR(64) 对齐） */
export const AMAP_GEOCODE_ADDRESS_MAX_LENGTH = 64;

/** 坐标格式：经度,纬度 */
export const AMAP_GEOCODE_COORD_PATTERN = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/;

/** 一条地理编码缓存记录 */
export interface AmapGeocodeEntry {
  /** 地址文本（section） */
  address: string;
  /** 坐标「经度,纬度」（data） */
  coordinates: string;
  /** 更新时间（毫秒） */
  updatedAt: number;
}

/** 写入请求体 */
export interface AmapGeocodeWriteBody {
  /** 地址文本 */
  address: string;
  /** 坐标「经度,纬度」 */
  coordinates: string;
  /** 编辑时的原地址；与新地址不同时执行重命名 */
  originalAddress?: string;
}
