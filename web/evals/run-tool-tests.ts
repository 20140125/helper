/**
 * AI Agent 工具层单测
 *
 * @description 不碰 LLM、不联网、不写文件，只测**纯逻辑与防御性边界**这层——
 *   对应 09-10 测试金字塔的第 ① 层，跑一次是秒级的，改工具时应当第一个跑它。
 *
 *   为什么不用测试框架：项目后端目前没有任何测试依赖（jest / vitest 都没装），
 *   为一个「不需要 mock、不需要并发、不需要覆盖率」的场景引入整套框架不划算。
 *   这里用 Node 内置的 `node:assert/strict` + 三十行 mini harness 解决，零新增依赖。
 *   等真的需要 mock / watch / 覆盖率时，再整体迁移到 vitest 也不迟。
 *
 * 覆盖的四类断言：
 *   1. 契约：工具注册、命名、schema 结构、权限码合法
 *   2. 权限：工具级 RBAC 过滤是否真的把无权工具挡在模型视野外
 *   3. 防御：非法入参必须被夹紧/拒绝，且失败要给出可恢复的引导（09-9 的防线）
 *   4. consent：副作用工具的意图摘录校验
 *
 * 用法（在 web/ 目录下）：
 *   npm run test:tools                        # 跑全部
 *   npm run test:tools -- --filter=query_logs # 只跑名字含该串的用例
 */

import assert from 'node:assert/strict';
import { checkConsent } from '@/utils/ai-chat/tools/_consent-guard';
import { ALL_TOOLS, getAvailableTools, buildToolDefinitions } from '@/utils/ai-chat/tools';
import { findTool } from '@/utils/ai-chat/tools/index';
import { queryLogsTool } from '@/utils/ai-chat/tools/query-logs-tool';
import { queryCacheTool } from '@/utils/ai-chat/tools/query-cache-tool';
import { translateTool } from '@/utils/ai-chat/tools/translate-tool';
import { loadSkillTool } from '@/utils/ai-chat/tools/load-skill-tool';
import { queryProjectMapTool } from '@/utils/ai-chat/tools/query-project-map-tool';
import { readProjectFileTool } from '@/utils/ai-chat/tools/read-project-file-tool';
import {
  listSkillDocs,
  listSkillMetas,
  findSkillDoc,
  findSkillDocByTool,
  parseSkillFrontmatter,
} from '@/utils/ai-chat/skill-docs';
import { Permission } from '@/types/permission';
import type { ToolContext, ToolImpl, ToolResult } from '@/types/ai-chat';

// ──────────────────────────
// mini 测试框架
// ──────────────────────────

/** 单个用例的执行结果 */
interface TestResult {
  /** 用例名 */
  name: string;
  /** 通过 / 跳过 / 失败 */
  status: 'passed' | 'skipped' | 'failed';
  /** 失败原因或跳过原因 */
  message?: string;
}

/** 用例登记表 */
const registry: Array<{ name: string; fn: () => void | Promise<void> }> = [];
/** 跳过登记表（依赖运行环境的用例，登记时就知道跑不了） */
let skippedCount = 0;

/**
 * 注册一个用例
 * @param {string} name - 用例名（建议 `模块/断言点` 形式，便于 --filter）
 * @param {() => void | Promise<void>} fn - 用例体，抛异常即失败
 * @returns {void}
 */
const test = (name: string, fn: () => void | Promise<void>): void => {
  registry.push({ name, fn });
};

/**
 * 跳过一个用例（例如依赖真实日志文件存在）
 * @param {string} reason - 跳过原因
 * @returns {never} 抛出约定的 SKIP 标记，由执行器识别
 * @description 用异常做控制流，避免给每个用例都设计返回值
 */
const skip = (reason: string): never => {
  const err = new Error(reason);
  err.name = 'SkipError';
  throw err;
};

/**
 * 构造工具执行上下文
 * @param {string[]} permissions - 该「用户」拥有的权限码
 * @returns {ToolContext} 工具执行上下文
 */
