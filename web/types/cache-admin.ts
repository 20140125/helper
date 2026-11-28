// ==============================
// 缓存数据管理（hp_cache_* 表）相关类型与常量
// @description 管理端按表检索、读取、写入与删除缓存行
// ==============================

/** 缓存行的时间粒度 */
export type CacheAdminPeriod = 'day' | 'month' | 'year' | 'static';

/** 列表默认每页条数 */
export const CACHE_ADMIN_PAGE_SIZE = 20;

/** 列表每页上限 */
export const CACHE_ADMIN_MAX_PAGE_SIZE = 100;

/** 单条缓存正文上限（字符） */
export const CACHE_ADMIN_BODY_MAX_LENGTH = 2_000_000;

/** 使用 section / row_key / data 展平存储的表（高德地理编码表已独立成页） */
export const CACHE_ADMIN_FLAT_TABLES = ['hp_cache_dailyword_library'] as const;

/** 一张可管理的缓存表 */
export interface CacheAdminTable {
  /** 表名 */
  name: string;
  /** 存储形态：flat=展平行，res=分类表 */
  kind: 'flat' | 'res';
  /** 中文说明 */
  comment: string;
  /** 该表的时间粒度约定 */
  granularity: string;
}

/** 列表中的一条缓存记录 */
export interface CacheAdminEntry {
  /** 所属表名 */
  table: string;
  /** 展平表的 section，分类表为空串 */
  section: string;
  /** 缓存键（asset_key / row_key） */
  entryKey: string;
  /** 正文预览（截断） */
  preview: string;
  /** 正文字节数 */
  size: number;
  /** 时间粒度 */
  periodType: CacheAdminPeriod;
  /** 粒度日期：YYYY-MM-DD / YYYY-MM / YYYY，静态为空 */
  periodKey: string;
  /** 更新时间（毫秒） */
  updatedAt: number;
}

/** 缓存列表结果 */
export interface CacheAdminList {
  /** 当前页记录 */
  items: CacheAdminEntry[];
  /** 过滤后的总条数 */
  total: number;
  /** 可筛选的表清单 */
  tables: CacheAdminTable[];
}

/** 列表查询参数 */
export interface CacheAdminQuery {
  /** 表名，空表示全部 */
  table?: string;
  /** 时间粒度，空表示全部 */
  periodType?: string;
  /** 键名 / section / 正文关键字 */
  keyword?: string;
  /** 每页条数 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

/** 单条缓存详情 */
export interface CacheAdminDetail {
  /** 所属表名 */
  table: string;
  /** 展平表的 section，分类表为空串 */
  section: string;
  /** 缓存键 */
  entryKey: string;
  /** 正文全文 */
  body: string;
  /** 时间粒度 */
  periodType: CacheAdminPeriod;
  /** 粒度日期 */
  periodKey: string;
  /** 更新时间（毫秒） */
  updatedAt: number;
}

/** 新增 / 更新缓存行的请求体 */
export interface CacheAdminWriteBody {
  /** 目标表名 */
  table: string;
  /** 展平表的 section */
  section?: string;
  /** 缓存键 */
  key: string;
  /** 正文全文 */
  body: string;
}
