# 5. 代码风格与样式组织

---

## 基础规范

| 规则 | 要求 |
|------|------|
| 缩进 | 2 空格 |
| 引号 | 单引号 |
| 分号 | 加 |
| 变量声明 | `const`/`let`（`var` 有作用域提升问题） |
| 模块导入 | ES6 `import/export`（`require` 不支持 tree-shaking） |
| 比较 | `===`/`!==`（`==` 有隐式转换陷阱） |

## 命名规范

| 场景 | 规范 | 示例 |
|------|------|------|
| 变量、函数 | camelCase | `loadList`、`isLoading` |
| 类、接口 | PascalCase | `ExampleModel`、`ExampleItem` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY` |
| 文件名 | kebab-case | `example-model.ts` |
| 事件处理 | `handle` 前缀 | `handleCreate` |
| 数据加载 | `load`/`fetch` 前缀 | `loadList` |

## TypeScript 规范

- 优先 `interface`（可扩展合并），联合类型等场景才用 `type`
- 断言用 `as`（与 JSX 兼容），不用 `<Type>`
- 用 `?.` optional chaining（`&&` 链可读性差）
- 基本类型依赖推断（`const count = 0`，不写 `: number`）

## Vue 规范

使用 `<script setup>`——Options API / `defineComponent` 样板代码多且类型推断弱。

---

## CSS 样式组织

样式重复是前端可维护性的头号杀手——同一滚动条写 5 遍，改一处忘四处。看到相同样式在第二个文件出现就该提取。

### 公共样式文件

写新样式前先查这些文件，已有的类直接用：

| 文件 | 用途 | 典型类名 |
|------|------|----------|
| `styles/style.css` | 全局基础 + Tailwind + 主题过渡 | `card-header-compact` |
| `styles/panel-layout.css` | 左右双栏面板 | `panel-layout` `panel-list` `panel-main` |
| `styles/common.css` | 空状态、纯文本、Markdown、筛选栏 | `empty-tip` `plain-text` `markdown-body` `filter-bar` |
| `styles/scrollbar.css` | 自定义滚动条（6px / 4px 两档） | `custom-scrollbar` `custom-scrollbar-sm` |

### 引用方式

```css
<style scoped>
@import "@/styles/panel-layout.css";
@import "@/styles/scrollbar.css";
/* 页面独有样式写这里 */
</style>
```

### 样式归属

| 场景 | 放哪里 | 原因 |
|------|--------|------|
| ≥2 文件出现的样式块 | `styles/*.css` | 改一处全局生效 |
| 页面独有布局/配色 | 页面 `<style scoped>` | 隔离不污染 |
| 组件内部样式 | 组件 `<style scoped>` | 跟组件走 |
| 全局主题/过渡/动画 | `styles/style.css` | 全局生效 |
| 全站背景图与遮挡层 | `styles/app-background.css` | 与 `style.css` 的写死底色互相覆盖，需单独维护 |

### 覆盖写死的全局背景

`style.css` 用 `background: var(--bg-primary) !important` 简写给 `.app-layout` / `.main-layout` / `.page-content` 设底色，**简写带出的 `background-size` / `background-attachment` 等长属性同样是 `!important`**。覆盖时所有 `background` 长属性都要加 `!important`，否则 `background-size` 被压回 `auto`，背景图按原始像素渲染、只露局部。背景只在 `body` 绘制一次、布局容器保持透明；图片层用 `cover` 铺满视口（`contain` 会留边）。改完 CSS 走 9527 生产模式必须 `npm run build`，5173 开发模式才自动热更新。细则见 `06-common-pitfalls-checklist.md` 6.8。

---

## 注释规范

**JSDoc**：Class、公共方法、属性加 JSDoc。

```typescript
/**
 * 加载规则列表
 * @param silent - 静默加载
 */
loadRules = async (silent = false): Promise<void> => { ... };
```

**分区注释**：

```typescript
// ==============================
// 状态变量
// ==============================
```

---

## 禁止事项速查

### View 中写业务逻辑

```html
<!-- ❌ -->
<script setup>
import { ref } from 'vue';
const list = ref([]);
</script>

<!-- ✅ -->
<script setup>
import { useRulesModel } from '@/models/rules-model';
const { list } = useRulesModel();
</script>
```

### Model 中直接用 axios

```typescript
// ❌ 绕过 Service 会丢失统一拦截器
import axios from 'axios';
const data = await axios.get('/api/rules');

// ✅
const service = new RuleService();
const data = await service.fetchRules();
```

### 忘记清理定时器

```typescript
beforeUnmount = (): void => {
  if (this.timer !== null) clearInterval(this.timer);
};
```

### 路由中写业务逻辑 + 裸 res.json

```typescript
// ❌ 路由内直接操作文件 + 绕过 returnResponse
router.get('/', (_req, res) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  res.json({ ok: true, rules: JSON.parse(content) });
});

// ✅
import { readRules, returnResponse, ErrorCode } from './utils';
router.get('/', (_req, res) => {
  return returnResponse(res, ErrorCode.SUCCESS, { rules: readRules() } as Record<string, unknown>, '');
});
```

### getter 不包装 computed

```typescript
// ❌ 不响应式
return { enabledCount: model.enabledCount };

// ✅
return { enabledCount: computed(() => model.enabledCount) };
```

### Model 不继承 BaseModel

```typescript
// ❌ 重复实现 pageLoading 等通用能力
export class ExampleModel { pageLoading = ref(false); }

// ✅
export class ExampleModel extends BaseModel { }
```

### 用 Dialog 而非 Drawer

```html
<!-- ❌ -->
<t-dialog v-model:visible="visible"><t-form>...</t-form></t-dialog>

<!-- ✅ -->
<form-drawer v-model="visible" ...>
  <auto-form v-model="formData" :fields="fields" />
</form-drawer>
```

---

## i18n 文案维护

文案唯一真源是 MySQL `hp_i18n_messages`（管理页 `/i18n-messages`），没有 TS 语言包文件。新增 key 的流程：

1. zh / en 各写一条到 `hp_i18n_messages`（含 `path_json` 层级、`namespace`、`sort_order`）。
2. `cd web && npm run i18n:sql`：从库导出 `sql/i18n/35_i18n_messages.sql` 种子与 `frontend/src/types/locale.ts` 静态 `Locale` 接口。
3. 前端用 `useLocaleStore().t.xxx`；`locale.ts` 是生成文件，不要手改。

种子 SQL 由脚本按 200 行分批生成，新增 key 会让后续批次边界产生少量行移位，属正常生成结果。现有库补 key 用 `npm run i18n:sql -- --apply`（幂等 UPSERT，不覆盖管理页编辑过的文案）。
