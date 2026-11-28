# 6. 常见踩坑与项目经验

> 写新代码或 Review 时对照本清单，可规避 90% 返工。

---

## 6.1 i18n：文案走 `useLocaleStore().t.xxx`

硬编码中文/英文无法切换语言，25+ 文件已统一用 i18n。

| 场景 | 写法 |
|------|------|
| `<template>` | 通过 Model 暴露的 `t` |
| Model 类 | `this.localeStore.t.xxx` |
| utils/constants | `useLocaleStore().t.xxx` |

```typescript
// ❌
MessagePlugin.warning('请填写 URL');
// ✅
MessagePlugin.warning(this.localeStore.t.apiManagement.executeUrlRequired);
```

路由 `meta.label` 也用 i18n key（`'menu.apiManagement'`）。新增文案同时补中英语言包。

---

## 6.2 常量/枚举/UI 映射：放 `constants/`

命中以下任一即拆到 `frontend/src/constants/<模块>.ts`，放 Model 会让 Model 膨胀且难以复用：
1. 值不随运行时变化
2. 可能被多处共用
3. 与 UI 映射有关（图标/主题色）

```typescript
// ❌ 写在 Model 里
HTTP_METHODS = ['GET', 'POST'] as const;

// ✅ constants/api-management.ts
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
export const METHOD_THEME: Record<string, string> = { GET: 'success', POST: 'primary' };
```

---

## 6.3 路由 `meta` 遵循 `RouteMeta`

```typescript
meta: {
  label: 'menu.apiManagement',           // i18n key
  icon: 'api',
  inMenu: true,
  menuGroup: 'features',
  permissions: [Permission.API_MANAGEMENT_VIEW],
} satisfies RouteMeta,
```

`permissions` 首个 VIEW 权限供 `BaseModel.canEdit()` 推导 EDIT 权限。

---

## 6.4 代码编辑器"双值模式"

`file-content.vue` 的 `content` prop 变化会重建编辑器实例（光标回跳）。拆两个 ref 避免此问题：

| ref | 说明 | 写入时机 |
|-----|------|---------|
| `xxxBody`（热值） | `@change` 回写 | 用户输入时 |
| `xxxBodyInitial`（冷值） | `:content` 绑定 | 仅打开/清空/切换时 |

```typescript
executeBody: Ref<string> = ref('');
executeBodyInitial: Ref<string> = ref('');

openDrawer = () => { this.executeBody.value = ''; this.executeBodyInitial.value = ''; };
handleChange = (v: string) => { this.executeBody.value = v; };
```

不要把 `:content` 和 `@change` 绑同一个 ref——每次输入都会触发 content 变化重建编辑器。

---

## 6.5 表单校验：仅提交时触发

- 校验在 `submitXxxForm()` / `handleConfirm` 内调用
- 不在 `watch(formData)` 整表校验——输入过程中弹校验体验差
- 字段即时提示用 `trigger: 'blur'`，不要用 `trigger: 'change'` 做必填校验

---

## 6.6 utils 目录组织

前后端 `utils/` 散文件超过 200 行或有多个独立职责时拆为子目录：

```
utils/<模块>/
├── index.ts        ← barrel 重导出外部使用的符号
├── <职责-a>.ts
└── <职责-b>.ts
```

- 目录内每个文件 < 200 行
- 外部 import 路径不变（`from '@/utils/format'` 解析到 `format/index.ts`）
- 前端按功能分组：`format/`、`rules/`、`rbac/`、`greetings/`、`api-management/`
- 不直接引用子文件（绕过 barrel 会导致依赖分散）
- **utils 只放函数**：interface/type 放 `types/`，大写常量放 `constants/`

```typescript
// ✅
import { formatSize } from '@/utils/format';
import type { RuleFlatFormData } from '@/types/rule'; // interface 在 types/
// ❌
import { formatSize } from '@/utils/format/common'; // 绕过 barrel
import type { RuleFlatFormData } from '@/utils/rules'; // interface 不应在 utils
```

---

## 6.7 新建页面·4 个 `.cache/*.json` 必改（**最高频漏点**）

**写完代码 ≠ 接入完成**。页面功能依赖以下运行时数据配置，任何一个漏改都会让用户看不到/用不上新功能：

| 文件 | 漏改后果 |
|------|----------|
| `.cache/permission_metas.json` | 权限管理页看不到新权限 |
| `.cache/rbac.json`（admin / viewer） | 这些角色用户菜单缺入口 |
| `.cache/api_categories.json` | 接口管理页分类缺失 |
| `.cache/api_items.json` | **每条新后端 API 都要登记**，否则接口管理页查不到 |

完整字段约束、原子写法、自检脚本见 `07-cache-json-sync.md`。

**一句话**：新增 Permission 枚举值 → 追加 `permission_metas` + `rbac`；新增 `router.<method>('<path>')` → 追加 `api_items`（必要时新建 `api_categories`）。

> 6.7 为历史记录：权限与接口元数据现已迁库，以 `hp_permissions` / `hp_roles` / `hp_api_categories` / `hp_api_items` 为唯一真源，不再维护 `.cache/*.json`（详见 `07-cache-json-sync.md` 顶部迁移状态）。

---

## 6.8 覆盖写死的全局背景：`!important` 简写要逐项覆盖

`style.css` 里 `.app-layout` / `.main-layout` / `.page-content` 用
`background: var(--bg-primary) !important` 简写设底色，**简写带出的
`background-size` / `background-attachment` 等长属性同样是 `!important`**。
只给 `background-image` 加 `!important` 而漏掉 `background-size`，会被简写压回
`auto`，背景图按原始像素绘制，用户只看得到中间一小块。

```css
/* ✅ 所有 background 长属性都加 !important，且只在 body 上绘制一次 */
html[data-app-bg='1'] body {
  background-color: var(--bg-primary) !important;
  background-image: linear-gradient(rgba(9, 12, 20, .22), rgba(9, 12, 20, .22)),
    var(--app-bg-image, none) !important;
  background-size: cover, cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  background-attachment: fixed !important;
}
html[data-app-bg='1'] .app-layout,
html[data-app-bg='1'] .main-layout,
html[data-app-bg='1'] .page-content {
  background-color: transparent !important;
  background-image: none !important;
}
```

要点：背景只在 `body` 画一次（多层容器各画一份会互相裁切、叠加变暗）；图片层用
`cover` 铺满视口不留黑边，`contain` 会留主题色边；改完 CSS 走 9527 生产模式必须
重新 `npm run build`，5173 开发模式才自动热更新。
