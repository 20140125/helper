---
description: "🌐 新建 Web 页面 - 按 helper 五层架构创建完整前后端页面并同步数据配置"
argument-hint: "[页面名称或功能描述]"
---

# 🌐 新建 Web 页面

在 `helper/web/` 下按五层架构新建完整前后端页面，并同步 `.cache/*.json` 数据配置。

## 📋 执行流程

| 步骤 | 操作 | 说明 | 必须 |
|-----|------|------|-----|
| 1️⃣ | **读 skill** | 直读 `.codebuddy/skills/helper-web-spec/SKILL.md`，每次必读 `references/06-common-pitfalls-checklist.md` | ✅ |
| 2️⃣ | **需求确认** | 页面名称 / 功能 / 是否需后端 API / 是否跨页共享 / 是否含代码编辑器 | ✅ |
| 3️⃣ | **建后端**（有 API 时） | `types/ → utils/<模块>/ → routes/utils.ts barrel → routes/<模块>.ts → server.ts 注册` | 有 API |
| 4️⃣ | **建前端** | `types/ → services/ → models/ → constants/(如有) → views/ → locales/ → router/`；其中 model/service 推荐用 `/生成Vue组件 <name> -t model\|service` 起脚手架 | ✅ |
| 5️⃣ | **按需拆组件** | View 预计 >200 行 → 拆 `components/<模块>/`；**优先调用 `/生成Vue组件 <name> -t basic\|card\|drawer`** 生成合规脚手架，再填业务字段 | 酌情 |
| 6️⃣ | **同步数据配置** | 按 `references/07-data-config-checklist.md` 的一键脚本补齐 `permission_metas` / `rbac` / `api_categories` / `api_items` | ✅ |
| 7️⃣ | **自检 + 规范审查** | 跑 07 的自检脚本 + `/审查Web规范` | ✅ |

### 详细说明

#### 1️⃣ 读 skill
直接读取 `.codebuddy/skills/helper-web-spec/SKILL.md` 内容并按指令执行——**不要调用 `use_skill` 工具**。骨架代码参考 `references/01-architecture.md`《最小骨架》。

#### 6️⃣ 同步数据配置（最易漏）
`web/` 的管理页（权限/角色/接口管理）运行时从 `.cache/*.json` 现读现渲染，不会扫描代码。**Permission 枚举或后端路由加了，但 JSON 没补 = 功能用户看不到**。使用 07 清单里的一键 Python 脚本，只改顶部 `MOD` / `CAT_NAME` / `ROUTES` 即可同步 4 张表；脚本采用 `os.replace` 原子写，规避运行中 web 服务的文件竞争。

## 🎯 按类型选读 references

| 页面类型 | 重点 references |
|----------|-----------------|
| 基础列表页 | 01 / 02 / 03 |
| 配置表单页 | + 06 校验时机 |
| 含代码编辑器 | + 06 编辑器双值 |
| 跨页共享状态 | 02 Store 章节 |
| 纯后端接口 | 01 / 04 |
| **任何新增页面 / 新增 API** | **必读 07 数据配置清单** |

---

## 🎯 关键规则

### ✅ 必须执行
- 读取并遵循 `helper-web-spec` skill 完整内容
- Model 继承 `BaseModel`，Service 继承 `BaseService`
- i18n `zh.ts` 与 `en.ts` 同步新增 key，UI 不出现硬编码中文
- 后端工具通过 `routes/utils.ts` barrel 重导出
- **每个新 Permission → 补 `permission_metas.json` + `rbac.json`**
- **每条新后端路由 → 补 `api_items.json`**（必要时新建 `api_categories.json`）
- `.cache/*.json` 改动使用 07 清单的原子写脚本，避免与运行中 web 服务竞争

### ❌ 严格禁止
- 直接使用编辑器修改 `.cache/*.json`（易与后端写入冲突丢失数据）
- 跳过第 6️⃣ 步数据配置同步，以为"代码写完就是完成"
- Model 不继承基类 / View 承载业务逻辑
- 为 1 条 API 单独新建 `api_categories` 分类（优先复用）

### 额外补充说明
$1  !!IMPORTANT

---

**开始新建 Web 页面...**
