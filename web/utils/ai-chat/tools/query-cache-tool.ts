import {
  CACHE_DIR,
  readCacheJsonFile,
  readDailyData,
  listDailyDataFiles,
  readApiResponse,
  listApiResponses,
} from '@/routes/utils';
import { readPermissionMetas, readRbacConfig } from '@/utils/rbac';
import { readUsers } from '@/utils/auth';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

// ──────────────────────────
// query_cache 工具实现
// 触发示例（仅供维护者参考，不会发送给 LLM）：
//   - "缓存里有哪些节假日数据？"                   → { target: 'holiday' }
//   - "看一下权限配置"                            → { target: 'rbac' }
//   - "消息模板有哪些？"                          → { target: 'message_templates' }
//   - "今天的数据缓存是什么？"                     → { target: 'daily_data', date: '2026-05-25' }
//   - "天气 API 响应缓存"                        → { target: 'api_response', filename: 'weather_深圳_2026-05.json' }
//   - "守护进程的发送状态"                         → { target: 'daemon_sent_state' }
//   - "列出所有可用的缓存类型"                     → {}（list 模式）
// ──────────────────────────

/**
 * query_cache 支持的目标类型
 *
 * 说明：以下数据已有专用查询工具，故不纳入本工具，避免 LLM 重复查询：
 *  - api_items       → list_apis
 *  - reminder_quotes → query_reminder_quotes
 *  - custom_rules    → query_rules
 */
const CACHE_TARGETS = [
  'holiday',
  'permission_metas',
  'permission_requests',
  'rbac',
  'api_categories',
  'message_templates',
  'month_config',
  'greetings',
  'daily_data',
  'api_response',
  'users',
  'daemon_sent_state',
] as const;

type CacheTarget = (typeof CACHE_TARGETS)[number];

/** 简单 JSON 文件读取的 target → 文件名映射 */
const SIMPLE_CACHE_FILE_MAP: Record<string, string> = {
  holiday: 'holiday_data.json',
  permission_metas: 'permission_metas.json',
  permission_requests: 'permission_requests.json',
  rbac: 'rbac.json',
  api_categories: 'api_categories.json',
  message_templates: 'message_templates.json',
  month_config: 'month_config.json',
  users: 'users.json',
  daemon_sent_state: 'daemon_sent_state.json',
};

/** 构建 list 模式的返回结果 */
const buildCacheListResult = (): ToolResult => ({
  ok: true,
  data: {
    available_targets: [...CACHE_TARGETS],
    description: {
      holiday: '节假日数据（含调休）',
      permission_metas: '权限码元信息列表（数据来自数据库，非 .cache JSON）',
      permission_requests: '权限申请记录列表',
      rbac: '角色权限配置（roles + userRoles，数据来自数据库，非 .cache JSON）',
      api_categories: 'API 接口分类',
      message_templates: '消息模板列表',
      month_config: '月份配置',
      greetings: '节日祝福语（数据量大，建议用 keyword 过滤）',
      daily_data: '每日数据缓存（需指定 date 参数）',
      api_response: 'API 响应缓存（需指定 filename 或用 list 模式）',
      users: '用户数据（含管理员标识、首次/最近登录时间，数据来自数据库，非 .cache JSON）',
      daemon_sent_state: '守护进程各类提醒的最近发送日期',
    },
  },
  summary: `当前支持 ${CACHE_TARGETS.length} 种缓存查询`,
});

/** 通用：读取简单 JSON 缓存文件并返回 ToolResult */
const handleSimpleCacheFile = (target: string, fileName: string): ToolResult => {
  const data = readCacheJsonFile(CACHE_DIR, fileName);
  const summaryMap: Record<string, string> = {
    holiday: '节假日数据（含调休安排）',
    permission_metas: `权限元信息共 ${Array.isArray(data) ? data.length : '?'} 条`,
    permission_requests: `权限申请记录共 ${Array.isArray(data) ? data.length : '?'} 条`,
    rbac: '角色权限配置',
    api_categories: `API 分类共 ${Array.isArray(data) ? data.length : '?'} 个`,
    message_templates: `消息模板共 ${Array.isArray(data) ? data.length : '?'} 个`,
    month_config: '月份配置',
    users: `用户数据共 ${Array.isArray((data as { users?: unknown[] })?.users) ? (data as { users: unknown[] }).users.length : '?'} 条`,
    daemon_sent_state: '守护进程发送状态',
  };
  return {
    ok: true,
    data,
    summary: summaryMap[target] ?? `缓存文件：${fileName}`,
  };
};

/** 处理已迁库的 target：直接读数据库，不再读 .cache 下的 JSON 文件 */
const handleDbCacheTarget = async (target: string): Promise<ToolResult> => {
  let data: unknown;
  if (target === 'permission_metas') {
    data = await readPermissionMetas();
  } else if (target === 'rbac') {
    data = await readRbacConfig();
  } else {
    data = (await readUsers()).users;
  }
  return { ok: true, data, summary: '数据来自数据库' };
};

/** 处理 greetings（支持 keyword 过滤 + limit） */
const handleGreetings = (keyword: string, limitNum: number): ToolResult => {
  const raw = readCacheJsonFile(CACHE_DIR, 'greetings.json');
  if (!Array.isArray(raw)) {
    return { ok: false, data: '祝福语数据格式异常' };
  }
  const filtered = keyword
    ? raw.filter((item: { key?: string; text?: string }) =>
      (item.key ?? '').toLowerCase().includes(keyword)
        || (item.text ?? '').toLowerCase().includes(keyword))
    : raw;
  const slice = filtered.slice(0, limitNum);
  return {
    ok: true,
    data: { items: slice, total: filtered.length, returned: slice.length },
    summary: `祝福语共 ${raw.length} 条，匹配 ${filtered.length} 条，返回 ${slice.length} 条`,
  };
};

