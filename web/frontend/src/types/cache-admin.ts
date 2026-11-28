// ==============================
// 缓存数据管理页相关类型
// @description 与后端 /api/cache-admin 的响应结构保持一致
// ==============================

/** 缓存行的时间粒度 */
export type CacheAdminPeriod = 'day' | 'month' | 'year' | 'static';

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
  /** 缓存键 */
  entryKey: string;
  /** 正文预览 */
  preview: string;
  /** 正文字节数 */
  size: number;
  /** 时间粒度 */
  periodType: CacheAdminPeriod;
  /** 粒度日期 */
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
  /** 表名 */
  table?: string;
  /** 时间粒度 */
  periodType?: string;
  /** 关键字 */
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
  /** 展平表的 section */
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

/** 单条定位参数 */
export interface CacheAdminEntryKey {
  /** 表名 */
  table: string;
  /** 展平表的 section */
  section: string;
  /** 缓存键 */
  key: string;
}

/** 新增 / 更新缓存行请求体 */
export interface CacheAdminWritePayload extends CacheAdminEntryKey {
  /** 正文全文 */
  body: string;
}

/** 表清单响应 */
export interface CacheAdminTablesResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { tables: CacheAdminTable[] };
  /** 提示信息 */
  message: string;
}

/** 列表响应 */
export interface CacheAdminEntriesResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { result: CacheAdminList };
  /** 提示信息 */
  message: string;
}

/** 详情响应 */
export interface CacheAdminDetailResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { result: CacheAdminDetail };
  /** 提示信息 */
  message: string;
}

/** 写入 / 删除响应 */
export interface CacheAdminMutationResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: Record<string, unknown>;
  /** 提示信息 */
  message: string;
}
