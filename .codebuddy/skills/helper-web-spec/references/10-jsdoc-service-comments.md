# 10. Service 文件注释规范（JSDoc 统一格式）

> 适用范围：`web/frontend/src/services/*.ts` 全部 Service 类文件。基准文件：`status-service.ts`（**改注释前先读它**，所有规则以它为准）。
>
> ⚠️ 不适用：`http.ts`（底层 axios 实例 + 拦截器，使用行内 `//` 解释拦截逻辑，不是 Service 类）；`base-service.ts`（基类，作为铁律对齐对象但不强制 `@example`）。

## 目录

- [为什么要统一](#为什么要统一)
- [五层硬规则](#五层硬规则)
  - [规则 1：类描述 = 标题 + `@description`](#规则-1类描述--标题--description)
  - [规则 2：方法注释 = 标题 + `@param {类型}` + `@returns {Promise<T>}` + `@description` + 可选 `@example`](#规则-2方法注释--标题--param-类型--returns-promiset--description--可选-example)
  - [规则 3：复杂 object 类型的 `@param` 用内联类型而不是 `{object}`](#规则-3复杂-object-类型的-param-用内联类型而不是-object)
  - [规则 4：分节标题 = 三行中文格式](#规则-4分节标题--三行中文格式)
  - [规则 5：工厂函数 + 默认导出 = 双注释固定模板](#规则-5工厂函数--默认导出--双注释固定模板)
- [自检清单（改完 Service 跑一遍）](#自检清单改完-service-跑一遍)
- [重构时的常见陷阱](#重构时的常见陷阱)（5 个真实陷阱）
- [何时不必死磕](#何时不必死磕)

## 为什么要统一

Service 文件是「前端 ↔ HTTP 后端」的唯一边界。19 个 Service 文件混用「单行 JSDoc」「`@returns` 仅类型不带描述」「工厂函数只有四字注释」「`@param` 缺 `{类型}`」，会让 IDE 悬浮提示参差不齐，新增接口时「抄哪个」都没标准。统一成一种 JSDoc 形态，hover 出来的提示长得一样，方法定位也快。

## 五层硬规则

### 规则 1：类描述 = 标题 + `@description`

类必须有「Service 类作用 + 一句话职责说明」：

```typescript
/**
 * 状态服务管理类
 * @description 封装状态相关的 API 接口，提供配置、模板、运行时状态查询能力
 */
export class StatusService extends BaseService {
```

❌ 反例（仅一行标题，无 description）：

```typescript
/**
 * 状态服务
 */
export class StatusService extends BaseService {
```

### 规则 2：方法注释 = 标题 + `@param {类型}` + `@returns {Promise<T>}` + `@description` + 可选 `@example`

```typescript
/**
 * 获取应用状态信息
 * @returns {Promise<StatusResponse>} 状态信息响应
 * @description 从服务端获取当前应用的运行状态、配置版本等信息
 * @example
 * const service = new StatusService();
 * const result = await service.fetchStatus();
 * console.log('状态信息:', result);
 */
fetchStatus = async (): Promise<StatusResponse> => {
  return this.get<StatusResponse>('/status');
};
```

- `@param` **三段式**：`{类型} 参数名 - 描述`，禁止 `@param 参数名 - 描述`（缺类型）
- `@returns` **必带类型 + 描述**：`@returns {Promise<XxxResponse>} 描述`，**禁止只写 `@returns {Promise<XxxResponse>}` 而无描述**
- `@description` 用一句话概括「这个接口在干什么 / 服务端做了什么副作用」，不要复述方法标题
- `@example` 仅在「调用方第一次接触会困惑」时给出（如复杂传参、特殊 URL 编码）；简单的 CRUD 可省略，只要 `@description` 写得清就行

❌ 反例（缺 `@returns` 描述）：

```typescript
/**
 * 获取角色管理页面数据
 * @returns {Promise<RbacRolesResponse>}
 */
fetchRoles = async (): Promise<RbacRolesResponse> => { ... };
```

❌ 反例（`@param` 缺类型）：

```typescript
/**
 * 修改用户角色
 * @param email - 用户邮箱
 * @param roleId - 角色 ID
 */
updateUserRole = async (email: string, roleId: string) => { ... };
```

### 规则 3：复杂 object 类型的 `@param` 用内联类型而不是 `{object}`

```typescript
// ✅ 推荐
/**
 * @param {{ name?: string; description?: string; permissions?: Permission[] }} payload - 更新内容
 */

// ❌ 反例：完全丢失结构信息
/**
 * @param {object} payload - 更新内容
 */
```

> 例外：内联类型超过一行（>120 字符）时可退化为 `{Partial<XxxItem>}` 或 `{XxxUpdatePayload}` 命名类型；不要硬塞超长 `{}`。

### 规则 4：分节标题 = 三行中文格式

Service 类内部按业务领域切分时，使用三行中文注释：

```typescript
  // ==============================
  // 接口分类（只读，用于下拉选择）
  // ==============================

  // ==============================
  // API 条目
  // ==============================

  // ==============================
  // API 执行
  // ==============================
```

工厂函数 + 默认导出**始终**用一个统一标题包裹：

```typescript
// ==============================
// 工厂函数和默认导出
// ==============================
```

> 单一职责的小 Service（如 cache-service / log-service）类内部不需要分节，**只在工厂函数前保留这个标题**即可，不要为凑数硬切。

### 规则 5：工厂函数 + 默认导出 = 双注释固定模板

```typescript
/**
 * 创建状态服务实例的工厂函数
 * @description 提供 StatusService 类的实例，确保服务实例的一致性
 * @returns {StatusService} 状态服务实例
 */
export const createStatusService = (): StatusService => new StatusService();

/**
 * 默认导出的状态服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createStatusService 工厂函数
 */
export default createStatusService();
```

**逐字一致**（方便 grep 检查）。区分：
- 工厂函数：`@description 提供 XxxService 类的实例，确保服务实例的一致性` + `@returns {XxxService} 描述`
- 默认导出：`@description 为向后兼容性保留的默认导出，推荐使用 createXxxService 工厂函数`

❌ 反例（仅一行标题）：

```typescript
/** 工厂函数 */
export const createXxxService = (): XxxService => new XxxService();

/** 默认实例 */
export default createXxxService();
```

## 自检清单（改完 Service 跑一遍）

1. **零无类型 `@param` 残留**（即 `@param 名` 后非 `{`）：
   ```bash
   rg "@param [a-zA-Z_]" web/frontend/src/services/
   ```
2. **`@returns` 都带描述**（仅类型无描述应触发审查）：
   ```bash
   rg "@returns \{[^}]+\}\s*$" web/frontend/src/services/
   ```
3. **工厂函数注释统一**（应每文件 1 个匹配）：
   ```bash
   rg -c "为向后兼容性保留的默认导出" web/frontend/src/services/
   ```
4. **类描述都有 `@description`**：
   ```bash
   rg -B1 "^export class \w+Service" web/frontend/src/services/ | rg -B1 "@description"
   ```
5. **lint 通过**：调用 `read_lints` 工具——重写注释最容易把 import 顺手改没/多改没了，lint 会兜底（典型如 `ApiCategory` unused import）。

## 重构时的常见陷阱

> 这些都是真实踩过的坑。

### 陷阱 1：multi_replace 整体重写时把 import 一并替换

把单行 JSDoc 升级为完整 JSDoc 时，多 Service 写法是「整体重写从 import 到默认导出的全文」。如果 `new_string` 漏掉某个 type import（如 `ApiCategory`），TS 不报错（type-only import 删了无影响）但 lint 会警告。**反过来**：原文件 import 了 `ApiCategory` 但全文都没用到（历史残留）——升级后还是 unused。

✅ 防御：升级完跑 `read_lints`；遇到 unused import 警告，确认是历史残留就一并清理（**这属于注释重构允许的连带修改**，与「不改业务代码」不冲突）。

### 陷阱 2：`@example` 给简单 CRUD 凑字数

```typescript
// ❌ 噪音：方法名+签名已经说清，example 是空话
/**
 * @example
 * const service = new XxxService();
 * await service.deleteItem('id');
 */
deleteItem = (id: string) => this.del(`/items/${id}`);
```

简单 CRUD 不强加 `@example`；只在「URL 编码 / 复杂参数 / 异步副作用 / 特殊 timeout」等需要解释的方法保留。基准 `status-service.ts` 给 example 是因为 `fetchStatus` 是首页第一次接触状态接口的入口；同理 `skill-map-service.runSkill` 因 60s timeout 也保留 example。

### 陷阱 3：`http.ts` 不是 Service，不要套规范

`http.ts` 是底层 axios 实例 + 401/403 拦截器，注释风格是行内 `//` 解释每个拦截器为什么这么写。**不要**把它改成「类描述 + 方法 JSDoc」模板——它根本没有 Service 类。

✅ 防御：批量统一时 `http.ts` 跳过；只动 `*Service` 类文件（`base-service.ts` 也算，因为它定义了 `BaseService` 类）。

### 陷阱 4：`@param {object}` / `@param {any}` 走捷径

复杂 payload 写 `{object}` 等于没写。要么内联类型 `{{ a: string; b: number }}`，要么命名类型 `{Partial<ApiItem>}` / `{XxxUpdatePayload}`。基准 `status-service.ts` 的所有 payload 都是命名类型，这是首选。

### 陷阱 5：把方法体改坏了还以为「只动注释」

multi_replace 时 `old_string` / `new_string` 都包含方法体，一不小心改了方法体（如 URL 拼写、timeout 数值）就破坏了业务。

✅ 防御：写 `new_string` 时**逐字复制原方法体**，先在脑子里 diff 一遍只有注释行不同；改完用 `git diff` 看实际变更，目视确认非注释行未动。

## 何时不必死磕

- **`http.ts`**：见陷阱 3。
- **测试文件 `*.spec.ts`**：注释只对断言点说明即可。
- **临时实验目录 `__experiments__/`**：随便写。

主目录 `web/frontend/src/services/*.ts`（含 `base-service.ts`）一律按本规范执行。
