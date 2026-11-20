import type {
  TemplateConfigResponse,
  TemplateContentResponse,
  TemplateSaveResult,
  TemplatePreviewResponse,
} from '@/types/template';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * 消息模板服务管理类
 * @description 封装消息模板相关的API接口，提供模板的查询、保存、预览和测试发送功能
 */
export class TemplateService extends BaseService {
  /**
   * 获取完整模板配置（从 .cache/message_templates.json 读取）
   * @returns {Promise<TemplateConfigResponse>} 完整配置
   * @description 拉取后端 .cache/message_templates.json 的全量模板配置，用于模板管理页初始化
   * @example
   * const service = new TemplateService();
   * const result = await service.fetchConfig();
   * console.log('模板配置:', result.templates);
   */
  fetchConfig = async (): Promise<TemplateConfigResponse> => {
    return this.get<TemplateConfigResponse>('/templates');
  };

  /**
   * 获取指定类型和风格的模板内容
   * @param {string} type - 消息类型（如 morning、lunch 等）
   * @param {string} style - 模板风格（如 default、brief、formal）
   * @returns {Promise<TemplateContentResponse>} 模板内容
   * @description 按消息类型与风格双维度读取单个模板的实际文本内容
   * @example
   * const service = new TemplateService();
   * const result = await service.fetchTemplate('morning', 'default');
   * console.log('模板内容:', result.content);
   */
  fetchTemplate = async (type: string, style: string): Promise<TemplateContentResponse> => {
    return this.get<TemplateContentResponse>(`/templates/${type}/${style}`);
  };

  /**
   * 保存模板内容
   * @param {string} type - 消息类型
   * @param {string} style - 模板风格
   * @param {string} template - 模板内容字符串
   * @returns {Promise<TemplateSaveResult>} 保存结果
   * @description 将指定类型和风格的模板文本持久化到后端配置文件
   * @example
   * const service = new TemplateService();
   * const result = await service.saveTemplate('morning', 'default', '早安，今天天气不错！');
   * console.log('保存结果:', result.success);
   */
  saveTemplate = async (type: string, style: string, template: string): Promise<TemplateSaveResult> => {
    return this.put<TemplateSaveResult>(`/templates/${type}/${style}`, { template });
  };

  /**
   * 预览模板渲染效果
   * @param {string} type - 消息类型
   * @param {string} style - 模板风格
   * @param {string} [template] - 自定义模板内容（可选，不传则从存储中读取）
   * @returns {Promise<TemplatePreviewResponse>} 预览结果
   * @description 调用后端模板引擎对指定模板（或外部传入的临时模板）进行变量填充，返回渲染后的预览文本
   * @example
   * const service = new TemplateService();
   * const result = await service.previewTemplate('morning', 'default');
   * console.log('预览内容:', result.content);
   */
  previewTemplate = async (
    type: string,
    style: string,
    template?: string,
  ): Promise<TemplatePreviewResponse> => {
    const body: Record<string, string> = { type, style };
    if (template) body.template = template;
    return this.post<TemplatePreviewResponse>(
      '/templates/preview',
      body,
    );
  };

}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建消息模板服务实例的工厂函数
 * @description 提供TemplateService类的实例，确保服务实例的一致性
 * @returns {TemplateService} 消息模板服务实例
 */
export const createTemplateService = (): TemplateService => {
  return new TemplateService();
};

/**
 * 默认导出的消息模板服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用createTemplateService工厂函数
 */
export default createTemplateService();