const ctxWith = (permissions: string[]): ToolContext => ({
  userEmail: 'eval@helper.local',
  userPermissions: permissions,
});

/**
 * 调用工具并断言调用成功
 * @param {ToolImpl} tool - 工具实现
 * @param {Record<string, unknown>} args - 入参
 * @param {string[]} [permissions] - 权限码，默认给全量
 * @returns {Promise<ToolResult>} 工具返回结果
 */
const invoke = async (tool: ToolImpl, args: Record<string, unknown>, permissions?: string[]): Promise<ToolResult> => {
  return tool.invoke(args, ctxWith(permissions ?? Object.values(Permission) as string[]));
};

/**
 * 断言工具调用失败，并返回失败信息原文
 * @param {ToolResult} result - 工具返回结果
 * @param {string} keyword - data 中应包含的关键词（确保失败信息「可恢复」而非一句废话）
 * @returns {string} 失败信息原文
 * @description 09-9 强调：失败要「给出引导」而不是「报错了」。
 *   所以这里不只断言 ok=false，还断言信息里带了下一步怎么做的线索
 */
const expectFailureWithHint = (result: ToolResult, keyword: string): string => {
  assert.equal(result.ok, false, '期望工具返回失败');
  const text = String(result.data ?? '');
  assert.ok(text.includes(keyword), `失败信息应包含「${keyword}」，实际：${text.slice(0, 80)}`);
  return text;
};

// ──────────────────────────
// 1. 契约：工具注册与 schema
// ──────────────────────────

test('registry/工具数量与去重', () => {
  assert.ok(ALL_TOOLS.length >= 20, `工具数量异常：${ALL_TOOLS.length}`);
  const names = ALL_TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, '存在重复注册的工具名');
});

test('registry/蛇形命名', () => {
  ALL_TOOLS.forEach((t) => {
    assert.match(t.name, /^[a-z][a-z0-9_]*$/, `工具名不符合蛇形规范：${t.name}`);
  });
});

test('registry/下划线内部模块未被注册成工具', () => {
  // _consent-guard.ts 是内部辅助模块，一旦被误当工具注册，LLM 会看到一个不该存在的函数
  assert.equal(findTool('checkConsent'), undefined, '内部模块不应出现在工具表里');
  assert.ok(!ALL_TOOLS.some((t) => t.name.startsWith('_')), '存在下划线开头的工具名');
});

test('registry/schema 结构合法', () => {
  ALL_TOOLS.forEach((t) => {
    assert.ok(t.description.trim().length > 0, `${t.name} 的 description 为空，LLM 无法判断何时调用`);
    assert.equal(t.parameters?.type, 'object', `${t.name} 的 parameters.type 必须是 object`);
    assert.ok(t.parameters?.properties, `${t.name} 缺少 properties`);
  });
});

test('registry/权限码必须是已定义的 Permission 枚举值', () => {
  // 拼错权限码不会报错，只会让这个工具对所有人永久不可见——静默故障最难查
  const known = new Set<string>(Object.values(Permission) as string[]);
  ALL_TOOLS.forEach((t) => {
    (t.requiredPermissions ?? []).forEach((p) => {
      assert.ok(known.has(p), `${t.name} 引用了未定义的权限码：${p}`);
    });
  });
});

test('registry/buildToolDefinitions 输出符合 OpenAI 协议', () => {
  const defs = buildToolDefinitions(ALL_TOOLS);
  assert.equal(defs.length, ALL_TOOLS.length);
  defs.forEach((d, i) => {
    assert.equal(d.type, 'function');
    assert.equal(d.function.name, ALL_TOOLS[i].name);
    assert.ok(d.function.description.length > 0);
  });
});

// ──────────────────────────
// 2. 权限：工具级 RBAC
// ──────────────────────────

test('rbac/无权限用户只拿到免权限工具', () => {
  const tools = getAvailableTools([]);
  assert.ok(tools.length > 0, '免权限工具不应为空，否则对话完全不可用');
  tools.forEach((t) => {
    assert.ok(
      !t.requiredPermissions || t.requiredPermissions.length === 0,
      `无权限用户不应看到 ${t.name}`,
    );
  });
});

