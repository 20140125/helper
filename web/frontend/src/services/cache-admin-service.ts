import { BaseService } from './base-service';
import type {
  CacheAdminDetailResponse,
  CacheAdminEntriesResponse,
  CacheAdminEntryKey,
  CacheAdminMutationResponse,
  CacheAdminQuery,
  CacheAdminTablesResponse,
  CacheAdminWritePayload,
} from '@/types/cache-admin';

// ==============================
// Service 类
// ==============================

/**
 * 缓存数据管理服务类
 * @description 封装 13 张 hp_cache_* 表的表清单、分页检索与单条读写删除接口
 */
export class CacheAdminService extends BaseService {
  /**
   * 读取可管理的缓存表清单
   * @returns {Promise<CacheAdminTablesResponse>} 1 张展平表 + 12 张分类表
   * @description 表清单也随列表接口返回，此接口供独立调用
   */
  fetchTables = (): Promise<CacheAdminTablesResponse> =>
    this.get<CacheAdminTablesResponse>('/cache-admin/tables');

  /**
   * 分页检索缓存行
   * @param {CacheAdminQuery} query - 表、粒度、关键字与分页参数
   * @returns {Promise<CacheAdminEntriesResponse>} 当前页记录、总数与表清单
   * @description 表名与粒度由后端白名单校验，关键字同时匹配键名 / section / 正文
   */
  fetchEntries = (query: CacheAdminQuery): Promise<CacheAdminEntriesResponse> =>
    this.get<CacheAdminEntriesResponse>('/cache-admin/entries', { params: query });

  /**
   * 读取单条缓存行全文
   * @param {CacheAdminEntryKey} key - 表名、section 与缓存键
   * @returns {Promise<CacheAdminDetailResponse>} 缓存行详情
   * @description 列表只返回正文预览，编辑前需按定位参数取全文
   */
  fetchEntry = (key: CacheAdminEntryKey): Promise<CacheAdminDetailResponse> =>
    this.get<CacheAdminDetailResponse>('/cache-admin/entry', { params: key });

  /**
   * 新增或更新一条缓存行
   * @param {CacheAdminWritePayload} payload - 目标表、键与正文
   * @returns {Promise<CacheAdminMutationResponse>} 保存结果
   * @description 分类表写入时后端按路由声明重算 period_type / period_key
   */
  saveEntry = (payload: CacheAdminWritePayload): Promise<CacheAdminMutationResponse> =>
    this.put<CacheAdminMutationResponse>('/cache-admin/entry', payload);

  /**
   * 删除一条缓存行
   * @param {CacheAdminEntryKey} key - 表名、section 与缓存键
   * @returns {Promise<CacheAdminMutationResponse>} 删除结果
   * @description 直接删除数据库行，展平表的单条删除可能被下次整表同步覆盖
   */
  deleteEntry = (key: CacheAdminEntryKey): Promise<CacheAdminMutationResponse> =>
    this.del<CacheAdminMutationResponse>('/cache-admin/entry', { params: key });
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建缓存数据管理服务实例的工厂函数
 * @description 提供 CacheAdminService 类的实例，确保服务实例的一致性
 * @returns {CacheAdminService} 缓存数据管理服务实例
 */
export const createCacheAdminService = (): CacheAdminService => new CacheAdminService();

/**
 * 默认导出的缓存数据管理服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createCacheAdminService 工厂函数
 */
export default createCacheAdminService();
