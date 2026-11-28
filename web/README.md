# Web 管理界面

基于 **Node.js + Express**（后端）和 **Vue 3 + TDesign**（前端）的可视化管理界面，提供守护进程控制、日志查看、配置管理、自定义规则、AI 审批、缓存管理、消息模板、接口管理、祝福语管理、提醒寄语、RBAC 权限管理、表单调试等能力。

---

## 技术栈

**后端**：Node.js · Express · TypeScript · ts-node · JWT · Multer · Nodemailer

**前端**：Vue 3 · Vite · TypeScript · TDesign Vue Next · Pinia · Vue Router · Axios · Tailwind CSS · CodeMirror 6 · vue-i18n

---

## 快速启动

### 生产模式

```bash
cd web && npm install && npx ts-node server.ts
# 访问 http://localhost:9527
```

或通过 `scripts/start_web.sh` 统一管理（推荐，会同时拉起启动器）：

```bash
bash scripts/start_web.sh start   # 同时启动 server.ts (9527) + web-launcher.ts (3001)
bash scripts/start_web.sh status
```

> **脱离 `scripts/` 运行**：Web 侧不依赖 `scripts/` 也能独立启动。
> 没有 `scripts/start_web.sh` 时，「Web 服务」页面的启停 / 重启会自动降级为直接拉起 / 结束 `server.ts` 进程，
> PID 文件落在 `web/.runtime/`（`web.pid` / `launcher.pid`）；日志统一写入 `hp_run_logs`，不落文件。
> 此时提醒类脚本（守护进程、脚本执行、卡片出图等）不可用，属预期降级。
>
> ```bash
> cd web && npx ts-node web-launcher.ts   # 可选：单独启动 3001 启动器
> ```

### 开发模式

```bash
# 终端 1：启动后端（热加载由 ts-node 支持）
cd web
NODE_ENV=development npx ts-node server.ts

# 终端 2：启动前端 Vite dev server
cd web/frontend && npm install && npm run dev
# 访问 http://localhost:5173（API 自动代理到后端 9527）
```

### 构建前端

```bash
cd web/frontend && npm run build   # 产物输出到 web/public/
```

---

## 环境变量

