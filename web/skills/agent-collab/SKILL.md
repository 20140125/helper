---
name: agent-collab
description: 贾维斯的协作机制：delegate_task 委派子 Agent 提炼长数据、request_approval 挂起副作用操作等人工审批、query_conversations 翻自己的历史会话；说「等我确认再执行 / 走审批 / 之前聊过什么」时加载
effect: action
permissions:
  - ai-approvals:edit
tools:
  - delegate_task
  - request_approval
  - query_conversations
---

# Agent 协作机制

## 什么时候用

- 要**翻很多数据但只要一句结论**（连续 3+ 次同类工具调用）→ `delegate_task`
- 用户说「**先别执行 / 等我确认 / 走审批**」→ `request_approval`
- 用户问「**我之前问过什么 / 翻一下刚才那个会话**」→ `query_conversations`

## delegate_task：子 Agent 委派

- `task`：写清楚要查什么、按什么口径整理、要什么形式的结论
- `allowed_tools`：建议只给必需的 1~2 个（如 `query_logs`）；**不传 = 全部只读工具**
- 子 Agent 在独立上下文里查完只回 300 字内结论，主上下文不被原始数据挤爆
- 单次能查完的简单查询**不要委派**，直接调对应工具

子 Agent 禁用：全部副作用工具、`web_search`、`delegate_task`（防递归）。

## request_approval：人工审批

- `tool` 必须是副作用工具之一（send_wecom_message / trigger_script / manage_service /
  create_rule / annual_update / manage_rule / update_config / manage_rbac / manage_logs /
  manage_cache / manage_webhook），`args` 与直接调用完全一致，`reason` 必填（为什么做、影响面）
- 建单后**不执行**：把 `approval_id` 与待执行内容告知用户，由超级管理员在「AI 审批」页通过或驳回
- 同工具同参数的待审单已存在时直接复用，不会重复建单
- 与严格模式的区别：严格模式是**增删改类自动建单**；本工具用于用户**主动要求**挂起任意副作用操作（含推送、跑脚本）
- 审批权在超级管理员：不要声称自己已批准，通过后由系统执行

## query_conversations：历史会话

- 只能查**当前登录用户自己**的会话，拿不到别人的
- 不传 `conversation_id` 列清单（标题 / 消息数 / 时间，`keyword` 按标题过滤，`limit` 默认 20 最大 50）；
  传入则返回该会话最近 20 条消息（单条截断 500 字符）

## 纪律

- 【不重复建单】建单失败先看是不是已有同内容的待审单，不要连发
- 【结论也要有依据】子 Agent 的结论要能对应到它调过的工具，拿不到就如实说
