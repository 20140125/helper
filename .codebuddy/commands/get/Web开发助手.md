---
description: "🌐 Web 开发助手 - 通用 Web 开发最佳实践指导（Vue3/TypeScript/Express）"
argument-hint: "[问题描述或关键词]"
---

# 🌐 Web 开发助手

通用 Web 开发最佳实践指导，涵盖 Vue 3、TypeScript、Express 等现代 Web 技术栈。

## 📋 执行流程

| 步骤 | 操作 | 说明 | 必须 |
|-----|------|------|-----|
| 1️⃣ | **读取项目规范** | 涉及 `web/` 目录改动时读取 `helper-web-spec` skill；纯通用问题无需 skill | ✅ |
| 2️⃣ | **分析问题** | 理解用户的问题或需求 | ✅ |
| 3️⃣ | **应用最佳实践** | 项目内改动按 skill 指令，通用问题按 Vue / TS / Express 通用实践回答 | ✅ |

### 详细说明

#### 1️⃣ 读取项目规范
涉及 helper 项目 `web/` 目录时，读取 `.codebuddy/skills/helper-web-spec/SKILL.md` 的内容并按照其指令执行（直接读取文件，不要调用 `use_skill` 工具）。

**注意**：
- 项目里没有通用的 `web` skill，不要去读取任何不存在的通用规范文件
- 通用 Vue 3 / TypeScript / Express / Pinia / Vue Router 问题，直接按通用最佳实践回答即可
- 涉及 `scripts/` 目录时改读 `helper-scripts-spec` skill

#### 2️⃣ 何时使用本命令

| 场景 | 依据 |
|------|------|
| helper 项目 `web/` 目录开发 | `helper-web-spec` skill |
| 通用 Vue 3 / TypeScript / Express 问题 | 通用最佳实践（无需 skill） |
| 通用 Pinia / Vue Router 问题 | 通用最佳实践（无需 skill） |
| helper 项目 `scripts/` 目录开发 | `helper-scripts-spec` skill |

---

## 🎯 关键规则

### ✅ 必须执行
- 区分 helper 项目规范与通用最佳实践
- 项目内改动引用 skill 中的代码示例和模式
- 提供清晰的解释和示例

### ❌ 严格禁止
- 将通用建议当作 helper 项目规范
- 忽略 helper 项目的特殊约定
- 引用不存在的 skill 文件

### 参数说明
`$1` 为可选的问题描述或关键词；未提供时按当前上下文判断用户想问的是项目规范还是通用实践。

---

**开始 Web 开发指导...**