test('rbac/按权限码精确放行', () => {
  const withLogs = getAvailableTools(['logs:view']);
  assert.ok(withLogs.some((t) => t.name === 'query_logs'), '有 logs:view 应能看到 query_logs');

  const withoutLogs = getAvailableTools(['rules:view']);
  assert.ok(!withoutLogs.some((t) => t.name === 'query_logs'), '无 logs:view 不应看到 query_logs');
});

test('rbac/无权限用户拿不到任何副作用工具', () => {
  // 这是 09-9 的硬防线：无权用户连工具定义都收不到，模型无从调用
  const tools = getAvailableTools([]);
  const sideEffect = tools.filter((t) => Object.prototype.hasOwnProperty.call(t.parameters?.properties ?? {}, 'user_consent_phrase'));
  assert.equal(sideEffect.length, 0, `无权限用户竟然能看到副作用工具：${sideEffect.map((t) => t.name).join(', ')}`);
});

test('rbac/副作用工具必须配置权限码', () => {
  // 副作用工具如果没有权限码兜底，就等于把「能不能推消息」完全交给提示词的软约束
  ALL_TOOLS.forEach((t) => {
    const isSideEffect = Object.prototype.hasOwnProperty.call(t.parameters?.properties ?? {}, 'user_consent_phrase');
    if (!isSideEffect) return;
    assert.ok(
      t.requiredPermissions && t.requiredPermissions.length > 0,
      `副作用工具 ${t.name} 必须配置 requiredPermissions 作为硬约束`,
    );
  });
});

// ──────────────────────────
// 3. consent 守卫
// ──────────────────────────

test('consent/缺失与空白一律拒绝', () => {
  assert.equal(checkConsent('', 'exec').ok, false);
  assert.equal(checkConsent('   ', 'push').ok, false);
});

test('consent/超长视为编造', () => {
  const tooLong = '帮'.repeat(101);
  const verdict = checkConsent(tooLong, 'exec');
  assert.equal(verdict.ok, false);
  assert.ok(!verdict.ok && verdict.reason.includes('100'), '失败信息应说明长度上限');
});

test('consent/正常摘录通过', () => {
  assert.equal(checkConsent('帮我把生日提醒脚本跑一下', 'exec').ok, true);
  assert.equal(checkConsent('帮'.repeat(100), 'push').ok, true, '恰好 100 字应通过');
});

// ──────────────────────────
// 4. 防御性边界（09-9 的防线要有测试锁住）
// ──────────────────────────

test('query_logs/未知 log_key 被拒绝且给出引导', async () => {
  const result = await invoke(queryLogsTool, { log_key: 'not_a_log' });
  expectFailureWithHint(result, '未知 log_key');
});

test('query_logs/路径穿越被拒绝', async () => {
  // 09-9 的核心论点：参数必须是枚举 + 夹紧，绝不能是自由路径
  const attacks = ['../../etc/passwd', '/etc/passwd', '../../../scripts/.env', '..%2f..%2fetc'];
  for (const attack of attacks) {
    const result = await invoke(queryLogsTool, { log_key: attack });
    expectFailureWithHint(result, '未知 log_key');
  }
});

