/**
 * 系统背景图访问层
 * @description 图片本体入库 hp_app_background，对外只暴露 /uploads/appbg-<md5> 短地址；
 *   启动时把旧 hp_env_config.APP_BACKGROUND_URL 指向的磁盘文件一次性迁移入库
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/utils/database/connection';
import { returnResponse, ErrorCode } from './response';
import { readEnvConfigMap, upsertEnvConfig } from './env-config';
import {
  APP_BACKGROUND_CONFIG_KEY,
  APP_BACKGROUND_DATA_URL_PATTERN,
  APP_BACKGROUND_IMAGE_EXTENSIONS,
  APP_BACKGROUND_IMAGE_MIME_TYPES,
  APP_BACKGROUND_IMAGE_URL_PREFIX,
  APP_BACKGROUND_MAX_DATA_URL_CHARS,
  APP_BACKGROUND_MAX_IMAGE_SIZE,
  APP_BACKGROUND_URL_PATTERN,
  type AppBackgroundConfig,
} from '@/types/app-background';

/** 静态资源根目录（仅迁移旧文件时读取） */
const PUBLIC_DIR = path.join(__dirname, '../public');

/** 旧版落盘文件严格白名单：只允许服务端生成的 bg-<时间戳>-<随机>.<扩展名> */
const LEGACY_FILE_PATTERN = /^\/uploads\/bg-[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/;

/** 库内图片行 */
interface AppBackgroundImageRow {
  /** 图片 MIME */
  mime: string;
  /** 图片二进制本体 */
  imageData: Buffer;
  /** 内容 MD5，用作短地址版本标识 */
  contentHash: string;
}

/**
 * 校验背景图地址是否为站内路径
 * @param {string} url - 待校验的地址
 * @returns {boolean} 合法返回 true
 * @description 只允许 /uploads/<名称>，拒绝外链、协议、路径穿越与 CSS 注入字符
 */
export const isSafeAppBackgroundUrl = (url: string): boolean =>
  APP_BACKGROUND_URL_PATTERN.test(url);

/**
 * 由内容 MD5 生成对外短地址
 * @param {string} hash - 图片内容 MD5
 * @returns {string} 站内短地址
 * @description 地址自带版本，内容变化时 URL 变化，浏览器可长缓存且不会读到旧图
 */
const buildImageUrl = (hash: string): string => `${APP_BACKGROUND_IMAGE_URL_PREFIX}${hash}`;

/**
 * 按扩展名归一化图片 MIME
 * @param {string} ext - 带点扩展名，如 .jpg
 * @returns {string} 归一化后的 MIME；不支持时返回空串
 * @description jpg 统一为 image/jpeg，避免扩展名与浏览器声明不一致时写出非法图片
 */
const mimeFromExtension = (ext: string): string => {
  const normalized = ext.replace(/^\./, '').toLowerCase();
  if (normalized === 'png') return 'image/png';
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
  if (normalized === 'webp') return 'image/webp';
  if (normalized === 'gif') return 'image/gif';
  return '';
};

/** 背景图上传专用 multer：内存暂存，图片本体直接入库，不再落磁盘 */
export const appBackgroundUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: APP_BACKGROUND_MAX_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const allowed = (APP_BACKGROUND_IMAGE_EXTENSIONS as readonly string[]).includes(ext)
      && (APP_BACKGROUND_IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype);
    if (!allowed) {
      cb(new Error('仅支持 JPG / PNG / WEBP / GIF 图片'));
      return;
    }
    cb(null, true);
  },
});

/**
 * 处理背景图上传
 * @param {Request} req - Express 请求
 * @param {Response} res - Express 响应
 * @returns {void} 返回图片本体 data URL，由前端随保存接口写入数据库
 */
export const handleAppBackgroundUpload = (req: Request, res: Response): void => {
  appBackgroundUpload.single('file')(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? '图片大小超过限制（最大 5MB）'
        : (err instanceof Error ? err.message : '图片上传失败');
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, message);
    }
    if (!req.file?.buffer) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '未收到文件，请确认字段名为 file');
    }
    const mime = mimeFromExtension(path.extname(req.file.originalname));
    if (!(APP_BACKGROUND_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '仅支持 JPG / PNG / WEBP / GIF 图片');
    }
    const url = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    return returnResponse(res, ErrorCode.SUCCESS, { url, name: req.file.originalname }, 'success');
  });
};

/**
 * 读取库内唯一一张背景图
 * @returns {Promise<AppBackgroundImageRow | null>} 图片行；无记录返回 null
 * @description 单行表 id 固定为 1；数据库异常由调用方降级处理
 */
const readAppBackgroundImage = async (): Promise<AppBackgroundImageRow | null> => {
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT mime, image_data, content_hash FROM hp_app_background WHERE id = 1 LIMIT 1',
  );
  const row = rows[0];
  if (!row) return null;
  return {
    mime: String(row.mime),
    imageData: row.image_data as Buffer,
    contentHash: String(row.content_hash),
  };
};

/**
 * 写入（UPSERT）系统背景图本体
 * @param {string} mime - 图片 MIME
 * @param {Buffer} buffer - 图片二进制本体
 * @returns {Promise<string>} 对外短地址
 * @description 全站只有一行；内容 MD5 同时作为短地址版本，避免浏览器缓存旧图
 */
