---
name: project-overview
description: helper 项目全貌速览——三块拼装、目录职责、四个进程与端口、关键文件、一条消息的发送链路、改动该去哪；问「这个项目怎么跑起来的 / 由哪几块组成 / 改 X 要动哪里」时加载
effect: read
tools:
  - query_project_map
  - read_project_file
  - query_knowledge
---

# helper 项目全貌

## 一句话架构

```
scripts/   提醒引擎（Bash）—— 定时把消息推到企业微信
web/       管理界面（Express + Vue 3）—— 让人不用改代码也能配置
MySQL      数据层（缓存键 / hp_* 表）—— 两边共享的唯一真源，运行时零文件依赖
```

关系：**脚本读配置与缓存 → 渲染消息 → 调 Webhook 推送**；
**Web 写缓存与配置 → 反过来影响脚本行为**。两边不直接通信，只通过 MySQL（缓存条目与 `hp_*` 表）与 `web/.env` 耦合，运行时不再读写 `.cache/` 文件。

技术栈：Bash 4+ / Python 3（仅农历互转）· MySQL / MariaDB（缓存与配置唯一真源）· Node.js + Express + TypeScript · Vue 3 + Vite + TDesign · 卡片走 SVG → rsvg-convert → PNG。

## 顶层目录

| 目录 | 职责 | 备注 |
|------|------|------|
| `scripts/` | 提醒业务脚本（120+ 个 `.sh`） | 子模块按功能分目录：`reminder/`、`workday_manager/`、`birthday_reminder/`、`festival_greetings/`、`custom_rules/`、`daily_data_manager/`、`template_utils/`、`view_logs/`、`update-tools/` |
| `scripts/tools/` | 信息卡片脚本（47 个，输出 PNG） | 天气 / 热搜 / 行情 / 黄历 / 星座…一个脚本一类数据 |
| `web/server.ts` | 后端入口，监听 **9527** | |
| `web/web-launcher.ts` | 启动器，监听 **3001** | 用于远程拉起主服务 |
| `web/routes/` + `web/utils/` + `web/types/` | 后端路由 / 工具 / 类型 | `routes/utils.ts` 是 barrel，新增 utils 要在这里导出 |
| `web/frontend/` | Vue 3 前端源码 | `src/router/index.ts` 管路由与菜单 |
| MySQL（`hp_*` / 缓存条目） | 运行时数据唯一真源：规则、模板、祝福语、寄语、RBAC、节假日、每日数据 | Web 经 `web/utils/database/cache-store.ts`、shell 经 `scripts/cache_db.sh` 按缓存键读写；运行时零文件依赖 |
| `docs/` | 25 篇教程 | 见末尾导航表 |
| `sql/` | 建表 SQL 与缓存种子（`sql/cache_data/*.sql`） | 全库初始化入口 `helper_database.sql`，缓存数据以数据库为唯一真源 |

## 四个进程

| 进程 | 启动 | 端口 | PID / 日志 |
|------|------|------|-----------|
| 主提醒守护进程 | `scripts/daemon.sh start` | — | `scripts/reminder_daemon.pid` / `hp_run_logs(reminder_daemon)` |
| 年度调度器 | 同上（一起拉起） | — | `scripts/annual_scheduler.pid` / `hp_run_logs(annual_scheduler)` |
| Web 服务 | `scripts/start_web.sh start` | 9527 | `web/.runtime/web.pid` / `hp_run_logs(web_server)` |
| Web 启动器 | 同上（一起拉起） | 3001 | `web/.runtime/launcher.pid` / `hp_run_logs(web_launcher)` |

老部署的 PID 文件仍在 `scripts/` 下，读取时会自动兼容；日志统一入 `hp_run_logs`，不再产生日志文件。
另有 `watchdog.sh` 看门狗（`scripts/watchdog.pid`）。

## 必须认识的几个文件

| 文件 | 作用 |
|------|------|
| `scripts/project_config.sh` | 推导 `PROJECT_DIR` / `ENV_FILE`（`CACHE_DIR` 仅迁移/兼容用途），写新脚本第一行就 source 它 |
| `scripts/cache_db.sh` | 按缓存键读写数据库缓存条目，脚本侧统一入口 |
| `scripts/weather_config.sh` | 加载 `.env`、时区、Webhook 与 `send_wecom_message` |
| `scripts/log_utils.sh` | 统一日志（`log_info` 等，写入 `hp_run_logs` + stderr） |
| `scripts/holiday_config.sh` | 节假日 / 调休判断（`is_holiday` 等） |
| `scripts/schedule_config.sh` | 时间表配置（谁在什么时候被调起） |
| `web/routes/utils.ts` | 后端 barrel，统一对外导出 |

## 一条消息是怎么发出去的

```
reminder_daemon.sh（按 schedule_config 到点）
  → 各提醒脚本（workday_manager / birthday_reminder / festival_greetings / custom_rules…）
  → 读 web/.env + 数据库缓存条目
  → template_utils.sh 渲染消息
  → 遍历 Webhook 列表推送到企微群
```

数据缓存是**凌晨预获取**（`daily_data_manager.sh` 写入数据库缓存条目），早高峰直接读库（0.1s vs 2-5s）。

## 关键约定（改之前先确认）

- **配置唯一真相源是 `web/.env`**，脚本与 Web 共用；改 SMTP / JWT / LLM 要重启 Web，改天气 Key / 生日列表不用
- **数据库是唯一真源**，业务数据按缓存键存放在 MySQL，`.cache/` 缓存文件已删除；Web 与 shell 分别经 `cache-store.ts` / `cache_db.sh` 读写
- 卡片渲染链路：脚本取数 → SVG → `rsvg-convert` → PNG（缺 `rsvg-convert` 会出不了图）
- 脚本里发消息统一走 `send_wecom_message`，不要各写各的 curl

## 想深入看哪篇

| 你想知道 | 看 docs/ |
|---------|---------|
| 系统由哪几块拼起来 | `02-系统概述与项目结构.md` |
| 配置怎么配、哪个要重启 | `03-配置初始化.md` |
| 谁在什么时候被调起 | `05-提醒脚本体系.md` |
| 数据、规则、模板怎么管 | `07-数据与规则.md` |
| 加人 / 配角色 / 审权限 | `08-权限与用户.md` |
| 加脚本 / 加页面的正确姿势 | `12-扩展开发.md` |
| 提醒为什么没发 | `11-日志与排障.md` |
| 上线、保活、备份 | `13-部署与运维.md` |
| 贾维斯自身（工具 / 技能 / 提示词） | `14-贾维斯使用说明.md` |

> 细节别靠记忆：用 `query_knowledge` 检索 `docs/` 拿原文；
> 想知道某个功能在哪个文件 / 目录，用 `query_project_map`。
