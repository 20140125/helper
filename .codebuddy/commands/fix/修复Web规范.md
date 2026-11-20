---
description: "🛠️ 修复 Web 规范 - 按 helper-web-spec 自动修复 web/ 违规代码（违规→合规）"
argument-hint: "[问题描述或文件路径]"
---

# 🛠️ 修复 Web 规范

**只做「违规 → 合规」**。结构重构请用 `/优化Web架构`。

## 📋 执行流程

| 步骤 | 操作 | 必须 |
|-----|------|-----|
| 1️⃣ | 读 SKILL.md + `references/06-common-pitfalls-checklist.md`，按需展开 `references/05-styles-and-i18n.md` / `references/08-define-model-migration.md`（双向绑定违规时） | ✅ |
| 2️⃣ | 定位违规项（审查报告或用户指定） | ✅ |
| 3️⃣ | **工具优先批改**：先 `cd web && npm run auto-fix -- --dry-run` 预览 → 确认后 `npm run auto-fix` 落盘（详见下方"auto-fix 规则与边界"） | ✅ |
| 4️⃣ | 逐项修复剩余违规，**填实**工具遗留的 `/** TODO: ... 描述 */` 占位；新增文件按 `01-architecture` 分层骨架选路径 | ✅ |
| 5️⃣ | 跑 `/审查Web规范` 验证零违规 | ✅ |

> 读取 `.codebuddy/skills/helper-web-spec/SKILL.md` 并执行，不要调用 `use_skill`。工具报错时回退到纯 AI 手修。

## 🛠️ auto-fix 规则与边界

### 工具能修的（机械可批）

| 规则 | 修复内容 | 风险 |
|------|---------|------|
| `fixShortTupleEmits` | `xxx: [next: boolean]` → `(e: 'xxx', next: boolean): void;` | 🟢 低（语义不变） |
| `addPropsComments` | 给无 JSDoc 的 prop 字段插入 `/** TODO: <propName> 描述 */` | 🟢 低（仅加注释） |
| `addEmitsComments` | 给无 JSDoc 的 emit 事件插入 `/** TODO: <eventName> 事件描述 */` | 🟢 低（仅加注释） |
| `fixInterfaceProps`（实验） | 外部 `interface Props` 内联到 `defineProps<{...}>()` | 🟡 中（手动核对默认值搬运） |

### 工具不会修的（必须 AI 手修）

- **JSDoc 内容质量**：`/** TODO: xxx 描述 */` 占位 **必须 AI 填实**，不能保留到提交
- **数组式 `defineEmits([...])`** / **Options 对象式 `defineProps({ key: { type: ... } })`**：工具不识别，AI 重写为内联泛型/长签名
- **defineModel 缺尾巴**：工具不检测，AI 按 Vue 3.4+ 语法糖手补
- **i18n 硬编码 / 未用 import / 样式重复**：分别由 `/审查Web规范` 中的 `lint:i18n`、`lint:unused` 报告 + AI 手修

### 标准调用

```bash
cd web

# ✅ 第 1 步：dry-run 预览
npm run auto-fix -- --dry-run

# ✅ 第 2 步：确认无误后实际修复
npm run auto-fix

# 指定目录
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/auto-fix.ts web/frontend/src/components --dry-run
```

### 工具失败时的兜底

若 `auto-fix` 报错或修出语法错：
1. `git checkout -- web/frontend/src` 回退
2. 缩小目录依次跑，定位是哪个文件让工具崩溃
3. 改 AI 手修（参考 `references/11-vue-props-emits-jsdoc.md` 的 N1~N5 迁移表）

### ✅ 注意
- 修 i18n：先补 `locales/{zh,en}.ts` key，再改引用；`template` 用 `t.xxx`、`script` 用 `t.value.xxx`
- 修样式：优先引用已有公共类（`custom-scrollbar` / `panel-layout` / `markdown-body`）
- 改常量/i18n：全量搜索同步所有引用

### ❌ 禁止
- **跳过 `--dry-run` 直接全量修复**——工具是机械批改，缺少业务判断
- 在 git 工作区有未提交改动时跑修复——出错难以回滚
- 把工具产出的 `TODO: xxx 描述` 占位**保留到提交里**
- 顺带做结构重构（越权）／只修一处留同类问题／子组件另起 `useXxxModel()`

### 额外补充说明
$1  !!IMPORTANT

---

**开始修复 Web 规范...**
