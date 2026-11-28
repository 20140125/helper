import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import {
  AI_CHAT_SKIN_MAX_DATA_URL_CHARS,
  AI_CHAT_SKIN_PRESET_SEEDS,
  DEFAULT_AI_CHAT_SKIN,
} from '@/types/ai-chat-skin';
import type { AiChatSkin, AiChatSkinBody, AiChatSkinPreset } from '@/types/ai-chat-skin';
import { listAiChatSkinPresets } from './skin-preset-store';

/**
 * 背景图本体白名单：只允许 data:image/...;base64,...
 * @description 图片本体随配置一起入库，值会拼进 CSS url()，禁止外链、引号、括号等字符
 */
const BACKGROUND_DATA_URL_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

/**
 * 校验保存皮肤配置的请求体
 * @param {AiChatSkinBody} raw - 请求体
 * @returns {Promise<string | null>} 校验错误文案；通过时返回 null
 * @description 皮肤 ID 改为查 hp_ai_chat_skin_presets 校验（支持后台新增预设），
 *   背景图只接受图片 data URL；非法值一律拒绝写库
 */
export const validateAiChatSkinBody = async (raw: AiChatSkinBody): Promise<string | null> => {
  const presets = await listAiChatSkinPresets();
  if (typeof raw.skinId !== 'string' || !presets.some((item) => item.skinKey === raw.skinId && item.enabled)) {
    return 'skinId 不在已启用的皮肤预设中';
  }
  if (typeof raw.backgroundUrl !== 'string') {
    return 'backgroundUrl 必须是字符串';
  }
  if (raw.backgroundUrl.length > AI_CHAT_SKIN_MAX_DATA_URL_CHARS) {
    return '背景图数据超过大小限制';
  }
  if (raw.backgroundUrl && !BACKGROUND_DATA_URL_PATTERN.test(raw.backgroundUrl)) {
    return 'backgroundUrl 必须是 data:image/...;base64,... 格式的图片本体';
  }
  return null;
};

/**
 * 把数据库行规范化为皮肤配置
 * @param {string} skinId - 库内皮肤 ID
 * @param {string} backgroundUrl - 库内背景图本体
 * @param {AiChatSkinPreset[]} presets - 已启用的预设列表
 * @returns {AiChatSkin} 合法皮肤配置
 * @description 库内历史脏数据（如手工改库、旧版路径值）按默认皮肤兜底，避免非法值进入前端 CSS
 */
const normalizeAiChatSkinRow = (
  skinId: string,
  backgroundUrl: string,
  presets: AiChatSkinPreset[],
): AiChatSkin => ({
  skinId: presets.some((item) => item.skinKey === skinId && item.enabled)
    ? skinId
    : DEFAULT_AI_CHAT_SKIN.skinId,
  backgroundUrl: BACKGROUND_DATA_URL_PATTERN.test(backgroundUrl) ? backgroundUrl : '',
});

/**
 * 读取指定用户的皮肤配置
 * @param {string} email - 用户邮箱（JWT req.userEmail）
 * @returns {Promise<AiChatSkin>} 皮肤配置；无记录或数据库不可用时返回默认皮肤
 * @description 背景图本体直接从 LONGTEXT 列读出；皮肤是非关键外观配置，异常只告警并降级
 */
export const readAiChatSkin = async (email: string): Promise<AiChatSkin> => {
  const presets = await listAiChatSkinPresets();
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT skin_id, background_url FROM hp_ai_chat_skins WHERE user = ? LIMIT 1',
      [email],
    );
    const row = rows[0];
    if (!row) {
      return { ...DEFAULT_AI_CHAT_SKIN };
    }
    return normalizeAiChatSkinRow(String(row.skin_id), String(row.background_url ?? ''), presets);
  } catch (err) {
    console.warn('[ai-chat-skin] 读取皮肤配置失败，回退默认皮肤：', (err as Error).message);
    return { ...DEFAULT_AI_CHAT_SKIN };
  }
};

/**
 * 保存（UPSERT）指定用户的皮肤配置
 * @param {string} email - 用户邮箱
 * @param {AiChatSkin} skin - 已校验的皮肤配置
 * @returns {Promise<void>}
 * @description 一个用户一行；图片本体直接写 LONGTEXT，不落磁盘，避免文件与数据库双真源
 */
export const upsertAiChatSkin = async (email: string, skin: AiChatSkin): Promise<void> => {
  await getPool().execute(
    `INSERT INTO hp_ai_chat_skins (user, skin_id, background_url) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE skin_id = VALUES(skin_id), background_url = VALUES(background_url)`,
    [email, skin.skinId, skin.backgroundUrl],
  );
};

/**
 * 确保皮肤相关表结构与种子就绪
 * @returns {Promise<void>}
 * @description 存量库无需全库重建：幂等建表、把旧版 VARCHAR(512) 列升级为 LONGTEXT，
 *   并以 INSERT IGNORE 补入 5 套预设种子（用户改过的预设不被覆盖）
 */
export const ensureAiChatSkinSchema = async (): Promise<void> => {
  const pool = getPool();
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS hp_ai_chat_skins (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user VARCHAR(191) NOT NULL,
      skin_id VARCHAR(32) NOT NULL DEFAULT 'default',
      background_url LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_user (user)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贾维斯 AI 助手按用户皮肤配置'`,
  );

  const [columns] = await pool.query<RowDataPacket[]>(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hp_ai_chat_skins' AND COLUMN_NAME = 'background_url'`,
  );
  if (columns.length > 0 && String(columns[0].DATA_TYPE).toLowerCase() !== 'longtext') {
    await pool.execute('ALTER TABLE hp_ai_chat_skins MODIFY COLUMN background_url LONGTEXT NOT NULL');
  }

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS hp_ai_chat_skin_presets (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      skin_key VARCHAR(32) NOT NULL,
      label_zh VARCHAR(64) NOT NULL,
      label_en VARCHAR(64) NOT NULL,
      swatch VARCHAR(512) NOT NULL DEFAULT '',
      bg_image VARCHAR(1024) NOT NULL DEFAULT '',
      vars_json JSON NOT NULL,
      sort_order INT UNSIGNED NOT NULL DEFAULT 0,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_skin_key (skin_key),
      KEY idx_enabled_sort (enabled, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贾维斯 AI 助手内置皮肤预设定义'`,
  );

  const placeholders = AI_CHAT_SKIN_PRESET_SEEDS.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const params = AI_CHAT_SKIN_PRESET_SEEDS.flatMap((item) => [
    item.skinKey,
    item.labelZh,
    item.labelEn,
    item.swatch,
    item.bgImage,
    JSON.stringify(item.vars),
    item.sortOrder,
    item.enabled ? 1 : 0,
  ]);
  await pool.execute(
    `INSERT IGNORE INTO hp_ai_chat_skin_presets
       (skin_key, label_zh, label_en, swatch, bg_image, vars_json, sort_order, enabled)
     VALUES ${placeholders}`,
    params,
  );
};
