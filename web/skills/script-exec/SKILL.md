---
name: script-exec
description: 手动执行系统脚本：trigger_script 跑提醒脚本、list_scripts 查清单、annual_update 跨年维护子工具；用户说「跑一下某脚本 / 手动触发 / 年度更新」时加载
effect: action
permissions:
  - trigger:view
  - trigger:annual-update:view
tools:
  - list_scripts
  - trigger_script
  - annual_update
---

# 手动执行脚本

## 什么时候用

用户明确要求**执行**某项系统任务："生日提醒跑一下""手动触发每周总结""做一下年度更新"。
只想看有哪些脚本 → `list_scripts`（清单模式，无副作用）。

## 三个工具的分界

| 场景 | 工具 |
|------|------|
| 天气 / 热搜 / 行情 / 黄历等**卡片与实时数据** | `card_skill`（能传参、能拿数值），不走这里 |
| 提醒类脚本（生日 / 周报 / 节日 / 自定义规则…） | `trigger_script` |
| 跨年维护（节假日数据 / 月份配置 / 更新通知） | `annual_update` |
| 不知道有哪些脚本可跑 | `list_scripts` 不传 `keyword` 看全量 |

## trigger_script

- `script_name`：**不含路径**的文件名（如 `birthday_reminder.sh`），只允许字母数字下划线；
  系统会在 `scripts/` 与 `scripts/tools/` 两个位置查找
- `user_consent_phrase`：从用户原话摘录能体现执行意图的短语，禁止编造
- 返回 stdout / stderr 尾部 2000 字符：如实转述，报错别包装成成功

## annual_update（跨年专用，平时不调用）

不传 `tool` 只返回清单。执行时：

| tool | 说明 |
|------|------|
| `annual_update` | 主脚本，无参数 |
| `get_holidays` | 拉取节假日数据 |
| `generate_holiday_config` | `args[0]` = 特别假日期，多个日期用英文逗号连成**一个字符串** |
| `update_month_config` | 更新月份配置，无参数 |
| `send_update_notification` | `args = [节假日状态, 特别假状态, 月份状态]`，状态只能填 `✅ 成功` 或 `❌ 失败` |

年份由系统自动取当前年，**不要传**。

## 纪律

- 【按意图判断】用户表达执行意图即可调用（不限定"执行 / 触发"等特定动词）；纯查询 / 查看意图不要调
- 【annual_update 属增删改】严格模式下会自动建审批单：只回 `approval_id`，说明需超级管理员通过，不要重试
- 【反馈】执行完报脚本名与关键输出摘要；失败贴报错关键行
