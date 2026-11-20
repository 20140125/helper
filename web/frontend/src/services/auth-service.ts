import type { SendCodeResult, VerifyCodeResult, VerifyTokenResult, AdminContactResult, PermissionApplyResult } from '@/types/auth';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * 鉴权服务管理类
 * @description 封装邮箱验证码登录相关的 API 接口
 */
export class AuthService extends BaseService {
  /**
   * 发送邮箱验证码
   * @param {string} email - 接收验证码的邮箱地址
   * @returns {Promise<SendCodeResult>} 发送结果
   * @description 向用户填写的邮箱地址发送 6 位数字验证码，有效期 5 分钟
   * @example
   * const service = new AuthService();
   * const result = await service.sendCode('user@example.com');
   * if (result.code === 0) {
   *   console.log('验证码已发送');
   * }
   */
  sendCode = async (email: string): Promise<SendCodeResult> => {
    return this.post<SendCodeResult>('/auth/send-code', { email });
  };

  /**
   * 验证登录验证码
   * @param {string} email - 接收验证码的邮箱地址
   * @param {string} code - 用户输入的 6 位验证码
   * @returns {Promise<VerifyCodeResult>} 验证结果
   * @description 校验用户输入的验证码是否正确且未过期
   * @example
   * const service = new AuthService();
   * const result = await service.verifyCode('user@example.com', '123456');
   * if (result.code === 0) {
   *   console.log('验证码验证成功');
   * }
   */
  verifyCode = async (email: string, code: string): Promise<VerifyCodeResult> => {
    return this.post<VerifyCodeResult>('/auth/verify-code', { email, code });
  };

  /**
   * 验证 JWT Token 有效性
   * @param {string} token - JWT Token 字符串
   * @returns {Promise<VerifyTokenResult>} 验证结果
   * @description 向后端校验 token 是否有效，用于页面初始化时恢复登录状态
   * @example
   * const service = new AuthService();
   * const result = await service.verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
   * if (result.code === 0) {
   *   console.log('Token 有效');
   * }
   */
  verifyToken = async (token: string): Promise<VerifyTokenResult> => {
    return this.post<VerifyTokenResult>('/auth/verify-token', { token });
  };

  /**
   * 获取超级管理员联系邮箱
   * @returns {Promise<AdminContactResult>} 管理员邮箱
   * @description 无需鉴权，供无权限页面展示管理员联系方式
   * @example
   * const service = new AuthService();
   * const result = await service.fetchAdminContact();
   * console.log('管理员邮箱:', result.email);
   */
  fetchAdminContact = async (): Promise<AdminContactResult> => {
    return this.get<AdminContactResult>('/auth/admin-contact');
  };

  /**
   * 退出登录
   * @returns {Promise<SendCodeResult>} 退出结果
   * @description 通知后端清除鉴权 Cookie；前端 localStorage 由调用方自行清理
   * @example
   * const service = new AuthService();
   * await service.logout();
   */
  logout = async (): Promise<SendCodeResult> => {
    return this.post<SendCodeResult>('/auth/logout', {});
  };

  /**
   * 申请权限（email 由后端从 JWT 中读取，无需前端传入）
   * @param {string} fromPath - 申请访问的页面路径
   * @param {string} [reason] - 申请原因（可选）
   * @returns {Promise<PermissionApplyResult>} 申请结果
   * @description 向管理员发送企微通知，并记录申请记录
   * @example
   * const service = new AuthService();
   * const result = await service.applyPermission('/dashboard', '需要查看财务数据');
   * console.log('申请结果:', result);
   */
  applyPermission = async (fromPath: string, reason?: string): Promise<PermissionApplyResult> => {
    return this.post<PermissionApplyResult>('/permission-apply/apply', { fromPath, reason });
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建鉴权服务实例的工厂函数
 * @description 提供 AuthService 类的实例，确保服务实例的一致性
 * @returns {AuthService} 鉴权服务实例
 */
export const createAuthService = (): AuthService => new AuthService();

/**
 * 默认导出的鉴权服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createAuthService 工厂函数
 */
export default createAuthService();
