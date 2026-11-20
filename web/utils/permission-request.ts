import fs from 'fs';
import { formatDate } from './script';
import { createMailTransporter, getAuthTargetEmail, getAuthMailFromName } from './auth';
import type { PermissionRequest, PermissionRequestsStore } from '@/types/permission-request';
import { PERMISSION_REQUESTS_FILE } from '@/types/permission-request';
import { CACHE_DIR } from './paths';
import { ErrorCode } from './response';

// ==============================
// 存储读写
// ==============================

/**
 * 读取权限申请存储
 * @returns {PermissionRequestsStore} 存储数据
 */
export function readPermissionRequests(): PermissionRequestsStore {
  if (!fs.existsSync(PERMISSION_REQUESTS_FILE)) return { requests: [] };
  try {
    return JSON.parse(fs.readFileSync(PERMISSION_REQUESTS_FILE, 'utf-8')) as PermissionRequestsStore;
  } catch {
    return { requests: [] };
  }
}

/**
 * 写入权限申请存储
 * @param {PermissionRequestsStore} store - 存储数据
 */
export function writePermissionRequests(store: PermissionRequestsStore): void {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(PERMISSION_REQUESTS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * 创建新的权限申请记录
 * @param {string} email - 申请人邮箱
 * @param {string} fromPath - 申请的页面路径
 * @param {string} [reason] - 申请原因
 * @returns {PermissionRequest} 新申请记录
 */
export function createPermissionRequest(email: string, fromPath: string, reason?: string): PermissionRequest {
  return {
    request_id: `pr_${Date.now()}`,
    email,
    fromPath,
    reason: reason?.trim() ?? '',
    status: 'pending',
    created_at: formatDate(),
  };
}

// ==============================
// 审批操作
// ==============================

/**
 * 查找待处理的申请记录，若不存在或已处理则返回错误
 * @param {PermissionRequestsStore} store - 存储数据
 * @param {string} id - 申请 ID
 * @returns {{ request: PermissionRequest } | { error: string; code: ErrorCode }} 查找结果
 */
export function findPendingRequest(
  store: PermissionRequestsStore,
  id: string,
): { request: PermissionRequest } | { error: string; code: ErrorCode } {
  const request = store.requests.find((r) => r.request_id === id);
  if (!request) return { error: 'Request not found', code: ErrorCode.NOT_FOUND };
  if (request.status !== 'pending') return { error: `Already ${request.status}`, code: ErrorCode.BAD_REQUEST };
  return { request };
}

/**
 * 执行审批写入操作（修改状态、时间、操作人）
 * @param {PermissionRequest} request - 申请记录（引用修改）
 * @param {PermissionRequestsStore} store - 存储数据
 * @param {string} resolvedBy - 操作人标识
 */
export function approveRequest(request: PermissionRequest, store: PermissionRequestsStore, resolvedBy: string): void {
  request.status = 'approved';
  request.resolvedAt = formatDate();
  request.resolvedBy = resolvedBy;
  writePermissionRequests(store);
}

// ==============================
// 企微通知 Markdown
// ==============================

/**
 * 构建权限申请企微通知 Markdown
 * @param {string} email - 申请人邮箱
 * @param {string} fromPath - 申请页面路径
 * @param {string} approveUrl - 一键批准链接
 * @param {string} [reason] - 申请原因
 * @returns {string} Markdown 字符串
 */
export function buildApplyMarkdown(email: string, fromPath: string, approveUrl: string, reason?: string): string {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const lines = [
    `## 🔔 Permission Request`,
    ``,
    `> **Time**: ${now}`,
    `> **Applicant**: ${email}`,
    `> **Requested Page**: \`${fromPath}\``,
    reason?.trim() ? `> **Reason**: ${reason.trim()}` : '',
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Click the link below to approve this request:`,
    `[✅ Approve Permission](${approveUrl})`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💡 *Sent by Smart Reminder Platform*`,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

/**
 * 构建权限批准企微通知 Markdown
 * @param {string} email - 申请人邮箱
 * @param {string} fromPath - 申请页面路径
 * @param {string} [approvedBy] - 操作人
 * @returns {string} Markdown 字符串
 */
export function buildApprovedMarkdown(email: string, fromPath: string, approvedBy?: string): string {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const lines = [
    `## ✅ Permission Approved`,
    ``,
    `> **Time**: ${now}`,
    `> **Applicant**: ${email}`,
    `> **Page**: \`${fromPath}\``,
    approvedBy ? `> **Approved by**: ${approvedBy}` : '',
    ``,
    `The applicant has been notified via email.`,
    ``,
    `💡 *Sent by Smart Reminder Platform*`,
  ];
  return lines.filter((l) => l !== '').join('\n');
}

// ==============================
// HTML 响应页面
// ==============================

/**
 * 生成"已处理"状态的 HTML 页面
 * @param {PermissionRequest} request - 申请记录
 * @returns {string} HTML 字符串
 */
export function alreadyResolvedHtml(request: PermissionRequest): string {
  return `
    <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
      <h2>ℹ️ This request has already been ${request.status}</h2>
      <p>Applicant: <strong>${request.email}</strong></p>
      <p>Page: <code>${request.fromPath}</code></p>
    </body></html>
  `;
}

/**
 * 生成审批成功的 HTML 页面
 * @param {PermissionRequest} request - 申请记录
 * @returns {string} HTML 字符串
 */
export function approveSuccessHtml(request: PermissionRequest): string {
  return `
    <html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:60px 40px;max-width:500px;margin:0 auto;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">✅</div>
      <h2 style="color:#16a34a;margin:0 0 12px;">Permission Approved</h2>
      <p style="color:#555;margin:0 0 8px;">Applicant: <strong>${request.email}</strong></p>
      <p style="color:#555;margin:0 0 24px;">Page: <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;">${request.fromPath}</code></p>
      <p style="color:#999;font-size:13px;">A notification email has been sent to the applicant.</p>
    </body></html>
  `;
}

// ==============================
// 邮件通知
// ==============================

/**
 * 发送权限批准邮件给申请人
 * @param {string} toEmail - 申请人邮箱
 * @param {string} fromPath - 申请的页面路径
 */
export async function sendApprovalEmail(toEmail: string, fromPath: string): Promise<void> {
  try {
    const transporter = createMailTransporter();
    const senderEmail = getAuthTargetEmail();
    const fromName = getAuthMailFromName();

    await transporter.sendMail({
      from: `"${fromName}" <${senderEmail}>`,
      to: toEmail,
      subject: '【Smart Reminder Platform】Permission Request Approved',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f8f9fa; border-radius: 12px;">
          <h2 style="color: #1a1a1a; margin: 0 0 8px;">Smart Reminder Management Platform</h2>
          <p style="color: #666; margin: 0 0 24px; font-size: 14px;">Permission Approved</p>
          <div style="background: #fff; border-radius: 8px; padding: 24px; border: 1px solid #e5e7eb;">
            <p style="color: #333; font-size: 15px; margin: 0 0 12px;">
              Hi <strong>${toEmail}</strong>,
            </p>
            <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px;">
              Your permission request for <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${fromPath}</code> has been <strong style="color:#16a34a;">approved</strong> by an administrator.
            </p>
            <p style="color: #333; font-size: 14px; margin: 0;">
              You can now access the page. Please log in and try again.
            </p>
          </div>
          <p style="color: #999; font-size: 12px; margin: 20px 0 0; text-align: center;">
            💡 This message was sent automatically by the Smart Reminder Platform.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[permission-request] 发送批准邮件失败:', (err as Error).message);
  }
}

/**
 * 发送权限拒绝邮件给申请人
 * @param {string} toEmail - 申请人邮箱
 * @param {string} fromPath - 申请的页面路径
 * @param {string} [rejectReason] - 拒绝原因
 */
export async function sendRejectionEmail(toEmail: string, fromPath: string, rejectReason?: string): Promise<void> {
  try {
    const transporter = createMailTransporter();
    const senderEmail = getAuthTargetEmail();
    const fromName = getAuthMailFromName();

    await transporter.sendMail({
      from: `"${fromName}" <${senderEmail}>`,
      to: toEmail,
      subject: '【Smart Reminder Platform】Permission Request Rejected',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f8f9fa; border-radius: 12px;">
          <h2 style="color: #1a1a1a; margin: 0 0 8px;">Smart Reminder Management Platform</h2>
          <p style="color: #666; margin: 0 0 24px; font-size: 14px;">Permission Request Update</p>
          <div style="background: #fff; border-radius: 8px; padding: 24px; border: 1px solid #e5e7eb;">
            <p style="color: #333; font-size: 15px; margin: 0 0 12px;">
              Hi <strong>${toEmail}</strong>,
            </p>
            <p style="color: #333; font-size: 14px; line-height: 1.7; margin: 0 0 16px;">
              Your permission request for <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${fromPath}</code> has been <strong style="color:#dc2626;">rejected</strong> by an administrator.
            </p>
            ${rejectReason ? `<p style="color:#555;font-size:14px;margin:0 0 16px;padding:12px;background:#fef2f2;border-radius:6px;border-left:3px solid #dc2626;">Reason: ${rejectReason}</p>` : ''}
            <p style="color: #333; font-size: 14px; margin: 0;">
              If you believe this is a mistake, please contact your administrator directly.
            </p>
          </div>
          <p style="color: #999; font-size: 12px; margin: 20px 0 0; text-align: center;">
            💡 This message was sent automatically by the Smart Reminder Platform.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[permission-request] 发送拒绝邮件失败:', (err as Error).message);
  }
}