test('query_logs/lines 超范围被夹紧', async () => {
  const listed = await invoke(queryLogsTool, {});
  if (!listed.ok) {
    skip(`日志来源清单不可用，跳过 lines 夹紧断言：${String(listed.data ?? '')}`);
  }
  const available = (listed.data as { available_logs?: Array<{ source: string }> }).available_logs ?? [];
  if (available.length === 0) {
    skip('库里尚无日志记录，夹紧断言需要真实日志才能观测');
  }

  const firstKey = available[0].source;
  const tooMany = await invoke(queryLogsTool, { log_key: firstKey, lines: 999999 });
  assert.equal(tooMany.ok, true, '夹紧后应正常返回，而不是报错');
  const data = tooMany.data as { lines?: number; content?: string };
  if (typeof data.lines !== 'number') {
    skip(`日志 ${firstKey} 尚未生成，无法观测 lines 夹紧结果`);
  }
  assert.equal(data.lines, 500, `lines 应夹紧到 500，实际 ${data.lines}`);

  const negative = await invoke(queryLogsTool, { log_key: firstKey, lines: -5 });
  assert.equal((negative.data as { lines?: number }).lines, 1, 'lines 为负应夹紧到下限 1');

  // 已知实现细节：`Number(args.lines) || 50` 用 falsy 回落，所以 0 被当成「没传」取默认 50，
  // 而负数走的是 Math.max 夹紧取 1。两者都是无意义入参，行为不一致但都无害，
  // 这里按现状锁定，避免将来有人「顺手改一下」却没意识到改的是哪条分支。
  const zero = await invoke(queryLogsTool, { log_key: firstKey, lines: 0 });
  assert.equal((zero.data as { lines?: number }).lines, 50, 'lines=0 走 falsy 回落到默认 50');
});

test('query_cache/非法 target 被拒绝且列出可用值', async () => {
  const result = await invoke(queryCacheTool, { target: '../../.env' });
  const text = expectFailureWithHint(result, '不支持 target');
  assert.ok(text.includes('可用'), '失败信息应列出可用 target，便于 LLM 自我纠正');
});

test('query_cache/不传 target 走 list 模式', async () => {
  const result = await invoke(queryCacheTool, {});
  assert.equal(result.ok, true);
  assert.ok(result.summary && result.summary.length > 0, 'list 模式应给出 summary');
});

test('translate/空文本被拒绝', async () => {
  const result = await invoke(translateTool, { text: '   ' });
  expectFailureWithHint(result, '缺少待翻译内容');
});

test('translate/超长文本被拒绝且不发起网络请求', async () => {
  // 超长时必须在 fetch 之前就返回，否则白白消耗一次外部调用
  const result = await invoke(translateTool, { text: 'a'.repeat(501) });
  const text = expectFailureWithHint(result, '500');
  assert.ok(text.includes('分段'), '失败信息应告诉调用方怎么恢复');
});

// ──────────────────────────
// 5. md 技能（load_skill）
// ──────────────────────────

test('skill-docs/frontmatter 解析与无 frontmatter 兜底', () => {
  const raw = [
    '---',
    'name: demo',
    'description: 一句话说明',
    'effect: read',
    'permissions:',
    '  - rules:view',
    '  - config:view',
    '---',
    '',
    '# 标题',
    '正文内容',
  ].join('\n');
  const { front, body } = parseSkillFrontmatter(raw);
  assert.equal(front.name, 'demo');
  assert.equal(front.effect, 'read');
  assert.deepEqual(front.permissions, ['rules:view', 'config:view']);
  assert.ok(body.startsWith('# 标题'), '正文应已剥离 frontmatter');
  assert.ok(!body.includes('---'), '正文里不应残留 frontmatter 分隔符');

  // 技能文档写错了不该让 Agent 挂掉：解析不出 frontmatter 就整篇当正文
  const plain = parseSkillFrontmatter('# 没有 frontmatter\n正文');
  assert.deepEqual(plain.front, {});
  assert.ok(plain.body.startsWith('# 没有 frontmatter'));
});

test('skill-docs/技能索引合法且按权限过滤', () => {
  const docs = listSkillDocs();
  if (docs.length === 0) skip('尚未配置任何 md 技能（web/skills/ 为空）');

  docs.forEach((d) => {
    assert.ok(d.name.length > 0, '技能名不能为空');
    assert.ok(['read', 'action', 'mutation'].includes(d.effect), `非法 effect：${d.effect}`);
    assert.ok(d.body.length > 0, `${d.name} 正文为空`);
    assert.ok(d.description.length > 0, `${d.name} 缺少 description，贾维斯无法判断何时加载`);
  });

  const metas = listSkillMetas(Object.values(Permission) as string[]);
  assert.equal(metas.length, docs.length, '全权限应能看到全部技能');
  // 零权限用户只能看到免权限技能：技能文档也可能含操作流程，不能无条件开放
  const zero = listSkillMetas([]);
  assert.ok(zero.every((m) => m.permissions.length === 0), '零权限用户竟能看到声明了权限的技能');
});