/** 处理 daily_data（支持指定 date，找不到时列出可用文件） */
const handleDailyData = (dateArg: unknown): ToolResult => {
  const date = typeof dateArg === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateArg)
    ? dateArg
    : new Date().toISOString().slice(0, 10);
  const data = readDailyData(CACHE_DIR, date);
  if (!data) {
    const files = listDailyDataFiles(CACHE_DIR);
    return {
      ok: true,
      data: { requested_date: date, found: false, available_files: files },
      summary: `未找到 ${date} 的每日数据，可用文件共 ${files.length} 个`,
    };
  }
  return {
    ok: true,
    data: { date, content: data },
    summary: `${date} 的每日数据`,
  };
};

/** 处理 api_response（支持列出所有文件或读取指定文件） */
const handleApiResponse = (filenameArg: unknown): ToolResult => {
  const filename = typeof filenameArg === 'string' ? filenameArg.trim() : '';
  if (!filename) {
    const files = listApiResponses(CACHE_DIR);
    return {
      ok: true,
      data: { available_files: files, total: files.length },
      summary: `API 响应缓存共 ${files.length} 个文件，请指定 filename 查看具体内容`,
    };
  }
  const data = readApiResponse(CACHE_DIR, filename);
  if (!data) {
    const files = listApiResponses(CACHE_DIR);
    return {
      ok: false,
      data: `文件 "${filename}" 不存在。可用文件：${files.join('、')}`,
    };
  }
  return {
    ok: true,
    data,
    summary: `API 响应缓存：${filename}`,
  };
};

/** target → handler 映射表（消除 if-else 分支） */
const CACHE_HANDLER_MAP: Record<string, (args: Record<string, unknown>, keyword: string, limitNum: number) => ToolResult | Promise<ToolResult>> = {
  // 简单 JSON 文件读取（直接从映射表读取）
  holiday: () => handleSimpleCacheFile('holiday', SIMPLE_CACHE_FILE_MAP.holiday),
  permission_metas: () => handleDbCacheTarget('permission_metas'),
  permission_requests: () => handleSimpleCacheFile('permission_requests', SIMPLE_CACHE_FILE_MAP.permission_requests),
  rbac: () => handleDbCacheTarget('rbac'),
  api_categories: () => handleSimpleCacheFile('api_categories', SIMPLE_CACHE_FILE_MAP.api_categories),
  message_templates: () => handleSimpleCacheFile('message_templates', SIMPLE_CACHE_FILE_MAP.message_templates),
  month_config: () => handleSimpleCacheFile('month_config', SIMPLE_CACHE_FILE_MAP.month_config),
  users: () => handleDbCacheTarget('users'),
  daemon_sent_state: () => handleSimpleCacheFile('daemon_sent_state', SIMPLE_CACHE_FILE_MAP.daemon_sent_state),
  // 特殊处理逻辑
  greetings: (_args, keyword, limitNum) => handleGreetings(keyword, limitNum),
  daily_data: (args) => handleDailyData(args.date),
  api_response: (args) => handleApiResponse(args.filename),
};

export const queryCacheTool: ToolImpl = {
  name: 'query_cache',
  description:
    '查 .cache/ 下的系统缓存数据（不含对话记录）。不传 target 返回可用类型列表。'
    + '查 API 接口用 list_apis；查提醒寄语用 query_reminder_quotes；查自定义规则用 query_rules。',
  parameters: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        enum: [...CACHE_TARGETS],
        description: '缓存类型；holiday=节假日、rbac=角色权限、greetings=节日祝福语、daily_data=每日数据、api_response=API 响应、daemon_sent_state=守护进程发送状态，其他同名',
      },
      date: {
        type: 'string',
        description: 'daily_data 专用，YYYY-MM-DD，默认今天',
      },
      filename: {
        type: 'string',
        description: 'api_response 专用；不传则列文件',
      },
      keyword: {
        type: 'string',
        description: 'greetings 过滤词',
      },
      limit: {
        type: 'number',
        description: '返回条数，默认 20，最大 200',
      },
    },
  },
  requiredPermissions: ['cache:view'],
  invoke: async (args): Promise<ToolResult> => {
    const target = typeof args.target === 'string' ? args.target.trim() : '';

    // list 模式：不传 target 时返回所有可用类型
    if (!target) {
      return buildCacheListResult();
    }

    // 校验 target 是否合法
    if (!CACHE_TARGETS.includes(target as CacheTarget)) {
      return {
        ok: false,
        data: `不支持 target="${target}"，可用：${CACHE_TARGETS.join('、')}`,
      };
    }

    const limitNum = Math.min(Math.max(Number(args.limit) || 20, 1), 200);
    const keyword = typeof args.keyword === 'string' ? args.keyword.toLowerCase() : '';

    // 从映射表获取处理函数并执行
    const handler = CACHE_HANDLER_MAP[target];
    if (handler) {
      return await handler(args, keyword, limitNum);
    }

    return { ok: false, data: `target="${target}" 未实现` };
  },
};
