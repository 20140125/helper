import fs from 'fs';
import path from 'path';
import { WEB_DIR, SCRIPTS_DIR } from '@/utils/paths';

/** Web 目录下的 .env（首选：web/ 独立运行时使用） */
export const WEB_ENV_FILE = path.join(WEB_DIR, '.env');

/** scripts 目录下的 .env（兼容旧部署：web/.env 不存在时回退） */
export const LEGACY_ENV_FILE = path.join(SCRIPTS_DIR, '.env');

/**
 * 当前生效的环境变量文件路径
 * @description 优先 web/.env；web/.env 不存在且 scripts/.env 存在时沿用 scripts/.env，
 *   保证既有部署升级后仍能读到原配置；两者都不存在时以 web/.env 作为写入目标
 */
export const ENV_FILE = fs.existsSync(WEB_ENV_FILE) || !fs.existsSync(LEGACY_ENV_FILE)
  ? WEB_ENV_FILE
  : LEGACY_ENV_FILE;

/** 环境变量加载顺序（先 web/.env 后 scripts/.env，dotenv 不覆盖已加载的键） */
export const ENV_FILE_CHAIN: string[] = [WEB_ENV_FILE, LEGACY_ENV_FILE];
