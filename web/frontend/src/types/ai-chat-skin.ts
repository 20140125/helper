import type { ApiResponse } from './api';

// ──────────────────────────
// 贾维斯 AI 助手皮肤配置（数据库真源）
// ──────────────────────────

/** 皮肤预设 ID（对应 hp_ai_chat_skin_presets.skin_key，可由后台新增） */
export type AiChatSkinId = string;

/** 用户皮肤配置 */
export interface AiChatSkinSettings {
  /** 当前皮肤预设 ID */
  skinId: AiChatSkinId;
  /** 自定义背景图本体（data:image/...;base64,...，空串表示未设置） */
  backgroundUrl: string;
}

/** 内置皮肤预设定义（hp_ai_chat_skin_presets 一行） */
export interface AiChatSkinPreset {
  /** 皮肤 ID */
  skinKey: string;
  /** 中文名称 */
  labelZh: string;
  /** 英文名称 */
  labelEn: string;
  /** 选择面板缩略图（CSS background-image 值） */
  swatch: string;
  /** 聊天窗口背景（CSS background-image 值） */
  bgImage: string;
  /** 抽屉内局部 CSS 变量覆盖 */
  vars: Record<string, string>;
  /** 展示顺序 */
  sortOrder: number;
  /** 是否启用 */
  enabled: boolean;
}

/** 读取皮肤配置响应 */
export type AiChatSkinResponse = ApiResponse<{ skin: AiChatSkinSettings }>;

/** 保存皮肤配置响应 */
export type AiChatSkinSaveResponse = ApiResponse<{ skin: AiChatSkinSettings }>;

/** 上传自定义背景图响应（url 为图片本体 data URL） */
export type AiChatSkinUploadResponse = ApiResponse<{ url: string; name: string }>;

/** 读取皮肤预设列表响应 */
export type AiChatSkinPresetsResponse = ApiResponse<{ presets: AiChatSkinPreset[] }>;
