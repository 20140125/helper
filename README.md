# Helper — 智能提醒系统

基于企业微信机器人的自动化提醒系统，提供工作日提醒、节假日祝福、生日提醒、自定义规则等功能，附带 Web 管理界面。

---

## 新手从这里开始

完整「从 0 到 1」教程见 [docs/00-导航.md](docs/00-导航.md)：装环境 → 跑通第一条提醒 → 用熟 Web 界面 → 自己加功能 → 上线运维（共 14 章）。

> 第 09 章「AI Agent 开发」面向想自己写 Agent 应用的开发者，展开为 11 篇（09-1 ~ 09-11）；
> 只想使用贾维斯看 [docs/14-贾维斯使用说明.md](docs/14-贾维斯使用说明.md)。

---

## 快速开始

### 1. 配置环境变量

```bash
cp web/.env.example web/.env
# 编辑 .env，填写 API Keys（Webhook 已迁移到 Web 界面管理）
```

### 2. 启动守护进程

```bash
bash scripts/daemon.sh start
```

### 3. 启动 Web 管理界面

```bash
bash scripts/start_web.sh start     # 启动（Web 9527 + 启动器 3001）
bash scripts/start_web.sh stop      # 停止
bash scripts/start_web.sh restart   # 重启
bash scripts/start_web.sh status    # 查看状态
# 访问 http://localhost:9527
```

> 开发模式：`cd web && npm install && npx ts-node server.ts`

---

## 功能模块

### 核心调度

| 脚本 | 功能 |
|------|------|
| `daemon.sh` | 守护进程管理（start/stop/restart/status） |
| `reminder_daemon.sh` | 主守护进程，定时调度所有提醒 |
| `annual_scheduler.sh` | 年度更新调度 + 日志定期清理 |

### 提醒功能（子模块化）

| 主入口 | 功能 |
|--------|------|
| `workday_manager.sh` | 工作日管理：调休提醒、早安/午餐/下班提醒 |
| `festival_greetings.sh` | 节日祝福：节假日、农历节日、二十四节气、特殊节日 |
| `daily_data_manager.sh` | 每日数据：凌晨预获取、缓存读取、早安数据组装 |
| `custom_rules.sh` | 自定义规则：触发判断、模板渲染、消息发送 |
| `view_logs.sh` | 日志管理：查看/筛选/统计/清理 |

### 独立提醒

| 脚本 | 功能 |
|------|------|
| `birthday_reminder.sh` | 生日提醒（阳历 + 农历） |
| `weekly_summary.sh` | 每周五工作总结报告 |
| `monthly_reminder.sh` | 月初问候 + 月底总结 |
| `holiday_countdown.sh` | 假期倒计时/进度/余额提醒 |
| `history_today.sh` | 历史上的今天（维基百科 API） |
| `inspirational_quotes.sh` | 每日励志语录 |

### 数据获取

| 脚本 | 功能 |
|------|------|
| `fetch_real_weather.sh` | 天气 API（聚合数据） |
| `fetch_real_almanac.sh` | 黄历 API（聚合数据） |
| `fetch_real_horoscope.sh` | 星座运势 API（聚合数据） |
| `get_zodiac_sign.sh` | 根据出生日期判断星座 |

### 公共工具

| 脚本 | 功能 |
|------|------|
| `project_config.sh` | 项目路径自动配置 |
| `weather_config.sh` | 统一配置（.env 加载、Webhook） |
| `holiday_config.sh` | 节假日/调休日数据与判断 |
| `log_utils.sh` / `log_db.sh` | 统一日志工具（JSON/TEXT，全量写入 `hp_run_logs`） |
| `template_utils.sh` | 消息模板渲染 |
| `greetings_loader.sh` | 祝福语加载器 |
| `date_utils.py` | 日期管理（农历互转、工作日计算） |

### 年度更新

