---
name: helper-web-spec
description: "helper 项目 web/ 目录全栈开发规范 + 配套自动化工具集。Use this skill whenever the user mentions web directory, Vue components, frontend pages, backend APIs, Model, Service, Type, Store, i18n, v-model, defineModel, defineProps, defineEmits, JSDoc comments, props comments, emits comments, Vue3, Vite, Tailwind, Express, BaseModel, BaseService, auto-form, form-drawer, card-panel, page-layout, two-way binding, computed bridge, code style check, component generator, scaffolding, batch fix Props, batch fix Emits, Chinese hardcoded scan, unused import check, generate-component, check-code-style, auto-fix, add-i18n, check-unused, Vue component generation, Model generation, Service generation. 凡涉及 web/ 下任何文件——新建页面、改前端组件、加后端接口、重构、修Bug、i18n、UI调整、样式整理、utils拆分——都先使用本技能加载规范；当用户希望快速生成 Vue 组件/Model/Service 脚手架、批量检查或修复代码风格（defineProps 内联泛型、defineEmits 长签名、JSDoc 注释）、扫描中文硬编码、查未使用 import 时，使用本技能 scripts/ 下的 TypeScript 工具（ts-node 直跑，npm run gen / lint:style / lint:unused / lint:i18n / auto-fix 五条别名）。覆盖前后端分层架构、代码注释规范、组件编写规范、自动化脚手架与规范检查工具。Make sure to use this skill when the user discusses any web development, frontend work, backend API, Vue.js components, TypeScript types, Pinia stores, or any code in the web/ directory."
---

# helper Web 全栈开发规范

你是 helper 项目的 **web/ 目录全栈规范专家**。在 helper 项目下写或改任何 `web/` 代码都**必须**先遵循本规范。

> 📌 **重要**：动手前先速读 `references/06-common-pitfalls-checklist.md`——沉淀了反复踩过的真实坑。

## 按场景找文档（反向索引）

文档共 12 篇按编号铺开，但实际工作中你不会从 01 顺读到 12。下表按**任务类型**反向索引——拿到需求先对号入座，找到 2~3 篇必读的就够：

| 你正在做的事 | 必读文档 |
|------|------|
| 🆕 新建一个完整页面（含权限） | `01` 架构 + `07` cache-json + `02` 前端三层 |
| ✏️ 改前端组件 / 拆子组件 | `02` 前端三层 + `11` 组件注释 + `06` 踩坑 |
| 🔌 加后端 API / 路由 | `04` 后端 + `07` cache-json + `03` Service/Type |
| 🔁 改 v-model / 双向绑定 | `08` defineModel + `11` 组件注释 |
| 🌐 i18n / 中文硬编码 | `05` 样式与 i18n + `06` 踩坑 + `12` 工具脚本（`add-i18n.ts`） |
| 📝 统一 JSDoc 注释（Model/Service/组件） | `09`（Model）/ `10`（Service）/ `11`（组件）三选一 |
| 🧰 跑脚手架 / 批量修复 / 风格巡检 | `12` 工具脚本 |
| 🐛 排查 i18n 漏译 / 编辑器双值 / 校验时机 | `06` 踩坑（先看它再说） |
| 🧱 重构 utils（前端/后端） | `04` 后端（utils 子目录组织） + `02` 前端（class 外组织） |

## 参考文件

