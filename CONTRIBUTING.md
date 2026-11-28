# 贡献指南

感谢你对 **Helper 智能提醒系统** 的关注！本文档说明如何参与项目贡献。

---

## 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境搭建](#开发环境搭建)
- [分支规范](#分支规范)
- [提交规范](#提交规范)
- [代码规范](#代码规范)
- [提交 Merge Request](#提交-merge-request)
- [报告问题](#报告问题)

---

## 行为准则

- 尊重所有贡献者，保持友善和专业的沟通
- 聚焦于技术问题，避免无关争论
- 接受建设性的批评，共同提升代码质量

---

## 如何贡献

你可以通过以下方式参与贡献：

| 方式 | 说明 |
|------|------|
| 🐛 报告 Bug | 提交 Issue 描述问题复现步骤 |
| 💡 功能建议 | 提交 Issue 描述新功能需求 |
| 📝 改进文档 | 修正文档错误或补充说明 |
| 🔧 提交代码 | Fork 后提交 Merge Request |

---

## 开发环境搭建

### 环境要求

| 依赖 | 版本 | 用途 |
|------|------|------|
| Bash | ≥ 4.0 | 脚本运行环境 |
| Python 3 | ≥ 3.6 | 农历转换、JSON 处理 |
| Node.js | ≥ 16 | Web 管理界面 |
| curl | 任意 | API 请求 |

### 初始化步骤

```bash
# 1. 克隆仓库
git clone <repository-url>
cd helper

# 2. 配置环境变量
cp web/.env.example web/.env
# 编辑 .env，填写企业微信 Webhook 和 API Keys

# 3. 安装 Python 依赖
pip3 install lunar-python

# 4. 安装 Web 依赖
cd web && npm install
cd frontend && npm install

# 5. 验证脚本语法
find scripts/ -name "*.sh" | xargs -I{} bash -n {}
echo "✅ 语法检查通过"
```

### 启动开发环境

```bash
# 启动守护进程
bash scripts/daemon.sh start

# 启动 Web 管理界面（开发模式）
cd web && npx ts-node server.ts
# 访问 http://localhost:9527
```

---

## 分支规范

| 分支类型 | 命名格式 | 说明 |
|----------|----------|------|
| 主分支 | `master` | 稳定版本，受保护 |
| 功能分支 | `feature/xxx` | 新功能开发 |
| 修复分支 | `fix/xxx` | Bug 修复 |
| 文档分支 | `docs/xxx` | 文档更新 |
| 重构分支 | `refactor/xxx` | 代码重构 |

```bash
# 创建功能分支示例
git checkout -b feature/add-weather-forecast
```

---

## 提交规范

提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范：

```
<类型>(<范围>): <简短描述>

[可选正文]

[可选脚注]
```

### 提交类型

| 类型 | 说明 |
|------|------|
| `feat` | 新增功能 |
| `fix` | 修复 Bug |
| `docs` | 文档更新 |
| `style` | 代码格式调整（不影响逻辑） |
| `refactor` | 代码重构（不新增功能，不修复 Bug） |
| `perf` | 性能优化 |
| `test` | 添加或修改测试 |
| `chore` | 构建流程或辅助工具变更 |

### 提交示例

```bash
# 新增功能
git commit -m "feat(scripts): 新增自定义规则执行脚本 custom_rules.sh"

# 修复 Bug
git commit -m "fix(workday): 修复 exit 0 与 log_info 拼在同一行的语法错误"

# 文档更新
git commit -m "docs: 在知识库管理页更新文档并重新导出种子 SQL"

# 重构
git commit -m "refactor(daemon): 整合 start_daemon.sh 和 stop_daemon.sh 为 daemon.sh"
```

---

## 代码规范

### Shell 脚本规范

所有 Shell 脚本必须遵循以下规范（详见 [.codebuddy/skills/helper-scripts-spec/SKILL.md](/.codebuddy/skills/helper-scripts-spec/SKILL.md)）：

```bash
#!/bin/bash
# 脚本说明注释

# 1. 加载路径配置（必须第一个加载）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_config.sh"

# 2. 定义日志文件（必须在 source log_utils.sh 之前）
LOG_FILE="${LOG_DIR}/your_script.log"

# 3. 加载日志工具
source "${SCRIPT_DIR}/log_utils.sh"

# 4. 业务逻辑
main() {
    log_info "脚本开始执行"
    # ...
    log_info "脚本执行完成"
}

main "$@"
```

**关键规范：**

- ✅ 所有脚本必须通过 `bash -n` 语法检查
- ✅ 使用 `log_info`、`log_warning`、`log_error` 统一日志输出
- ✅ 使用 `${PROJECT_DIR}` 替代硬编码路径
- ✅ 函数名使用 `snake_case`
- ✅ 变量名使用大写 + 下划线（全局变量）或小写（局部变量）
- ❌ 禁止硬编码 `/data/workspace` 等绝对路径
- ❌ 禁止在脚本中直接 `echo` 输出，统一使用日志函数

### Web 代码规范

Web 部分（TypeScript/Vue）遵循项目内置 ESLint 规范（详见 [.codebuddy/skills/helper-web-spec/SKILL.md](/.codebuddy/skills/helper-web-spec/SKILL.md)）：

```bash
# 运行代码检查
cd web && npm run lint

# 自动修复
cd web && npm run lint:fix
```

---

## 提交 Merge Request

1. **Fork 仓库**并创建功能分支
2. **编写代码**，确保遵循代码规范
3. **本地验证**：
   ```bash
   # 验证脚本语法
   find scripts/ -name "*.sh" | xargs -I{} bash -n {}

   # 验证 Web 代码
   cd web && npm run lint
   ```
4. **提交代码**，遵循提交规范
5. **创建 MR**，填写以下信息：
   - **标题**：简洁描述变更内容
   - **描述**：说明变更原因、实现方式、测试方法
   - **关联 Issue**：如有相关 Issue，使用 `Closes #xxx` 关联
6. **等待 Review**：根据反馈修改代码

### MR 检查清单

提交 MR 前，请确认以下事项：

- [ ] 代码通过 `bash -n` 语法检查
- [ ] 新增脚本已加载 `project_config.sh` 和 `log_utils.sh`
- [ ] 无硬编码路径，使用 `${PROJECT_DIR}` 变量
- [ ] 相关文档已同步更新（知识库管理页中的文档、`scripts/README.md`、`web/README.md`、根目录 `README.md`）
- [ ] 在知识库管理页 / 贾维斯改过文档后已重跑 `npm run knowledge:sql`（从数据库导出种子）；新增 i18n 文案后已重跑 `npm run i18n:sql`
- [ ] 新增页面已同步 `hp_nav_items`（或经 `/navigation-admin` 维护），避免侧边栏菜单与贾维斯入口导航缺项
- [ ] 改过前端源码（含 CSS）后已 `cd web/frontend && npm run build`（9527 生产模式托管构建产物）
- [ ] `CHANGELOG` 已记录本次变更
- [ ] 提交信息符合 Conventional Commits 规范

---

## 报告问题

提交 Issue 时，请提供以下信息：

### Bug 报告模板

```
**问题描述**
简洁描述遇到的问题。

**复现步骤**
1. 执行 `bash scripts/xxx.sh`
2. 查看日志 `tail -50 logs/xxx.log`
3. 出现错误 `...`

**期望行为**
描述期望的正确行为。

**实际行为**
描述实际发生的错误行为。

**环境信息**
- 操作系统：Ubuntu 20.04
- Bash 版本：5.0.17
- Python 版本：3.8.10
- Node.js 版本：18.x

**日志输出**
粘贴相关日志内容。
```

### 功能建议模板

```
**功能描述**
简洁描述希望新增的功能。

**使用场景**
描述该功能的使用场景和价值。

**实现思路**（可选）
如有实现思路，可以简要描述。
```

---

## 联系维护者

如有疑问，可通过以下方式联系：

- 提交 Issue
- 企业微信联系项目维护者

---

感谢你的贡献！🎉
