import type { ApiCategory, ApiItem, ApiExecuteResult, HeaderEntry } from '@/types/api-management';
import { AUTH_STORAGE_KEY } from '@/constants/auth';

/**
 * 规范化执行 URL
 * @description 未填域名时自动补全当前页面 origin
 */
export const normalizeExecuteUrl = (rawUrl: string): string => {
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  const prefix = rawUrl.startsWith('/') ? '' : '/';
  return `${window.location.origin}${prefix}${rawUrl}`;
};

/**
 * 将已启用的 HeaderEntry 列表转换为键值对象
 * @description 过滤掉 disabled 与空 key，供 headers/params 共用
 */
export const pickEnabledEntries = (entries: HeaderEntry[]): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    if (!entry.enabled) continue;
    const key = entry.key.trim();
    if (!key) continue;
    result[key] = entry.value;
  }
  return result;
};

/** 构造打开执行抽屉时的默认请求头列表（附带 Authorization） */
export const buildDefaultHeaders = (): HeaderEntry[] => {
  const token = localStorage.getItem(AUTH_STORAGE_KEY) ?? '';
  return [
    { key: 'Authorization', value: token ? `Bearer ${token}` : '', enabled: true },
    { key: '', value: '', enabled: true },
  ];
};

/** 尝试美化 JSON 字符串，失败时原样返回 */
export const formatJson = (text: string): string => {
  if (!text) return '';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

/**
 * 根据响应头 content-type 与响应体推断 file-content 的展示文件名
 * @description 非空 JSON → response.json（走编辑器高亮）；其他 → response.txt（走纯文本）；
 *              空 body 仍返回 response.txt 让下游展示「内容为空」空态
 */
export const pickResponseFilename = (result: ApiExecuteResult | null): string => {
  if (!result) return '';
  const headers = result.headers ?? {};
  const contentTypeRaw = headers['content-type'] ?? headers['Content-Type'] ?? '';
  const contentType = Array.isArray(contentTypeRaw) ? contentTypeRaw.join(';') : String(contentTypeRaw);
  return contentType.toLowerCase().includes('json') ? 'response.json' : 'response.txt';
};

/**
 * HTTP method → item_key 语义后缀映射
 * @description 贴合历史命名习惯：POST→create / PUT→update / DELETE→delete / PATCH→patch；
 *              GET 使用 get 作为默认后缀（根资源的 list 语义请用户在手动编辑时覆盖）
 */
const METHOD_SUFFIX_MAP: Record<string, string> = {
  GET: 'get',
  POST: 'create',
  PUT: 'update',
  DELETE: 'delete',
  PATCH: 'patch',
};

/**
 * 根据 HTTP method + 请求路径生成 item_key
 * @description 规则：
 *  1. 忽略 path 中的占位段（:param / {param}）
 *  2. 去掉 `/api/` 前缀，保留业务段
 *  3. `-` 转 `_`，多 `_` 合并，去首尾 `_`
 *  4. 拼接 `api_<segs>_<methodSuffix>`，methodSuffix 见 {@link METHOD_SUFFIX_MAP}
 * @example buildItemKey('GET',  '/api/system')          → 'api_system_get'
 * @example buildItemKey('POST', '/api/auth/send-code')  → 'api_auth_send_code_create'
 * @example buildItemKey('PUT',  '/api/rules/:id')       → 'api_rules_update'
 * @example buildItemKey('DELETE','/api/rbac/roles/:id') → 'api_rbac_roles_delete'
 */
export const buildItemKey = (method: string, path: string): string => {
  const normalizedMethod = (method || '').trim().toUpperCase();
  if (!normalizedMethod || !path) return '';

  // 按 / 切段；过滤占位段（:xxx / {xxx}）与空段；`-` 转 `_`
  const segs = path
    .split('/')
    .map((seg) => seg.trim())
    .filter((seg) => seg && !seg.startsWith(':') && !(seg.startsWith('{') && seg.endsWith('}')))
    .filter((seg) => seg.toLowerCase() !== 'api') // 去掉 /api/ 前缀
    .map((seg) => seg.replace(/-/g, '_'));

  const suffix = METHOD_SUFFIX_MAP[normalizedMethod] ?? normalizedMethod.toLowerCase();

  return ['api', ...segs, suffix]
    .join('_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

/** `category_key` 合法格式校验：以 `cat_` 开头 + 小写字母/数字/下划线，最多 64 字符 */
export const CATEGORY_KEY_PATTERN = /^cat_[a-z][a-z0-9_]*$/;

/**
 * 根据分类名称派生 `category_key`
 * @description 规则：
 *  1. 只保留 ASCII 字母/数字/空格/连字符/下划线
 *  2. 统一小写，空格 / 连字符 → 下划线，多下划线合并，去首尾下划线
 *  3. 若清洗结果为空（如纯中文名称）→ 回退 `cat_<timestamp>`
 *  4. 否则拼接 `cat_<cleaned>`，并裁剪到 64 字符内
 * @example buildCategoryKey('System')       → 'cat_system'
 * @example buildCategoryKey('Web Service')  → 'cat_web_service'
 * @example buildCategoryKey('接口管理')      → 'cat_<timestamp>'
 */
export const buildCategoryKey = (name: string): string => {
  const cleaned = (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) return `cat_${Date.now()}`;
  return `cat_${cleaned}`.slice(0, 64);
};

/** API 条目按分类分组（含未分类兜底），只保留非空组 */
export const groupItemsByCategory = (
  items: ApiItem[],
  categories: ApiCategory[],
  uncategorizedLabel: string,
): Array<{ category_id: string; categoryName: string; items: ApiItem[] }> => {
  const categoryMap = new Map<string, { categoryName: string; items: ApiItem[] }>();
  for (const cat of categories) {
    categoryMap.set(cat.category_key, { categoryName: cat.name, items: [] });
  }
  const uncategorized: ApiItem[] = [];
  for (const item of items) {
    const group = categoryMap.get(item.category_id);
    if (group) {
      group.items.push(item);
    } else {
      uncategorized.push(item);
    }
  }
  const result: Array<{ category_id: string; categoryName: string; items: ApiItem[] }> = [];
  for (const [category_id, group] of categoryMap) {
    if (group.items.length > 0) result.push({ category_id, ...group });
  }
  if (uncategorized.length > 0) {
    result.push({ category_id: '__uncategorized__', categoryName: uncategorizedLabel, items: uncategorized });
  }
  return result;
};
