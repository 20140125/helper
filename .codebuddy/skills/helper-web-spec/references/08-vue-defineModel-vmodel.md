# 8. Vue 3.4+ defineModel 重构（双向绑定反模式治理）

Vue 3.4 的 `defineModel` 宏取代了"prop + `update:xxx` emit + computed 桥接"三件套。helper 项目 Vue 已在 `^3.5.0`（见 [web/frontend/package.json](/web/frontend/package.json)），直接可用，无需开启实验标志。

凡在 `web/frontend/src/` 下遇到双向绑定冗余代码，或用户提到"改成 defineModel""简化 v-model""消除 computed 桥接"，按本文档执行。

## 目录

- [识别特征（任一命中即是目标）](#识别特征任一命中即是目标)
- [标准重构四式](#标准重构四式)
  - [式 1：默认 v-model](#式-1默认-v-model)
  - [式 2：具名 v-model（多个双向属性）](#式-2具名-v-model多个双向属性)
  - [式 3：模板透传 → 直接 v-model](#式-3模板透传--直接-v-model)
  - [式 4：手动 patch → ref 直接赋值](#式-4手动-patch--ref-直接赋值)
- [类型写法速查](#类型写法速查)
- [父组件兼容性](#父组件兼容性)
- [何时 **不要** 改](#何时-不要-改)
- [工作流 SOP](#工作流-sop)
- [禁止事项](#禁止事项)

---

## 识别特征（任一命中即是目标）

```ts
// 1) computed 桥接（最常见）
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

// 2) 模板透传
<child :model-value="x" @update:model-value="$emit('update:x', $event)" />

// 3) 手动 patch 后 emit
emit('update:formData', { ...props.formData, content });

// 4) 仅用于 v-model 语义的 prop + emit 对（无业务副作用）
defineProps<{ modelValue: boolean }>();
defineEmits<{ 'update:modelValue': [v: boolean] }>();
```

---

## 标准重构四式

### 式 1：默认 v-model

```ts
// Before
const props = defineProps<{ modelValue: boolean; header: string }>();
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>();
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

// After
defineProps<{ header: string }>();
/** v-model（Vue 3.4+ defineModel 语法糖） */
const modelValue = defineModel<boolean>({ required: true });
```

真实例：[form-drawer.vue](/web/frontend/src/components/common/form-drawer.vue)。

### 式 2：具名 v-model（多个双向属性）

```ts
const localVisible = defineModel<boolean>('visible', { required: true });
const localFormData = defineModel<Partial<Item>>('formData', { required: true });
```

父组件 `v-model:visible / v-model:form-data` 照常用，kebab-case ↔ camelCase 自动互转。真实例：[greetings-form-drawer.vue](/web/frontend/src/components/greetings/greetings-form-drawer.vue)。

### 式 3：模板透传 → 直接 v-model

```vue
<!-- Before -->
<t-textarea :model-value="reason" @update:model-value="$emit('update:reason', $event)" />

<!-- After -->
<t-textarea v-model="reason" />
<script setup lang="ts">
const reason = defineModel<string>('reason', { required: true });
</script>
```

真实例：[reject-form-drawer.vue](/web/frontend/src/components/permission-requests/reject-form-drawer.vue)。

### 式 4：手动 patch → ref 直接赋值

```ts
const localFormData = defineModel<Partial<Item>>('formData', { required: true });

const handleEditorChange = (content: string): void => {
  emit('editor-change', content);
  // 直接赋值，defineModel 自动 emit update:formData
  localFormData.value = { ...localFormData.value, content };
};
```

记得把 `watch(() => props.formData.xxx)` 同步改成 `watch(() => localFormData.value?.xxx)`。

---

## 类型写法速查

| 场景 | 写法 |
|------|------|
| 必传 | `defineModel<T>({ required: true })` |
| 可选 + 默认值 | `defineModel<T>({ default: () => ({}) })` |
| 具名必传 | `defineModel<T>('name', { required: true })` |
| 具名可选 | `defineModel<T>('name')` → `Ref<T \| undefined>` |

`required` 与 `default` 二选一，不共存。

---

## 父组件兼容性

`defineModel` 协议层**等价于** "prop + `update:prop` emit"，所以父组件三种写法全部兼容，**不用动**：

| 父组件写法 | 兼容性 |
|------------|--------|
| `<child v-model="x" />` | ✅ 默认 v-model |
| `<child v-model:foo="x" />` | ✅ 具名 v-model |
| `<child :foo="x" @update:foo="x = $event" />` | ✅ 手动拆写，`@update:foo` 照常触发 |
| `<child :foo="x" @update:foo="(v) => { doSomething(v) }" />` | ⚠️ 写法 C 变种：handler 含业务副作用时保留原写法或仔细复核 |

**关键点**：子组件 `ref.value = x` 会自动 emit `update:xxx`，所以父组件 `@update:xxx="onEditorChange"` 这类业务钩子继续触发——改造后**不会丢副作用**。

---

## 何时 **不要** 改

遇到以下情形跳过，保留原 props + emit：

- 父组件 `@update:xxx` 的 handler 含**非简单赋值的业务副作用**（节流、异步校验、重置、埋点等），且依赖读取 prop 旧值
- 子组件内同一 prop 既有 `defineModel` 又想保留手写 `emit('update:xxx', ...)`——协议会重复触发
- 父组件**没用** `v-model`，`:foo + @update:foo` 只是普通事件通道，且 handler 对新值语义有自定义约定

真实跳过案例：[webhook-section.vue](/web/frontend/src/components/config/webhook-section.vue)。

---

## 工作流 SOP

1. **定位**：`grep` 两条正则
   - `computed\(\{[\s\n]*get: \(\) => props\.` —— 桥接
   - `@update:\w+="\$emit\('update:` —— 透传
2. **判定父组件**：打开引用子组件的父文件，看 `@update:xxx` handler 是不是简单赋值
3. **改造**：按四式替换；清理不再引用的 `const props =`
4. **验证**：`read_lints` → `npx vite build`（模块全部 transformed 即过）

---

## 禁止事项

- ❌ 把带业务副作用的 `@update:xxx="onEditorChange"` 吞进子组件
- ❌ 同一 prop 混用 `defineModel` 和手写 `emit('update:xxx', ...)`
- ❌ `required: true` 和 `default: xxx` 同时写
- ❌ 基础类型显式写 `defineModel<boolean>({ required: true, default: false })`——二选一
