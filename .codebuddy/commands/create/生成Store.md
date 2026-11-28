---
description: "🗃️ 生成 Pinia Store - 一键创建符合 helper-web-spec 规范的跨页共享状态 Store"
argument-hint: "<模块名> [--with-persistence]"
---

# 🗃️ 生成 Pinia Store

通过 `generate-store.ts` 工具，一键生成符合规范的 Pinia Store 脚手架——产出物**自带**：`defineStore` Composition API 写法、state/getters/actions 三段式占位、可选的 `pinia-plugin-persistedstate` 持久化配置。

> 🎯 适用场景：**跨页共享状态**（多个 view 都要读写的全局状态，例：当前用户、主题、全局缓存）。如果状态只在一个 view 内使用，**应该写在 Model 里**而不是 Store。
>
> 🚦 **何时不用本命令**：仅在单页面内使用的状态走 Model（继承 `BaseModel`）；表单临时态走组件 `ref`。Store 是**最后才考虑**的层。

## 📋 执行流程

| 步骤 | 操作 | 必须 |
|-----|------|-----|
| 1️⃣ | 确认是否真的是"跨页共享"——若不确定先读 `references/02-frontend-mvc-layers.md` Store 章节 | ✅ |
| 2️⃣ | 确认模块名（kebab-case，例：`user` / `theme` / `app`） | ✅ |
| 3️⃣ | 在 `web/` 目录执行 `npm run gen:store -- <args>` | ✅ |
| 4️⃣ | 工具产出文件后，根据业务需求填充 state / getters / actions | ✅ |
| 5️⃣ | 在使用方 view 中通过 `import { useXxxStore } from '@/stores/<模块>'` 引入 | ✅ |
| 6️⃣ | 跑 `/审查Web规范` 确认产出物合规 | 推荐 |

## 🚀 标准调用

```bash
cd web

# 普通 Store（不带持久化）
npm run gen:store -- user

# 带 localStorage 持久化的 Store
npm run gen:store -- app --with-persistence

# ts-node 直跑（脱离 web/ 目录）
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/generate-store.ts <模块名> [--with-persistence]
```

## 📁 产出位置

| 产物 | 路径 |
|------|------|
| Store 文件 | `web/frontend/src/stores/<模块>.ts` |

## ⚠️ 后处理（工具产出后必做）

1. **优先写 actions**，不要在 view / model 里直接 mutate state——保持单向数据流
2. 类型尽量从 `@/types/<模块>` 复用，不要在 store 内部重复定义 interface
3. `--with-persistence` 时确认 `web/frontend/package.json` 已装 `pinia-plugin-persistedstate`，否则会报运行时错
4. 不要直接把工具产出物提交，**至少做一次"业务字段填充"再 commit**

## ❌ 禁止
- 把单页面状态硬塞进 Store——Store 是跨页共享专用，不是"全局变量箱"
- Store 里写 HTTP 请求——HTTP 调用应在 Service（继承 `BaseService`）里
- 文件已存在时强制覆盖（工具会报错退出，先决定是否手动归档旧文件）
- 把模块名传成 PascalCase（应使用 kebab-case）

## 🔄 工具失败时的兜底

若 `npm run gen:store` 失败：
1. 读 `.codebuddy/skills/helper-web-spec/references/12-scripts-cli-reference.md` 重新核对参数
2. 若仍不可用，**回退到手写**——读 `references/02-frontend-mvc-layers.md` Store 章节按规范手写脚手架

### 额外补充说明
$1  !!IMPORTANT

---

**开始生成 Pinia Store...**
