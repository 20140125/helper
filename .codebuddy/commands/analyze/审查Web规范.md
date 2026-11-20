---
description: "🔍 审查 Web 规范 - 扫描 web/ 是否符合五层架构、样式规范与踩坑清单（只报告不改）"
argument-hint: "[文件或目录路径，留空则全量；可加 --only=style|i18n|unused 只跑某一类]"
---

# 🔍 审查 Web 规范

**只报告不修改**。结果分 🔴 必须修 / 🟡 建议修，每项附修复建议（指向 `/修复Web规范`）。

## 📋 执行流程

| 步骤 | 操作 | 必须 |
|-----|------|-----|
| 1️⃣ | 读 SKILL.md + `references/06-common-pitfalls-checklist.md`，按需展开 `references/05-styles-and-i18n.md` | ✅ |
| 2️⃣ | **工具优先**（详见下方"工具矩阵"）：`cd web && npm run lint:style` 拿字段级违规、`npm run lint:i18n` 拿硬编码中文、`npm run lint:unused` 拿未用 import | ✅ |
| 3️⃣ | 扫描架构层 + 样式层 + 踩坑清单（工具覆盖不到的部分靠 AI 阅读补全） | ✅ |
| 4️⃣ | 输出分级报告，注明文件路径与行号；字段级违规引用工具输出、架构级/样式级问题由 AI 补充 | ✅ |

> 读取 `.codebuddy/skills/helper-web-spec/SKILL.md` 并执行，不要调用 `use_skill`。工具报错时回退到纯 AI 扫描。

## 🎯 扫描重点

| 层级 | 检查项 |
|------|-------|
| **架构**🔴 | BaseModel/BaseService 继承、View 混业务、硬编码中文、`returnResponse` |
| **样式**🔴🟡 | 公共样式重复、scrollbar/panel-layout/markdown-body 类 |
| **utils**🔴 | utils 文件含 `export interface`/`export type` → 应移至 `types/` |
| **踩坑**🟡 | i18n key、常量归宿、编辑器双值、表单校验时机、utils 行数 >200 |

## 🛠️ 工具矩阵（步骤 2️⃣ 详解）

三个 npm 别名分别对应三类工具检查，可单独跑也可顺序全跑。

### A. `npm run lint:style` — 字段级写法/JSDoc 巡检

| 规则 ID | 规则含义 | 适用文件 |
|---------|---------|---------|
| `defineProps-inline` | 必须使用内联泛型 `defineProps<{...}>()`，禁外部 `interface Props` | `*.vue` |
| `defineEmits-longhand` | 必须使用长签名 `(e: 'xxx'): void;`，禁短元组 | `*.vue` |
| `props-comments` / `emits-comments` | 每个字段上方需有 `/** ... */` JSDoc | `*.vue` |
| `model-jsdoc-class` / `model-jsdoc-member` | Model 类与公共字段/方法必须有 JSDoc | `models/*.ts` |
| `service-jsdoc-class` / `service-jsdoc-method` / `service-jsdoc-param` / `service-jsdoc-returns` | Service 类需 `@description`、方法需 `@param`/`@returns` | `services/*.ts` |

> 详细规则：`references/11-vue-props-emits-jsdoc.md` / `references/09-jsdoc-model-comments.md` / `references/10-jsdoc-service-comments.md`

### B. `npm run lint:i18n` — 中文硬编码扫描

输出形如：
```
📄 web/frontend/src/components/dashboard/user-card.vue:
   Line 15: "保存"
   → 建议 key: dashboard.保存
```

**AI 二次处理**：
- 工具产出的 `dashboard.保存` 是中文 key，AI 必须改为英文驼峰 `dashboard.save`
- 工具只输出 zh 建议，**en.ts 翻译需 AI/人工补**
- 工具**不**自动替换源代码硬编码（`--fix` 是占位 stub），仍需手动改为 `t.value.xxx`
- 工具会把"模板 `{{ }}` 中的中文"、"TS 文件 console.log 中文"误报，需 AI 排除

### C. `npm run lint:unused` — 未用 import 检查（基于 TypeScript AST）

> **扫描范围**：前端 `frontend/src` + 后端 `routes/` `types/` `utils/` `server.ts` `web-launcher.ts`，前后端全覆盖。

| 误报场景 | 工具判断 | 实际 |
|---------|---------|------|
| `import type { X }` 仅用于 JSDoc `@type {X}` | ❌ 未用 | ✅ 有用 |
| `import 'side-effect-only'` 副作用导入 | 不报 | ✅ 保留 |
| 通过 `eval`/反射使用 | ❌ 未用 | ✅ 有用 |

**结论**：工具是粗筛，命中后必须 `grep_search` 二次确认；删除后跑 `cd web && npm run build`（即 `tsc --noEmit`）验证类型仍编译。

## 🔧 单独调用某个工具

```bash
cd web

# 默认扫整个 frontend/src
npm run lint:style    # 字段级写法
npm run lint:i18n     # 硬编码中文
npm run lint:unused   # 未用 import

# 指定目录
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-code-style.ts web/frontend/src/components
```

## 🔄 工具失败时的兜底

1. 检查 `web/node_modules/` 是否安装；如无则 `cd web && npm install`
2. 检查 `.codebuddy/skills/helper-web-spec/scripts/tsconfig.json` 是否存在
3. 仍失败回退**手工巡检**：用 `grep_search` 按规则 ID 含义逐项扫，参考 references 中对应文档

### ❌ 禁止
- 修改任何代码（修复请用 `/修复Web规范`）
- 把工具结果直接当真——尤其 i18n 与 unused 都有误报，必须 AI 二次核对

### 额外补充说明
$1  !!IMPORTANT

---

**开始审查 Web 规范...**
