# 9. Model 文件注释规范（JSDoc 统一格式）

> 适用范围：`web/frontend/src/models/*.ts` 全部 Model 类文件。基准文件：`home-model.ts`（**改注释前先读它**，所有规则以它为准）。

## 目录

- [为什么要统一](#为什么要统一)
- [三层硬规则](#三层硬规则)
  - [规则 1：类成员注释 = 三行 JSDoc](#规则-1类成员注释--三行-jsdoc)
  - [规则 2：getter 注释 = 标题 + `@returns {<类型>}`](#规则-2getter-注释--标题--returns-类型)
  - [规则 3：方法注释 = 标题 + `@param`（如有）+ `@description`](#规则-3方法注释--标题--param如有-description)
  - [规则 4：包装函数注释 = 固定模板](#规则-4包装函数注释--固定模板)
- [分节标题三行格式](#分节标题三行格式)
- [自检清单（改完 Model 跑一遍）](#自检清单改完-model-跑一遍)
- [重构时的常见陷阱](#重构时的常见陷阱)（4 个真实陷阱）
- [何时不必死磕](#何时不必死磕)

## 为什么要统一

Model 文件是页面业务逻辑的核心；当 19 个 Model 文件混用「单行 `/** xxx */`」「英文分节标题」「缺 `@type`/`@returns`」等多种风格时，新人读代码先要在风格之间切换，IDE 悬浮提示也长得不一样。统一成一种 JSDoc 形态后，类成员一眼就能看出「类型 + 描述」，IDE 提示也整齐。

## 三层硬规则

### 规则 1：类成员注释 = 三行 JSDoc

类成员（`ref`/`store`/`service`/`reactive` 字段）必须使用三行 JSDoc：**标题 + `@type` + `@description`**。**禁止单行 `/** xxx */`**。

```typescript
/**
 * 权限申请列表数据
 * @type {Ref<PermissionRequestItem[]>}
 * @description 当前页的权限申请记录集合
 */
items: Ref<PermissionRequestItem[]> = ref([]);
```

❌ 反例：

```typescript
/** 权限申请列表数据 */
items: Ref<PermissionRequestItem[]> = ref([]);
```

> 例外：文件顶部 `import` 区域内的局部类型注释、闭包变量注释，不强制三行。只针对 class 成员。

### 规则 2：getter 注释 = 标题 + `@returns {<类型>}`

```typescript
/**
 * 角色抽屉当前模式
 * @returns {FormMode} editingRole 非空时返回 Edit，否则返回 Create
 */
get roleFormMode(): FormMode {
  return this.editingRole.value ? FormMode.Edit : FormMode.Create;
}
```

`@returns` 的「类型」必须填，「描述」要说清边界条件（什么时候返回什么），不要只复述方法名。

### 规则 3：方法注释 = 标题 + `@param`（如有）+ `@description`

```typescript
/**
 * 切换规则启用状态
 * @param {string} id - 规则 ID
 * @param {boolean} enabled - 目标启用状态
 */
toggleRule = async (id: string, enabled: boolean): Promise<void> => {
  await this.rulesStore.editRule(id, { enabled });
};
```

- `@param` 三段式：`{类型} 参数名 - 描述`
- 不要写 `@returns {void}` / `@returns {Promise<void>}`——TS 类型签名已表达，写了反而冗余
- 复杂逻辑/副作用用 `@description` 解释，简单方法只留标题即可

### 规则 4：包装函数注释 = 固定模板

每个 `useXxxModel` 必须用以下模板（**逐字一致**，方便 grep 检查）：

```typescript
/**
 * Composition API 包装函数
 * @description 将 XxxModel 类包装为 Composition API 可用的函数
 */
export const useXxxModel = () => { /* ... */ };
```

## 分节标题三行格式

类内部用三行注释切分逻辑块，**禁止使用英文标题**（State/Computed/Methods）：

```typescript
  // ==============================
  // 依赖注入（service、store）
  // ==============================

  // ==============================
  // 状态变量（ref）
  // ==============================

  // ==============================
  // 静态数据
  // ==============================

  // ==============================
  // 计算属性（get）
  // ==============================

  // ==============================
  // 公共方法
  // ==============================

  // ==============================
  // 私有方法
  // ==============================

  // ==============================
  // 生命周期
  // ==============================
```

中文标题对应 [`02-frontend-mvc-layers.md`](./02-frontend-mvc-layers.md) 中 Class 成员顺序的 7 个分组。**不是每个分组都必须出现**（没有静态数据就别写空标题），只要写就用统一格式。

## 自检清单（改完 Model 跑一遍）

1. **零单行 JSDoc**：grep 必须返回空
   ```bash
   rg "^  /\*\* [^*]" web/frontend/src/models/
   ```
2. **零英文分节标题**：
   ```bash
   rg "// (State|Computed|Methods|Constants)$" web/frontend/src/models/
   ```
3. **包装函数注释统一**（统计行数应 = 文件数）：
   ```bash
   rg -c "Composition API 包装函数" web/frontend/src/models/
   ```
4. **lint 通过**：调用 `read_lints` 工具看一下，注释升级时容易把字段或 import 跟着删除（例如 `WatchStopHandle`），lint 会兜底。

## 重构时的常见陷阱

> 这些都是真实踩过的坑。

### 陷阱 1：multi_replace 时把字段定义跟着覆盖

把单行注释 `/** xxx */` 升级成三行 JSDoc 时，`old_string` 通常会包含 `private xxxField: Type = value;` 这一行。如果 `new_string` 只写新注释忘了把字段贴回去，**字段就被静默删除**——TypeScript 不会立刻报错（成员可能被外部读取，类型只是宽容收窄到 `undefined`），但运行时一定崩。

✅ 防御：每次 `multi_replace` 后立刻 `read_lints` + `grep_search` 确认目标字段还在。

### 陷阱 2：未使用 import 残留

如果原代码在某处用了 `WatchStopHandle` / `watch`，而你升级注释时不慎删除了它们的使用点，TS 不报错但 lint 会警告 "is declared but its value is never read"。

✅ 防御：升级完跑 `read_lints`，看到 unused import 直接清理。

### 陷阱 3：`@returns {void}` 噪音

简单 setter / handler 写 `@returns {void}` 没有信息量，只是堆砌。直接省略，让方法标题描述行为即可。

```typescript
// ❌ 噪音
/**
 * 关闭抽屉
 * @returns {void}
 */
closeDrawer = (): void => { ... };

// ✅ 干净
/**
 * 关闭抽屉
 * @description 同时重置编辑状态与表单数据
 */
closeDrawer = (): void => { ... };
```

### 陷阱 4：`@type` 与 TS 类型不一致

JSDoc 的 `@type` 是给阅读用的提示，**真正生效的是 TS 类型签名**。两者不一致时 TS 类型胜出，但读者会困惑。改字段类型时记得同步改 `@type`。

## 何时不必死磕

- **跨语言/跨平台 SDK 的桥接代码**：注释要兼顾英文文档生成时，分节标题可能保留英文。
- **测试文件 `*.spec.ts`**：注释只对断言点说明即可，不强求三行 JSDoc。
- **临时 prototype 文件**（`__experiments__/` 目录）：随便写。

主目录 `web/frontend/src/models/*.ts` 一律按本规范执行。
