import type { CacheAdminPeriod } from '@/types/cache-admin';

/** 列表每页条数（与后端 CACHE_ADMIN_PAGE_SIZE 对齐） */
export const CACHE_ADMIN_PAGE_SIZE = 20;

/** 展平表名（section / row_key / data 结构；高德地理编码表已独立成页） */
export const CACHE_ADMIN_FLAT_TABLES: string[] = ['hp_cache_dailyword_library'];

/** 可筛选的时间粒度 */
export const CACHE_ADMIN_PERIODS: CacheAdminPeriod[] = ['day', 'month', 'year', 'static'];
