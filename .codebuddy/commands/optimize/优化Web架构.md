---
description: "♻️ 优化 Web 架构 - 拆 View 子组件 / 治理 Model / 整合公共样式 / utils 子目录拆分"
argument-hint: "[目标文件或方向，如 view/model/utils/styles]"
---

# ♻️ 优化 Web 架构

对已合规但结构臃肿的前端文件做结构性重构。

> 与 `/修复Web规范` 的区别：**修复**是"违规→合规"；**优化**是"合规→更优"。两者不混做。

## 📋 执行流程

| 步骤 | 操作 | 必须 |
|-----|------|-----|
| 1️⃣ | 读 SKILL.md，按需展开 `references/02-frontend-mvc-layers.md` / `references/04-backend-api-layers.md` / `references/05-styles-and-i18n.md` / `references/06-common-pitfalls-checklist.md` / `references/08-define-model-migration.md` | ✅ |
| 2️⃣ | 识别优化点（见下方典型场景） | ✅ |
| 3️⃣ | 产出方案：文件清单 + 职责边界，**先确认再动手** | ✅ |
| 4️⃣ | 落盘，跑 `/审查Web规范` 验证 | ✅ |

> 读取 `.codebuddy/skills/helper-web-spec/SKILL.md` 并执行，不要调用 `use_skill`。

## 🎯 典型场景

| 场景 | 触发条件 | 操作 |
|------|---------|------|
| View 拆子组件 | >200 行 / ≥2 独立区块 | `components/<模块>/`；子组件不建 Model，props/emits 接力 |
| Model 抽纯函数 | 方法 >30 行 / 重复转换 | 文件顶部私有纯函数 |
| 抽共享 Store | ≥2 页面共享状态 | Class + `defineStore` 双层 |
| 样式提取 | 同一样式 ≥2 文件 | 抽到 `styles/*.css`，组件 `@import` |
| **utils 拆子目录** | **utils 文件 >200 行** | **`utils/<模块>/index.ts` barrel 结构** |
| **utils interface 迁移** | **utils 含 `export interface`** | **移到 `types/<模块>.ts`，源文件保留 re-export** |
| **`defineModel` 重构** | **子组件出现 `props.modelValue` + `emit('update:xxx')` / computed 桥接 / 本地 `const = ref(props.x)`** | **按 `08-define-model.md` 改为 `const model = defineModel<T>()`；父组件删除 `@update:xxx` 手写监听** |

### ❌ 禁止
- 顺带修违规（拆开到 `/修复Web规范`）
- 改变组件对外行为
- 绕过 barrel 直接引用子文件

### 额外补充说明
$1  !!IMPORTANT

---

**开始优化 Web 架构...**
