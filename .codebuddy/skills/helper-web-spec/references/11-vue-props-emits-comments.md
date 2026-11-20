# 11. 组件 Props/Emits/defineModel 注释规范（JSDoc 统一格式）

> 适用范围：`web/frontend/src/components/**/*.vue` 全部子组件文件。基准文件：`config/webhook-form.vue`（**改注释前先读它**，所有规则以它为准）。
>
> 适用范围**不**包括：`views/` 下的页面组件（页面级 props/emits 极少，且通常被 router 注入；它们的注释由 model 文件的三行 JSDoc 兜底，不在此规范）。

## 目录

- [为什么要统一](#为什么要统一)
- [唯一写法（铁则）](#唯一写法铁则)
  - [Props：内联泛型 `defineProps<{...}>()`，可选包 `withDefaults`](#propsdefinepropsxxx可选包-withdefaults)
  - [Emits：长签名 `(e: 'xxx', ...): void`](#emits长签名-e-xxx--void)
  - [`defineModel`：固定带「Vue 3.4+ defineModel 语法糖」尾巴](#definemodel固定带vue-34-definemodel-语法糖尾巴)
- [JSDoc 注释格式](#jsdoc-注释格式)
  - [格式 1：注释 = 单行 JSDoc，贴在字段上方](#格式-1注释--单行-jsdoc贴在字段上方)
  - [格式 2：分节标题不强求](#格式-2分节标题不强求)
- [禁止的写法（migration 一次性清掉）](#禁止的写法migration-一次性清掉)
- [自检清单（改完组件跑一遍）](#自检清单改完组件跑一遍)
- [重构时的常见陷阱](#重构时的常见陷阱)（4 个真实陷阱）
- [何时不必死磕](#何时不必死磕)

## 为什么要统一

53 个 `.vue` 子组件历史上混过 5 种 props 写法（内联泛型 / `withDefaults` 内联 / `withDefaults<外部 Props>` / Options 对象式 / 数组式）和 3 种 emits 写法（长签名 / 短元组 / 数组式）。注释更是参差，hover 体验各异，code review 反复争论。

经过近一轮治理，仓库现状已自然收敛为：**props 100% 内联泛型**（A 31 个 + B 17 个，B 只是 A 加 `withDefaults` 处理默认值）+ **emits 100% 长签名（38/38）**，仅剩 1 个文件用外部 `interface Props`。本规范把这一现状**写死为唯一允许格式**，新增/重构组件不得引入其它写法。

## 唯一写法（铁则）

### Props：`defineProps<{...}>()`，可选包 `withDefaults`

**唯一允许的写法只有一种：内联泛型**。需要默认值时用 `withDefaults` 包一层；不需要默认值就裸 `defineProps<{...}>()`——`withDefaults` 不是另一种写法，是同一种写法的默认值变体。

✅ **不需要默认值**（基准 webhook-form.vue 同款）：

```ts
defineProps<{
  /** 表单字段 */
  fields: AutoFormField[];
  /** 是否禁用提交 */
  disabled?: boolean;
}>();
```

✅ **需要默认值**（用 `withDefaults` 包一层即可，**类型仍内联**）：

```ts
const props = withDefaults(defineProps<{
  /** 卡片标题 */
  title: string;
  /** 图标主题，控制图标背景色 */
  iconTheme?: IconTheme;
  /** 是否撑满父容器高度（flex 列方向） */
  fullHeight?: boolean;
}>(), {
  iconTheme: 'primary',
  fullHeight: false,
});
```

**铁则**：
- 类型**必须内联**在 `defineProps<{ ... }>()` 的尖括号里——不允许抽到外部 `interface Props` / `type Props` 再传入 `defineProps<Props>()`。
- 默认值**必须用** `withDefaults` 第二参对象，不要用 `??`/`||` 在使用处兜底，也不要在 `withDefaults` 第二参内嵌业务逻辑。
- JSDoc 注释贴**内联类型字段**上方（详见后文「JSDoc 注释格式」）。

### Emits：长签名 `(e: 'xxx', ...): void`

**唯一允许的写法是长签名**（基准 webhook-form.vue 同款，仓库已 100% 采用）：

```ts
const emit = defineEmits<{
  /** 设置表单 ref */
  (e: 'set-ref', el: unknown): void;
  /** 取消 */
  (e: 'cancel'): void;
  /** 提交 */
  (e: 'submit'): void;
  /** 切换开关，参数为下一个状态 */
  (e: 'toggle', next: boolean): void;
}>();
```

**铁则**：
- 即使没参数也要写完整的 `(e: 'xxx'): void;`，不要因为"省事"省略 `: void`。
- JSDoc 注释贴在 `(e: 'xxx', ...): void;` 上方，每条事件都要有。
- 不允许短元组写法 `xxx: [next: boolean]`（参见「禁止的写法」）。

### `defineModel`：固定带「Vue 3.4+ defineModel 语法糖」尾巴

`defineModel` 本质是 prop + emit 的语法糖（Vue 3.4 稳定，helper Vue ^3.5.0 直接可用），必须有 `/** xxx */` 注释贴在声明上方，且**括号注明对应 v-model 名**：

```ts
/** 表单值（v-model，Vue 3.4+ defineModel 语法糖） */
const modelValue = defineModel<Record<string, unknown>>({ required: true });

/** 抽屉显示状态（v-model:visible，Vue 3.4+ defineModel 语法糖） */
const visible = defineModel<boolean>('visible', { required: true });

/** 表单数据（v-model:formData，Vue 3.4+ defineModel 语法糖） */
const formData = defineModel<Partial<GreetingItem>>('formData', { required: true });
```

格式**逐字一致**（方便 grep 检查）：
- 默认 model（无名）：`（v-model，Vue 3.4+ defineModel 语法糖）`
- 命名 model：`（v-model:<name>，Vue 3.4+ defineModel 语法糖）`

> 为什么强制带「Vue 3.4+ defineModel 语法糖」尾巴：调用方代码里看到 `const xxx = defineModel(...)` 不容易反应过来这就是 v-model 接收口子，注释统一带语法糖标注能省去新人 stackoverflow 的时间。

## JSDoc 注释格式

### 格式 1：注释 = 单行 JSDoc，贴在字段上方

格式逐字一致：`/** 中文描述 */`，独占一行，紧贴字段：

```ts
defineProps<{
  /** 表单字段 */
  fields: AutoFormField[];
}>();
```

❌ 反例（同行尾注释 / 多行 JSDoc / 行内 `//`）：

```ts
defineProps<{
  fields: AutoFormField[]; // 表单字段
}>();

defineProps<{
  /**
   * 表单字段
   */
  fields: AutoFormField[];
}>();

defineProps<{
  // 表单字段
  fields: AutoFormField[];
}>();
```

> 为什么坚持单行 `/** */`：Vue / Volar / IDE hover 仅认 JSDoc，行内 `//` 不会出现在悬浮提示里。多行 JSDoc 在 props 里冗余且容易把声明撑得很长。

### 格式 2：分节标题不强求

Service 文件强制要求中文三行分节标题（`// ==== / // 标题 / // ====`），但**组件不要求**——组件 `<script setup>` 普遍 < 200 行，强加分节标题会让小组件显得啰嗦。

仅当 `<script setup>` 超 150 行，且 props/emits/defineModel/computed/methods 多到肉眼难定位时，才允许使用分节标题。例外是 [auto-form/index.vue](/projects/helper/web/frontend/src/components/auto-form/index.vue)（46KB / 800+ 行）、[skill-map/skill-card.vue](/projects/helper/web/frontend/src/components/skill-map/skill-card.vue)、[trigger/annual-update-card.vue](/projects/helper/web/frontend/src/components/trigger/annual-update-card.vue)，这类大组件**应该**有分节标题。

## 禁止的写法（migration 一次性清掉）

下列写法**一律不允许**。遇到既有代码以这些形态出现，**必须**在改注释的同时一并迁移到唯一格式（唯一一种"动业务"被允许的场景）：

| 编号 | 禁用写法 | 原因 | 迁移到 |
|------|----------|------|--------|
| ❌ N1 | 外部 `interface Props` + `defineProps<Props>()` | 类型与组件分离，hover/跳转多一跳；本仓库仅 1 个孤例 | 把 interface 字段（含注释）全部内联进 `defineProps<{...}>()` 尖括号 |
| ❌ N2 | Options 对象式 `defineProps({ key: { type: ..., default: ... } })` | 丢类型推断，注释贴位置与泛型版不同，新人混淆 | 改写为 `withDefaults(defineProps<{...}>(), {...})`；类型从 `type:` 推；默认值搬到第二参 |
| ❌ N3 | 数组式 `defineEmits(['a', 'b'])` | 无 TS 类型，无法逐条贴 JSDoc | 改写为长签名 `defineEmits<{ (e: 'a'): void; (e: 'b'): void; }>()` 后再加注释 |
| ❌ N4 | 短元组 emits `xxx: [next: boolean]` | 与项目 100% 长签名现状不一致；hover 时元组括号容易让新人误读为数组类型 | 改写为长签名 `(e: 'xxx', next: boolean): void;` |
| ❌ N5 | 同一组件内既有 `defineModel` 又用 `prop + 'update:xxx' emit + computed` 桥接做双向绑定 | 双向绑定写法分裂；详见 [08-vue-defineModel-vmodel.md](./08-vue-defineModel-vmodel.md) | 全部改 `defineModel` |

> N1 ~ N4 都属于"为了让注释能贴上去 / 让格式收敛到唯一格式"必须做的写法升级，**业务行为零变化**——和「只改注释不动业务」的总原则不冲突。

## 自检清单（改完组件跑一遍）

1. **每个 props 字段都有上方 `/** */`**——抽样查非空 props 块紧邻上一行：
   ```bash
   # 应当为空：定义了 props 但下一行不是 JSDoc 的位置
   rg -B1 "^\s+\w+\??: " web/frontend/src/components/ -g "*.vue" | rg -A1 "^--$" | head
   ```
   > 这是粗筛，会有少量假阳；目视检查每个 props 块即可。

2. **`defineModel` 都有 `Vue 3.4+ defineModel 语法糖` 尾巴**：
   ```bash
   rg -c "defineModel" web/frontend/src/components/ -g "*.vue"
   rg -c "Vue 3.4\+ defineModel 语法糖" web/frontend/src/components/ -g "*.vue"
   # 两个数字应一致（每个 defineModel 都有 1 条注释）
   ```

3. **没有禁用写法残留**（应全为空）：
   ```bash
   # N1：外部 interface Props
   rg "defineProps<Props>" web/frontend/src/components/ -g "*.vue"
   # N2：Options 对象式
   rg "defineProps\(\{" web/frontend/src/components/ -g "*.vue"
   # N3：数组式 emits
   rg "defineEmits\(\[" web/frontend/src/components/ -g "*.vue"
   # N4：短元组 emits（在 defineEmits<{ ... }> 块内出现 `name: [`）
   rg -U "defineEmits<\{[\s\S]*?\w+:\s*\[" web/frontend/src/components/ -g "*.vue"
   ```

4. **lint 通过**：`read_lints` 兜底，重点看是否把 import 顺手改没。

## 重构时的常见陷阱

### 陷阱 1：把外部 `interface Props` 注释往 `defineProps<Props>()` 调用上方搬

错误的"统一"：试图把 interface 上的注释搬到 `defineProps` 调用上方——这样**不形成 hover 提示**，因为 hover 看的是字段定义位置（内联泛型看 `<{...}>` 内字段）。

✅ 防御：迁移 N1 时，把 **interface 的字段（含注释整体）**逐字搬进 `defineProps<{ ... }>()` 的尖括号里，删除原 interface。注释贴在「**字段类型实际定义的地方**」。

### 陷阱 2：`withDefaults` 替换时漏掉默认值或类型尾巴

`withDefaults(defineProps<{...}>(), { ... })` 替换时，`new_string` 容易把第二参 `{ ... }` 写漏。

✅ 防御：multi_replace 的 `old_string` 必须包含到末尾的 `});`，`new_string` 逐字保留默认值对象，仅在内联类型字段上方插入 `/** */`。改完用 `git diff` 目视确认默认值未变。

### 陷阱 3：把数组式 emits 当字段类型自动补注释

`defineEmits(['a', 'b'])` 是运行时数组——不能直接 `new_string` 在每个字符串前加 `/** */`，那样不是合法 TS。**必须**完整改写为长签名形态（N3 → 唯一格式）：

```ts
// ❌ 改前：无类型，无法贴字段注释
defineEmits(['toggle', 'test']);

// ✅ 改后：升级为长签名，逐条注释
defineEmits<{
  /** 切换规则启用状态 */
  (e: 'toggle'): void;
  /** 测试规则 */
  (e: 'test'): void;
}>();
```

### 陷阱 4：emits 长签名漏写 `: void` 或参数描述写到事件描述里

长签名 `(e: 'change', next: boolean): void` 的事件名是 `change`、参数是 `next: boolean`、返回类型是 `void`。

❌ 反例 1：漏 `: void` 让 TS 推断为 `undefined`：
```ts
(e: 'change', next: boolean) // 错：缺 : void
```

❌ 反例 2：注释啰嗦地把参数也复述（参数已自描述）：
```ts
/** 切换开关，参数 next 是布尔值表示下一个状态，true 表示开启，false 表示关闭 */
(e: 'change', next: boolean): void;
```

✅ 简洁：注释只描述**事件本身**，参数语义由 `next: boolean` 自带；如果参数名不直观（如 `force`），**重命名参数**或在描述里点一句即可：
```ts
/** 切换开关，参数为下一个状态 */
(e: 'change', next: boolean): void;
```

## 何时不必死磕

- **`<script setup>` 之外的组件**：极少数老组件用 `export default defineComponent({ props, emits })` 选项式 API——本仓库目前没有，不在此规范。
- **`auto-form/index.vue` 等极复杂组件**：800+ 行，props/emits 注释优先保证「关键字段全注释」，对边缘 prop（如内部状态透传）允许从简，但不能裸奔。
- **测试文件 / `__experiments__/`**：不强制。

主目录 `web/frontend/src/components/**/*.vue` 一律按本规范执行。
