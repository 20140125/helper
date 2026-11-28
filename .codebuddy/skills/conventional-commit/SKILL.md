---
name: conventional-commit
version: 1.0.0
description: "helper 项目的 Conventional Commits 提交规范与 Git 提交流程。Use this skill whenever the user asks to generate a commit message, write a conventional commit, or commit code changes. 凡涉及 git commit、提交代码、生成提交信息、规范提交信息、commit message、feat/fix 类型判断——都先使用本技能。触发关键词：生成提交信息、规范提交、commit message、git commit、代码提交、提交代码、conventional commits、提交类型、breaking change。"
---

# Conventional Commits 提交规范

你是 helper 项目的 **Git 提交规范专家**。生成提交信息或执行提交前，必须先按本规范分析变更。

## 1. 提交信息格式

```
<类型>[可选范围]: <描述>

[可选正文]

[可选脚注]
```

### 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响代码运行的变动） |
| `refactor` | 重构（既不是新功能也不是修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建过程或辅助工具变更 |

类型一律用单数，按改动性质选一个；不确定时优先按 CHANGELOG 里该批改动的归类判断。

### 范围

一个提交只用一个 scope。优先沿用项目已有范围：`web`、`sql`、`scripts`、`docs`、`db`。跨多模块的架构级改动可用 `db` 等能概括主题的单一范围。

### 描述

- 用中文，与项目历史提交保持一致
- 简洁明了，首字母小写，结尾不加句号
- 不写模糊描述（禁止 `fix: 修了一些 bug`）
- 不包含密钥、口令、令牌等敏感信息

### 正文

- 用 `- ` 列 3~5 条要点，说明"改了什么"，不要复述 diff 数字
- 每条结尾不加句号

### 脚注

- 存在破坏性变更时，必须以 `BREAKING CHANGE: ` 开头单独成段说明影响与迁移方式
- 关联 issue 用 `Closes #123`

## 2. 执行流程

对应快捷指令 `/create:生成规范提交信息`。

| 步骤 | 操作 |
|------|------|
| 1 | `git status --short`、`git diff --stat`、`git diff --cached --stat` 分析变更范围与主题 |
| 2 | 改动较多时读 `CHANGELOG` 的 Unreleased 段，据此归纳本批改动主题 |
| 3 | 安全检查：扫描待提交文本是否含真实密钥 / 私钥 / 口令；确认 `web/.env` 未被跟踪；`*.example` 里的占位符可以提交 |
| 4 | 确定暂存范围：默认提交全部工作区改动（`git add -A`）；用户指定文件时只暂存指定文件 |
| 5 | 按第 1 节格式生成提交信息，类型由改动性质决定，必要时加 `BREAKING CHANGE:` 脚注 |
| 6 | 用 `git commit -F -` 从 stdin 读入多行信息执行提交；禁止 `--no-verify`、禁止 `--amend` |
| 7 | `git log -1 --format='%B'` 与 `git status --short` 验证结果 |

**不要自动 push**，除非用户明确要求。

## 3. 示例

```
feat(db): 全量业务数据落库并新增数据库管理页

- 新增数据库管理页与 /api/database/* 接口，引入 mysql2 连接池与 DB_* 配置
- 新增 hp_run_logs、hp_playground_templates 表，运行日志、表单模板改为数据库唯一真源
- 登录与 RBAC 全量接入数据库，数据库不可用时降级读取 .cache 快照
- 同步更新建表 SQL、权限元数据、脚本日志链路、文档及前端构建产物

BREAKING CHANGE: 运行日志不再写入日志文件，部署需配置 MySQL 并执行 helper_database.sql
```

```
fix(sql): 去掉缓存键类别前缀并补齐未同步缓存数据

- hp_cache_res_* 的 asset_key 不再重复表名里的类别前缀
- 按 .cache 最新内容补齐缺失记录并刷新过期响应
```
