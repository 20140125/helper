import { BaseService } from './base-service';
import type {
  SkillMapListResponse,
  SkillMapAmapConfigResponse,
} from '@/types/skill-map';

// ==============================
// Service 类
// ==============================

/**
 * 技能地图服务管理类
 * @description 封装前端仍需要的 /api/skill-map 接口：
 *   - 技能清单：贾维斯「指定技能」选择器用（技能执行本身由后端 card_skill 工具完成，不再有前端页面）
 *   - 高德 JS 配置：配置页「家/公司地址」地图选点用
 */
export class SkillMapService extends BaseService {
  /**
   * 获取技能清单 + 分组元信息
   * @returns {Promise<SkillMapListResponse>} 技能列表响应
   * @description 拉取后端注册的技能集合及分组元数据，用于渲染技能地图页面
   * @example
   * const service = new SkillMapService();
   * const result = await service.fetchSkills();
   * console.log('技能分组:', result.groups);
   */
  fetchSkills = async (): Promise<SkillMapListResponse> => {
    return this.get<SkillMapListResponse>('/skill-map');
  };

  /**
   * 获取高德地图 JS API 配置
   * @returns {Promise<SkillMapAmapConfigResponse>} 地图配置响应（含常用地点）
   * @description 供地图选点组件初始化高德 SDK；configured=false 表示未配置 JS Key，应降级为文本输入
   * @example
   * const service = new SkillMapService();
   * const { configured, city } = await service.fetchAmapConfig();
   */
  fetchAmapConfig = async (): Promise<SkillMapAmapConfigResponse> => {
    return this.get<SkillMapAmapConfigResponse>('/skill-map/amap-config');
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建技能地图服务实例的工厂函数
 * @description 提供 SkillMapService 类的实例，确保服务实例的一致性
 * @returns {SkillMapService} 技能地图服务实例
 */
export const createSkillMapService = (): SkillMapService => new SkillMapService();

/**
 * 默认导出的技能地图服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createSkillMapService 工厂函数
 */
export default createSkillMapService();
