import {
  AI_CHAT_SKIN_CUSTOM_VARS,
  AI_CHAT_SKIN_MAX_DATA_URL_CHARS,
  DEFAULT_AI_CHAT_SKIN_SETTINGS,
} from '@/constants/ai-chat-skin';
import type { AiChatSkinPreset, AiChatSkinSettings } from '@/types/ai-chat-skin';

/**
 * 背景图本体白名单：只允许 data:image/...;base64,...
 * @description 图片本体随配置一起入库，值会拼进 CSS url()，禁止外链、引号、括号等字符
 */
const SAFE_BACKGROUND_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

/**
 * 预设 CSS 值中的危险片段
 * @description 预设来自数据库，最终会进入 style 与 CSS 变量，禁止分隔符、引号与外部 url()
 */
const UNSAFE_CSS_PATTERN = /[<>{};"']|javascript:|url\s*\(/i;

/**
 * 规范化服务端返回的预设列表
 * @param {unknown} raw - GET /skin/presets 的 data.presets
 * @returns {AiChatSkinPreset[]} 合法预设；全部非法时返回空数组由 Store 兜底
 * @description 逐条校验 ID、名称、CSS 值与变量字典，杜绝脏数据进入 style
 */
export const normalizeAiChatSkinPresets = (raw: unknown): AiChatSkinPreset[] => {
  if (!Array.isArray(raw)) return [];
  const result: AiChatSkinPreset[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Record<string, unknown>;
    if (typeof value.skinKey !== 'string' || !/^[a-z0-9_-]{1,32}$/i.test(value.skinKey)) continue;
    if (typeof value.labelZh !== 'string' || typeof value.labelEn !== 'string') continue;
    if (typeof value.swatch !== 'string' || UNSAFE_CSS_PATTERN.test(value.swatch)) continue;
    if (typeof value.bgImage !== 'string' || UNSAFE_CSS_PATTERN.test(value.bgImage)) continue;
    const vars: Record<string, string> = {};
    if (value.vars && typeof value.vars === 'object' && !Array.isArray(value.vars)) {
      for (const [key, itemValue] of Object.entries(value.vars as Record<string, unknown>)) {
        if (!/^--[a-z0-9-]+$/i.test(key)) continue;
        if (typeof itemValue !== 'string' || UNSAFE_CSS_PATTERN.test(itemValue)) continue;
        vars[key] = itemValue;
      }
    }
    result.push({
      skinKey: value.skinKey,
      labelZh: value.labelZh,
      labelEn: value.labelEn,
      swatch: value.swatch,
      bgImage: value.bgImage,
      vars,
      sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : result.length + 1,
      enabled: value.enabled !== false,
    });
  }
  return result.sort((a, b) => a.sortOrder - b.sortOrder);
};

/**
 * 规范化服务端返回的用户皮肤配置
 * @param {unknown} raw - 接口返回的 skin 字段
 * @param {AiChatSkinPreset[]} presets - 当前已启用的预设
 * @returns {AiChatSkinSettings} 合法皮肤配置
 * @description 未知预设 ID 与非法图片数据均降级为默认值，避免脏数据影响渲染
 */
export const normalizeAiChatSkinSettings = (
  raw: unknown,
  presets: AiChatSkinPreset[],
): AiChatSkinSettings => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AI_CHAT_SKIN_SETTINGS };
  }
  const value = raw as Partial<AiChatSkinSettings>;
  const skinId = presets.some((item) => item.skinKey === value.skinId && item.enabled)
    ? String(value.skinId)
    : DEFAULT_AI_CHAT_SKIN_SETTINGS.skinId;
  const backgroundUrl = typeof value.backgroundUrl === 'string'
    && value.backgroundUrl.length <= AI_CHAT_SKIN_MAX_DATA_URL_CHARS
    && SAFE_BACKGROUND_URL.test(value.backgroundUrl)
    ? value.backgroundUrl
    : '';
  return { skinId, backgroundUrl };
};

/**
 * 专用皮肤变量与预设配色字段的对应关系
 * @description 集中定义一套 --ai-chat-* 变量，组件与 TDesign 都只认这套变量，避免出现
 *   「文字跟随皮肤、背景仍用站点主题」的错配
 */
const CANONICAL_VAR_SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['--ai-chat-surface', '--bg-card'],
  ['--ai-chat-panel-bg', '--bg-secondary'],
  ['--ai-chat-bubble-bg', '--bg-tertiary'],
  ['--ai-chat-code-bg', '--bg-card'],
  ['--ai-chat-hover', '--bg-hover'],
  ['--ai-chat-border', '--border-color'],
  ['--ai-chat-text', '--text-primary'],
  ['--ai-chat-text-secondary', '--text-secondary'],
  ['--ai-chat-text-muted', '--text-muted'],
  ['--ai-chat-accent', '--accent-primary'],
  ['--ai-chat-accent-rgb', '--accent-primary-rgb'],
  ['--ai-chat-accent-bg', '--accent-primary-bg'],
  ['--ai-chat-accent-green', '--accent-green'],
];

