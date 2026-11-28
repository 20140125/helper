// ──────────────────────────
// 贾维斯 AI 助手皮肤配置（数据库唯一真源）
// ──────────────────────────

/** 自定义背景图允许的扩展名 */
export const AI_CHAT_SKIN_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const;

/** 自定义背景图允许的 MIME 类型 */
export const AI_CHAT_SKIN_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/** 自定义背景图大小上限（字节） */
export const AI_CHAT_SKIN_MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** data URL 字符串上限（5MB 图片 base64 后约 6.7MB，留少量余量） */
export const AI_CHAT_SKIN_MAX_DATA_URL_CHARS = 7 * 1024 * 1024;

/** 皮肤配置接口的 JSON 请求体上限（需容纳背景图本体，必须大于 data URL 上限） */
export const AI_CHAT_SKIN_BODY_LIMIT = '8mb';

/** 默认皮肤配置：跟随站点主题、无自定义背景 */
export const DEFAULT_AI_CHAT_SKIN: AiChatSkin = {
  skinId: 'default',
  backgroundUrl: '',
};

/** 贾维斯 AI 助手皮肤配置 */
export interface AiChatSkin {
  /** 皮肤预设 ID（对应 hp_ai_chat_skin_presets.skin_key） */
  skinId: string;
  /** 自定义背景图本体（data:image/...;base64,...，空串表示未设置） */
  backgroundUrl: string;
}

/** 保存皮肤配置的请求体 */
export interface AiChatSkinBody {
  /** 皮肤预设 ID */
  skinId?: unknown;
  /** 自定义背景图 data URL */
  backgroundUrl?: unknown;
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

/** 新增/更新皮肤预设的请求体 */
export interface AiChatSkinPresetBody {
  /** 中文名称 */
  labelZh?: unknown;
  /** 英文名称 */
  labelEn?: unknown;
  /** 缩略图 CSS */
  swatch?: unknown;
  /** 背景图 CSS */
  bgImage?: unknown;
  /** CSS 变量字典 */
  vars?: unknown;
  /** 展示顺序 */
  sortOrder?: unknown;
  /** 是否启用 */
  enabled?: unknown;
}

/**
 * 内置预设种子
 * @description 服务启动时幂等写入 hp_ai_chat_skin_presets；数据库不可用时也作为列表接口的降级数据。
 *   与前端 constants/ai-chat-skin.ts 的兜底列表保持一致。
 */
export const AI_CHAT_SKIN_PRESET_SEEDS: AiChatSkinPreset[] = [
  {
    skinKey: 'default', labelZh: '经典', labelEn: 'Classic',
    swatch: 'linear-gradient(135deg, #1c2333, #6366f1)',
    bgImage: '',
    vars: {},
    sortOrder: 1, enabled: true,
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
