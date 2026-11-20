/** 验证码记录 */
export interface CodeRecord {
  /** 验证码 */
  code: string;
  /** 过期时间戳（毫秒） */
  expiresAt: number;
}

/** JWT Payload 数据结构 */
export interface JwtPayload {
  /** 用户邮箱 */
  email: string;
  /** 签发时间戳（秒） */
  iat?: number;
  /** 过期时间戳（秒） */
  exp?: number;
}

/** 已登录用户记录 */
export interface UserRecord {
  /** 用户邮箱 */
  email: string;
  /** 是否为管理员 */
  isAdmin: boolean;
  /** 首次登录时间（ISO 字符串） */
  firstLoginAt: string;
  /** 最近登录时间（ISO 字符串） */
  lastLoginAt: string;
}

/** 用户存储文件结构 */
export interface UsersStore {
  /** 用户列表 */
  users: UserRecord[];
}