环境变量优先读 `web/.env`，该文件不存在时回退 `scripts/.env`（见 [scripts/README.md](../scripts/README.md#环境变量配置)）。
两者都存在时 `web/.env` 生效；都不存在时「系统配置」页保存到 `web/.env`。Web 服务相关：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WEB_PORT` | `9527` | 后端监听端口 |
| `VITE_PORT` | `5173` | Vite dev server 端口 |
| `NODE_ENV` | — | 设为 `development` 启用开发模式（代理到 Vite） |
| `JWT_SECRET` | — | JWT 签名密钥（登录鉴权用） |
| `MAIL_*` | — | 登录验证码邮件配置（`MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_ENCRYPTION` / `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME`） |

---

## 目录结构

```
web/
├── server.ts              # Express 后端入口（JWT 鉴权 + 路由注册）
├── web-launcher.ts        # Web 启动器（端口 3001，供 scripts/start_web.sh 远程拉起 / 重启 server.ts）
├── package.json           # 后端依赖
├── tsconfig.json          # 后端 TS 配置
│
├── routes/                # 后端路由模块（每个模块一个文件）
├── types/                 # 后端类型定义
├── utils/                 # 后端工具（auth / cache / logger / rbac / access-log / …）
│
├── public/                # 前端构建产物 + favicon（生产环境静态托管）
│   ├── index.html
│   ├── favicon.svg
│   └── assets/
│
└── frontend/              # 前端子项目（Vue 3 + Vite）
    ├── vite.config.ts
    ├── tailwind.config.cjs
    └── src/
        ├── app.vue            # 根组件
        ├── main.ts            # 入口
        ├── views/             # 页面组件（模板）
        ├── models/            # 页面逻辑层（BaseModel 继承体系）
        ├── stores/            # Pinia 全局状态（auth/permission/status/tab-bar/theme/…）
        ├── services/          # HTTP 请求封装（BaseService 继承体系）
        ├── components/        # 公共组件 + 按业务分组（common/layout/rbac/…）
        ├── router/            # 路由配置（带权限元数据）
        ├── types/             # 前端类型定义（locale.ts 由数据库导出）
        ├── constants/         # 常量（access-log/auth/rules/trigger/…）
        ├── data/              # 静态数据（city-data.ts 等）
        ├── styles/            # 公共样式（common / panel-layout / scrollbar / style.css）
        └── utils/             # 工具函数（format/ · handler-registry/ · rbac/ · greetings/ · …）
```

---

## 功能页面

按侧边栏分组（见 `router/index.ts`）：

### 概览
| 路径 | 页面 | 功能 |
|------|------|------|
| `/dashboard` | 仪表盘 | 守护进程状态、运行时长、最近日志、快捷操作 |

### 功能管理
| 路径 | 页面 | 功能 |
|------|------|------|
| `/config` | 系统配置 | 读写 `.env`（`web/.env` 优先），Webhook 管理 |
| `/rules` | 自定义规则 | 规则 CRUD、测试触发 |
| `/message-templates` | 消息模板 | 模板 CRUD + 实时预览 |
| `/interface-management` | 接口管理 | API 条目 CRUD、执行调试 |
| `/interface-categories` | 接口分类 | 分类管理 |
| `/greetings` | 祝福语管理 | 节日祝福语分组、Markdown 编辑 |
| `/reminder-quotes` | 提醒寄语 | 早安/午餐/下班等寄语库 |
| `/approvals` | AI 审批 | 贾维斯增删改审批单：通过执行 / 驳回（仅超级管理员可决策） |

### 系统运维
| 路径 | 页面 | 功能 |
|------|------|------|
| `/logs` | 运行日志 | 查看/清空所有脚本日志 |
| `/cache` | 缓存文件 | 查看/编辑数据库中的缓存条目（缓存键） |
| `/database` | 数据库管理 | 连接状态、库表结构与数据预览、SQL 控制台、建表脚本查看与初始化（仅超级管理员） |

### 开发工具
| 路径 | 页面 | 功能 |
|------|------|------|
| `/auto-form-playground` | AutoForm 调试 | AutoForm 组件在线调试（带模板库） |

### 权限管理（RBAC）
| 路径 | 页面 | 功能 |
|------|------|------|
| `/rbac/roles` | 角色管理 | 角色 CRUD + 权限分配 |
| `/rbac/users` | 用户管理 | 用户角色分配 |
| `/rbac/permissions` | 权限管理 | 权限元数据 |
| `/rbac/requests` | 权限申请 | 申请/审批流程 |

### 其他
| 路径 | 页面 | 功能 |
|------|------|------|
| `/unauthorized` | 403 | 无权限兜底页面 |

---

## 鉴权与权限

- **登录方式**：邮箱 + 验证码（验证码通过 `MAIL_*` 配置的邮箱发出）
- **JWT 鉴权**：除 `/api/auth/*` 外所有 `/api/*` 路径强制校验 `Authorization: Bearer <token>`
- **RBAC 权限**：`server.ts` 通过 `withPermission(router, { read, write, readPaths })` 统一挂接读写权限；路由内部按需追加细粒度校验（如 `/api/trigger` 按脚本判权、`/api/skill-map` POST 额外校验 `SKILL_MAP_EDIT`）
- **Access Log**：所有 API 请求记录用户、方法、路径、状态码、响应体；可在仪表盘查看

---

## API 接口

> 详细定义见 `routes/` 下各文件；所有接口统一返回 `{ code, data, message }`。

| 路径前缀 | 说明 | 权限（读 / 写） |
|----------|------|-----------------|
| `/api/auth/*` | 登录、登出、发送验证码、刷新 token | — |
| `/api/system` | 系统状态（仪表盘） | `DASHBOARD_VIEW` |
| `/api/config` | 读写 `.env`（`web/.env` 优先） | `CONFIG_VIEW` / `CONFIG_EDIT` |
| `/api/webhooks` | 企业微信机器人管理 | `CONFIG_VIEW` / `WEBHOOK_EDIT` |
| `/api/logs` | 日志来源列表 / 读取 / 清空（`hp_run_logs`） | `LOGS_VIEW` / `LOGS_EDIT` |
| `/api/daemon` | 守护进程 start / stop / restart | — / `DAEMON_EDIT` |
| `/api/trigger` | 手动触发脚本 + 自定义规则 | 路由内细粒度判权 |
| `/api/update-tools` | 年度更新工具列表 / 执行 | `TRIGGER_ANNUAL_UPDATE_VIEW` / `..._EDIT` |
| `/api/cache` | 缓存条目（缓存键）读取 / 保存 | `CACHE_VIEW` / `CACHE_EDIT` |
| `/api/rules` | 自定义规则 CRUD / 测试 | `RULES_VIEW` / `RULES_EDIT` |
| `/api/templates` | 消息模板 CRUD / 预览 | `TEMPLATES_VIEW` / `TEMPLATES_EDIT` |
| `/api/api-management/categories` | 接口分类 CRUD | `API_CATEGORY_VIEW` / `API_CATEGORY_EDIT` |
| `/api/api-management/items` | API 条目 CRUD / execute | `API_MANAGEMENT_VIEW` / `API_MANAGEMENT_EDIT` |
| `/api/greetings` | 祝福语管理 | `GREETINGS_VIEW` / `GREETINGS_EDIT` |
| `/api/reminder-quotes` | 提醒寄语管理 | `REMINDER_QUOTES_VIEW` / `REMINDER_QUOTES_EDIT` |
| `/api/skill-map` | 技能地图列表 / 生成 | `SKILL_MAP_VIEW`（POST 额外校验 EDIT） |
| `/api/playground` | AutoForm 调试 / 模板 | `PLAYGROUND_VIEW` / `PLAYGROUND_EDIT` |
| `/api/upload` | 文件上传 | — / `UPLOAD_EDIT` |
| `/api/launcher` | web-launcher 状态 / 控制 | `WEB_SERVICE_VIEW` / `WEB_SERVICE_EDIT` |
| `/api/web-service` | Web 服务自身状态 | `WEB_SERVICE_VIEW` / `WEB_SERVICE_EDIT` |
| `/api/rbac/roles` | 角色 CRUD + 权限绑定 | `RBAC_ROLES_VIEW` / `RBAC_ROLES_EDIT` |
| `/api/rbac/users` | 用户角色分配 | `RBAC_USERS_VIEW` / `RBAC_USERS_EDIT` |
| `/api/rbac/permissions` | 权限元数据 | `RBAC_PERMISSIONS_VIEW` / `RBAC_PERMISSIONS_EDIT` |
| `/api/permission-apply` | 权限申请 / 审批 | 路由内细粒度判权 |
| `/api/database` | 数据库状态、库表结构/数据、SQL 执行、建表脚本初始化 | `DATABASE_VIEW` / `DATABASE_EDIT`（仅超级管理员） |

静态资源：

- `/uploads/*` → `web/public/uploads/`（文件上传结果）
- `/skill-images/*` → `web/public/skill-images/`（技能地图卡片 PNG，无鉴权）

---

## 前端架构

五层分层（详见 [Web 全栈开发规范](../.codebuddy/skills/helper-web-spec/SKILL.md)）：

```
View (views/*.vue)
  ↓ 使用
Model (models/*-model.ts)       继承 BaseModel，承担页面逻辑与响应式状态
  ↓ 调用
Service (services/*-service.ts) 继承 BaseService，封装 HTTP 请求
  ↓ 请求
Backend API (/api/*)

Store (stores/*.ts)             Pinia 全局状态（auth / permission / status / 主题 / 标签页 / …）
Type (types/*.ts)               TypeScript 类型定义（interface 归此处）
```

公共约定：

- **布局组件**：`page-layout` / `card-panel` / `form-drawer` / `auto-form`
- **常量归口**：全部放 `constants/`
- **类型归口**：interface 全部放 `types/`
- **utils 拆分阈值**：单文件 > 200 行拆子目录
- **i18n**：文案统一维护在 MySQL `hp_i18n_messages`（管理页 `/i18n-messages`），静态类型由 `npm run i18n:sql` 导出到 `types/locale.ts`；前端启动读库并用 localStorage 缓存兜底
- **双向绑定**：Vue 3.4+ `defineModel` 优先，消除 `computed` 桥接

---

## 详细文档

完整的架构说明、接口详解、开发规范请参阅 [Web 全栈开发规范](../.codebuddy/skills/helper-web-spec/SKILL.md)。