| 文件 | 内容 | 何时读 |
|------|------|--------|
| `references/01-architecture-overview.md` | 分层架构总览、新增页面完整流程、最小骨架 | 新建页面 |
| `references/02-frontend-mvc-layers.md` | View/Model(BaseModel)/Store 详细规范 | 改前端 |
| `references/03-service-and-types.md` | Service(BaseService)/Type 规范 | 改接口/类型 |
| `references/04-backend-routes-utils.md` | 后端路由、utils barrel、utils 子目录组织、JWT 全局鉴权 | 改后端 / 重构 utils |
| `references/05-styles-and-i18n.md` | 代码风格、CSS 公共样式组织、i18n 硬编码治理 | 改样式 / 拆组件 / 加 i18n |
| `references/06-common-pitfalls-checklist.md` | 踩坑汇总（i18n/常量/编辑器双值/校验/拆分/utils 组织） | **每次必读** |
| `references/07-cache-json-sync.md` | 新建页面·权限/接口元数据配置清单（已迁库，含历史 .cache JSON 字段关系与迁移状态） | **新建页面 / 加后端 API 必读** |
| `references/08-vue-defineModel-vmodel.md` | Vue 3.4+ `defineModel` 双向绑定重构（4 式反模式治理 + 父组件兼容性 + 何时不改） | 改组件 v-model / 消除 computed 桥接 |
| `references/09-jsdoc-model-comments.md` | Model 文件 JSDoc 注释统一（以 home-model.ts 为基准：类成员三行 JSDoc + getter @returns + 包装函数模板 + 中文分节标题 + 重构陷阱） | **改 model 注释 / 统一注释风格** |
| `references/10-jsdoc-service-comments.md` | Service 文件 JSDoc 注释统一（以 status-service.ts 为基准：类描述+@description / 方法三件套 / 工厂函数双注释固定模板 / @param 必带{类型} / 重构陷阱） | **改 service 注释 / 统一注释风格** |
| `references/11-vue-props-emits-comments.md` | 组件 Props/Emits/defineModel 注释统一（以 webhook-form.vue 为基准：单行 /** 中文 */ 贴内联字段定义处 / **props 唯一写法**：内联泛型 `defineProps<{...}>()`（需默认值时包 `withDefaults`）/ **emits 唯一写法**：长签名 `(e: 'xxx', ...): void` / defineModel 固定带语法糖尾巴 / 5 条禁用写法一次性清掉） | **改组件注释 / 统一注释风格** |
| `references/12-scripts-cli-reference.md` | `scripts/` 下 5 个 TypeScript 工具脚本的完整参数文档与场景示例（generate-component / check-code-style / auto-fix / add-i18n / check-unused）+ npm 别名表格 | **跑工具脚本前必读** |

## 架构铁律（展开看 references）

**前端五层**：View 只模板 → Model 业务逻辑（继承 `BaseModel`）→ Store 跨页共享 → Service HTTP（继承 `BaseService` + `createXxxService` 工厂）→ Type 类型（优先 `interface`，响应含 `code: number`）

**后端**：路由仅参数校验 + 响应；工具函数走 `routes/utils.ts` barrel 重导出；JWT 全局鉴权，路由内不再 `verifyToken`