test('load_skill/不传 name 返回清单', async () => {
  const result = await invoke(loadSkillTool, {});
  assert.equal(result.ok, true);
  const data = result.data as { skills?: unknown[] };
  assert.ok(Array.isArray(data.skills), '清单模式应返回 skills 数组');
});

test('load_skill/未知技能名回吐可用清单', async () => {
  const result = await invoke(loadSkillTool, { name: 'no-such-skill' });
  const text = expectFailureWithHint(result, '未找到技能');
  if (listSkillDocs().length > 0) {
    assert.ok(text.includes('可用'), '未命中时应列出可用技能名，便于自我纠正');
  }
});

test('load_skill/正文剥离 frontmatter 且无权限被拦', async () => {
  const gated = listSkillDocs().find((d) => d.permissions.length > 0);
  if (!gated) {
    skip('没有声明权限的技能，无法观测权限拦截');
    return;
  }

  const ok = await invoke(loadSkillTool, { name: gated.name });
  assert.equal(ok.ok, true, `全权限应能加载 ${gated.name}`);
  const data = ok.data as { content?: string };
  assert.ok(data.content && data.content.length > 0, '应返回技能正文');
  assert.ok(!data.content.startsWith('---'), '下发的正文不应包含 frontmatter');

  const denied = await invoke(loadSkillTool, { name: gated.name }, ['ai-approvals:view']);
  expectFailureWithHint(denied, '无权限');
});

test('load_skill/技能名大小写与连字符容错', async () => {
  const docs = listSkillDocs();
  if (docs.length === 0) skip('尚未配置任何 md 技能');
  const fuzzy = docs[0].name.replace(/-/g, '_').toUpperCase();
  assert.ok(findSkillDoc(fuzzy), `技能名应忽略大小写与连字符差异：${fuzzy}`);
});

test('skill-docs/frontmatter 解析 tools 声明', () => {
  const raw = ['---', 'name: demo', 'description: 一句话', 'tools:', '  - query_rules', '  - manage_rule', '---', '', '正文'].join('\n');
  const { front } = parseSkillFrontmatter(raw);
  assert.deepEqual(front.tools, ['query_rules', 'manage_rule']);
});

test('skill-docs/tools 声明必须是真实存在的工具', () => {
  // 技能里拼错工具名不会报错，只会让「按工具反查」永远落空——和拼错权限码同属静默故障
  const known = new Set(ALL_TOOLS.map((t) => t.name));
  listSkillDocs().forEach((d) => {
    d.tools.forEach((tool) => {
      assert.ok(known.has(tool), `技能 ${d.name} 声明了不存在的工具：${tool}`);
    });
  });
});

test('skill-docs/按工具名反查技能', () => {
  if (listSkillDocs().length === 0) skip('尚未配置任何 md 技能');
  const rule = findSkillDocByTool('create_rule');
  assert.ok(rule, 'create_rule 应能反查到 reminder-rules 技能');
  assert.equal(rule.name, 'reminder-rules');

  const push = findSkillDocByTool('send_wecom_message');
  assert.ok(push, 'send_wecom_message 应能反查到 wecom-push 技能');
  assert.equal(push.name, 'wecom-push');

  assert.equal(findSkillDocByTool('no_such_tool'), undefined, '未声明的工具不应反查到技能');
});

// ──────────────────────────
// 6. 项目结构与源码（让贾维斯看懂这个项目）
// ──────────────────────────

test('project_map/顶层概览返回各目录规模', async () => {
  const result = await invoke(queryProjectMapTool, {});
  assert.equal(result.ok, true);
  const data = result.data as { entries: Array<{ path: string; type: string }>; total: number };
  assert.ok(data.total > 0, '顶层概览不应为空');
  const paths = data.entries.map((e) => e.path);
  ['scripts', 'web', 'docs'].forEach((p) => {
    assert.ok(paths.includes(p), `顶层概览应包含 ${p}`);
  });
});

