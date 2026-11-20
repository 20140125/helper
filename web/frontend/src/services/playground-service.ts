import type {
  TemplateItem,
  PlaygroundSaveResult,
  PlaygroundTemplatesResponse,
  PlaygroundTemplateResponse,
} from '@/types/playground';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * Playground 服务管理类
 * @description 封装 playground 模板相关的 API 接口，提供模板列表查询、字段保存、模板增删能力
 */
export class PlaygroundService extends BaseService {
  /**
   * 获取全部模板列表
   * @returns {Promise<PlaygroundTemplatesResponse>} 模板列表响应
   * @description 从服务端拉取 playground 中的全部模板条目
   * @example
   * const service = new PlaygroundService();
   * const result = await service.getTemplates();
   * console.log('模板列表:', result.templates);
   */
  getTemplates = async (): Promise<PlaygroundTemplatesResponse> => {
    return this.get<PlaygroundTemplatesResponse>('/playground');
  };

  /**
   * 按 id 获取单个模板
   * @param {string} id - 模板唯一标识
   * @returns {Promise<PlaygroundTemplateResponse>} 模板数据响应
   * @description 根据 ID 获取单个模板的完整数据
   * @example
   * const service = new PlaygroundService();
   * const result = await service.getTemplateById('template-123');
   * console.log('模板数据:', result.template);
   */
  getTemplateById = async (id: string): Promise<PlaygroundTemplateResponse> => {
    return this.get<PlaygroundTemplateResponse>(`/playground/${id}`);
  };

  /**
   * 保存模板 fields 到源文件
   * @param {string} id - 模板唯一标识
   * @param {string} fields - 合法的 JSON 数组字符串
   * @returns {Promise<PlaygroundSaveResult>} 保存结果
   * @description 将模板的 fields 字段持久化到后端源文件
   * @example
   * const service = new PlaygroundService();
   * const result = await service.saveTemplateFields('template-123', JSON.stringify(['field1', 'field2']));
   * console.log('保存结果:', result);
   */
  saveTemplateFields = async (id: string, fields: string): Promise<PlaygroundSaveResult> => {
    return this.put<PlaygroundSaveResult>(`/playground/${id}`, { fields });
  };

  /**
   * 向模板列表末尾新增一个模板
   * @param {Omit<TemplateItem, 'id'> & { id?: string }} template - 要新增的模板（id 可选，后端自动生成）
   * @returns {Promise<PlaygroundSaveResult>} 保存结果
   * @description 在模板列表末尾追加一个新模板条目
   * @example
   * const service = new PlaygroundService();
   * const result = await service.addTemplate({ name: '新模板', fields: [] });
   * console.log('添加结果:', result);
   */
  addTemplate = async (template: Omit<TemplateItem, 'id'> & { id?: string }): Promise<PlaygroundSaveResult> => {
    return this.post<PlaygroundSaveResult>('/playground', { template });
  };

  /**
   * 按 id 删除指定模板
   * @param {string} id - 模板唯一标识
   * @returns {Promise<PlaygroundSaveResult>} 删除结果
   * @description 根据 ID 删除指定模板条目
   * @example
   * const service = new PlaygroundService();
   * const result = await service.deleteTemplate('template-123');
   * console.log('删除结果:', result);
   */
  deleteTemplate = async (id: string): Promise<PlaygroundSaveResult> => {
    return this.del<PlaygroundSaveResult>(`/playground/${id}`);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建 Playground 服务实例的工厂函数
 * @description 提供 PlaygroundService 类的实例，确保服务实例的一致性
 * @returns {PlaygroundService} Playground 服务实例
 */
export const createPlaygroundService = (): PlaygroundService => new PlaygroundService();

/**
 * 默认导出的 Playground 服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createPlaygroundService 工厂函数
 */
export default createPlaygroundService();
