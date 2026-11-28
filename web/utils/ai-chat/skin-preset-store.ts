import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { AI_CHAT_SKIN_PRESET_SEEDS } from '@/types/ai-chat-skin';
import type { AiChatSkinPreset, AiChatSkinPresetBody } from '@/types/ai-chat-skin';

/**
 * 皮肤 ID 合法字符
 * @description 只允许小写字母/数字/下划线/连字符，避免拼进 SQL 或 CSS 时引入特殊字符
 */
const SKIN_KEY_PATTERN = /^[a-z0-9_-]{1,32}$/i;

/**
 * CSS 值中的危险片段
 * @description 预设的 swatch / bgImage / vars 最终会进入 style 与 CSS 变量，禁止分隔符、引号与外部 url()
 */
const UNSAFE_CSS_PATTERN = /[<>{};"']|javascript:|url\s*\(/i;

/**
 * 判断皮肤 ID 是否合法
 * @param {string} key - 皮肤 ID
 * @returns {boolean} 是否合法
 * @description 只允许短横线、下划线、字母与数字
 */
export const isValidAiChatSkinKey = (key: string): boolean => SKIN_KEY_PATTERN.test(key);

/**
 * 判断 CSS 值是否安全
 * @param {string} value - CSS 值
 * @returns {boolean} 是否安全
 * @description 内置预设只用 linear-gradient / rgba / hex，不含引号、分号、花括号或 url()
 */
export const isSafeAiChatSkinCss = (value: string): boolean => !UNSAFE_CSS_PATTERN.test(value);

/**
 * 规范化 CSS 变量字典
 * @param {unknown} raw - 库内 JSON / 请求体中的 vars
 * @returns {Record<string, string>} 合法变量字典
 * @description 只保留 --xxx 形式的键与安全的字符串值，脏数据直接丢弃
 */
export const normalizeAiChatSkinPresetVars = (raw: unknown): Record<string, string> => {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!/^--[a-z0-9-]+$/i.test(key)) continue;
    if (typeof item !== 'string' || item.length > 256 || !isSafeAiChatSkinCss(item)) continue;
    result[key] = item;
  }
  return result;
};

/**
 * 校验新增/更新预设的请求体
 * @param {AiChatSkinPresetBody} raw - 请求体
 * @returns {string | null} 错误文案；通过时返回 null
 * @description 名称、CSS 值、变量字典与展示顺序逐项校验，杜绝非法 CSS 写进数据库
 */
export const validateAiChatSkinPresetBody = (raw: AiChatSkinPresetBody): string | null => {
  if (typeof raw.labelZh !== 'string' || !raw.labelZh.trim() || raw.labelZh.length > 64) {
    return 'labelZh 必须是 1~64 个字符';
  }
  if (typeof raw.labelEn !== 'string' || !raw.labelEn.trim() || raw.labelEn.length > 64) {
    return 'labelEn 必须是 1~64 个字符';
  }
  if (typeof raw.swatch !== 'string' || raw.swatch.length > 512 || !isSafeAiChatSkinCss(raw.swatch)) {
    return 'swatch 不是合法的 CSS 背景值';
  }
  if (typeof raw.bgImage !== 'string' || raw.bgImage.length > 1024 || !isSafeAiChatSkinCss(raw.bgImage)) {
    return 'bgImage 不是合法的 CSS 背景值';
  }
  if (raw.sortOrder !== undefined && (!Number.isInteger(raw.sortOrder) || Number(raw.sortOrder) < 0)) {
    return 'sortOrder 必须是非负整数';
  }
  if (raw.enabled !== undefined && typeof raw.enabled !== 'boolean') {
    return 'enabled 必须是布尔值';
  }
  if (raw.vars !== undefined && (!raw.vars || typeof raw.vars !== 'object' || Array.isArray(raw.vars))) {
    return 'vars 必须是 CSS 变量对象';
  }
  return null;
};

/**
 * 把数据库行转为预设定义
 * @param {RowDataPacket} row - hp_ai_chat_skin_presets 一行
 * @returns {AiChatSkinPreset} 预设定义
 * @description mysql2 会把 JSON 列解析成对象，这里兼容字符串与对象两种形态
 */
const rowToPreset = (row: RowDataPacket): AiChatSkinPreset => ({
  skinKey: String(row.skin_key),
  labelZh: String(row.label_zh),
  labelEn: String(row.label_en),
  swatch: String(row.swatch ?? ''),
  bgImage: String(row.bg_image ?? ''),
  vars: normalizeAiChatSkinPresetVars(row.vars_json),
  sortOrder: Number(row.sort_order ?? 0),
  enabled: Boolean(row.enabled),
});

/**
 * 列出启用的皮肤预设
 * @param {boolean} includeDisabled - 是否包含已下线预设，默认 false
 * @returns {Promise<AiChatSkinPreset[]>} 预设列表
 * @description 数据库不可用或表为空时降级返回内置种子，保证聊天窗口始终可选皮肤
 */
export const listAiChatSkinPresets = async (includeDisabled: boolean = false): Promise<AiChatSkinPreset[]> => {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT skin_key, label_zh, label_en, swatch, bg_image, vars_json, sort_order, enabled
       FROM hp_ai_chat_skin_presets ${includeDisabled ? '' : 'WHERE enabled = 1'}
       ORDER BY sort_order, id`,
    );
    const presets = rows.map(rowToPreset);
    return presets.length ? presets : AI_CHAT_SKIN_PRESET_SEEDS;
  } catch (err) {
    console.warn('[ai-chat-skin] 读取预设定义失败，使用内置种子：', (err as Error).message);
    return AI_CHAT_SKIN_PRESET_SEEDS;
  }
};

/**
 * 新增或更新一条皮肤预设
 * @param {AiChatSkinPreset} preset - 已校验的预设定义
 * @returns {Promise<void>}
 * @description 以 skin_key 为唯一键 UPSERT；写库失败由路由转成错误响应
 */
export const upsertAiChatSkinPreset = async (preset: AiChatSkinPreset): Promise<void> => {
  await getPool().execute(
    `INSERT INTO hp_ai_chat_skin_presets
       (skin_key, label_zh, label_en, swatch, bg_image, vars_json, sort_order, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       label_zh = VALUES(label_zh), label_en = VALUES(label_en),
       swatch = VALUES(swatch), bg_image = VALUES(bg_image),
       vars_json = VALUES(vars_json), sort_order = VALUES(sort_order), enabled = VALUES(enabled)`,
    [
      preset.skinKey,
      preset.labelZh,
      preset.labelEn,
      preset.swatch,
      preset.bgImage,
      JSON.stringify(preset.vars),
      preset.sortOrder,
      preset.enabled ? 1 : 0,
    ],
  );
};
