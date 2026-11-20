# 2. 前端三层规范（View / Model / Store）

## 目录

- [View 层](#view-层)
- [Model 层](#model-层)
- [Store 层](#store-层)

---

## View 层

**职责**：只做模板渲染，数据和方法来自 Model。

### 核心规则

- ❌ **禁止**：`ref`/`computed`/`watch`/`onMounted`——业务逻辑散落各处难以追踪
- ✅ **必须**：根元素用 `<page-layout>`，文案走 `t.xxx`（i18n）
- ✅ **组件**：卡片用 `<card-panel>`，表单用 `<form-drawer>` + `<auto-form>`
- ✅ **列表三态**：加载中 / 空 / 有数据

### form-drawer 确认按钮

```vue
<!-- ✅ 用 mode 自动推导 -->
<form-drawer 
  v-model="visible" 
  :mode="editing ? 'edit' : 'create'" 
/>

<!-- ✅ 特殊文案才覆盖 -->
<form-drawer :confirm-text="t.xxx.executeBtn" />

<!-- ❌ 手写三元 -->
<form-drawer :confirm-text="editing ? t.x.a : t.x.b" />
```

### 页面拆分

View 超 200 行或 ≥2 个独立区块 → 拆到 `components/<模块>/`

命名：`xxx-card.vue`、`xxx-panel.vue`、`xxx-form-drawer.vue`

**注意**：子组件只做展示与事件转发，不建 Model、不调 Service/Store

---

## Model 层

**职责**：页面全部业务逻辑，继承 `BaseModel`（提供 `pageLoading`、`canEdit()` 等）。

### 类结构

```typescript
export class XxxModel extends BaseModel {
  // 1. 依赖注入（store、service）
  // 2. 状态变量（ref）
  // 3. 私有变量（定时器、缓存）
  // 4. 计算属性（computed）
  // 5. 公共方法（箭头函数）
  // 6. 私有方法（箭头函数）
  // 7. 生命周期（mounted / beforeUnmount）
}

export const useXxxModel = () => {
  const m = new XxxModel();
  onMounted(() => m.mounted());
  onBeforeUnmount(() => m.beforeUnmount());
  return { ...m };
};
```

### canEdit 使用规则

`canEdit()` 判断编辑权限，内部将 `:view` 替换为 `:edit`：

- **单权限域** → `canEdit()` 不传参（自动推导）
- **多权限域** → `canEdit(Permission.XXX_VIEW)`

```vue
<!-- ✅ 单权限域 -->
<t-button v-if="canEdit()" @click="handleEdit">编辑</t-button>

<!-- ✅ 多权限域 -->
<t-button v-if="canEdit(Permission.CONFIG_VIEW)">修改配置</t-button>
```

### 核心规则

- ✅ 公共方法用**箭头函数**（自动绑定 this）
- ✅ 计算属性用 `computed()` 包装
- ✅ 定时器在 `beforeUnmount` 清理（防止内存泄漏）
- ✅ 文案走 `this.localeStore.t.xxx`（禁止硬编码）
- ✅ 复杂数据变换抽到 `utils/<模块>.ts`（便于单元测试）
- ❌ **禁止**：class 外写工具函数/interface/常量（放 `utils/`、`types/`、`constants/`）

### 标准模板（精简版）

```typescript
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { BaseModel } from '@/models/base-model';
import { ExampleService } from '@/services/example-service';
import type { ExampleItem } from '@/types/example';

export class ExampleModel extends BaseModel {
  // 依赖注入
  private exampleService = new ExampleService();
  
  // 状态变量
  list = ref<ExampleItem[]>([]);
  loading = ref(false);
  
  // 私有变量
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  
  // 计算属性
  get enabledCount() {
    return computed(() => this.list.value.filter(i => i.enabled).length);
  }
  
  // 公共方法
  loadList = async () => {
    this.pageLoading.value = true;
    try {
      const res = await this.exampleService.fetchList();
      this.list.value = res.data.items;
    } catch (err) {
      MessagePlugin.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      this.pageLoading.value = false;
    }
  };
  
  // 生命周期
  mounted = () => {
    this.loadList();
    this.startPolling();
  };
  
  beforeUnmount = () => {
    this.stopPolling();
  };
  
  // 私有方法（定时器）
  private startPolling = () => {
    if (this.pollingTimer !== null) return;
    this.pollingTimer = setInterval(() => this.loadList(), 30000);
  };
  
  private stopPolling = () => {
    if (this.pollingTimer !== null) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  };
}

export const useExampleModel = () => {
  const m = new ExampleModel();
  onMounted(() => m.mounted());
  onBeforeUnmount(() => m.beforeUnmount());
  return { ...m };
};
```

---

## Store 层

**职责**：跨页面共享状态（单页面私有数据放 Model）。

### 何时使用

✅ **适合**：
- 多页面共享状态（用户权限、主题、系统状态）
- 需要持久化的状态（语言偏好、主题设置）
- 全局单例（轮询状态、WebSocket 连接）

❌ **不适合**：
- 单页面业务状态（放 Model）
- 组件局部状态（放组件）
- 可通过 props/events 传递的数据

### 标准模板（精简版）

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { SomeService } from '@/services/some-service';

export class SomeStore {
  // 状态变量
  items = ref([]);
  loading = ref(false);
  
  // 私有变量
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  
  // 依赖注入
  private someService = new SomeService();
  
  // 计算属性
  get count() {
    return this.items.value.length;
  }
  
  // 公共方法
  fetchItems = async (force = false) => {
    if (!force && this.items.value.length > 0) return;
    this.loading.value = true;
    try {
      const { data: { items } } = await this.someService.fetchItems();
      this.items.value = items;
    } finally {
      this.loading.value = false;
    }
  };
  
  // 定时器管理
  startPolling = (interval = 30000) => {
    this.fetchItems();
    if (this.pollingTimer !== null) return;
    this.pollingTimer = setInterval(() => this.fetchItems(true), interval);
  };
  
  stopPolling = () => {
    if (this.pollingTimer !== null) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  };
}

export const useSomeStore = defineStore('some', () => {
  const store = new SomeStore();
  return {
    ...store,
    count: computed(() => store.count),
  };
});
```

### Model vs Store

| 维度 | Model | Store |
|------|-------|-------|
| 作用域 | 单页面 | 跨页面 |
| 生命周期 | 跟随组件 | 全局单例 |
| 状态归属 | 页面私有 | 全局共享 |
| 继承 | 继承 BaseModel | 不继承 |
| 文件命名 | `xxx-model.ts` | `xxx.ts` |

---

## 最佳实践速查

### View 层

- ✅ 只做模板渲染，逻辑全放 Model
- ✅ 使用统一组件（page-layout、card-panel、form-drawer）
- ✅ 文案走 i18n（`t.xxx`）

### Model 层

- ✅ 继承 BaseModel
- ✅ 公共方法用箭头函数
- ✅ 定时器在 beforeUnmount 清理
- ✅ 复杂逻辑抽到 `utils/`

### Store 层

- ✅ 只放跨页面共享状态
- ✅ 提供定时器启动/停止方法
- ✅ 用 `defineStore` 包装类实例

### 代码风格

- ✅ 写 JSDoc 注释（@description、@param、@returns）
- ✅ 注释用英文标点
- ✅ 复杂类型用 `interface` 或 `type` 定义

---

## 参考资源

- [BaseModel 源码](/projects/helper/web/frontend/src/models/base-model.ts)
- [Pinia 文档](https://pinia.vuejs.org/)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
