# Agent 工具系统

**目标**：让模型能真正"动手"——学会设计工具、注册工具、控制谁能用、并保证它不乱动手。

---

## 1. 工具的本质：给模型看的函数声明

你写一个普通函数，再用 **JSON Schema** 描述它的参数，一起发给模型。模型不执行任何代码，它只返回：

```json
{ "tool_calls": [{ "id": "call_1", "function": { "name": "query_rules", "arguments": "{\"enabled_only\":true}" } }] }
```

**执行在你这边**。这是 Agent 与传统 API 最大的区别：调用者从"人"变成了"模型"。

所以设计工具的思路要变：

| 传统 API 设计 | Agent 工具设计 |
|--------------|---------------|
| 面向开发者，文档在 wiki | 面向模型，全靠 `name` + `description` + 参数描述 |
| 参数多没关系 | 参数越少越好，模型容易漏填 |
| 报错抛异常 | 报错要**回灌成结果**，让模型自己纠正或如实告知用户 |
| 权限在网关 | 权限要**按工具粒度**声明，并在执行前校验 |

---

## 2. 工具接口抽象（本项目真实定义）

```ts
// web/types/ai-chat.ts
export interface ToolImpl {
  /** 工具名（与 LLM 调用名称一致，必须英文蛇形） */
  name: string;
  /** 描述（给 LLM 看，决定它何时选用） */
  description: string;
  /** 参数 JSON Schema */
  parameters: ToolDefinition['function']['parameters'];
  /** 调用此工具所需的权限码（任一即可） */
  requiredPermissions?: string[];
  /** 触发样例（会被序列化拼到 description 末尾给 LLM 看） */
  examples?: ToolExample[];
  /** 执行实现 */
  invoke: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}
```

一个完整的最小工具（真实代码，`tools/query-rules-tool.ts`）：

```ts
export const queryRulesTool: ToolImpl = {
  name: 'query_rules',
  description: '查询系统已配置的自定义规则（每条规则定义触发时间和行为）',
  parameters: {
    type: 'object',
    properties: {
      enabled_only: { type: 'boolean', description: '只返回已启用的规则，默认 false' },
    },
  },
  requiredPermissions: ['rules:view'],
  invoke: async (args): Promise<ToolResult> => {
    const list = args.enabled_only ? readRules().filter((r) => r.enabled) : readRules();
    return { ok: true, data: { rules: list }, summary: `共 ${list.length} 条规则` };
  },
};
```

注意 `summary` 字段：给模型看的是精简摘要，避免把大对象全塞回上下文（省 token）。

---

## 3. 注册：约定优于配置（不用改注册中心）

新增工具只需**两步**：新建 `xxx-tool.ts`，导出 `ToolImpl`。扫描器自动收集：

```ts
// web/utils/ai-chat/tools/index.ts
const TOOL_FILE_PATTERN = /-tool\.(ts|js)$/;

const isToolFile = (file: string): boolean => {
  if (file.startsWith('_') || file.startsWith('.')) return false;   // 下划线开头是内部模块
  if (file.endsWith('.d.ts')) return false;
  return TOOL_FILE_PATTERN.test(file);
};

export const loadTools = (): ToolImpl[] => {
  const files = fs.readdirSync(__dirname).filter(isToolFile).sort();
  const tools: ToolImpl[] = [];
  const seenNames = new Set<string>();

  files.forEach((file) => {
    let mod: Record<string, unknown>;
    try {
      mod = require(path.join(__dirname, file));       // ts-node 下 .ts，产物下 .js
    } catch (err) {
      console.error(`[ai-chat] 工具加载失败 ${file}：${(err as Error).message}`);
      return;                                          // 单个文件失败不影响其他工具
    }
    Object.values(mod).forEach((exp) => {
      if (!isToolImpl(exp)) return;                    // 结构化校验：name/description/parameters/invoke
      if (seenNames.has(exp.name)) return;             // 重名去重
      seenNames.add(exp.name);
      tools.push(exp);
    });
  });
  return tools;
};
```

三个值得抄的设计：

