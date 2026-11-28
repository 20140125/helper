# 06 Web 管理界面

**目标**：能启动、登录，并知道日常操作该去哪个页面。

---

## 1. 启动与停止

```bash
bash scripts/start_web.sh start     # 启动 Web(9527) + 启动器(3001)
bash scripts/start_web.sh stop      # 停止
bash scripts/start_web.sh restart   # 重启
bash scripts/start_web.sh status    # 查看状态
```

打开 `http://<机器IP>:9527`。

**没有 `scripts/` 目录时**（Web 独立部署）：

```bash
cd web && npm start                   # 9527
cd web && npx ts-node web-launcher.ts # 3001（可选，用于页面内重启主服务）
```

此时页面上的启停/重启会自动降级为直接拉起/结束 `server.ts` 进程，PID 与日志落在 `web/.runtime/`。

---

## 2. 登录

- 方式：**邮箱验证码**（SMTP 配置来自 `web/.env` 的 `MAIL_*`）
- 与 `MAIL_USERNAME` 一致的邮箱 = 管理员（拥有全部权限）
- 其他邮箱登录后按 RBAC 角色获得权限，见 [08](08-权限与用户.md)

收不到验证码时先验证 SMTP：

```bash
bash -c 'source scripts/weather_config.sh 2>/dev/null; echo "MAIL_HOST=${MAIL_HOST:-未配置}"; echo "MAIL_USERNAME=${MAIL_USERNAME:-未配置}"'
```

---

## 3. 页面导览

| 分组 | 菜单 | 路径 | 干什么 |
|------|------|------|--------|
| 概览 | 仪表盘 | `/dashboard` | 守护进程状态与快速控制、系统概览 |
| 功能管理 | 系统配置 | `/config` | 编辑 `.env` 配置项 + 管理企业微信机器人 |
| 功能管理 | 自定义规则 | `/rules` | 规则 CRUD、测试触发 |
| 功能管理 | 消息模板 | `/message-templates` | 提醒类模板 CRUD + 实时预览（技能类无模板正文，推送排版由脚本侧 LLM 负责） |
| 功能管理 | API 管理 / 接口分类 | `/interface-management`、`/interface-categories` | 内部接口登记与调试执行 |
| 功能管理 | 节日祝福语 / 提醒寄语 | `/greetings`、`/reminder-quotes` | 文案库维护 |
| 功能管理 | AI 审批 | `/approvals` | 贾维斯增删改审批单：通过并执行 / 驳回（仅超级管理员可决策） |
| 系统运维 | 运行日志 | `/logs` | 各脚本日志查看与清空 |
| 系统运维 | 缓存文件 | `/cache` | 查看/编辑 `.cache` 下的 JSON |
| 权限管理 | 角色/用户/权限/申请 | `/rbac/*` | RBAC 与权限审批 |
| 开发工具 | 表单配置器 | `/auto-form-playground` | auto-form 表单调试 |

---

## 4. 三个高频操作

**改配置**：系统配置 → 修改 → 保存。普通 env 项写入 `web/.env`，改 `MAIL_*`/`JWT_SECRET` 后**需重启 Web**；`AI_INSPECTOR_*` 例外，调度器每分钟重读一次，保存后 60 秒内自动生效。模型配置存 `.cache/ai-model-configs.json`，保存后立即生效、无需重启。

系统配置的分区：企业微信机器人、天气 / 老黄历 / 星座、项目配置、生日提醒、卡片全局配置、**邮件配置**（`MAIL_*`，登录验证码）、**AI 模型与记忆**（模型配置组 / `AI_MEMORY_ENABLED` / `AI_COST_PRICING_JSON`）、**定时巡检与外部消息入口**（`AI_INSPECTOR_*` / `AI_CHAT_WEBHOOK_*`）。

**跑一次脚本**：命令行 `bash scripts/xxx.sh`，或直接让贾维斯执行（它会调 `trigger_script`）。原「手动触发」页已下线。

**看日志**：运行日志 → 选日志来源 → 查看/清空（数据来自 `hp_run_logs`）。等价于 `view_logs.sh`；也可以让贾维斯查（`query_logs`）或清（`manage_logs`，默认会先建审批单）。

**批贾维斯的增删改**：AI 审批 → 待审批 → 通过并执行 / 驳回。详见 [14 贾维斯使用说明](14-贾维斯使用说明.md) 第 9.5 节。

---

## 5. 开发模式（改前端时）

```bash
# 终端 1：后端（开发模式会把前端请求代理到 Vite）
cd web && NODE_ENV=development npx ts-node server.ts

# 终端 2：前端
cd web/frontend && npm run dev     # 5173
```

访问 `http://localhost:5173`，改代码即时热更新。

前端构建产物输出到 `web/public/`：

```bash
cd web/frontend && npm run build
```

---

## 6. 页面背后的进程

| 端口 | 进程 | 作用 |
|------|------|------|
| 9527 | `server.ts` | 主服务：API + 静态资源 |
| 3001 | `web-launcher.ts` | 启动器：主服务挂了时可从页面把它拉起/重启 |

页面上的「重启」走 3001，避免在 9527 进程内自杀导致响应中断。

---

## 7. 检查清单

- [ ] 能启动 Web 并打开页面
- [ ] 能用邮箱验证码登录
- [ ] 知道改配置、看日志、批审批单分别在哪个页面
- [ ] 知道改前端要跑 Vite（5173）+ 后端开发模式

---

**返回**: [教程索引](00-导航.md) | [上一篇：提醒脚本体系](05-提醒脚本体系.md) | [下一篇：数据与规则](07-数据与规则.md)
