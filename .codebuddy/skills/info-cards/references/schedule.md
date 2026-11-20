# 定时推送调度

脚本本身**不包含**定时逻辑，全部由 OpenClaw cron 配置驱动。脚本只负责"被调起 → 产出 PNG / 推消息 → 退出"。

> **注意**：33 个 `scripts/tools/` ——它们由 AI 对话即时触发（用户问"看看今天的热搜"→ 跑脚本 → `MEDIA:` 回图）。

真实推送由 `card_utils.sh` 暴露的 `send_card_image <png> [webhook_ids]` 完成；脚本内部不拼企微请求。

## 工作日判断

```bash
# 调用这两个工具脚本，以退出码判断
bash ./is_cn_workday.sh         # 今天
bash ./is_tomorrow_cn_workday.sh  # 明天
# 退出码 0 = 工作日，非 0 = 休息日/节假日
```

**关键原则**：「工作日才推」「价格变动才推」等**闸门写在 cron 配置里**（通过 `&&` 串联 `is_cn_workday.sh` 的退出码），而**不写在脚本里**。这样：

- 脚本永远是「调我我就出图」，手动触发不会被业务规则误拦
- cron 任务配置变更不需要改脚本
- AI pipeline 可以和 cron 共享同一组脚本，各自拼闸门

## 油价缓存机制

`oil_price_card_gen.sh` 通过 `.oil_price_cache_v2` 文件记录上次推送价格，用于**涨跌幅展示**（对比本次与上次价格）。脚本总会出图，不再有"未变动跳过" gate；定时任务的变动判断在 cron 层 / AI pipeline 自行实现。

## 手动触发不受 cron 条件约束

任何脚本都可以直接 `bash <脚本>.sh` 手动运行，此时所有"工作日""价格变动"等 gate 都不参与判断（因为那些 gate 写在 cron 配置里，而不是脚本里）。
