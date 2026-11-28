import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { formatDate } from '@/utils/script';

/**
 * 由数据库管理的配置项键名：超级管理员默认验证码
 * @description 值为空表示关闭；可在「系统配置 → 邮件配置」里修改，保存后立即生效
 */
export const DEFAULT_AUTH_CODE_KEY = 'DEFAULT_AUTH_CODE';

/**
 * 确保 hp_env_config 中存在默认验证码配置行
 * @returns {Promise<void>}
 * @description 存量库该表为空，运行时补一行空值种子，避免配置页无法保存该键
 */
export const ensureEnvConfigSeed = async (): Promise<void> => {
  await getPool().execute(
    `INSERT INTO hp_env_config (env_key, env_value, group_name, description, is_secret, sort_order, updated_at)
     VALUES (?, '', '邮件/登录', '超级管理员默认验证码，留空即关闭', 0, 90, ?)
     ON DUPLICATE KEY UPDATE env_key = VALUES(env_key)`,
    [DEFAULT_AUTH_CODE_KEY, formatDate()],
  );
};

/**
 * 读取数据库配置表为扁平对象
 * @returns {Promise<Record<string, string>>} 配置项键值对
 */
export const readEnvConfigMap = async (): Promise<Record<string, string>> => {
  const [rows] = await getPool().query<RowDataPacket[]>('SELECT env_key, env_value FROM hp_env_config');
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[String(row.env_key)] = row.env_value === null ? '' : String(row.env_value);
  }
  return result;
};

/**
 * 写入数据库配置表
 * @param {Record<string, string>} updates - 待写入的配置项
 * @returns {Promise<void>}
 */
export const upsertEnvConfig = async (updates: Record<string, string>): Promise<void> => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    for (const [key, value] of Object.entries(updates)) {
      await conn.execute(
        `INSERT INTO hp_env_config (env_key, env_value, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE env_value = VALUES(env_value), updated_at = VALUES(updated_at)`,
        [key, value, formatDate()],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * 读取超级管理员默认验证码
 * @returns {Promise<string>} 配置值；数据库不可用时返回空串（关闭默认验证码）
 */
export const getDefaultAuthCode = async (): Promise<string> => {
  try {
    const map = await readEnvConfigMap();
    return map[DEFAULT_AUTH_CODE_KEY] ?? '';
  } catch {
    // 数据库不可用时回退到已加载的进程环境变量（需重启 Web 才生效）
    return process.env[DEFAULT_AUTH_CODE_KEY] ?? '';
  }
};