test('project_map/按路径与关键词查询', async () => {
  const byPath = await invoke(queryProjectMapTool, { path: 'scripts', type: 'file', limit: 10 });
  assert.equal(byPath.ok, true);
  assert.ok((byPath.data as { total: number }).total > 0, 'scripts 下应有脚本文件');

  const miss = await invoke(queryProjectMapTool, { path: 'no/such/dir' });
  const text = expectFailureWithHint(miss, '没有匹配的条目');
  assert.ok(text.includes('顶层概览'), '查不到时应引导先看顶层概览');
});

test('read_project_file/路径穿越一律拒绝', async () => {
  const attacks = ['../../etc/passwd', '/etc/passwd', '../../../web/.env', 'scripts/../../etc/hosts'];
  for (const attack of attacks) {
    const result = await invoke(readProjectFileTool, { path: attack });
    assert.equal(result.ok, false, `路径穿越必须被拒绝：${attack}`);
  }
});

test('read_project_file/敏感文件与后缀被拒绝', async () => {
  const forbidden = ['web/.env', '.cache/rbac.json', 'web/.cache/x.json'];
  for (const p of forbidden) {
    const result = await invoke(readProjectFileTool, { path: p });
    assert.equal(result.ok, false, `敏感路径必须被拒绝：${p}`);
  }
});

test('read_project_file/正常读取带行号且可分段', async () => {
  const result = await invoke(readProjectFileTool, { path: 'scripts/reminder_daemon.sh', limit: 5 });
  assert.equal(result.ok, true, '白名单内的脚本应可读');
  const data = result.data as { total_lines: number; from_line: number; to_line: number; content: string };
  assert.equal(data.from_line, 1);
  assert.ok(data.total_lines > 5, '该文件应有多行');
  assert.match(data.content, /^1\t/, '内容应带行号前缀');

  const second = await invoke(readProjectFileTool, { path: 'scripts/reminder_daemon.sh', offset: 10, limit: 5 });
  assert.equal((second.data as { from_line: number }).from_line, 10, 'offset 应生效');
});

test('read_project_file/目录与不存在文件给出可恢复引导', async () => {
  const dir = await invoke(readProjectFileTool, { path: 'docs' });
  expectFailureWithHint(dir, 'query_project_map');

  const missing = await invoke(readProjectFileTool, { path: 'scripts/not_exist.sh' });
  expectFailureWithHint(missing, 'query_project_map');
});

// ──────────────────────────
// 执行器
// ──────────────────────────

/**
 * 执行全部用例并打印结果
 * @param {string} filter - 只跑名字包含该串的用例
 * @returns {Promise<TestResult[]>} 用例结果列表
 * @description 串行执行：用例里有真实文件读取，并发意义不大且会互相干扰
 */
const runAll = async (filter: string): Promise<TestResult[]> => {
  const results: TestResult[] = [];
  for (const item of registry) {
    if (filter && !item.name.includes(filter)) continue;
    try {
      await item.fn();
      results.push({ name: item.name, status: 'passed' });
      process.stdout.write(`✓ ${item.name}\n`);
    } catch (err) {
      const error = err as Error;
      if (error.name === 'SkipError') {
        results.push({ name: item.name, status: 'skipped', message: error.message });
        process.stdout.write(`○ ${item.name}  （跳过：${error.message}）\n`);
        continue;
      }
      results.push({ name: item.name, status: 'failed', message: error.message });
      process.stdout.write(`✗ ${item.name}\n    ${error.message}\n`);
    }
  }
  return results;
};

// ──────────────────────────
// N. 高德地图工具：契约与入参防御（不发真实网络请求）
// ──────────────────────────

/** 新增的地图类工具名（与 tools/ 下的实现一一对应） */
const AMAP_TOOL_NAMES = ['amap_geocode', 'amap_inputtips', 'amap_district', 'amap_static_map'];

