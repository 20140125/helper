import type {
  AiChatSkinPresetsResponse,
  AiChatSkinResponse,
  AiChatSkinSaveResponse,
  AiChatSkinSettings,
  AiChatSkinUploadResponse,
} from '@/types/ai-chat-skin';
import { BaseService } from './base-service';

/**
 * 贾维斯皮肤配置服务类
 * @description 封装按登录用户读写皮肤配置、读取数据库预设定义、上传自定义背景图的接口
 */
export class AiChatSkinService extends BaseService {
  /**
   * 读取当前用户皮肤配置
   * @returns {Promise<AiChatSkinResponse>} 皮肤配置响应
   * @description 服务端按 JWT 用户邮箱查询 hp_ai_chat_skins，无记录时返回默认皮肤
   */
  fetchSkin = async (): Promise<AiChatSkinResponse> => {
    return this.get<AiChatSkinResponse>('/ai-chat/skin');
  };

  /**
   * 保存当前用户皮肤配置
   * @param {AiChatSkinSettings} settings - 待保存的皮肤配置
   * @returns {Promise<AiChatSkinSaveResponse>} 保存后的皮肤配置响应
   * @description 服务端按用户 UPSERT 到 hp_ai_chat_skins，预设 ID 查库校验，背景图本体直接入库
   */
  saveSkin = async (settings: AiChatSkinSettings): Promise<AiChatSkinSaveResponse> => {
    return this.put<AiChatSkinSaveResponse>('/ai-chat/skin', settings);
  };

  /**
   * 读取已启用的内置皮肤预设
   * @returns {Promise<AiChatSkinPresetsResponse>} 预设定义列表响应
   * @description 预设以 hp_ai_chat_skin_presets 为真源，后台可增删改而不用改前端代码
   */
  fetchPresets = async (): Promise<AiChatSkinPresetsResponse> => {
    return this.get<AiChatSkinPresetsResponse>('/ai-chat/skin/presets');
  };

  /**
   * 上传自定义背景图
   * @param {File} file - 用户选择的图片文件
   * @returns {Promise<AiChatSkinUploadResponse>} 上传结果（含图片本体 data URL）
   * @description 以 multipart/form-data 上传，交给 axios 自动设置带 boundary 的请求头
   */
  uploadBackground = async (file: File): Promise<AiChatSkinUploadResponse> => {
    const form = new FormData();
    form.append('file', file);
    return this.post<AiChatSkinUploadResponse>('/ai-chat/skin/background', form);
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建贾维斯皮肤配置服务实例的工厂函数
 * @description 提供 AiChatSkinService 类的实例，确保服务实例的一致性
 * @returns {AiChatSkinService} 皮肤配置服务实例
 */
export const createAiChatSkinService = (): AiChatSkinService => new AiChatSkinService();

/**
 * 默认导出的贾维斯皮肤配置服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createAiChatSkinService 工厂函数
 */
export default createAiChatSkinService();