| 脚本 | 功能 |
|------|------|
| `annual_update.sh` | 年度数据更新（节假日/节气/农历，6 步流程） |
| `update-tools/` | 更新子工具：节假日获取、配置生成、月度更新、通知 |

---

## Web 管理界面

基于 Express + Vue 3 的可视化管理界面。详见 [web/README.md](web/README.md)。

| 页面 | 功能 |
|------|------|
| 仪表盘 | 守护进程状态监控、快速控制 |
| 系统配置 | 编辑 `.env` 配置项 |
| 运行日志 | 查看/清空 `hp_run_logs` 里的各来源日志 |
| 自定义规则 | 规则 CRUD 与测试 |
| AI 审批 | 贾维斯增删改审批单：通过执行 / 驳回（仅超级管理员） |
| 缓存文件 | 查看/编辑数据库中的缓存条目（缓存键） |
| 数据库管理 | MySQL 连接状态、库表结构与数据预览、SQL 执行、建表脚本初始化（仅超级管理员） |

---

## 环境要求

| 依赖 | 版本 | 用途 |
|------|------|------|
| Bash | ≥ 4.0 | 脚本运行 |
| Python 3 | ≥ 3.6 | 农历转换、JSON 处理 |
| Node.js | ≥ 16 | Web 管理界面 |
| curl | 任意 | API 请求 |

---

## 配置说明

主要配置项在 `web/.env` 中，完整说明见 [docs/03-配置初始化.md](docs/03-配置初始化.md)。

> 脚本与 Web 服务的加载顺序一致：`web/.env` 优先，它不存在时才回退 `scripts/.env`。只维护一份即可。

| 变量 | 说明 |
|------|------|
| `JUHE_WEATHER_KEY` | 聚合数据天气 API Key |
| `JUHE_ALMANAC_KEY` | 聚合数据黄历 API Key |
| `JUHE_HOROSCOPE_KEY` | 聚合数据星座 API Key |
| `WEATHER_CITY_NAME` | 天气查询城市（默认：深圳） |
| `BIRTHDAY_LIST` | 生日配置列表 |
| `WEB_PORT` | Web 界面端口（默认：9527） |

> **Webhook 配置**已迁移到 Web 管理界面，启动后在「系统配置」页面添加机器人即可。

---

## 目录结构

```
helper/
├── README.md                  # 本文档
├── CHANGELOG                  # 变更日志
├── CONTRIBUTING.md            # 贡献指南
├── scripts/                   # Shell 脚本（核心业务逻辑）
│   ├── daemon.sh              # 守护进程管理
│   ├── reminder_daemon.sh     # 主守护进程
│   ├── workday_manager.sh     # 工作日管理（含子模块）
│   ├── festival_greetings.sh  # 节日祝福（含子模块）
│   ├── daily_data_manager.sh  # 每日数据（含子模块）
│   ├── custom_rules.sh        # 自定义规则（含子模块）
│   ├── view_logs.sh           # 日志管理（查库 / 清理，含子模块）
│   ├── ...                    # 独立提醒 & 工具脚本
│   └── start_web.sh           # Web 服务管理
├── web/                       # Web 管理界面（详见 web/README.md）
├── helper_database.sql        # 数据库初始化入口（SOURCE 聚合器）
├── sql/                       # 模块化建表 SQL（按业务模块分目录，含缓存种子）
├── docs/                      # 文档（14 章教程 + 1 篇使用说明，共 25 个文件）
└── knowledge/                 # 开发规范摘要（供贾维斯检索）
```

> 运行时缓存、规则、RBAC 等数据全部以 MySQL 为唯一真源，全新安装由 `sql/cache_data/*.sql` 种子初始化，项目不再有 `.cache/` 缓存文件。

> **开发规范**：见 `.codebuddy/skills/` 下的 [Shell 脚本规范](/.codebuddy/skills/helper-scripts-spec/SKILL.md) 和 [全栈开发规范](/.codebuddy/skills/helper-web-spec/SKILL.md)。