**关键约定**（每条的「为什么 + 反例」在对应 reference 里）：
- View 根节点 `<page-layout>`；表单用 `<form-drawer>` + `<auto-form>`，不用裸 `<t-dialog>` / `<t-form>`
- 文案走 `useLocaleStore().t.xxx`，不硬编码中文/英文；新 key 登记到数据库 `hp_i18n_messages` 并重跑 `npm run i18n:sql` 导出静态类型
- 常量/枚举/UI 映射归 `constants/<模块>.ts`，不放 Model
- 双向绑定统一用 `defineModel<T>()` / `defineModel<T>('name')`，禁止写 `prop + update:xxx emit + computed get/set` 桥接三件套（细则与跳过场景见 `references/08-vue-defineModel-vmodel.md`）
- 代码编辑器双值：`xxxBody`(热) / `xxxBodyInitial`(冷)，不同 ref 双绑
- 表单仅在提交时 `validate()`，不输入即校验
- View 超 200 行拆 `components/<模块>/` 子组件；子组件不新建 Model，通过 props/emits 与父页接力
- Model 类成员注释一律三行 JSDoc（标题 + `@type` + `@description`），getter 带 `@returns {<类型>}`，包装函数 `useXxxModel` 用固定模板，分节标题用中文三行格式（细则见 `references/09-jsdoc-model-comments.md`）
- Service 类有描述+`@description`；方法必带 `@param {<类型>} 名 - 描述` / `@returns {Promise<T>} 描述` / `@description`；工厂函数与默认导出用固定双注释模板（细则见 `references/10-jsdoc-service-comments.md`）
- 子组件 props/emits/defineModel 每个字段上方有单行 `/** 中文描述 */`；props **唯一写法**是内联泛型 `defineProps<{...}>()`（需默认值时包 `withDefaults(defineProps<{...}>(), {...})`）；emits **唯一写法**是长签名 `(e: 'xxx', ...): void`；禁用外部 `interface Props` / Options 对象式 / 数组式 emits / 短元组 emits；`defineModel` 注释固定带「Vue 3.4+ defineModel 语法糖」尾巴（细则见 `references/11-vue-props-emits-comments.md`）
- 样式 ≥2 文件重复即提取到 `frontend/src/styles/*.css`
- 后端响应统一 `returnResponse(res, ErrorCode.xxx, data, msg)`，不裸 `res.json()`
- `beforeUnmount` 清理定时器
- **utils 只放函数**：interface/type 归 `types/`，大写常量归 `constants/`；utils 出现 `export interface` 属违规
- utils 超 200 行拆为 `utils/<模块>/` 子目录 + `index.ts` barrel

## 新增页面流程

**前端**：`types/ → services/ → models/ → views/ → constants/(如有) → router/`（文案在数据库维护，静态类型见 `types/locale.ts`）
**后端**：`types/ → utils/<模块>.ts → routes/utils.ts barrel 重导出 → routes/<模块>.ts → server.ts 注册`
**数据配置（容易漏！）**：权限与接口元数据现已迁库，以 `hp_permissions` / `hp_roles` / `hp_api_categories` / `hp_api_items` 为唯一真源，通过 Web 管理页或 `sql/` 种子维护；缓存数据已全量入库、`.cache` 缓存文件已删除，运行时不再读写 `.cache/*.json`，无需手工同步 JSON。字段关系与历史脚本见 `07-cache-json-sync.md`（顶部有迁移状态说明）

骨架代码见 `references/01-architecture-overview.md`《最小骨架》。

## 核心文件位置

| 用途 | 路径 |
|------|------|
| 前端路由 | `frontend/src/router/index.ts` |
| HTTP 客户端 | `frontend/src/services/http.ts` |
| 后端 barrel | `web/routes/utils.ts` |
| 后端入口 | `web/server.ts` |
| 通用组件 | `frontend/src/components/common/` |
| 公共样式 | `frontend/src/styles/` |
| i18n 文案真源 | MySQL `hp_i18n_messages`（`/i18n-messages` 管理页维护） |
| i18n 静态类型 | `frontend/src/types/locale.ts`（`npm run i18n:sql` 导出） |
| 前端 utils | `frontend/src/utils/<模块>/index.ts`（只含函数） |
| 后端 utils | `web/utils/<模块>/index.ts`（只含函数） |
| 前端 types | `frontend/src/types/<模块>.ts` |
| 后端 types | `web/types/<模块>.ts` |

## 自动化工具脚本（scripts/）

本技能除规范文档外，还内置 5 个 **TypeScript** 工具脚本，让规范落地不再靠手动巡检。全部脚本以 `.ts` 形式交付，通过 `ts-node` 直跑，**首选 `web/package.json` 已注册的 npm 别名**：`npm run gen / lint:style / lint:unused / lint:i18n / auto-fix`。

