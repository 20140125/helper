# helper 前端开发自动化工具集 - 使用文档

本文件是 `helper-web-spec` skill 的参考文档之一，详尽说明 `scripts/` 目录下 **13 个 TypeScript** 工具脚本的所有参数与使用场景。

> 📌 所有脚本均为 `.ts`，通过 `ts-node` 直接执行，**无需预编译**。仓库根 `web/package.json` 已注册多条 npm 别名，**首选 npm 别名**调用，路径长串作为兜底。

## 目录

- [📦 工具列表](#-工具列表)
- [🚀 调用方式](#-调用方式)
- [🚀 工具详解](#-工具详解)
  - [生成类脚本](#生成类脚本)
    - [1. generate-component.ts - 组件生成器](#1-generate-componentts---组件生成器)
    - [2. generate-page.ts - 完整页面生成器](#2-generate-pagets---完整页面生成器)
    - [3. generate-type.ts - 类型定义生成器](#3-generate-typets---类型定义生成器)
    - [4. generate-store.ts - Pinia Store 生成器](#4-generate-storets---pinia-store-生成器)
  - [检查类脚本](#检查类脚本)
    - [5. check-code-style.ts - 代码风格检查器](#5-check-code-stylets---代码风格检查器)
    - [6. check-unused.ts - 未使用代码检查工具](#6-check-unusedts---未使用代码检查工具)
    - [7. check-timer.ts - Timer 清理检查器](#7-check-timerts---timer-清理检查器)
    - [8. check-route.ts - 路由配置检查器](#8-check-routets---路由配置检查器)
    - [9. check-import-order.ts - 导入顺序检查器](#9-check-import-orderts---导入顺序检查器)
    - [10. check-model-service.ts - 分层规范检查器](#10-check-model-servicets---分层规范检查器)
    - [11. check-a11y.ts - 无障碍访问检查器](#11-check-a11yts---无障碍访问检查器)
  - [修复类脚本](#修复类脚本)
    - [12. auto-fix.ts - 自动修复工具](#12-auto-fixts---自动修复工具)
    - [13. add-i18n.ts - i18n 键值添加工具](#13-add-i18nts---i18n-键值添加工具)
- [🔧 npm 别名（已注册）](#-npm-别名已注册)
- [📝 开发规范参考](#-开发规范参考)
- [🐛 问题反馈](#-问题反馈)

## 📦 工具列表

| 类别 | 工具 | 用途 | 技术栈 |
|------|------|------|--------|
| 生成 | `generate-component.ts` | Vue 组件代码生成器 | TypeScript + ts-node |
| 生成 | `generate-page.ts` | 完整页面脚手架生成器 | TypeScript + ts-node |
| 生成 | `generate-type.ts` | TypeScript 类型定义生成器 | TypeScript + ts-node |
| 生成 | `generate-store.ts` | Pinia Store 生成器 | TypeScript + ts-node |
| 检查 | `check-code-style.ts` | 代码风格检查器 | TypeScript + ts-node |
| 检查 | `check-unused.ts` | 未使用代码检查工具 | TypeScript + ts-node + typescript 编译 API |
| 检查 | `check-timer.ts` | Timer 清理检查器 | TypeScript + ts-node |
| 检查 | `check-route.ts` | 路由配置检查器 | TypeScript + ts-node |
| 检查 | `check-import-order.ts` | 导入顺序检查器 | TypeScript + ts-node |
| 检查 | `check-model-service.ts` | Model/Service 分层检查器 | TypeScript + ts-node |
| 检查 | `check-a11y.ts` | 无障碍访问检查器 | TypeScript + ts-node |
| 修复 | `auto-fix.ts` | 自动修复工具 | TypeScript + ts-node |
| 修复 | `add-i18n.ts` | i18n 键值自动添加工具 | TypeScript + ts-node |

> 📁 与脚本同目录的 `tsconfig.json` 是 ts-node 专用配置（`module: CommonJS` + `transpileOnly: true`），保证脚本里的 `__dirname` 可用、启动快速。**不要**用根 `tsconfig.json` 跑这些脚本。

## 🚀 调用方式

### ✅ 首选：npm 别名（在 `web/` 目录下执行）

```bash
cd web
npm run gen -- my-component -t card        # 生成卡片组件
npm run gen:page -- user                  # 生成完整页面脚手架
npm run gen:type -- user                  # 生成类型定义
npm run gen:store -- user                 # 生成 Store 文件
npm run lint:style                          # 检查代码风格
npm run lint:unused                         # 检查未用导入
npm run lint:timer                          # 检查 Timer 清理
npm run lint:route                          # 检查路由配置
npm run lint:import-order                   # 检查导入顺序
npm run lint:model-service                  # 检查分层规范
npm run lint:a11y                           # 检查无障碍访问
npm run lint:i18n                           # 扫描中文硬编码
npm run auto-fix -- --dry-run               # 预览自动修复
```

> 注意：传给脚本的参数前面要加 `--`（npm 习惯），例如 `npm run gen -- my-component`。

### 🪛 兜底：直接 ts-node 调用（任意工作目录）

```bash
npx ts-node \
  -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/<脚本名>.ts \
  [脚本参数]
```

`-P` 指向脚本目录的 `tsconfig.json`，**必填**——否则 ts-node 会用 `web/tsconfig.json`，模板字符串里的 vue 路径会被错误解析。

---

## 🚀 工具详解

### 生成类脚本

#### 1. generate-component.ts - 组件生成器

根据项目规范快速生成 Vue 组件脚手架代码。

**用法（npm 别名）：**
```bash
cd web
npm run gen -- <组件名> [选项]
```

**用法（ts-node）：**
```bash
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/generate-component.ts <组件名> [选项]
```

**选项:**
- `-t, --type <type>` - 组件类型: `basic`, `card`, `drawer`, `model`, `service` (默认: `basic`)
- `-h, --help` - 显示帮助信息
- `--icon <name>` - 卡片图标名称 (用于 card 类型)
- `--icon-theme <theme>` - 图标主题 (用于 card 类型)
- `--i18n-prefix <prefix>` - i18n 前缀 (用于 card 类型)

**示例:**
```bash
# 生成基础组件
npm run gen -- my-component

# 生成卡片组件
npm run gen -- user-card -t card --icon user --icon-theme primary

# 生成 Model 文件
npm run gen -- api -t model

# 生成 Service 文件
npm run gen -- api -t service
```

> `-t model` / `-t service` 与 `generate-page`、`generate-type` 共用 `lib/scaffold-templates.ts` 里
> 的同一套模板，产出与 `npm run gen:page` 完全一致（kebab 文件名、`@/types/<kebab>` 导入、
> `BaseService` 具名导入、`this.get/post/put/del`）。

**生成的文件结构:**
```
web/frontend/src/
├── components/
│   └── my-component/
│       └── my-component.vue
├── models/
│   └── api-model.ts
└── services/
    └── api-service.ts
```

---

#### 2. generate-page.ts - 完整页面生成器

一键生成包含 View、Model、Service、Type 的完整页面脚手架。

**用法（npm 别名）：**
```bash
cd web
npm run gen:page -- <页面名> [选项]
```

**用法（ts-node）：**
```bash
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/generate-page.ts <页面名> [选项]
```

**选项:**
- `-o, --output <dir>` - 指定输出根目录 (默认: `web/frontend/src`)
- `--no-service` - 不生成 Service 文件
- `--with-store` - 生成 Store 文件
- `--no-i18n` - 不生成 i18n 相关代码
- `--with-constants` - 生成 constants 文件

**示例:**
```bash
# 生成完整页面脚手架
npm run gen:page -- user

# 生成页面（包含 Store）
npm run gen:page -- product --with-store

# 生成页面（不包含 Service）
npm run gen:page -- order --no-service
```

**生成的文件结构:**
```
web/frontend/src/
├── types/
│   └── user.ts           # 类型定义
├── services/
│   └── user-service.ts   # API 服务
├── models/
│   └── user-model.ts     # 业务逻辑
└── views/
    └── user.vue          # 页面视图
```

> 文件名统一 kebab-case：`userProfile` → `user-profile.ts` / `user-profile-model.ts` /
> `user-profile-service.ts` / `user-profile.vue`，与 `types/`、`services/` 现存命名一致。
> 四个文件的模板统一来自 `lib/scaffold-templates.ts`。

---

#### 3. generate-type.ts - 类型定义生成器

根据项目规范快速生成 TypeScript 类型定义文件。

**用法（npm 别名）：**
```bash
cd web
npm run gen:type -- <模块名> [选项]
```

**用法（ts-node）：**
```bash
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/generate-type.ts <模块名> [选项]
```

**选项:**
- `-o, --output <dir>` - 指定输出目录 (默认: `frontend/src/types`)
- `--no-list` - 不生成列表相关类型
- `--no-form` - 不生成表单相关类型
- `--no-response` - 不生成响应类型

**示例:**
```bash
# 生成类型定义
npm run gen:type -- user

# 生成类型（不包含列表类型）
npm run gen:type -- product --no-list
```

**生成的类型:**
```typescript
export interface UserItem { id, name, createdAt, updatedAt }
export interface UserListResponse { list: UserItem[]; total: number }
export interface UserQueryParams { page?, pageSize?, keyword? }
export interface UserFormData { name: string }
export interface UserDetailResponse { code, data, message }
```

> 旧版会 `import type { BaseListResponse, PaginationParams } from './base'`，但项目里没有
> `types/base.ts`，生成即 TS2307。现在列表响应 / 分页参数直接展开写，与
> `generate-page`、`generate-component` 共用同一份模板。

---

#### 4. generate-store.ts - Pinia Store 生成器

根据项目规范快速生成 Pinia Store 文件。

**用法（npm 别名）：**
```bash
cd web
npm run gen:store -- <模块名> [选项]
```

**用法（ts-node）：**
```bash
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/generate-store.ts <模块名> [选项]
```

**选项:**
- `-o, --output <dir>` - 指定输出目录 (默认: `frontend/src/stores`)
- `--with-persistence` - 添加持久化支持（需要安装 pinia-plugin-persistedstate）

**示例:**
```bash
# 生成 Store 文件
npm run gen:store -- user

# 生成带持久化的 Store
npm run gen:store -- app --with-persistence
```

---

### 检查类脚本

#### 5. check-code-style.ts - 代码风格检查器

检查代码是否符合项目规范。

**用法:**
```bash
# npm 别名（默认扫 frontend/src）
cd web && npm run lint:style

# ts-node 直跑（可指定目录）
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-code-style.ts [目录路径]
```

**示例:**
```bash
# 检查整个 src 目录（npm 别名默认）
cd web && npm run lint:style

# 检查指定组件目录（ts-node 直跑）
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-code-style.ts web/frontend/src/components

# 检查当前目录
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-code-style.ts .
```

**检查规则:**
- `defineProps` 必须使用内联泛型
- `defineEmits` 必须使用长签名格式
- Props 字段必须有 JSDoc 注释
- Emits 事件必须有 JSDoc 注释
- Model 文件必须有完整的 JSDoc 注释
- Service 文件必须有完整的 JSDoc 注释

> 退出码：发现违规返回 `1`，全部合规返回 `0`，可作为 CI 卡点。

---

#### 6. check-unused.ts - 未使用代码检查工具

检查未使用的导入和变量（依赖 `typescript` 包）。**同时覆盖前端与后端** —— npm 别名默认扫描 `frontend/src` + `routes` + `types` + `utils` + `server.ts` + `web-launcher.ts`。

**用法:**
```bash
# npm 别名（推荐，默认扫描全工程前后端）
cd web && npm run lint:unused

# ts-node 直跑，可传入多个路径或单个文件
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-unused.ts [路径1] [路径2] ...
```

**选项:**
- `--fix` - 移除未使用的导入：按 specifier 精确删除，不再整行删除（避免连带删掉同一行仍在使用的导入）；跨行 import 会跳过并提示手动处理
- `--dry-run` - 预览将要删除的导入
- 退出码：存在未使用导入/未注册组件且未执行 `--fix` 时以 1 结束，便于接入 CI 门禁

**前置要求:**
`web/devDependencies` 已包含 `typescript`，**无需额外安装**。如果在脱离 `web/` 的环境运行，确保 `npx typescript` 可用：

```bash
npm install -g typescript
```

**示例:**
```bash
# 检查整个 web 工程（前后端全覆盖）
cd web && npm run lint:unused

# 只检查某个子目录（ts-node 直跑）
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-unused.ts web/frontend/src/components

# 同时检查多个后端目录
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-unused.ts web/routes web/utils web/server.ts
```

**输出示例:**
```
📄 web/frontend/src/components/my-component.vue:
   ❌ 未使用: unusedImport (from "some-module")
```

---

#### 7. check-timer.ts - Timer 清理检查器

检查 `setTimeout`/`setInterval` 是否在 `onUnmounted` 中正确清理。

**用法（npm 别名）：**
```bash
cd web
npm run lint:timer [选项]
```

**用法（ts-node）：**
```bash
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-timer.ts [目录路径] [选项]
```

**选项:**
- 本脚本只做检查：`--fix` / `--dry-run` 已停用（旧版宣称支持，实际从未实现，只会打印一行提示）

**示例:**
```bash
# 检查整个 frontend/src 目录
cd web && npm run lint:timer

# 检查指定目录
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-timer.ts web/frontend/src/views
```

**检查规则:**
- `setInterval` 返回值必须保存
- `setTimeout` 返回值必须保存
- 保存的 timer 必须在 `onUnmounted` 中清理（`clearInterval`/`clearTimeout`）

---

#### 8. check-route.ts - 路由配置检查器

检查路由配置是否符合项目规范。

**用法（npm 别名）：**
```bash
cd web
npm run lint:route [选项]
```

**用法（ts-node）：**
```bash
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-route.ts [路由文件或目录] [选项]
```

**选项:**
- `--fix` - 自动修复（实验性）
- `--dry-run` - 预览修复内容，不实际修改文件

**示例:**
```bash
# 检查路由配置
cd web && npm run lint:route

# 检查指定路由文件
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-route.ts web/frontend/src/router/index.ts
```

**检查规则:**
- 路由 name 应使用 kebab-case 命名
- 路由组件应使用动态导入 `() => import()` 实现懒加载
- 建议包含 `meta.title` 用于 i18n

---

#### 9. check-import-order.ts - 导入顺序检查器

检查并自动修复导入语句顺序。

**用法（npm 别名）：**
```bash
cd web
npm run lint:import-order [选项]
```

**用法（ts-node）：**
```bash
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-import-order.ts [目录路径] [选项]
```

**选项:**
- `--fix` - 自动修复导入顺序（重排时会保留 import 之间的分节注释与空行）
- `--dry-run` - 预览修复内容，不实际修改文件

**示例:**
```bash
# 检查导入顺序
cd web && npm run lint:import-order

# 自动修复
npm run lint:import-order -- --fix
```

**导入顺序规范:**
1. Vue 核心库 (`vue`, `vue-router`, `pinia`)
2. 第三方库 (TDesign 等)
3. 项目内部模块 (`@/` 开头)
4. 相对路径导入
5. 类型导入 (`import type`)

---

#### 10. check-model-service.ts - 分层规范检查器

检查 Model 和 Service 分层是否规范。

**用法（npm 别名）：**
```bash
cd web
npm run lint:model-service [选项]
```

**用法（ts-node）：**
```bash
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-model-service.ts [目录路径] [选项]
```

**选项:**
- 本脚本只做检查：`--fix` / `--dry-run` 已停用（旧版宣称支持，实际从未实现，只会打印一行提示）

**示例:**
```bash
# 检查分层规范
cd web && npm run lint:model-service

# 检查指定目录
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-model-service.ts web/frontend/src/models
```

**检查规则:**
- Model 类应继承 `BaseModel`
- Service 类应继承 `BaseService`
- Model 不应直接调用 HTTP 请求（应通过 Service）
- Service 不应包含业务逻辑（应在 Model）
- 建议添加工厂函数 `createXxxModel` / `createXxxService`

---

#### 11. check-a11y.ts - 无障碍访问检查器

检查 Vue 组件的无障碍访问属性。

**用法（npm 别名）：**
```bash
cd web
npm run lint:a11y [选项]
```

**用法（ts-node）：**
```bash
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-a11y.ts [目录路径] [选项]
```

**选项:**
- 本脚本只做检查：`--fix` / `--dry-run` 已停用（旧版宣称支持，实际从未实现，只会打印一行提示）

**示例:**
```bash
# 检查无障碍访问
cd web && npm run lint:a11y

# 检查指定组件目录
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/check-a11y.ts web/frontend/src/components
```

**检查规则:**
- `img-alt`: 图片必须有 `alt` 属性
- `button-aria-label`: 按钮应有 `aria-label` 或文字内容
- `input-label`: 输入框应有 `label` 或 `aria-label`
- `link-meaningful`: 链接应有意义明确的文本

---

### 修复类脚本

#### 12. auto-fix.ts - 自动修复工具

调用**项目自身的 ESLint** 执行 `eslint --fix`：修复与检查同源，不再用正则臆造规则。
ESLint 修不了的问题如实列出来交人工处理，不假装修好。

> 规则来源：`web/eslint.config.mjs`（ESLint 9 flat config，覆盖前端 frontend/src 与后端 routes/types/utils/server.ts）。
> 依赖未安装时先执行 `cd web && npm i`。

**用法:**
```bash
# npm 别名（默认扫 frontend/src）
cd web && npm run auto-fix [-- --dry-run]

# ts-node 直跑
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/auto-fix.ts [目录路径] [--dry-run]
```

**选项:**
- `--dry-run` - 预览将要修复的内容，不实际修改文件

**示例:**
```bash
# 预览修复（不实际修改文件）
cd web && npm run auto-fix -- --dry-run

# 执行修复
cd web && npm run auto-fix

# 修复指定目录（ts-node 直跑）
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/auto-fix.ts web/frontend/src/components
```

**输出内容:**
- 规则来源（读到的是哪个 eslint 配置）
- 扫描文件数 / 问题总数（error、warning 分类）
- dry-run：将修复多少处、涉及哪些文件；实际执行：已修复多少处
- 剩余需人工处理的问题清单（文件:行列 + 规则 + 说明，最多 20 条）

**修复范围（取决于 ESLint 配置）:**
- 可自动修复的规则：`prefer-const`、`no-extra-semi`、无用转义等
- 不可自动修复的（如 `no-explicit-any`、`no-unused-vars`、`vue/no-v-html`）只报告不改写

**不覆盖:**
- Props/Emits 的写法与注释属项目规范，非 ESLint 能力 —— 用 `npm run lint:style` 巡检后按 `references/11` 修正
- 早期版本会插入 `TODO` 占位注释，已移除（那是在批量制造脏代码）

---

#### 13. add-i18n.ts - i18n 键值添加工具

扫描代码中的中文硬编码，生成 i18n 键值对。

**用法:**
```bash
# npm 别名
cd web && npm run lint:i18n

# ts-node 直跑
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/add-i18n.ts [目录路径] [--dry-run] [--fix]
```

**选项:**
- `--dry-run` - 仅扫描，不输出修复建议
- `--fix` - 尝试自动修复（实验性功能，目前仅打印提示）

**示例:**
```bash
# 扫描硬编码中文
cd web && npm run lint:i18n

# 扫描并生成翻译建议（ts-node 直跑）
npx ts-node -P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json \
  .codebuddy/skills/helper-web-spec/scripts/add-i18n.ts web/frontend/src --dry-run
```

**输出示例:**
```
❌ 发现 3 处硬编码中文:

📄 web/frontend/src/components/my-component.vue:
   Line 15: "保存"
   → 建议 key: common.save
   ...
```

---

## 🔧 npm 别名（已注册）

`web/package.json` 已注册以下 **13 条 npm 别名**，**优先用别名**：

```json
{
  "scripts": {
    "gen": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/generate-component.ts",
    "gen:page": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/generate-page.ts",
    "gen:type": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/generate-type.ts",
    "gen:store": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/generate-store.ts",
    "lint:style": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/check-code-style.ts frontend/src",
    "lint:unused": "NODE_PATH=node_modules npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/check-unused.ts frontend/src",
    "lint:timer": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/check-timer.ts frontend/src",
    "lint:route": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/check-route.ts frontend/src/router",
    "lint:import-order": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/check-import-order.ts frontend/src",
    "lint:model-service": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/check-model-service.ts frontend/src",
    "lint:a11y": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/check-a11y.ts frontend/src",
    "lint:i18n": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/add-i18n.ts frontend/src",
    "auto-fix": "npx ts-node -P ../.codebuddy/skills/helper-web-spec/scripts/tsconfig.json ../.codebuddy/skills/helper-web-spec/scripts/auto-fix.ts frontend/src"
  }
}
```

使用：
```bash
cd web
npm run gen -- my-component
npm run gen:page -- user
npm run lint:style
npm run lint:timer
npm run auto-fix -- --dry-run
```

---

## 📝 开发规范参考

这些工具遵循以下项目规范:

1. **Vue 组件规范** - `.codebuddy/skills/helper-web-spec/`
2. **Shell 脚本规范** - `.codebuddy/skills/helper-scripts-spec/`
3. **组件注释规范** - `references/11-vue-props-emits-comments.md`

---

## 🐛 问题反馈

如果工具出现问题，请检查:
1. Node.js 版本 >= 16
2. 在 `web/` 目录下执行别名（依赖 `web/node_modules` 里的 `ts-node` / `typescript`）
3. ts-node 直跑时记得加 `-P .codebuddy/skills/helper-web-spec/scripts/tsconfig.json`
4. 确保项目结构符合预期

---

## 📄 许可证

内部工具，仅供项目使用。
