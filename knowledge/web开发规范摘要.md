# Web 开发规范摘要

本文件是 helper 项目 `web/` 开发规范的可检索摘要，供贾维斯 / `query_knowledge` 回答“怎么新增页面、怎么加接口、有哪些必须遵守的规范”时使用。

**完整规范以 `.codebuddy/skills/helper-web-spec/references/` 为准。** 本摘要只保留高频、项目特有、容易漏的规则，不替代 12 篇完整参考文档。CodeBuddy IDE 在改 `web/` 代码时会自动按场景加载对应 skill 文档。

## 何时使用这份规范

- 新建或修改 `web/frontend/src/` 下的页面、组件、Model、Service、Type、Store。
- 新增或修改 `web/routes/`、`web/utils/`、`web/types/` 下的后端接口与工具函数。
- 处理 i18n、`defineModel` 双向绑定、JSDoc 注释、代码风格巡检、脚手架生成。
- 新增页面或接口时同步数据库配置（`hp_permissions` / `hp_roles` / `hp_api_categories` / `hp_api_items`）。

如果只是想查完整细则，例如某种注释模板或脚本的全部参数，请直接读 `.codebuddy/skills/helper-web-spec/references/` 下对应文档。

## 架构铁律

前端五层：`View → Model → Store → Service → Type`。

- View 只放模板和交互壳，业务逻辑放 Model。
- Model 继承 `BaseModel`，Service 继承 `BaseService` 并使用 `createXxxService` 工厂。
- Store 只负责跨页面共享状态，不承载页面业务逻辑。
- Type 优先使用 `interface`，接口响应包含 `code: number`。
- 后端路由只做参数校验与响应，工具函数放 `utils/`，统一经 `routes/utils.ts` barrel 重导出。
- 后端启用 JWT 全局鉴权，路由内不要重复 `verifyToken`。

## 新增页面完整流程

前端顺序：`types → services → models → views → constants（如有） → router`（文案在数据库维护，不再改 locales）。

后端顺序：`types → utils/<模块>.ts → routes/utils.ts barrel 重导出 → routes/<模块>.ts → server.ts 注册`。

数据配置必须同步：新增权限或后端 API 时以数据库表为准（`hp_permissions` / `hp_roles` / `hp_api_categories` / `hp_api_items`），通过 Web 管理页或 `sql/` 种子维护；运行时缓存数据全量入库、`.cache` 缓存文件已删除，无需手工同步 JSON（迁移记录见 `CHANGELOG`）。

## 前端关键约定

- View 根节点使用 `<page-layout>`；表单使用 `<form-drawer>` + `<auto-form>`，不要裸用 `<t-dialog>` / `<t-form>`。
- 文案走 `useLocaleStore().t.xxx`，禁止硬编码中文或英文；新 key 登记到数据库 `hp_i18n_messages`，并重跑 `npm run i18n:sql` 导出类型与种子。
- 常量、枚举、UI 映射统一放 `constants/<模块>.ts`，不要散落在 Model 或组件里。
- 双向绑定使用 `defineModel<T>()` 或 `defineModel<T>('name')`，禁止写 `prop + update:xxx emit + computed get/set` 桥接三件套。
- 代码编辑器采用双值：`xxxBody` 是热值，`xxxBodyInitial` 是冷值，分别绑定不同 ref。
- 表单只在提交时调用 `validate()`，不要在输入过程中即时校验。
- View 超过 200 行时拆到 `components/<模块>/`；子组件不新建 Model，通过 props/emits 与父页面协作。
- 样式重复达到 2 个文件就提取到 `frontend/src/styles/*.css`。
- 定时器必须在 `beforeUnmount` 清理。
- 新增文案先写 zh / en 两条到 `hp_i18n_messages`，再 `cd web && npm run i18n:sql` 导出 `sql/i18n/35_i18n_messages.sql` 与 `types/locale.ts`；`locale.ts` 是生成文件，不要手改。
- 覆盖 `style.css` 里 `background: ... !important` 简写时，所有 `background` 长属性都要加 `!important`（简写会同时把 `background-size` 等设为 `!important`）；全局背景图只在 `body` 绘制一次，布局容器透明，避免多层叠加与原始像素裁切。改完 CSS 走 9527 生产模式需重新 `npm run build`。
- 缓存数据管理页的表清单按表名去重（多个前缀路由可共用一张表，如 `hp_cache_res_hot_list`），不要把路由清单直接当表清单，否则下拉与 UNION 都会重复。