1. **下划线前缀 = 内部模块**（`_consent-guard.ts` 不会被当成工具）
2. **单文件加载失败只跳过**，不拖垮整个系统
3. **结构化校验 + 重名去重**，写错字段会静默忽略而不是运行时炸

转成模型协议只要一次 map：

```ts
export const buildToolDefinitions = (tools: ToolImpl[]) =>
  tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
```

---

## 4. 怎么让模型"选对"工具

模型只看 `name` + `description`，所以：

- **name 用蛇形动词开头**：`query_rules`、`manage_service`、`send_wecom_message`
- **description 写"什么时候用"**：「查询系统已配置的自定义规则（每条规则定义触发时间和行为）」——比「规则查询」有效得多
- **给 examples**：本项目会把 `examples` 拼到 description 末尾，等于给模型 few-shot

```
- "我现在配置了哪些自定义规则？"  → {}
- "只看启用中的规则"              → { enabled_only: true }
```

反面教材：description 写「获取信息」——模型不知道该不该调，只能瞎猜。

**工具数量也是成本**：每个工具都占 prompt token，本项目 25 个工具已经需要控制，超过 ~30 个要做**按权限/按场景动态装载**（见下）。

---

## 5. 权限：工具层面的 RBAC

```ts
export const getAvailableTools = (userPermissions: string[]): ToolImpl[] =>
  ALL_TOOLS.filter((tool) => {
    if (!tool.requiredPermissions?.length) return true;
    return tool.requiredPermissions.some((p) => userPermissions.includes(p));
  });
```

关键思路：**没权限的工具根本不出现在模型的可选列表里**。这比"让它调了再报错"好得多——模型不会浪费轮次，也不会告诉用户"我试了但没权限"。

三层校验（01 篇提过的护栏，这里落地）：

```
路由层 withPermission  →  工具装载层（按权限过滤）  →  执行前 checkToolPermission  →  工具内部细分校验
```

---

## 6. 副作用护栏：consent 机制

启停服务、发消息这类操作，光有权限不够——**必须是用户自己提出来的**。做法：要求模型从用户原话里摘录一句作为凭证。

```ts
// tools/_consent-guard.ts
const CONSENT_PHRASE_MAX_LEN = 100;

export const checkConsent = (phrase: string, _kind: ConsentKind) => {
  const text = (phrase ?? '').trim();
  if (!text) return { ok: false, reason: 'user_consent_phrase 缺失：必须从用户原话中摘录，禁止编造' };
  if (text.length > CONSENT_PHRASE_MAX_LEN) {
    return { ok: false, reason: `应为原话短句摘录（≤100 字），当前 ${text.length} 字，疑似编造` };
  }
  return { ok: true };
};
```

**设计取舍（重要）**：这里**不做关键词匹配**。早期版本要求原话含"发送"等动词，结果"抖音热搜""生日提醒发一下"这类自然表达被误伤。现在的策略是：

- 软约束：prompt 要求模型如实摘录
- 硬约束：权限码（`webhook:edit` / `trigger:*:edit`）
- 长度上限：防止模型编造一整段话冒充用户

**输入白名单同理**：脚本名必须匹配 `/^[a-z0-9_]+\.sh$/`，挡住目录穿越。

---

## 7. 常见坑

| 坑 | 症状 | 解法 |
|----|------|------|
| description 太短 | 模型不用你的工具 | 写清"什么时候用"，配 examples |
| 参数过多 | 模型漏填/编造 | 拆成多个工具，或用枚举约束 |
| 工具抛异常 | 整个循环中断 | 捕获成 `{ ok:false, error }` 回灌，让模型继续 |
| 返回大数据 | 上下文暴涨 | 返回 `summary` + 精简 data |
| 工具太多 | prompt 变长、选择变难 | 按权限/场景动态装载 |
| 敏感值直出 | 密钥泄露进上下文 | 读取时脱敏（本项目 `query_config` 脱敏为 `***（已脱敏）`） |

---

## 8. 实例：本项目 39 个工具一览

上面讲的是方法，这里是**本项目的真实清单**——看方法如何落地，也方便你照着设计自己的工具集。

