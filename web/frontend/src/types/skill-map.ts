import type { ApiResponse } from './api';

// ==============================
// 基础结构（与后端 SkillItem 对齐）
// ==============================

/** 技能脚本入参元信息（与后端 SkillParamMeta 对齐） */
export interface SkillParamMeta {
  /** 字段名（仅前端表单 key 用，不会拼到命令行） */
  name: string;
  /** 字段标签 */
  label: string;
  /** 控件类型 */
  type: string;
  /** 占位提示 */
  placeholder?: string;
  /** select 选项 */
  options?: Array<{ value: string; label: string }>;
  /** 是否必填 */
  required?: boolean;
  /** 默认值 */
  defaultValue?: string;
}

/** 技能条目 */
export interface SkillItem {
  /** 唯一键（= 脚本文件名去 .sh，同时作为 locale 索引键） */
  key: string;
  /** 展示用图标（emoji） */
  icon: string;
  /** 分组名（中文展示用） */
  category: string;
  /** 脚本文件名（相对 scripts/tools/，含 .sh） */
  script: string;
  /** 脚本默认参数（按位顺序，前端可通过 params 覆盖） */
  args: string[];
  /** 该脚本是否会输出 PNG 卡片 */
  hasCard: boolean;
  /** 卡片主题色（hex） */
  accent: string;
  /** 可配置的脚本入参（按位顺序对应命令行参数；为空表示不需要传参） */
  params?: SkillParamMeta[];
}

/** 分组元信息 */
export interface SkillCategoryMeta {
  /** 分组名 */
  name: string;
  /** 分组圆点颜色 */
  dotColor: string;
}

// ==============================
// 接口响应
// ==============================

/** GET /api/skill-map 响应 */
export type SkillMapListResponse = ApiResponse<{
  skills: SkillItem[];
  categories: SkillCategoryMeta[];
}>;

/** 常用地点（后端地理编码缓存） */
export interface AmapRecentPlace {
  /** 地点名 */
  name: string;
  /** 坐标 "经度,纬度" */
  location: string;
}

/** 高德地图 JS API 前端配置 */
export interface AmapJsConfig {
  /** 是否已配置 JS Key（false 时地图选点不可用，降级为文本输入） */
  configured: boolean;
  /** 高德 JS API Key（Web 端类型） */
  jsKey: string;
  /** JS API 安全密钥 */
  securityCode: string;
  /** 地图默认城市 */
  city: string;
  /** 常用地点候选 */
  recentPlaces: AmapRecentPlace[];
}

/** GET /api/skill-map/amap-config 响应 */
export type SkillMapAmapConfigResponse = ApiResponse<AmapJsConfig>;
