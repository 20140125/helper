import type { ChatMessage, ToolImpl } from '@/types/ai-chat';
import { lastUserText } from './planning';

/** 工具裁剪结果 */
export interface ToolScopeResult {
  /** 本轮实际提供给模型的工具 */
  tools: ToolImpl[];
  /** 命中的场景名（便于调试与 SSE meta） */
  scenarios: string[];
  /** 是否未裁剪（全量工具） */
  full: boolean;
}

/** 所有场景都保留的基础工具：说明书、委派、审批、页面链接、当前用户身份 */
const ALWAYS_TOOL_NAMES: string[] = [
  'load_skill',
  'delegate_task',
  'request_approval',
  'query_pages',
  'query_current_user',
];

/** 各场景工具包，尽量按 web/skills/* 的 tools 声明分组并补充易混工具 */
const SCENARIO_TOOL_NAMES: Record<string, string[]> = {
  default: [
    'query_knowledge',
    'query_knowledge_docs',
    'query_workday',
  ],
  ops: [
    'query_system_status',
    'query_service_status',
    'query_logs',
    'query_config',
    'query_rules',
    'query_cache',
    'query_api_responses',
    'manage_service',
    'list_scripts',
    'trigger_script',
    'annual_update',
    'query_workday',
  ],
  knowledge: [
    'query_knowledge',
    'query_knowledge_docs',
    'query_project_map',
    'read_project_file',
    'list_apis',
    'query_api_categories',
  ],
  business: [
    'query_rules',
    'query_config',
    'query_message_templates',
    'query_greetings',
    'query_reminder_quotes',
    'query_webhooks',
    'query_rbac',
    'query_permission_requests',
    'query_workday',
    'query_pages',
    'list_apis',
    'query_api_categories',
    'query_cache',
    'query_api_responses',
    'query_conversations',
  ],
  external: [
    'card_skill',
    'web_search',
    'query_ip',
    'translate',
    'amap_poi',
    'amap_route',
    'amap_geocode',
    'amap_inputtips',
    'amap_district',
    'amap_static_map',
  ],
  push: [
    'send_wecom_message',
    'query_webhooks',
    'query_message_templates',
    'create_rule',
    'manage_webhook',
  ],
  write: [
    'update_config',
    'manage_cache',
    'manage_webhook',
    'manage_rbac',
    'manage_logs',
    'manage_knowledge',
    'create_rule',
    'manage_rule',
    'annual_update',
    'query_config',
    'query_rules',
    'query_rbac',
    'query_cache',
    'query_logs',
  ],
  script: [
    'list_scripts',
    'trigger_script',
    'annual_update',
    'card_skill',
  ],
};

/** 场景识别规则；按顺序匹配，命中多个场景时取并集 */
const SCENARIO_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'ops', pattern: /服务|端口|进程|pid|守护|daemon|launcher|重启|启停|挂了|起不来|排障|排查|报错|日志|cpu|内存|磁盘|资源|状态|提醒没发|脚本没跑|9527|3001/i },
  { name: 'knowledge', pattern: /知识库|文档|规范|怎么用|怎么配置|怎么新增|项目结构|源码|代码|文件|页面在哪|rag|检索|扩展开发/i },
  { name: 'business', pattern: /规则|模板|文案|权限|角色|rbac|webhook|页面|接口|api|缓存|白名单|节假日|工作日|提醒|quotes|会话|历史对话/i },
  { name: 'external', pattern: /天气|热搜|新闻|行情|股票|基金|黄金|汇率|油价|星座|黄历|日历|历史今天|空气|aqi|地图|地址|路线|poi|经纬度|翻译|ip|联网|搜索|查一下/i },
  { name: 'push', pattern: /推送|发到群|企微|群消息|通知|发群|发消息|send/i },
  { name: 'script', pattern: /脚本|执行|跑一下|出图|卡片|生成图|绘图|架构图|时序图/i },
  { name: 'write', pattern: /修改|改成|设置|设为|新增|创建|删除|清空|覆盖|写入|导入|重建|开启|关闭|保存|编辑|审批|改名/i },
];

/** 明确询问工具能力时返回全量，避免裁剪掉正在讨论的工具 */
const FULL_SCOPE_PATTERN = /有哪些工具|什么工具|哪个工具|选哪个工具|工具路由|tool[\s_-]?router|全部工具|所有工具|你能用什么/i;

/**
 * 根据用户语义识别本轮场景
 * @param {string} text - 用户最新消息文本
 * @returns {string[]} 命中场景列表
 */
export const detectToolScenarios = (text: string): string[] => {
  if (FULL_SCOPE_PATTERN.test(text)) return ['all'];
  const matched = SCENARIO_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => name);
  return matched.length > 0 ? matched : ['default'];
};

/**
 * 按场景裁剪可用工具
 * @param {ToolImpl[]} tools - 已按权限过滤后的工具列表
 * @param {ChatMessage[] | string} messagesOrText - 完整消息列表或用户最新文本
 * @returns {ToolScopeResult} 裁剪结果
 * @description 只影响发给模型的 tool schema 与 system prompt 工具名；工具执行仍走全局 findTool，
 *   因此不会破坏已发生的 tool_call。未命中任何场景时使用 default 小工具包，避免空工具列表。
 */
export const selectToolsByScenario = (
  tools: ToolImpl[],
  messagesOrText: ChatMessage[] | string,
): ToolScopeResult => {
  const text = typeof messagesOrText === 'string'
    ? messagesOrText
    : lastUserText(messagesOrText);
  // 用户显式说出工具名时返回全量，避免裁剪掉他指定的工具
  const lowerText = text.toLowerCase();
  if (tools.some((tool) => lowerText.includes(tool.name.toLowerCase()))) {
    return { tools, scenarios: ['explicit-tool'], full: true };
  }
  const scenarios = detectToolScenarios(text);
  if (scenarios.includes('all')) {
    return { tools, scenarios, full: true };
  }

  const allowed = new Set<string>(ALWAYS_TOOL_NAMES);
  for (const scenario of scenarios) {
    for (const name of SCENARIO_TOOL_NAMES[scenario] ?? []) allowed.add(name);
  }

  const scoped = tools.filter((tool) => allowed.has(tool.name));
  if (scoped.length === 0) {
    return { tools, scenarios: [...scenarios, 'fallback'], full: true };
  }
  return { tools: scoped, scenarios, full: false };
};