### 只读查询（24 个）

| 工具 | 用途 | 主要参数 | 所需权限 |
|------|------|---------|---------|
| `query_system_status` | 主机/内存/磁盘/守护进程 | 无 | `dashboard:view`、`daemon:view` |
| `query_service_status` | 9527 / 3001 进程存活与 PID | 无 | `web-service:view` |
| `list_scripts` | 可触发的脚本清单 | `keyword` | `trigger:view` |
| `query_config` | 读 `.env`（敏感键脱敏） | `keyword` | `config:view` |
| `query_webhooks` | 机器人列表（URL 脱敏） | 无 | `webhook:view` |
| `query_rules` | 自定义规则 | `enabled_only` | `rules:view` |
| `query_cache` | 查 `.cache` 各类缓存（13 种 target） | `target`、`date`、`keyword`、`limit` | `cache:view` |
| `query_api_responses` | API 原始响应归档 | `api`、`filename`、`limit` | `cache:view` |
| `query_logs` | 列日志 / 读末尾 N 行 | `log_key`、`lines` | `logs:view` |
| `query_workday` | 工作日/节假日/调休 | `date`、`days`（≤31） | `cache:view` |
| `query_greetings` | 节日祝福语库 | `group`、`keyword`、`limit` | `greetings:view` |
| `query_reminder_quotes` | 提醒寄语库 | `bucket_keyword`、`limit` | `reminder-quotes:view` |
| `query_message_templates` | 消息模板 | `type`、`style` | `templates:view` |
| `list_apis` | 接口管理条目 | `keyword` | `api-management:view` |
| `query_api_categories` | 接口分类 | `keyword` | `api-category:view` |
| `query_rbac` | 角色/用户/权限码/概览 | `target`、`keyword` | `rbac:roles:view` 等（按维度再校验） |
| `query_permission_requests` | 权限申请记录 | `status`、`email` | `rbac:requests:view` |
| `query_conversations` | 本人历史会话 | `keyword`、`conversation_id`、`limit` | 无（按邮箱隔离） |
| `query_ip` | IP 归属地 / 本机出口 IP | `ip` | `cache:view` |
| `translate` | 短句翻译（MyMemory） | `text`、`target`、`source` | `cache:view` |
| `amap_poi` | 周边 POI 搜索（美食/加油站/充电桩/停车场） | `keywords`、`city`、`location`、`radius` | 无 |
| `amap_route` | 路线规划（驾车/公交/步行/骑行） | `origin`、`destination`、`mode` | 无 |
| `amap_geocode` | 地址 ↔ 坐标（正向 / 逆地理，带本地缓存） | `address`、`location`、`city` | 无 |
| `amap_inputtips` | 地点输入提示（候选名称 / 区县 / 地址） | `keywords`、`city`、`limit` | 无 |
| `amap_district` | 行政区划（adcode / 中心点 / 下级） | `keywords`、`subdistrict` | 无 |
| `amap_static_map` | 静态地图出图（返回本站 `/api/amap-static-map` 图片地址） | `location`、`zoom`、`size`、`markers`、`traffic` | 无 |
| `query_knowledge` | BM25 检索 `docs/` 项目文档 | `query`、`top_k` | 无 |
| `query_pages` | Web 页面直连入口（菜单收起的页面也能给路径；能代劳时优先说“我可以直接帮你做”） | `keyword` | 无 |

### 动作类副作用（3 个，需 consent）

| 工具 | 用途 | 参数 | 所需权限 |
|------|------|------|---------|
| `manage_service` | 启停/重启 Web(9527)、守护进程 | `target`、`action`、`user_consent_phrase` | 查询 `:view`；启停 `web-service:edit` / `daemon:edit` |
| `trigger_script` | 执行 `scripts/*.sh` | `script_name`、`user_consent_phrase` | `trigger:view` + 对应 `trigger:*:edit` |
| `send_wecom_message` | 推送内容到企微群 | `content`、`user_consent_phrase` | `webhook:edit` |

### 增删改（8 个，默认先建审批单）

