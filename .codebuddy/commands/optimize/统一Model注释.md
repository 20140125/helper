---
description: "📝 统一 Model 注释 - 按 home-model.ts 规范化 web/frontend/src/models 下 JSDoc 注释风格"
argument-hint: "[目标文件，留空 = 全量扫描 models/ 目录]"
---

# 📝 统一 Model 注释

把 `web/frontend/src/models/*.ts` 全部 Model 文件的 JSDoc 注释统一成 [home-model.ts](web/frontend/src/models/home-model.ts) 风格。

> 与 `/优化Web架构` 区别：本指令**只动注释**，不改业务逻辑、不改文件结构。

## 📋 执行流程

| 步骤 | 操作 | 必须 |
|-----|------|-----|
| 1️⃣ | 读 `helper-web-spec/SKILL.md` + 重点展开 `references/09-jsdoc-model-comments.md` | ✅ |
| 2️⃣ | 读基准文件 `home-model.ts`，确认本仓库当下注释样式 | ✅ |
| 3️⃣ | 列出受影响文件清单（默认全量；若用户指定文件则按指定） | ✅ |
| 4️⃣ | 对每个文件按规则升级注释：单行 → 三行 JSDoc / 英文标题 → 中文 / 包装函数模板 | ✅ |
| 5️⃣ | 跑 grep 自检 + `read_lints` 确认无残留与无误删 | ✅ |

> 直接读取 `.codebuddy/skills/helper-web-spec/SKILL.md` 与 `references/09-jsdoc-model-comments.md` 并执行，不要调用 `use_skill`。

## 🎯 关键规则（速查）

| 目标 | 模板 |
|------|------|
| **类成员** | 三行 JSDoc：标题 + `@type {<类型>}` + `@description` |
| **getter** | 标题 + `@returns {<类型>} 描述`（讲清边界条件） |
| **方法** | 标题 + `@param {<类型>} 名 - 描述`（如有）+ 可选 `@description`；省略 `@returns {void}` |
| **包装函数** | 固定模板：`Composition API 包装函数` + `@description 将 XxxModel 类包装为 Composition API 可用的函数` |
| **分节标题** | 三行中文格式 `// ====` + `// 中文标题` + `// ====`；禁止英文 State/Computed/Methods |

### ✅ 必须执行
- 改完跑 `rg "^  /\*\* [^*]" web/frontend/src/models/`，**结果必须为空**
- 每次 `multi_replace` 后立刻 `read_lints` 确认字段未被误删、import 未变 unused
- 保留原有业务逻辑：注释行变多/变少，但成员定义、return 表达式、方法体一字不动

### ❌ 严格禁止
- 修改类成员的类型签名（`@type` 与 TS 类型不一致时以 TS 为准）
- 顺手「优化」业务代码（哪怕是显然的小问题，也单独走 `/修复Web规范`）
- 把单行注释升级时遗漏字段定义本身（典型坑：`/** xxx */ \n field: T = v;` 替换成多行注释时把 `field: T = v;` 也丢了）
- 给简单 setter/handler 加 `@returns {void}` 噪音

### 额外补充说明
$1  !!IMPORTANT

---

**开始统一 Model 注释...**
