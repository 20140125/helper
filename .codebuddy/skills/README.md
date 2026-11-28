# CodeBuddy Skills（本项目）

> 这些技能用于让 AI 在新增或改造项目代码时，严格遵循 helper 现有的分层架构、编码风格和组织规范，确保新代码与现有代码保持一致。

## Skills 列表

| Skill 目录 | 用途 |
|---|---|
| `helper-web-spec/` | helper 项目 `web/` 目录全栈开发规范。涵盖 Vue 3 + Vite + TailwindCSS 前端五层架构（View/Model/Store/Service/Type）+ TypeScript + Express 后端（路由参数校验、utils barrel 重导出、returnResponse + ErrorCode、JWT 全局鉴权）；约束 BaseModel/BaseService 继承、createXxxService 工厂、page-layout/card-panel/form-drawer/auto-form 组件使用、useLocaleStore().t 国际化、constants/ 常量归宿、RouteMeta 与 canEdit() 推导、代码编辑器双值模式、表单仅提交时校验、View 拆子组件与 Model 纯函数抽取、utils 子目录拆分（>200 行 / interface 迁 `types/`）、**`.cache/*.json` 四表同步清单（permission_metas / rbac / api_categories / api_items 原子写）**、**Vue 3.4+ `defineModel` 双向绑定重构（消除 computed 桥接 / 子组件 v-model 简化）**、**配套 `scripts/` 自动化工具集（generate-component 脚手架 / check-code-style 风格检查 / auto-fix 批量修复 / add-i18n 中文扫描 / check-unused 未用 import 检查）**。 |
| `helper-scripts-spec/` | helper 项目 `scripts/` 目录 Shell 脚本编写规范。涵盖文件头注释、路径初始化、配置加载顺序、按需加载原则、log_utils 日志工具（禁止 echo）、企业微信消息发送与模板、主脚本+同名子目录的模块化拆分（>300 行）、cmd_xxx 子命令路由与 auto 自我递归、守护进程多实例检测（ps -eo pid,args，禁用 pgrep -f）、PID trap 自检回收、crontab 存活保活、日志清理调度，以及 **`scripts/tools/` 信息卡片脚本规范（`card_utils.sh` 公共库 / SVG→PNG 渲染 / stdout 仅输出图片路径的契约 / 企微机器人推送）**。 |
| `info-cards/` | helper 项目 `scripts/tools/` 信息卡片推送系统的运行时知识库。描述了 30+ 个卡片脚本（天气/新闻/财经/影视综艺/科技生活）的关键字 → 脚本路由表、`card.sh` 统一入口用法、`card_utils.sh` 渲染 API、stdout PNG 路径契约、cron 定时与 AI 即时双通道模型。**触发场景**：用户要求生成/推送信息卡片、"看看今日油价"、"B 站剧集排行"、"出一张行情卡"等。与 `helper-scripts-spec/` 区分：本 skill 关注**调用哪个脚本出图**，后者关注**如何写合规的卡片脚本**（新建卡片脚本请配合 `references/07-info-cards.md`）。 |
| `conventional-commit/` | Conventional Commits 提交规范与 helper 项目 Git 提交流程。定义 `<类型>[范围]: <描述>` 格式、类型/范围/描述/正文/脚注规则、`BREAKING CHANGE:` 写法；固化「分析变更 → 归纳主题（读 `CHANGELOG` Unreleased）→ 敏感信息检查 → 确定暂存范围 → 生成信息 → `git commit -F -` → 验证、不自动 push」七步流程，并禁止 `--no-verify` / `--amend`。**触发场景**：生成提交信息、代码提交、`/create:生成规范提交信息`。 |

## 配套快捷指令

所有 skill 均配有对应快捷指令，路径见 `.codebuddy/commands/`

