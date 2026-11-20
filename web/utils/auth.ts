import fs from 'fs';
import type { Response } from 'express';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import type { CodeRecord, JwtPayload, UserRecord, UsersStore } from '@/types/auth';
import { formatDate } from './script';
import { PROJECT_DIR, CACHE_DIR } from './paths';
/** 已登录用户存储文件路径 */
const USERS_FILE = `${PROJECT_DIR}/.cache/users.json`;

// ==============================
// 验证码工具
// ==============================

/** 验证码内存存储（key 为邮箱地址） */
export const codeStore = new Map<string, CodeRecord>();

/**
 * 获取目标邮箱地址（发送和接收均为同一邮箱，也作为发件人地址）
 * @returns {string} 目标邮箱地址
 */
export const getAuthTargetEmail = (): string => process.env.MAIL_FROM_ADDRESS ?? '';

/**
 * 获取邮件发件人名称
 * @returns {string} 发件人名称
 */
export const getAuthMailFromName = (): string => process.env.MAIL_FROM_NAME ?? '';

/**
 * 创建 SMTP 邮件传输器
 * @returns {nodemailer.Transporter} 邮件传输器实例
 */
export const createMailTransporter = (): nodemailer.Transporter => nodemailer.createTransport({
    host: process.env.MAIL_HOST ?? 'smtp.qq.com',
    port: Number(process.env.MAIL_PORT ?? 465),
    secure: (process.env.MAIL_ENCRYPTION ?? 'ssl') === 'ssl',
  auth: {
      user: process.env.MAIL_USERNAME ?? '',
      pass: process.env.MAIL_PASSWORD ?? '',
  },
});

/**
 * 生成6位随机数字验证码
 * @returns {string} 6位验证码字符串
 */
export const generateAuthCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

/**
 * 判断邮箱是否为管理员账号（与 MAIL_USERNAME 一致）
 * @param {string} email - 用户邮箱
 * @returns {boolean} 是否为管理员
 */
export const isAdminEmail = (email: string): boolean =>
  !!process.env.MAIL_USERNAME && email === process.env.MAIL_USERNAME;

// ==============================
// JWT 工具函数
// ==============================

/** JWT 密钥（从环境变量读取，未配置则使用随机生成的默认值） */
const JWT_SECRET = process.env.JWT_SECRET ?? `helper-jwt-secret-${Math.random().toString(36).slice(2)}`;

/** JWT 有效期（7天） */
const JWT_EXPIRES_IN = '7d';

/**
 * 签发 JWT Token
 * @param {string} email - 用户邮箱
 * @returns {string} JWT Token 字符串
 */
export const signJwt = (email: string): string => {
  const payload: JwtPayload = { email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * 验证 JWT Token
 * @param {string} token - JWT Token 字符串
 * @returns {JwtPayload | null} 解析后的 payload，验证失败返回 null
 */
export const verifyJwt = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
};

// ==============================
// 用户存储文件读写
// ==============================

/**
 * 读取已登录用户列表
 * @returns {UsersStore} 用户存储数据
 */
export const readUsers = (): UsersStore => {
  if (!fs.existsSync(USERS_FILE)) {
    return { users: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')) as UsersStore;
  } catch {
    return { users: [] };
  }
};

/**
 * 写入用户存储数据
 * @param {UsersStore} store - 用户存储数据
 */
export const writeUsers = (store: UsersStore): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(store, null, 2), 'utf-8');
};

/**
 * 记录用户登录信息（新用户写入，老用户更新最近登录时间和管理员状态）
 * @param {string} email - 用户邮箱
 */
export const recordUserLogin = (email: string): void => {
  const store = readUsers();
  const now = formatDate();
  const isAdmin = isAdminEmail(email);
  const existing = store.users.find((u) => u.email === email);
  if (existing) {
    existing.lastLoginAt = now;
    existing.isAdmin = isAdmin;
  } else {
    const newUser: UserRecord = { email, isAdmin, firstLoginAt: now, lastLoginAt: now };
    store.users.push(newUser);
  }
  writeUsers(store);
};

// ==============================
// 鉴权 Cookie 工具
// ==============================

/** Cookie 中存储 JWT Token 的名称（与 server.ts、utils/permission.ts 三处保持一致） */
const AUTH_COOKIE_NAME = 'auth_token';

/** Cookie 有效期（7 天，与 JWT 过期时间一致），单位毫秒 */
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * 将 JWT Token 以 Cookie 形式下发到浏览器
 * @description 让用户在浏览器地址栏直接访问 API 时也能携带登录凭证
 * @param {Response} res - Express Response 对象
 * @param {string} token - JWT Token 字符串
 */
export const setAuthCookie = (res: Response, token: string): void => {
  const segments = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${Math.floor(AUTH_COOKIE_MAX_AGE / 1000)}`,
    'SameSite=Lax',
    'HttpOnly',
  ];
  res.setHeader('Set-Cookie', segments.join('; '));
};

/**
 * 清除浏览器端的鉴权 Cookie
 * @param {Response} res - Express Response 对象
 */
export const clearAuthCookie = (res: Response): void => {
  res.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`,
  );
};

// ==============================
// 邮件模板
// ==============================

/**
 * 构建登录验证码邮件 HTML 内容
 * @description 渲染 6 位验证码到统一样式的卡片中，避免在路由层硬编码 HTML
 * @param {string} code - 6 位验证码
 * @returns {string} 完整的 HTML 邮件正文
 */
export const buildAuthCodeMailHtml = (code: string): string => `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8f9fa; border-radius: 12px;">
          <h2 style="color: #1a1a1a; margin: 0 0 8px;">智能提醒管理平台</h2>
          <p style="color: #666; margin: 0 0 24px; font-size: 14px;">登录验证码</p>
          <div style="background: #fff; border-radius: 8px; padding: 24px; text-align: center; border: 1px solid #e5e7eb;">
            <p style="color: #666; font-size: 14px; margin: 0 0 12px;">您的登录验证码为</p>
            <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #2563eb; font-family: monospace;">${code}</div>
            <p style="color: #999; font-size: 12px; margin: 16px 0 0;">验证码 5 分钟内有效，请勿泄露给他人</p>
          </div>
        </div>
      `;