## 后端关键约定

- 所有响应统一 `returnResponse(res, ErrorCode.xxx, data, msg)`，不要裸 `res.json()`。
- `utils` 只放函数；interface/type 放 `types/`，大写常量放 `constants/`；`utils` 中出现 `export interface` 属于违规。
- `utils` 超过 200 行时拆为 `utils/<模块>/` 子目录，并用 `index.ts` 做 barrel。
- 修改后端 utils 后，记得在 `routes/utils.ts` 重导出，避免依赖分散。

## 组件 Props / Emits 写法

- props 唯一写法是内联泛型 `defineProps<{...}>()`；需要默认值时用 `withDefaults(defineProps<{...}>(), {...})`。
- emits 唯一写法是长签名：`(e: 'xxx', ...): void`。
- 禁止外部 `interface Props`、Options 对象式 props、数组式 emits、短元组 emits。
- 每个 props / emits / defineModel 字段上方写单行 `/** 中文描述 */`。
- `defineModel` 注释固定带“Vue 3.4+ defineModel 语法糖”说明。

## 注释规范

- Model 类成员使用三行 JSDoc：标题、`@type`、`@description`。
- getter 带 `@returns {<类型>}`。
- `useXxxModel` 包装函数使用固定模板，分节标题用中文三行格式。
- Service 类有类描述和 `@description`。
- Service 方法必须有 `@param {<类型>} 名 - 描述`、`@returns {Promise<T>} 描述`、`@description`。
- Service 工厂函数与默认导出使用固定双注释模板。

## 常用工具脚本

优先使用 `web/package.json` 注册的 npm 别名，工作目录是 `web/`：

- `npm run gen`：生成组件 / Model / Service / Type 脚手架。
- `npm run lint:style`：检查 props/emits 写法与 JSDoc 注释。
- `npm run lint:unused`：基于 TypeScript AST 检查未使用 import。
- `npm run lint:i18n`：扫描中文硬编码并输出 i18n key 建议。
- `npm run auto-fix`：调用项目 ESLint 自动修复；全量执行前先 `npm run auto-fix -- --dry-run`。
- `npm run i18n:sql`：新增文案写库后，从 `hp_i18n_messages` 导出 `sql/i18n/35_i18n_messages.sql` 与 `types/locale.ts`。
- `npm run knowledge:sql`：改完 `docs/` / `knowledge/` 后重建 `sql/knowledge/38_knowledge_docs.sql`；同步现有库加 `--apply`。

注意：`check-code-style`、`check-model-service`、`check-a11y`、`check-timer` 只检查不改写；可自动修复的问题统一走 `npm run auto-fix`。

## 完整规范索引

- `01-architecture-overview.md`：分层架构总览、新增页面完整流程、最小骨架。
- `02-frontend-mvc-layers.md`：View / Model / Store 详细规范。
- `03-service-and-types.md`：Service / Type 规范。
- `04-backend-routes-utils.md`：后端路由、utils barrel、utils 子目录、JWT 全局鉴权。
- `05-styles-and-i18n.md`：代码风格、CSS 公共样式、i18n 硬编码治理。
- `06-common-pitfalls-checklist.md`：踩坑汇总，改 web 代码前必读。
- `07-cache-json-sync.md`：新增页面或接口的权限/接口元数据配置清单（已迁库，含历史字段关系与迁移状态说明）。
- `08-vue-defineModel-vmodel.md`：Vue 3.4+ `defineModel` 双向绑定重构细则。
- `09-jsdoc-model-comments.md`：Model JSDoc 注释模板。
- `10-jsdoc-service-comments.md`：Service JSDoc 注释模板。
- `11-vue-props-emits-comments.md`：组件 props / emits / defineModel 注释与写法细则。
- `12-scripts-cli-reference.md`：工具脚本完整参数与场景示例。

完整路径前缀：`.codebuddy/skills/helper-web-spec/references/`。

## 维护原则

本摘要是检索入口，不是规范的唯一真相源。若完整规范更新，应同步更新本摘要；若两者冲突，以 `.codebuddy/skills/helper-web-spec/references/` 下的完整文档为准。
