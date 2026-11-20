import { CACHE_DIR } from '@/utils/paths';

/** 接口分类数据文件路径 */
export const API_CATEGORIES_FILE = `${CACHE_DIR}/api_categories.json`;

/** API 条目数据文件路径 */
export const API_ITEMS_FILE = `${CACHE_DIR}/api_items.json`;


/** 代理请求超时时间（毫秒） */
export const PROXY_TIMEOUT_MS = 30000;

/**
 * 接口分类
 */
export interface ApiCategory {
  category_key: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

/**
 * API 条目
 */
export interface ApiItem {
  item_key: string;
  category_id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ── 请求体类型 ──

export interface CreateApiCategoryBody {
  name: string;
  category_key?: string;
  description?: string;
}

export interface UpdateApiCategoryBody {
  name?: string;
  description?: string;
  category_key?: string;
}

export interface CreateApiItemBody {
  category_id: string;
  name: string;
  method: ApiItem['method'];
  path: string;
  description?: string;
  enabled?: boolean;
  item_key: string;
}

export interface UpdateApiItemBody {
  category_id?: string;
  name?: string;
  method?: ApiItem['method'];
  path?: string;
  description?: string;
  enabled?: boolean;
}

// ── 代理执行（/execute） ──

export interface ExecuteApiBody {
  url: string;
  method: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: string;
}

export interface ExecuteApiResult {
  status: number;
  statusText: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  duration: number;
}

/** 代理请求失败结果 */
export interface ProxyError {
  error: string;
}