| 脚本 | 用途 | 何时用 |
|------|------|-------|
| `scripts/generate-component.ts` | 生成 Vue 组件 / Model / Service 脚手架（自动遵循上面所有规范） | 新建页面/组件/模型/服务 |
| `scripts/check-code-style.ts` | 检查 `defineProps` 内联泛型、`defineEmits` 长签名、JSDoc 注释 | 提交前规范巡检 |
| `scripts/auto-fix.ts` | 调用项目自身 ESLint 执行 `--fix`（规则来自 `web/eslint.config.mjs`，前后端同源），ESLint 修不了的问题如实报出 | 批量修复 lint 问题 |
| `scripts/add-i18n.ts` | 扫描中文硬编码并按文件归类，输出 i18n key 建议 | 国际化清理、输出待入库 key 建议 |
| `scripts/check-unused.ts` | 基于 TypeScript AST 检查未使用的 import（**前端 + 后端全覆盖**） | 清理冗余、瘦身 bundle |

脚本同目录的 `tsconfig.json` 为 ts-node 专用配置（CommonJS + transpileOnly），**不要**使用项目根 tsconfig。

### 公共模块（scripts/lib/）

各脚本共用，避免同一份逻辑在多处各写一遍（历史上因此出现过路径算错、忽略名单不一致等问题）：

| 模块 | 职责 |
|------|------|
| `lib/paths.ts` | 项目根 / `web` / `frontend/src` 常量，目标路径解析（兼容三种传参基准） |
| `lib/fs.ts` | 统一目录扫描（忽略名单一致、支持单文件、跳过超大文件）与读写 |
| `lib/naming.ts` | kebab / Pascal / camel 互转与名称合法性校验 |
| `lib/args.ts` | 命令行参数解析（含 `--no-x`、`--k=v`、未知选项收集） |
| `lib/scaffold-templates.ts` | **Type / Service / Model / View 四套脚手架模板的唯一来源**，被 `generate-page` / `generate-component` / `generate-type` 共用 |

> 脚手架模板曾经三处各写一份并已漂移（generate-page 生成 `import BaseModel from './base-model'` 默认导入、还引用了不存在的 `returnResponse`，产出直接编译失败）。
> 现在收敛到 `lib/scaffold-templates.ts`，并严格按项目现状生成：
> `import { BaseModel } from '@/models/base-model'`、`import { BaseService } from './base-service'`、
> 请求走 `this.get<T>/post<T>/put<T>/del<T>`（**是 `del` 不是 `delete`**）、方法用箭头函数属性、
> 类型不再 import 不存在的 `types/base`、文件名与 `@/types/xxx` 路径统一 kebab-case。

### `--fix` 支持现状

只有真正实现了写文件的脚本才支持 `--fix`，其余脚本传 `--fix` 会明确提示不支持（旧版会静默什么都不做）：

- ✅ 支持：`check-unused`（按 specifier 精确删除）、`check-import-order`（重排，保留分节注释）、`check-route`（补 kebab-case 与 meta.label）
- 🚫 只检查不改写：`check-code-style`（正则改 props/emits 会写坏文件）、`check-model-service`、`check-a11y`、`check-timer`；可自动修复的问题统一走 `npm run auto-fix`（项目 ESLint）

**典型用法**（完整参数与所有场景示例见 `references/12-scripts-cli-reference.md`）：

```bash
# 1. 生成卡片组件（首选 npm 别名）
cd web
npm run gen -- user-card -t card --icon user --icon-theme primary --i18n-prefix user

# 2. 规范巡检 → 预览 → 修复（两步走，避免黑盒）
npm run lint:style
npm run auto-fix -- --dry-run
npm run auto-fix

# 3. 扫描中文硬编码（输出待登记到 hp_i18n_messages 的 key 建议）
npm run lint:i18n

# 4. 检查未使用 import（web/devDependencies 已含 typescript，无须额外安装）
npm run lint:unused

# 免走 npm 别名的兼容调用（任意工作目录）
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-code-style.ts web/frontend/src
```

> ⚠️ **常见误用**：TS 工具脚本应放在本技能 `scripts/` 子目录，不要与项目根 `scripts/tools/`（信息卡片 shell 脚本目录）混放；`auto-fix` 全量执行前先 `--dry-run` 看清单；ts-node 直跑记得带 `-P .../scripts/tsconfig.json`。