会写库 / 改文件的工具。**数据变更必须经人工拍板**：严格模式（`web/.env` 的 `AI_STRICT_SIDE_EFFECTS`，默认 `true`）开启时，这 8 个工具不当场执行，先建审批单，超级管理员在 Web「AI 审批」页（`/approvals`）通过后才会真正执行；此时执行身份与权限取**审批人**。

| 工具 | 用途 | 参数 | 所需权限 |
|------|------|------|---------|
| `create_rule` | 新建自定义提醒规则 | `name`、`type`、`time`、`condition`、`message`、`template_id` | `rules:edit` |
| `manage_rule` | 改 / 停用 / 删除已有规则 | `action`(`update`/`toggle`/`delete`)、`rule_id` + 待改字段 | `rules:edit` |
| `update_config` | 改 `.env` 里**已存在**的键（不允许新增键，敏感值脱敏） | `key`、`value` | `config:edit` |
| `manage_rbac` | 分配/收回角色、建角色、改角色权限 | `action`、`email`、`role_id`、`role_name`、`permissions` | `rbac:roles:edit`、`rbac:users:edit` |
| `manage_logs` | 清空运行日志（只覆盖「运行日志」页展示的日志） | `action`(`clear`/`clear_all`)、`log_key` | `logs:edit` |
| `manage_cache` | 整文件覆写 `.cache/` 下**已存在**的 JSON 缓存（不能新建、不能路径穿越） | `action`(`write`)、`filename`、`content` | `cache:edit` |
| `manage_webhook` | 新增 / 修改 / 删除企微机器人 | `action`(`create`/`update`/`delete`)、`id`、`name`、`url` | `webhook:edit` |
| `annual_update` | 跑年度更新脚本（跨年维护专用） | `tool`、`args`、`user_consent_phrase` | `trigger:annual-update:view` |

### 生成 / 协作（4 个）

| 工具 | 用途 | 参数 | 所需权限 |
|------|------|------|---------|
| `card_skill` | 跑卡片脚本 | `skill_key`、`params`、`mode`(`card`/`data`/`json`) | 列举 `skill-map:view`；执行 `skill-map:edit` |
| `web_search` | 联网检索 | `query`、`engine`、`count`、`recency` | `ai-web-search:view`（需开开关） |
| `delegate_task` | 把「翻很多数据只要一句结论」的子任务交给子 Agent | `task`、`allowed_tools` | 无（继承主会话工具可见范围） |
| `request_approval` | 主动开一张审批单（用户说「先别执行 / 走审批」时） | `tool`、`args`、`reason` | `ai-approvals:edit` |

**看这一份清单能学到的**：

- 命名高度规律（`query_*` 只读、`manage_*/trigger_*/send_*` 副作用），模型一眼能分清风险
- 权限码与业务模块一一对应，天然可做工具级 RBAC
- 只读 24 / 39 ≈ 62%，剩下分两类：**动作类**（推送、跑脚本、启停服务，靠 consent 短语把关）与**增删改类**（默认走审批单）——副作用永远是少数例外，这个比例值得保持
- 新增写工具时记得同步登记 `web/types/ai-chat.ts` 的 `SIDE_EFFECT_TOOLS` 与 `MUTATION_TOOLS`，否则不会进审批链路

---

## 9. 动手练习

1. 写一个 `query_disk_usage` 工具：无参数、返回磁盘占用、需要 `dashboard:view` 权限
2. 故意把 `invoke` 改成抛异常，观察循环是否还能继续（第 04 篇会讲循环）
3. 给工具加 `examples`，对比加之前/之后模型的选择准确率

---

## 10. 检查清单

- [ ] 工具用 JSON Schema 声明，参数精简
- [ ] description 写清使用场景，配 examples
- [ ] 注册无需改中心文件（约定优于配置）
- [ ] 权限按工具声明，并按权限动态装载
- [ ] 副作用工具有 consent 校验 + 输入白名单

---

**返回**: [教程索引](00-导航.md) | [上一篇：LLM 客户端与流式](09-2-LLM客户端与流式.md) | [下一篇：循环、规划与反思](09-4-Agent循环与反思.md)
