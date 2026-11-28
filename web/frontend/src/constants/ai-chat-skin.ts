import type { AiChatSkinPreset, AiChatSkinSettings } from '@/types/ai-chat-skin';

/** 默认皮肤配置：跟随站点主题、无自定义背景 */
export const DEFAULT_AI_CHAT_SKIN_SETTINGS: AiChatSkinSettings = {
  skinId: 'default',
  backgroundUrl: '',
};

/** 自定义背景图大小上限（字节，与后端 AI_CHAT_SKIN_MAX_IMAGE_SIZE 一致） */
export const AI_CHAT_SKIN_MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** data URL 字符串上限（与后端 AI_CHAT_SKIN_MAX_DATA_URL_CHARS 一致） */
export const AI_CHAT_SKIN_MAX_DATA_URL_CHARS = 7 * 1024 * 1024;

/** 允许上传的图片 MIME 类型 */
export const AI_CHAT_SKIN_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/**
 * 自定义背景图的局部配色
 * @description 背景图上叠一层暗色渐变，文字统一用浅色系，保证任意图片下都可读
 */
export const AI_CHAT_SKIN_CUSTOM_VARS: Record<string, string> = {
  '--bg-card': '#101827',
  '--bg-secondary': 'rgba(15, 23, 42, 0.72)',
  '--bg-tertiary': 'rgba(15, 23, 42, 0.68)',
  '--bg-hover': 'rgba(255, 255, 255, 0.12)',
  '--border-color': 'rgba(255, 255, 255, 0.24)',
  '--text-primary': '#f8fafc',
  '--text-secondary': '#e2e8f0',
  '--text-muted': '#cbd5e1',
  '--accent-primary': '#60a5fa',
  '--accent-primary-rgb': '96, 165, 250',
  '--accent-primary-bg': 'rgba(96, 165, 250, 0.22)',
  '--accent-green': '#34d399',
};

/**
 * 内置预设兜底
 * @description 数据库不可用或预设接口失败时使用；正常情况以 hp_ai_chat_skin_presets 为真源
 */
export const AI_CHAT_SKIN_PRESETS: AiChatSkinPreset[] = [
  {
    skinKey: 'default', labelZh: '经典', labelEn: 'Classic',
    swatch: 'linear-gradient(135deg, #1c2333, #6366f1)',
    bgImage: '', vars: {}, sortOrder: 1, enabled: true,
  },
  {
    skinKey: 'aurora', labelZh: '极光', labelEn: 'Aurora',
    swatch: 'linear-gradient(135deg, #4c1d95, #a78bfa)',
    bgImage: 'linear-gradient(160deg, rgba(76, 29, 149, 0.38), rgba(30, 27, 75, 0.08) 48%, rgba(124, 58, 237, 0.3))',
    vars: {
      '--bg-card': '#1b1636',
      '--bg-secondary': '#251d47',
      '--bg-tertiary': 'rgba(167, 139, 250, 0.14)',
      '--bg-hover': 'rgba(167, 139, 250, 0.12)',
      '--border-color': '#3c3268',
      '--text-primary': '#f4f0ff',
      '--text-secondary': '#c4b5fd',
      '--text-muted': '#9486c4',
      '--accent-primary': '#a78bfa',
      '--accent-primary-rgb': '167, 139, 250',
      '--accent-primary-bg': 'rgba(167, 139, 250, 0.18)',
      '--accent-green': '#c4b5fd',
    },
    sortOrder: 2, enabled: true,
  },
  {
    skinKey: 'ocean', labelZh: '深海', labelEn: 'Ocean',
    swatch: 'linear-gradient(135deg, #0c4a6e, #38bdf8)',
    bgImage: 'linear-gradient(160deg, rgba(12, 74, 110, 0.42), rgba(8, 47, 73, 0.08) 48%, rgba(14, 165, 233, 0.3))',
    vars: {
      '--bg-card': '#0b2436',
      '--bg-secondary': '#10334b',
      '--bg-tertiary': 'rgba(56, 189, 248, 0.13)',
      '--bg-hover': 'rgba(56, 189, 248, 0.12)',
      '--border-color': '#1d4c6b',
      '--text-primary': '#eaf7ff',
      '--text-secondary': '#a5d8f3',
      '--text-muted': '#76a9c4',
      '--accent-primary': '#38bdf8',
      '--accent-primary-rgb': '56, 189, 248',
      '--accent-primary-bg': 'rgba(56, 189, 248, 0.18)',
      '--accent-green': '#5eead4',
    },
    sortOrder: 3, enabled: true,
  },
  {
    skinKey: 'sunset', labelZh: '暮光', labelEn: 'Sunset',
    swatch: 'linear-gradient(135deg, #7c2d12, #fb923c)',
    bgImage: 'linear-gradient(160deg, rgba(124, 45, 18, 0.4), rgba(67, 20, 38, 0.08) 48%, rgba(251, 146, 60, 0.28))',
    vars: {
      '--bg-card': '#2b1a1e',
      '--bg-secondary': '#3a2327',
      '--bg-tertiary': 'rgba(251, 146, 60, 0.14)',
      '--bg-hover': 'rgba(251, 146, 60, 0.12)',
      '--border-color': '#654036',
      '--text-primary': '#fff4ea',
      '--text-secondary': '#f5c6a5',
      '--text-muted': '#c49b81',
      '--accent-primary': '#fb923c',
      '--accent-primary-rgb': '251, 146, 60',
      '--accent-primary-bg': 'rgba(251, 146, 60, 0.18)',
      '--accent-green': '#fbbf24',
    },
    sortOrder: 4, enabled: true,
  },
  {
    skinKey: 'mint', labelZh: '薄荷', labelEn: 'Mint',
    swatch: 'linear-gradient(135deg, #064e3b, #34d399)',
    bgImage: 'linear-gradient(160deg, rgba(6, 78, 59, 0.42), rgba(16, 45, 38, 0.08) 48%, rgba(52, 211, 153, 0.26))',
    vars: {
      '--bg-card': '#10251f',
      '--bg-secondary': '#16342b',
      '--bg-tertiary': 'rgba(52, 211, 153, 0.13)',
      '--bg-hover': 'rgba(52, 211, 153, 0.12)',
      '--border-color': '#255545',
      '--text-primary': '#eafff6',
      '--text-secondary': '#a7e8cd',
      '--text-muted': '#79b69e',
      '--accent-primary': '#34d399',
      '--accent-primary-rgb': '52, 211, 153',
      '--accent-primary-bg': 'rgba(52, 211, 153, 0.18)',
      '--accent-green': '#a3e635',
    },
    sortOrder: 5, enabled: true,
  },
];
