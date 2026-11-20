import type { ApiResponse } from './api';

/**
 * 发送验证码响应类型
 * @description 发送邮箱验证码接口的响应数据结构（无数据返回）
 */
export type SendCodeResult = ApiResponse;

/** 验证登录响应 data */
export interface IVerifyCodeData {
  /** JWT Token（登录成功时返回） */
  token?: string;
  /** 是否为管理员（登录成功时返回） */
  isAdmin?: boolean;
  /** 用户权限码列表（登录成功时返回） */
  permissions?: string[];
  /** 用户角色 ID（登录成功时返回） */
  roleId?: string;
}

/**
 * 验证登录响应类型
 * @description 验证邮箱验证码接口的响应数据结构
 */
export type VerifyCodeResult = ApiResponse<IVerifyCodeData>;

/** 验证 Token 响应 data */
export interface IVerifyTokenData {
  /** 用户邮箱（Token 有效时返回） */
  email?: string;
  /** 是否为管理员（Token 有效时返回） */
  isAdmin?: boolean;
  /** 用户权限码列表（Token 有效时返回） */
  permissions?: string[];
  /** 用户角色 ID（Token 有效时返回） */
  roleId?: string;
}

/**
 * 验证 Token 响应类型
 * @description 验证 JWT Token 有效性接口的响应数据结构
 */
export type VerifyTokenResult = ApiResponse<IVerifyTokenData>;

/**
 * 管理员联系信息响应类型
 * @description 获取超级管理员邮箱接口的响应数据结构
 */
export type AdminContactResult = ApiResponse<{ email: string }>;

/**
 * 权限申请响应类型
 * @description 提交权限申请接口的响应数据结构
 */
export type PermissionApplyResult = ApiResponse<{ requestId: string }>;
