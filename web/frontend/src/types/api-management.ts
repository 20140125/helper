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


/**
 * API 分组
 */
export interface ApiGroup {
  category_id: string;
  categoryName: string;
  items: ApiItem[];
}

// ── 响应类型 ──

export interface ApiCategoryListResponse {
  code: number;
  data: {
    categories: ApiCategory[];
  };
  message: string;
}

export interface ApiCategoryResponse {
  code: number;
  data: {
    category?: ApiCategory;
  };
  message: string;
}

export interface ApiItemListResponse {
  code: number;
  data: {
    items: ApiItem[];
  };
  message: string;
}

export interface ApiItemResponse {
  code: number;
  data: {
    item?: ApiItem;
  };
  message: string;
}

// ── API 执行类型 ──

/** API 执行请求参数 */
export interface ApiExecuteRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: string;
}

/** API 执行响应结果 */
export interface ApiExecuteResult {
  status: number;
  statusText: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  duration: number;
}

export interface ApiExecuteResponse {
  code: number;
  data: ApiExecuteResult;
  message: string;
}

/** 请求头条目（用于表单编辑） */
export interface HeaderEntry {
  key: string;
  value: string;
  enabled: boolean;
}

/**
 * API 条目表单数据类型
 * @description 用于 API 条目管理抽屉（新增/编辑）的 v-model 绑定值
 */
export type IApiItemFormData = Partial<ApiItem>;

/**
 * API 分类表单数据类型
 * @description 用于 API 分类管理抽屉（新增/编辑）的 v-model 绑定值
 */
export type IApiCategoryFormData = Partial<ApiCategory>;