test('amap/新工具已注册且 schema 完整', () => {
  AMAP_TOOL_NAMES.forEach((name) => {
    const tool = findTool(name);
    assert.ok(tool, `工具 ${name} 未注册`);
    assert.ok(tool.description.length > 20, `${name} 的 description 过短，LLM 无法判断何时调用`);
    const props = (tool.parameters as { properties?: Record<string, unknown> }).properties ?? {};
    assert.ok(Object.keys(props).length > 0, `${name} 缺少参数定义`);
  });
});

test('amap/新工具内部模块未被注册成工具', () => {
  assert.equal(findTool('amapShared'), undefined, '内部共享模块不应出现在工具表里');
  assert.ok(!ALL_TOOLS.some((t) => t.name.startsWith('_')), '存在下划线开头的工具名');
});

test('amap_geocode/缺少入参时给可恢复提示', async () => {
  const tool = findTool('amap_geocode');
  assert.ok(tool);
  expectFailureWithHint(await invoke(tool, {}), 'address');
});

test('amap_geocode/坐标格式非法时给可恢复提示', async () => {
  const tool = findTool('amap_geocode');
  assert.ok(tool);
  // 传非坐标字符串：应被拦下而不是打接口
  expectFailureWithHint(await invoke(tool, { location: '深圳北站' }), '经度,纬度');
});

test('amap_inputtips/缺少关键字时给可恢复提示', async () => {
  const tool = findTool('amap_inputtips');
  assert.ok(tool);
  expectFailureWithHint(await invoke(tool, { city: '深圳' }), 'keywords');
});

test('amap_district/缺少关键字时给可恢复提示', async () => {
  const tool = findTool('amap_district');
  assert.ok(tool);
  expectFailureWithHint(await invoke(tool, {}), 'keywords');
});

test('amap_static_map/缺少位置或尺寸格式非法时给可恢复提示', async () => {
  const tool = findTool('amap_static_map');
  assert.ok(tool);
  expectFailureWithHint(await invoke(tool, {}), 'location');
  expectFailureWithHint(await invoke(tool, { location: '113.93,22.53', size: '600x400' }), '宽*高');
});

test('amap_static_map/图片地址走本站代理且不泄露 Key', async () => {
  const tool = findTool('amap_static_map');
  assert.ok(tool);
  // 传坐标：不触发地理编码联网请求，只拼代理地址
  const res = await invoke(tool, { location: '113.93,22.53' });
  if (!res.ok) skip(`未配置 AMAP_KEY（${String(res.data).slice(0, 40)}）`);
  const url = String((res.data as { image_url?: string }).image_url ?? '');
  assert.ok(url.startsWith('/api/amap-static-map'), `应返回本站代理地址，实际：${url}`);
  assert.ok(!url.includes('key='), '图片地址里不应出现 key（否则泄露 AMAP_KEY）');
  assert.ok(!url.includes('restapi.amap.com'), '不应直接引用高德域名');
});

/**
 * 主流程：跑用例 → 打印汇总 → 按失败数决定退出码
 * @returns {Promise<void>}
 */
const main = async (): Promise<void> => {
  const filterArg = process.argv.slice(2).find((a) => a.startsWith('--filter='));
  const filter = filterArg ? filterArg.slice('--filter='.length) : '';

  console.log(`工具层单测：共 ${registry.length} 个用例${filter ? `（过滤：${filter}）` : ''}\n`);
  const results = await runAll(filter);

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  skippedCount = results.filter((r) => r.status === 'skipped').length;

  console.log(`\n──────── 汇总 ────────`);
  console.log(`通过 ${passed}  失败 ${failed}  跳过 ${skippedCount}`);
  if (failed > 0) {
    console.log('\n失败用例：');
    results.filter((r) => r.status === 'failed').forEach((r) => {
      console.log(`  ✗ ${r.name}：${r.message}`);
    });
  }
  process.exit(failed > 0 ? 1 : 0);
};

main().catch((err) => {
  console.error(`测试执行失败：${(err as Error).message}`);
  process.exit(1);
});