const writeAppBackgroundImage = async (mime: string, buffer: Buffer): Promise<string> => {
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  await getPool().execute(
    `INSERT INTO hp_app_background (id, mime, image_data, content_hash)
     VALUES (1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE mime = VALUES(mime), image_data = VALUES(image_data),
       content_hash = VALUES(content_hash)`,
    [mime, buffer, hash],
  );
  return buildImageUrl(hash);
};

/**
 * 解析并校验图片本体 data URL
 * @param {string} dataUrl - 上传接口返回的图片本体
 * @returns {{ mime: string; buffer: Buffer } | null} 解析结果；非法值返回 null
 * @description 双重校验格式、长度、解码后大小与 MIME 白名单，拒绝任意内容入库
 */
const parseAppBackgroundDataUrl = (dataUrl: string): { mime: string; buffer: Buffer } | null => {
  if (typeof dataUrl !== 'string' || dataUrl.length > APP_BACKGROUND_MAX_DATA_URL_CHARS) return null;
  const matched = APP_BACKGROUND_DATA_URL_PATTERN.exec(dataUrl);
  if (!matched) return null;
  const mime = `image/${matched[1].toLowerCase()}`;
  if (!(APP_BACKGROUND_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) return null;
  const buffer = Buffer.from(matched[2], 'base64');
  if (!buffer.length || buffer.length > APP_BACKGROUND_MAX_IMAGE_SIZE) return null;
  return { mime, buffer };
};

/**
 * 读取系统背景配置
 * @returns {Promise<AppBackgroundConfig>} 站内短地址；无图或数据库异常时返回空串
 * @description 只返回几十字符的短地址，登录页与首屏不会被迫下载 MB 级图片配置
 */
export const readAppBackground = async (): Promise<AppBackgroundConfig> => {
  try {
    const row = await readAppBackgroundImage();
    if (!row) return { url: '' };
    const url = buildImageUrl(row.contentHash);
    return { url: isSafeAppBackgroundUrl(url) ? url : '' };
  } catch {
    return { url: '' };
  }
};

/**
 * 保存系统背景图本体
 * @param {string} dataUrl - 上传接口返回的图片本体 data URL
 * @returns {Promise<string>} 对外短地址
 * @description 图片本体写 hp_app_background，不再写 hp_env_config、也不再落盘
 */
export const saveAppBackground = async (dataUrl: string): Promise<string> => {
  const parsed = parseAppBackgroundDataUrl(dataUrl);
  if (!parsed) throw new Error('非法的背景图数据');
  return writeAppBackgroundImage(parsed.mime, parsed.buffer);
};

/**
 * 清除系统背景，恢复默认主题
 * @returns {Promise<void>} 无返回值
 * @description 删除库内唯一一行；磁盘上的旧版历史文件保留，不再被引用
 */
export const clearAppBackground = async (): Promise<void> => {
  await getPool().execute('DELETE FROM hp_app_background WHERE id = 1');
};

/**
 * 输出库内背景图二进制
 * @param {Request} req - Express 请求（含 :hash 路由参数）
 * @param {Response} res - Express 响应
 * @param {NextFunction} next - 交给静态目录兜底
 * @returns {Promise<void>} 无返回值
 * @description 公开路由，供登录页与首屏显示；URL 自带内容 MD5，可长缓存
 */
export const handleAppBackgroundImage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const hash = String(req.params.hash ?? '');
  if (!/^[a-f0-9]{32}$/.test(hash)) {
    next();
    return;
  }
  try {
    const row = await readAppBackgroundImage();
    if (!row || row.contentHash !== hash) {
      next();
      return;
    }
    res.setHeader('Content-Type', row.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(row.imageData);
  } catch {
    next();
  }
};

/**
 * 确保系统背景表结构就绪，并迁移旧版磁盘文件
 * @returns {Promise<void>} 无返回值
 * @description 存量库无需全库重建：幂等建表；表中无图且旧配置指向 /uploads/bg-* 时，
 *   读取该文件写入数据库并清空旧配置键，保证升级后当前背景图不丢失
 */
export const ensureAppBackgroundSchema = async (): Promise<void> => {
  const pool = getPool();
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS hp_app_background (
      id TINYINT UNSIGNED NOT NULL DEFAULT 1,
      mime VARCHAR(32) NOT NULL,
      image_data LONGBLOB NOT NULL,
      content_hash CHAR(32) NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='系统背景图（图片本体入库，全站共享）'`,
  );

  const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM hp_app_background');
  if (Number(rows[0]?.total ?? 0) > 0) return;

  let legacy = '';
  try {
    const map = await readEnvConfigMap();
    legacy = map[APP_BACKGROUND_CONFIG_KEY] ?? '';
  } catch {
    return;
  }
  if (!LEGACY_FILE_PATTERN.test(legacy)) return;
  const filePath = path.join(PUBLIC_DIR, legacy);
  const mime = mimeFromExtension(path.extname(filePath));
  if (!mime || !fs.existsSync(filePath)) return;

  const buffer = fs.readFileSync(filePath);
  if (!buffer.length || buffer.length > APP_BACKGROUND_MAX_IMAGE_SIZE) return;
  await writeAppBackgroundImage(mime, buffer);
  await upsertEnvConfig({ [APP_BACKGROUND_CONFIG_KEY]: '' });
  console.log('[app-background] 旧版系统背景图已迁移入库');
};
