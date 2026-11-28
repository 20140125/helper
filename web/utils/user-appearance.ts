/**
 * 按用户外观偏好访问层
 * @description 读写 hp_user_appearance 中的背景图遮挡层不透明度，并幂等补齐表结构与文案种子
 */
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import {
  USER_APPEARANCE_SURFACE_OPACITY_DEFAULT,
  USER_APPEARANCE_SURFACE_OPACITY_MAX,
  USER_APPEARANCE_SURFACE_OPACITY_MIN,
} from '@/types/user-appearance';
import type { UserAppearanceConfig } from '@/types/user-appearance';

/**
 * 顶栏设置项文案的启动补种子
 * @description 文案真源是 hp_i18n_messages；存量库未执行 35 号脚本时，启动时补齐缺失 key，
 *   已存在的条目（含管理页改过的文案）用 INSERT IGNORE 保留不动
 */
const USER_APPEARANCE_MESSAGES = [
  { lang: 'zh', key: 'backgroundSurfaceOpacity', value: '背景遮挡不透明度', sortOrder: 5118 },
  { lang: 'zh', key: 'backgroundSurfaceOpacityHint', value: '数值越大越不透明、背景图越淡；仅对当前账号生效', sortOrder: 5119 },
  { lang: 'en', key: 'backgroundSurfaceOpacity', value: 'Panel opacity', sortOrder: 5118 },
  { lang: 'en', key: 'backgroundSurfaceOpacityHint', value: 'Higher values make panels less transparent; applies only to your account', sortOrder: 5119 },
] as const;

/**
 * 校验并规范化遮挡层不透明度
 * @param {unknown} value - 待校验的值
 * @returns {number | null} 合法的整数百分比；非法返回 null
 * @description 只接受 20–100 的整数，拒绝字符串、小数与越界值，避免非法值写库或进入 CSS
 */
export const normalizeSurfaceOpacity = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < USER_APPEARANCE_SURFACE_OPACITY_MIN || value > USER_APPEARANCE_SURFACE_OPACITY_MAX) return null;
  return value;
};

/**
 * 读取指定用户的外观偏好
 * @param {string} email - 用户邮箱（JWT req.userEmail）
 * @returns {Promise<UserAppearanceConfig>} 外观偏好；无记录、脏数据或数据库异常时返回默认值
 * @description 外观是非关键配置，异常只告警并降级，不阻断首屏
 */
export const readUserAppearance = async (email: string): Promise<UserAppearanceConfig> => {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT surface_opacity FROM hp_user_appearance WHERE user = ? LIMIT 1',
      [email],
    );
    const row = rows[0];
    const value = row ? normalizeSurfaceOpacity(Number(row.surface_opacity)) : null;
    return { surfaceOpacity: value ?? USER_APPEARANCE_SURFACE_OPACITY_DEFAULT };
  } catch (err) {
    console.warn('[user-appearance] 读取外观偏好失败，回退默认值：', (err as Error).message);
    return { surfaceOpacity: USER_APPEARANCE_SURFACE_OPACITY_DEFAULT };
  }
};

/**
 * 保存（UPSERT）指定用户的外观偏好
 * @param {string} email - 用户邮箱
 * @param {UserAppearanceConfig} config - 已校验的外观偏好
 * @returns {Promise<void>}
 * @description 一个用户一行；只写不透明度，不触碰其他外观字段
 */
export const upsertUserAppearance = async (email: string, config: UserAppearanceConfig): Promise<void> => {
  await getPool().execute(
    `INSERT INTO hp_user_appearance (user, surface_opacity) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE surface_opacity = VALUES(surface_opacity)`,
    [email, config.surfaceOpacity],
  );
};

/**
 * 确保外观偏好表结构与顶栏文案种子就绪
 * @returns {Promise<void>}
 * @description 存量库无需全库重建；文案补种子失败只告警，不影响表结构创建
 */
export const ensureUserAppearanceSchema = async (): Promise<void> => {
  const pool = getPool();
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS hp_user_appearance (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user VARCHAR(191) NOT NULL,
      surface_opacity TINYINT UNSIGNED NOT NULL DEFAULT 86 COMMENT '背景图遮挡层不透明度（20–100）',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_user (user)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='按用户的系统背景遮挡层外观偏好'`,
  );

  try {
    for (const message of USER_APPEARANCE_MESSAGES) {
      const keyPath = `topbar.${message.key}`;
      await pool.execute(
        `INSERT IGNORE INTO hp_i18n_messages
           (lang, key_path, namespace, path_json, value, value_type, sort_order)
         VALUES (?, ?, 'topbar', ?, ?, 'text', ?)`,
        [
          message.lang,
          keyPath,
          JSON.stringify(['topbar', message.key]),
          message.value,
          message.sortOrder,
        ],
      );
    }
  } catch (err) {
    console.warn('[user-appearance] 顶栏文案补种子失败：', (err as Error).message);
  }
};
