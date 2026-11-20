import type { ApiResponse } from './api';

/**
 * 模板占位符映射类型
 * @description 键为占位符名称，值为占位符描述
 */
export type TemplatePlaceholders = Record<string, string>;

/**
 * 模板内容类型
 * @description 描述从服务端获取的模板内容结构
 */
export interface TemplateContent {
  /** 模板字符串内容 */
  template: string;
}

/**
 * 模板预览结果类型
 * @description 描述模板预览接口返回的数据结构
 */
export interface TemplatePreviewResult {
  /** 渲染后的预览内容 */
  preview: string;
  /** 未被替换的占位符列表 */
  unresolved: string[];
  /** 技能类配图已按「每条数据配自己的图」内联在 preview 正文中，不再单独返回 */
}

/**
 * 消息类型选项
 * @description 描述消息类型下拉选项的数据结构
 */
export interface MessageTypeOption {
  /** 选项值 */
  value: string;
  /** 显示标签 */
  label: string;
}

/**
 * 模板风格元数据
 * @description 描述 message_templates.json 中 styles 字段的单个风格配置
 */
export interface TemplateStyleMeta {
  /** 风格显示名称 */
  name: string;
  /** 风格描述 */
  description: string;
  /** 适用场景 */
  target: string;
}

/**
 * 完整模板配置
 * @description 描述 message_templates.json 的完整结构
 */
export interface TemplateConfig {
  /** 模板内容，key 为消息类型，value 为各风格模板字符串 */
  templates: Record<string, Record<string, string>>;
  /** 占位符说明 */
  placeholders: TemplatePlaceholders;
  /** 风格元数据，key 为风格 key */
  styles: Record<string, TemplateStyleMeta>;
  /** 模板类型 key → 中文名称映射 */
  template_names: Record<string, string>;
}

/**
 * file-content 组件暴露的实例接口
 * @description 用于通过 ref 调用 file-content 组件的方法
 */
export interface FileContentInstance {
  /** 获取编辑器当前内容 */
  getContent: () => string;
  /** 重新初始化编辑器（切换文件后调用） */
  resetEditor: (text: string) => Promise<void>;
}

// ==============================
// API 响应类型
// ==============================

/**
 * 获取完整模板配置响应
 */
export type TemplateConfigResponse = ApiResponse<TemplateConfig>;

/**
 * 获取指定类型和风格的模板内容响应
 */
export type TemplateContentResponse = ApiResponse<TemplateContent>;

/**
 * 保存模板结果响应
 */
export type TemplateSaveResult = ApiResponse;

/**
 * 模板预览结果响应
 */
export type TemplatePreviewResponse = ApiResponse<TemplatePreviewResult>;