/**
 * 项目通用变量 → 专用皮肤变量
 * @description ai-chat 组件历史样式大量使用 --bg-* / --text-* / --accent-*，统一映射到同一套皮肤色
 */
const PROJECT_VAR_MAP: Record<string, string> = {
  '--bg-card': 'var(--ai-chat-surface)',
  '--bg-primary': 'var(--ai-chat-surface)',
  '--bg-secondary': 'var(--ai-chat-panel-bg)',
  '--bg-tertiary': 'var(--ai-chat-bubble-bg)',
  '--bg-hover': 'var(--ai-chat-hover)',
  '--card-bg': 'var(--ai-chat-surface)',
  '--input-bg': 'var(--ai-chat-panel-bg)',
  '--border-color': 'var(--ai-chat-border)',
  '--text-primary': 'var(--ai-chat-text)',
  '--text-secondary': 'var(--ai-chat-text-secondary)',
  '--text-muted': 'var(--ai-chat-text-muted)',
  '--accent-primary': 'var(--ai-chat-accent)',
  '--accent-primary-rgb': 'var(--ai-chat-accent-rgb)',
  '--accent-primary-bg': 'var(--ai-chat-accent-bg)',
  '--accent-green': 'var(--ai-chat-accent-green)',
};

/**
 * TDesign 内部变量 → 专用皮肤变量
 * @description Drawer 容器、Button、Input、Textarea 的颜色由 --td-* 决定，不覆盖会绕过皮肤
 */
const TDESIGN_VAR_MAP: Record<string, string> = {
  '--td-bg-color-container': 'var(--ai-chat-surface)',
  '--td-bg-color-container-hover': 'var(--ai-chat-hover)',
  '--td-bg-color-container-active': 'var(--ai-chat-hover)',
  '--td-bg-color-secondarycontainer': 'var(--ai-chat-panel-bg)',
  '--td-bg-color-component': 'var(--ai-chat-panel-bg)',
  '--td-bg-color-component-hover': 'var(--ai-chat-hover)',
  '--td-bg-color-component-active': 'var(--ai-chat-hover)',
  '--td-text-color-primary': 'var(--ai-chat-text)',
  '--td-text-color-secondary': 'var(--ai-chat-text-secondary)',
  '--td-text-color-placeholder': 'var(--ai-chat-text-muted)',
  '--td-border-level-1-color': 'var(--ai-chat-border)',
  '--td-brand-color': 'var(--ai-chat-accent)',
};

/**
 * 构建聊天抽屉的局部 CSS 变量
 * @param {AiChatSkinSettings} settings - 当前用户皮肤配置
 * @param {AiChatSkinPreset[]} presets - 数据库读取的预设列表
 * @returns {Record<string, string>} 绑定到抽屉根节点与浮层的 CSS 变量
 * @description 无任何配色覆盖时返回空对象，完全沿用站点明暗主题；其余情况统一注入
 *   --ai-chat-*、项目通用变量与 TDesign 内部变量三层映射；自定义背景图叠加暗色遮罩
 */
export const buildAiChatSkinStyle = (
  settings: AiChatSkinSettings,
  presets: AiChatSkinPreset[],
): Record<string, string> => {
  const preset = presets.find((item) => item.skinKey === settings.skinId && item.enabled);
  const hasBackground = Boolean(
    settings.backgroundUrl
    && settings.backgroundUrl.length <= AI_CHAT_SKIN_MAX_DATA_URL_CHARS
    && SAFE_BACKGROUND_URL.test(settings.backgroundUrl),
  );
  if (!hasBackground && (!preset || (Object.keys(preset.vars).length === 0 && !preset.bgImage))) {
    return {};
  }

  const source: Record<string, string> = hasBackground
    ? { ...(preset?.vars ?? {}), ...AI_CHAT_SKIN_CUSTOM_VARS }
    : { ...(preset?.vars ?? {}) };
  const style: Record<string, string> = {};
  for (const [canonical, sourceKey] of CANONICAL_VAR_SOURCES) {
    const value = source[sourceKey];
    if (value) {
      style[canonical] = value;
    }
  }
  Object.assign(style, PROJECT_VAR_MAP, TDESIGN_VAR_MAP);

  if (hasBackground) {
    style['--ai-chat-bg-image'] =
      `linear-gradient(rgba(8, 12, 22, 0.55), rgba(8, 12, 22, 0.55)), url("${settings.backgroundUrl}")`;
  } else if (preset?.bgImage) {
    style['--ai-chat-bg-image'] = preset.bgImage;
  }
  return style;
};
