---
description: "🛠 统一 Service 注释 - 按 status-service.ts 规范化 web/frontend/src/services 下 JSDoc 注释风格"
argument-hint: "[目标文件，留空 = 全量扫描 services/ 目录]"
---

# 🛠 统一 Service 注释

把 `web/frontend/src/services/*.ts` 全部 Service 类文件的 JSDoc 注释统一成 [status-service.ts](web/frontend/src/services/status-service.ts) 风格。

> 与 `/统一Model注释` 配套：本指令**只动注释**，不改业务逻辑、不改 URL/timeout/方法体。
>
> ⚠️ 跳过 `http.ts`（底层 axios 实例 + 拦截器，行内 `//` 注释，不是 Service 类）。

## 📋 执行流程

| 步骤 | 操作 | 必须 |
|-----|------|-----|
| 1️⃣ | 读 `helper-web-spec/SKILL.md` + 重点展开 `references/10-jsdoc-service-comments.md` | ✅ |
| 2️⃣ | 读基准文件 `status-service.ts`，确认本仓库当下注释样式 | ✅ |
| 3️⃣ | 列出受影响文件清单（默认全量；若用户指定文件则按指定）；标注每个文件「✅ 已对齐 / 🟡 部分 / 🟠 较差 / 🔴 重灾」 | ✅ |
| 4️⃣ | 对每个文件按规则升级注释：单行 → 完整 JSDoc / 缺类型 @param 补 `{类型}` / 仅类型 @returns 补描述 / 工厂函数补双注释模板 | ✅ |
| 5️⃣ | 跑 grep 自检 + `read_lints` 确认无残留与无误删（含 unused import） | ✅ |

> 直接读取 `.codebuddy/skills/helper-web-spec/SKILL.md` 与 `references/10-jsdoc-service-comments.md` 并执行，不要调用 `use_skill`。

## 🎯 关键规则（速查）

| 目标 | 模板 |
|------|------|
| **类描述** | 标题 + `@description 封装 XXX 相关的 API 接口，提供 ... 能力` |
| **方法** | 标题 + `@param {<类型>} 名 - 描述`（如有）+ `@returns {Promise<T>} 描述` + `@description` + 可选 `@example` |
| **复杂 payload** | 内联类型 `{{ a: string; b?: number }}` 或命名类型 `{Partial<XxxItem>}`；禁止 `{object}` / `{any}` 走捷径 |
| **分节标题** | 三行中文格式 `// ====` + `// 中文标题` + `// ====`；工厂函数前固定标题「工厂函数和默认导出」 |
| **工厂函数** | `创建 XXX 服务实例的工厂函数` + `@description 提供 XxxService 类的实例，确保服务实例的一致性` + `@returns {XxxService} ...` |
| **默认导出** | `默认导出的 XXX 服务实例` + `@description 为向后兼容性保留的默认导出，推荐使用 createXxxService 工厂函数` |

### ✅ 必须执行
- 改完跑 `rg "@param [a-zA-Z_]" web/frontend/src/services/`，**结果必须为空**（即没有「@param 名」缺类型的写法）
- 改完跑 `rg -c "为向后兼容性保留的默认导出" web/frontend/src/services/`，每个 Service 文件应 = 1
- 每次 `multi_replace` 后立刻 `read_lints` 确认 import 未变 unused（典型如 `ApiCategory` type-only import 残留）
- 保留原有业务逻辑：URL、timeout、URL encoding、方法体一字不动

### ❌ 严格禁止
- 改 `http.ts`（不是 Service 类，独立风格）
- 给简单 CRUD 强加 `@example`（凑字数空话）
- `@param {object}` / `@param {any}` 走捷径
- 顺手修方法体（哪怕 URL 拼写显然有 typo，也单独走 `/修复Web规范`）
- 把 `@returns` 仅写类型不带描述：`@returns {Promise<XxxResponse>}` ❌

### 额外补充说明
$1  !!IMPORTANT

---

**开始统一 Service 注释...**
