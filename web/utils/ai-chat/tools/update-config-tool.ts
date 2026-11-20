import { readEnvFile, writeEnvFile, formatEnvValue } from '@/utils/env';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/** 命中即视为敏感值（回显时脱敏，不把密钥原文写进会话上下文） */
const SENSITIVE_PATTERN = /KEY|SECRET|TOKEN|PASSWORD|WEBHOOK|DSN/i;

/**
 * 对敏感值做脱敏
 * @param {string} value - 原始值
 * @returns {string} 脱敏后的值
 */
const maskValue = (value: string): string => {
  if (!value) return '（空）';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}****${value.slice(-2)}`;
};

/**
 * update_config 工具实现（配置写能力）
 * @description 改系统配置（web/.env）。配置写错会让整个系统起不来，因此只放开「改已有键」，
 *   不允许凭空新增键；并纳入副作用白名单——严格模式下先建审批单，由超级管理员通过后生效。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "把企微机器人地址换一下"      → { key: 'WECOM_WEBHOOK', value: 'https://...' }
 *   - "高德 Key 换成 xxx"          → { key: 'AMAP_KEY', value: 'xxx' }
 */
export const updateConfigTool: ToolImpl = {
  name: 'update_config',
  description:
    '修改系统配置（web/.env）中**已存在**的某个键。不确定键名时先用 query_config 查。'
    + '禁止凭空新增键：key 不在现有配置里会被拒绝（配置写错可能让服务起不来）。'
    + '敏感键（KEY / SECRET / TOKEN / PASSWORD / WEBHOOK）写入成功后只回显脱敏值，不会把密钥原文带进对话。'
    + '多数配置需要重启 Web 服务才生效，改完要提醒用户。',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: '配置键名（大写下划线，如 AMAP_KEY）；先用 query_config 确认' },
      value: { type: 'string', description: '要写入的值；传空串表示清空该配置' },
    },
    required: ['key', 'value'],
  },
  requiredPermissions: ['config:edit'],
  invoke: async (args): Promise<ToolResult> => {
    const key = typeof args.key === 'string' ? args.key.trim() : '';
    const rawValue = typeof args.value === 'string' ? args.value : '';
    const value = rawValue.trim();

    if (!key) return { ok: false, data: 'key 不能为空：先用 query_config 查看可修改的配置键' };
    if (!/^[A-Za-z0-9_]+$/.test(key)) {
      return { ok: false, data: `key 只能包含字母数字下划线，当前为 ${key}` };
    }

    const env = readEnvFile();
    if (!(key in env)) {
      const available = Object.keys(env).slice(0, 20).join('、');
      return {
        ok: false,
        data: `配置里不存在键 ${key}，不允许新增。现有键（前 20 个）：${available || '（配置为空）'}`,
      };
    }
    if (env[key] === value) {
      return { ok: false, data: `${key} 的新值与当前值相同，无需修改` };
    }

    const before = env[key];
    // 同配置页：值含空格或 | & $ 等字符时补引号，避免脚本 source .env 时被拆成命令
    writeEnvFile({ [key]: formatEnvValue(value) });

    const sensitive = SENSITIVE_PATTERN.test(key);
    return {
      ok: true,
      data: {
        key,
        changed: true,
        before: sensitive ? maskValue(before) : before,
        after: sensitive ? maskValue(value) : value,
        sensitive,
        restart_hint: '多数配置需重启 Web 服务后生效（可用 manage_service 重启，或提示用户手动重启）',
      },
      summary: `已更新配置 ${key}${sensitive ? '（值已脱敏）' : ''}，多数配置需重启 Web 服务后生效`,
    };
  },
};
