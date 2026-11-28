import {
  isValidFilename,
  validateCacheWriteParams,
  writeCacheFile,
  listCacheFiles,
} from '@/routes/utils';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * 兜底：把待写内容统一成合法 JSON 字符串
 * @param {unknown} raw - 工具入参 content（对象或 JSON 字符串皆可）
 * @returns {string} JSON 字符串
 */
const toJsonString = (raw: unknown): string =>
  typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);

/**
 * manage_cache 工具实现（缓存写能力）
 * @description query_cache 只能看，改数据库 已有业务表 的缓存键此前只能去 Web「缓存文件」页手改。
 *   本工具补齐整文件写入能力，并纳入增删改白名单——严格模式下会先建审批单，
 *   由超级管理员通过后生效。只写**已存在**的缓存键（*.json），不允许新建、不允许路径穿越。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "把节假日数据这份缓存整个替换掉"   → { action: 'write', filename: 'holiday_data.json', content: {...} }
 *   - "改一下守护进程发送状态缓存"        → { action: 'write', filename: 'daemon_sent_state.json', content: {...} }
 */
export const manageCacheTool: ToolImpl = {
  name: 'manage_cache',
  description:
    '整文件写入数据库 已有业务表 的缓存键（覆盖原内容，不可撤销）。'
    + 'action 只有 write：必传 filename（.json 结尾，可带子目录）与 content；只能改已存在的文件，不能新建。'
    + '改角色 / 用户授权用 manage_rbac，不要直接改 rbac.json / users.json。'
    + '不确定文件名先用 query_cache 不带参数看列表；写之前跟用户复述要改哪个文件与影响。',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['write'],
        description: '操作类型：write（整文件覆盖写入）',
      },
      filename: {
        type: 'string',
        description: '缓存文件名，必须以 .json 结尾（如 holiday_data.json / api_responses/weather_深圳_2026-05.json）',
      },
      content: {
        description: '新的文件内容：JSON 字符串，或直接给对象（工具会序列化）',
      },
    },
    required: ['action', 'filename', 'content'],
  },
  requiredPermissions: ['cache:edit'],
  invoke: async (args): Promise<ToolResult> => {
    const action = typeof args.action === 'string' ? args.action.trim() : '';
    if (action !== 'write') {
      return { ok: false, data: `不支持的 action：${action}（目前只支持 write）` };
    }

    const filename = typeof args.filename === 'string' ? args.filename.trim() : '';
    if (!isValidFilename(filename)) {
      return {
        ok: false,
        data: `非法文件名：${filename || '(空)'}；必须是 .json 结尾、不含 .. 与绝对路径`,
      };
    }

    const content = toJsonString(args.content);
    const invalid = validateCacheWriteParams(filename, content);
    if (invalid) {
      return { ok: false, data: invalid };
    }

    // 只允许改已存在的缓存键：避免 LLM 凭空造缓存键污染 已有业务表
    // name 是相对路径（子目录形如 api_responses/xxx.json）
    const files = await listCacheFiles();
    const exists = files.some((f) => f.name === filename);
    if (!exists) {
      return {
        ok: false,
        data: `缓存文件不存在：${filename}；先调 query_cache 不带参数看当前有哪些文件`,
      };
    }

    const writeError = await writeCacheFile(filename, content);
    if (writeError) {
      return { ok: false, data: `写入失败：${writeError}` };
    }

    return {
      ok: true,
      data: { filename, bytes: Buffer.byteLength(content, 'utf-8') },
      summary: `已写入缓存文件 ${filename}（${Buffer.byteLength(content, 'utf-8')} 字节）`,
    };
  },
};
