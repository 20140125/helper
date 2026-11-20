# Agent 循环、规划与反思

**目标**：让 Agent 能连续多步完成任务，并且**不会跑飞**——这是 Agent 开发里最容易失控的部分。

---

## 1. 循环的本质：把"模型输出"当成"下一步指令"

传统开发：你写 `if/else` 决定下一步。
Agent 开发：模型返回 `tool_calls` 就执行、返回纯文本就结束。**这个判断就是循环的全部**。

```ts
// 本项目真实骨架（web/utils/ai-chat/agent-loop.ts 精简）
for (let iteration = 0; iteration < MAX_AGENT_LOOP_ITERATIONS; iteration += 1) {
  if (signal?.aborted) { yield { type: 'error', message: '会话已被终止' }; return; }

  const streamResult = yield* streamOneIteration(conversationMessages, toolDefs, signal, model);
  if (!streamResult) return;                       // abort 或上游错误

  yield { type: 'iteration_end', iteration, finish_reason: streamResult.finishReason || 'stop' };
  if (streamResult.usage) { /* 累加 token */ }

  const toolCalls = buildToolCalls(streamResult.partialToolCalls);
  conversationMessages.push({ role: 'assistant', content: streamResult.assistantContent, tool_calls: toolCalls });

  if (toolCalls.length === 0 || !enableTools) {
    // 模型给了最终回答 → 收尾（可能先反思，见第 3 节）
    if (!needRetry) break;
    continue;
  }

  usedTools = true;
  for (const tc of toolCalls) {
    const content = yield* executeToolCall(tc, context);
    conversationMessages.push({ role: 'tool', content, tool_call_id: tc.id, name: tc.function.name });
    if (plan) { /* 推进计划步骤状态 */ }
  }
}
```

三个必须有的东西：

| 元素 | 值 | 为什么 |
|------|-----|--------|
| 迭代上限 | `MAX_AGENT_LOOP_ITERATIONS = 8` | 模型反复调工具时不设上限就是烧钱 + 死循环 |
| 工具超时 | `TOOL_CALL_TIMEOUT_MS = 30_000` | 单个脚本卡住会拖死整轮 |
| 中断信号 | `AbortSignal` | 每次迭代开头检查，用户停止要立刻生效 |

---

## 2. 为什么"8 次"够用，以及什么时候该停

观察真实任务：查状态（1 次）→ 查日志（1 次）→ 分析（0 次工具）→ 回答。绝大多数任务 2–3 次迭代就够。

超过 8 次通常是**模型卡住了**（反复调同一个工具、参数总填错）。这时候与其让它继续，不如：

- 把已执行结果回灌，让它基于现有信息作答（本项目：循环结束后模型会自然输出最后一次回答）
- 前端展示"已达上限"，用户可自行追问

**判断"该停"的信号**：模型本轮没有 `tool_calls`（`finish_reason: 'stop'`）——这就是终止条件。

---

## 3. 规划（Planning）：先想再做，但要按需开启

```ts
const planningEnabled = (input.enablePlanning ?? false) && enableTools && tools.length > 0;
if (planningEnabled) {
  plan = await generatePlan(userGoal, toolNames, model, signal);
  if (plan) {
    yield { type: 'plan_start', goal: plan.goal, steps: plan.steps.map(...) };
    conversationMessages.push(formatPlanAsMessage(plan));   // 计划也进上下文
  }
}
```

设计要点：

- **只在「开了工具 + 工具非空」时规划**。纯闲聊也规划，就是白白多一次 LLM 调用
- 步骤上限 `MAX_PLAN_STEPS = 6`，超出让模型自己合并
- **默认关闭**（`enable_planning` 默认 false）——多数问题直接跑比先规划更快更省
- 计划要能推进和收尾：每执行完一个工具就 `advancePlanStep`，循环结束时把没跑到的步骤标记 `skipped`（否则前端一直显示"准备中"）

---

## 4. 反思（Reflection）：给 Agent 一个质检员

模型给出最终回答后、返回用户前，让另一个（或同一个）模型判断：答全了吗？

```ts
const worthReflecting = usedTools || Boolean(plan && plan.steps.length > 0);
if (planningEnabled && worthReflecting && reflectionCount < MAX_REFLECTION_ROUNDS
    && iteration + 1 < MAX_AGENT_LOOP_ITERATIONS && !signal?.aborted) {
  const reflection = await runReflection(userGoal, lastAssistantText(...), toolNames, reflectionCount, model, signal);
  if (reflection) {
    yield { type: 'reflection', round: reflection.round, complete: reflection.complete,
            missing: reflection.missing, hint: reflection.hint };
    if (!reflection.complete && reflection.hint) {
      conversationMessages.push(formatReflectionAsMessage(reflection));   // 缺口注入上下文
      needRetry = true;                                                   // 再跑一轮
    }
  }
}
```

关键取舍（这段注释很值钱）：

> **只有「本轮本该用工具」才反思**。纯闲聊 / 无需工具的问题直接收尾，否则每句"你好"都要多花一次反思调用，纯粹烧 token。

反思上限 `MAX_REFLECTION_ROUNDS = 2`，并且**还要满足迭代上限**——双重约束，防止无限递归。

反思失败要**静默降级**：规划/反思调用出错不影响主流程，用户照样拿到回答。

---

## 5. 事件：让前端看得见过程

Agent 跑起来是"黑盒"，所以每一步都要产事件（第 02 篇的 SSE）：

| 事件 | 何时发 |
|------|--------|
| `iteration_end` | 每轮迭代结束 |
| `iteration_usage` | 每轮 token 用量 |
| `tool_start` / `tool_args` / `tool_executing` / `tool_result` | 工具调用全过程 |
| `plan_start` / `plan_step` | 规划与步骤推进 |
| `reflection` | 反思结论 |
| `notice` | 提示（如"正在重试"） |
| `done` | 完成（此时会话已落盘） |

原则：**先让过程可见，再优化体验**。看不到过程时，你连"它为什么答错"都无法排查。

---

## 6. 常见坑

| 坑 | 症状 | 解法 |
|----|------|------|
| 无迭代上限 | 一次提问烧掉大量 token | 硬上限 8 + 工具超时 30s |
| 工具抛异常中断循环 | 一个工具报错整轮白跑 | 捕获成 `{ok:false}` 回灌 |
| 反思无条件开启 | 闲聊也多花一次调用 | 只在用过工具/有计划时反思 |
| 计划步骤不收尾 | 前端永远显示"准备中" | 结束时统一标记 skipped |
| usage 不累加 | 统计不到真实成本 | 每轮累加，循环结束写回 |
| 忘了 abort 检查 | 用户停止后仍在跑 | 每轮开头 + 每次 await 都检查 |

---

## 7. 动手练习

1. 把 `MAX_AGENT_LOOP_ITERATIONS` 临时改成 1，观察多步任务如何失败——你会直观理解循环的价值
2. 写一个必定失败的工具（返回 `{ok:false}`），确认循环继续而不是崩溃
3. 打开规划模式问一个复杂问题，看 `plan_start` 与 `plan_step` 事件

---

## 8. 检查清单

- [ ] 循环有迭代上限、工具超时、abort 检查
- [ ] 终止条件是"本轮无 tool_calls"
- [ ] 规划按需开启，步骤有上限且能收尾
- [ ] 反思只在值得时触发，有轮次上限，失败静默降级
- [ ] 关键过程都有事件回传

---

**返回**: [教程索引](00-导航.md) | [上一篇：工具系统](09-3-Agent工具系统.md) | [下一篇：会话、护栏与工程化](09-5-会话护栏与工程化.md)
