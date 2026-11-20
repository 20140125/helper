import type {
  KnowledgeOverviewResponse,
  KnowledgeDocResponse,
  KnowledgeDocContentResponse,
  KnowledgeImportResponse,
  KnowledgeReindexResponse,
  KnowledgeSearchResponse,
  KnowledgeDirsResponse,
  KnowledgeDocFormData,
} from '@/types/knowledge';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * 知识库管理服务类
 * @description 封装知识库文档的增删改查、索引重建、检索测试与索引目录配置接口
 */
export class KnowledgeService extends BaseService {
  /**
   * 获取知识库概览
   * @returns {Promise<KnowledgeOverviewResponse>} 文档列表与索引目录配置
   * @description 一次性拉取管理页所需的全部初始数据
   */
  fetchOverview = async (): Promise<KnowledgeOverviewResponse> => {
    return this.get<KnowledgeOverviewResponse>('/knowledge');
  };

  /**
   * 读取知识文档正文
   * @param {string} docPath - 文档相对路径（系统文档与用户文档均可读）
   * @returns {Promise<KnowledgeDocContentResponse>} 文档正文响应
   * @description 编辑抽屉打开前读取完整正文，避免仅凭列表元信息回填
   */
  fetchDocContent = async (docPath: string): Promise<KnowledgeDocContentResponse> => {
    return this.get<KnowledgeDocContentResponse>(`/knowledge/docs/${encodeURIComponent(docPath)}`);
  };

  /**
   * 导入系统文档为用户文档副本
   * @param {string} docPath - 系统文档相对路径
   * @returns {Promise<KnowledgeImportResponse>} 导入后的用户文档
   * @description 原系统文档保持不变，仅复制内容到 knowledge/ 目录
   */
  importDoc = async (docPath: string): Promise<KnowledgeImportResponse> => {
    return this.post<KnowledgeImportResponse>(`/knowledge/docs/${encodeURIComponent(docPath)}/import`);
  };

  /**
   * 新建知识文档
   * @param {{ name: string; content: string }} payload - 文档名与 Markdown 正文
   * @returns {Promise<KnowledgeDocResponse>} 新建文档响应
   * @description 文档写入用户知识目录后自动触发索引失效
   */
  createDoc = async (payload: KnowledgeDocFormData): Promise<KnowledgeDocResponse> => {
    return this.post<KnowledgeDocResponse>('/knowledge/docs', payload);
  };

  /**
   * 更新用户知识文档
   * @param {string} docPath - 用户文档相对路径
   * @param {{ content: string }} payload - 新的 Markdown 正文
   * @returns {Promise<KnowledgeDocResponse>} 更新后的文档响应
   * @description 覆盖写入指定文档并触发索引失效；系统文档由后端拒绝修改
   */
  updateDoc = async (docPath: string, payload: { content: string }): Promise<KnowledgeDocResponse> => {
    return this.put<KnowledgeDocResponse>(`/knowledge/docs/${encodeURIComponent(docPath)}`, payload);
  };

  /**
   * 删除用户知识文档
   * @param {string} docPath - 用户文档相对路径
   * @returns {Promise<KnowledgeDocResponse>} 删除操作响应
   * @description 删除指定文档并触发索引失效；系统文档由后端拒绝删除
   */
  deleteDoc = async (docPath: string): Promise<KnowledgeDocResponse> => {
    return this.del<KnowledgeDocResponse>(`/knowledge/docs/${encodeURIComponent(docPath)}`);
  };

  /**
   * 重建知识索引
   * @returns {Promise<KnowledgeReindexResponse>} 索引片段数与来源文件数
   * @description 清空内存缓存后立即重新扫描所有索引目录
   */
  reindex = async (): Promise<KnowledgeReindexResponse> => {
    return this.post<KnowledgeReindexResponse>('/knowledge/reindex');
  };

  /**
   * 检索测试
   * @param {string} query - 检索关键词
   * @param {number} [topK] - 返回片段数，默认 3
   * @returns {Promise<KnowledgeSearchResponse>} 命中片段列表
   * @description 与贾维斯 query_knowledge 工具共用同一个检索函数，用于验证文档效果
   */
  search = async (query: string, topK: number = 3): Promise<KnowledgeSearchResponse> => {
    return this.post<KnowledgeSearchResponse>('/knowledge/search', { query, top_k: topK });
  };

  /**
   * 更新索引目录配置
   * @param {string[]} dirs - 相对项目根的目录列表
   * @returns {Promise<KnowledgeDirsResponse>} 更新后的配置
   * @description 写入配置后清空索引缓存，下次检索按新目录重新构建
   */
  updateDirs = async (dirs: string[]): Promise<KnowledgeDirsResponse> => {
    return this.put<KnowledgeDirsResponse>('/knowledge/dirs', { dirs });
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建知识库服务实例的工厂函数
 * @description 提供 KnowledgeService 类的实例，确保服务实例的一致性
 * @returns {KnowledgeService} 知识库服务实例
 */
export const createKnowledgeService = (): KnowledgeService => new KnowledgeService();

/**
 * 默认导出的知识库服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createKnowledgeService 工厂函数
 */
export default createKnowledgeService();
