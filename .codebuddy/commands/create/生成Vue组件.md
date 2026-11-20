---
description: "🎨 生成 Vue 组件 - 一键创建符合 helper-web-spec 规范的 Vue/Model/Service 脚手架"
argument-hint: "<组件名> [-t basic|card|drawer|model|service] [--icon ...] [--icon-theme ...] [--i18n-prefix ...]"
---

# 🎨 生成 Vue 组件

通过 `generate-component.ts` 工具，一键生成符合规范的脚手架——产出物**自带**：内联泛型 `defineProps<{...}>()`、长签名 `defineEmits`、JSDoc 注释占位、`useLocaleStore` i18n 接入、`@/` 路径别名、TS 类型导入。

> 🎯 适用场景：新建页面/组件/Model/Service 的**第 1 步**。手写从零开始易漏规范，用此命令产出物再做业务即可。
>
> 🚦 **何时用 `/新建Web页面` 而不是本命令**：从 0 新建一个完整功能页（涉及路由 / 权限 / `.cache/*.json` 数据配置同步）请用 `/新建Web页面`——它会编排五层架构并在拆组件时调用本命令。本命令仅产出**单个文件**脚手架。

## 📋 执行流程

| 步骤 | 操作 | 必须 |
|-----|------|-----|
| 1️⃣ | 确认组件类型（basic/card/drawer/model/service）和组件名（kebab-case） | ✅ |
| 2️⃣ | 在 `web/` 目录执行 `npm run gen -- <args>`（或 ts-node 直跑） | ✅ |
| 3️⃣ | 工具产出文件后，**根据用户实际业务**填充 props/emits 字段、`/** TODO */` 占位注释 | ✅ |
| 4️⃣ | 跑 `/审查Web规范` 确认产出物合规 | 推荐 |

## 🚀 标准调用

```bash
cd web

# 基础组件
npm run gen -- my-component

# 卡片组件（必带图标 + i18n 前缀）
npm run gen -- user-card -t card --icon user --icon-theme primary --i18n-prefix user

# 表单抽屉
npm run gen -- user-form-drawer -t drawer

# Model 文件（输出到 frontend/src/models/）
npm run gen -- user -t model

# Service 文件（输出到 frontend/src/services/）
npm run gen -- user -t service
```

ts-node 直跑（脱离 web/ 目录）：
```bash
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/generate-component.ts <组件名> [选项]
```

## 📁 产出位置

| 类型 | 输出位置 |
|------|---------|
| `basic / card / drawer` | `web/frontend/src/components/<组件名>/<组件名>.vue` |
| `model` | `web/frontend/src/models/<组件名>-model.ts` |
| `service` | `web/frontend/src/services/<组件名>-service.ts` |

## ⚠️ 后处理（工具产出后必做）

1. 把 `/**  */`（空 JSDoc）和 `/** TODO: ... 描述 */` 占位**全部填实**
2. `card` 类型：`t.<i18n-prefix>.title` 这条 i18n key 同步加到 `frontend/src/locales/{zh,en}.ts`
3. `model/service` 类型：`@/types/<组件名>` 类型文件需自行新建
4. 不要直接把工具产出物提交，**至少做一次"业务字段填充"再 commit**

## ❌ 禁止
- 文件已存在时强制覆盖（工具会报错退出，先决定是否手动归档旧文件）
- 把 `gen` 命令产出的文件当作"完成态"——它是**起点不是终点**
- 把组件名传成 PascalCase（应使用 kebab-case，如 `user-card` 不是 `UserCard`）

## 🔄 工具失败时的兜底

若 `npm run gen` 失败（路径错/重名/参数错），AI 应：
1. 读 `.codebuddy/skills/helper-web-spec/references/12-cli-tool-reference.md` 重新核对参数
2. 若仍不可用，**回退到手写**——读 `references/02-frontend-mvc-layers.md` + `references/11-vue-props-emits-jsdoc.md`，按规范手写脚手架

### 额外补充说明
$1  !!IMPORTANT

---

**开始生成 Vue 组件...**
