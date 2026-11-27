-- ============================================================
-- 31. 贾维斯巡检状态与报告表 (web/.runtime/ai-inspector-state*.json)
-- ============================================================
DROP TABLE IF EXISTS `hp_ai_inspection_state`;
CREATE TABLE `hp_ai_inspection_state` (
  `id`             INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `last_run_date`  VARCHAR(16)   NULL COMMENT '最近巡检日期',
  `last_run_minute` VARCHAR(32)  NULL COMMENT '最近巡检分钟',
  `last_run_at`    VARCHAR(40)   NULL COMMENT '最近巡检时间(ISO)',
  `last_status`    VARCHAR(32)   NULL COMMENT '最近状态',
  `last_error`     TEXT          NULL COMMENT '最近错误',
  `last_summary`   VARCHAR(255)  NULL COMMENT '最近结果摘要',
  `fail_count`     INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '连续失败次数',
  `report`         LONGTEXT      NULL COMMENT '巡检报告(Markdown)',
  `duration_ms`    INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '耗时(ms)',
  `total_tokens`   INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '消耗 token',
  `tool_calls`     INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '工具调用次数',
  `pushed`         TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '是否已推送',
  `run_at`         VARCHAR(40)   NULL COMMENT '运行时间(ISO)',
  `manual`         TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '是否手动触发',
  `source_file`    VARCHAR(64)   NULL COMMENT '来源状态文件',
  PRIMARY KEY (`id`),
  KEY `idx_last_run` (`last_run_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贾维斯巡检状态与报告';

INSERT INTO `hp_ai_inspection_state` (`source_file`, `last_run_date`, `last_run_minute`, `last_run_at`, `last_status`, `last_error`, `last_summary`, `fail_count`, `report`, `duration_ms`, `total_tokens`, `tool_calls`, `pushed`, `run_at`, `manual`) VALUES
  ('ai-inspector-state.json', '2026-11-23', '2026-11-23 09:31', '2026-11-23T01:31:55.141Z', 'ok', '', 'tokens=197043 tools=9 pushed=false', 0, '- **高**：内存占用 99%，仅剩 0.10 GB。建议尽快检查高占用进程并释放内存或扩容。\n- **中**：Web 日志记录缺少数据库表 `helper.hp_role_permissions` 的错误及请求体过大错误。建议核对数据库迁移和表结构，并排查触发大请求的接口。\n- **需核实**：17 条规则均已启用，但已查到的触发记录未更新到今天；日志未提供今天的触发记录。建议检查提醒守护进程和规则执行日志，确认是否漏触发，并在确认后补执行应触发的任务。\n- **正常**：Web 服务、launcher、提醒守护进程和年度调度器均在运行；今天与明天均为工作日，非节假日、非调休工作日。', 74506, 197043, 9, 0, '2026-11-23T01:31:55.141Z', 0) ,
  ('ai-inspector-state', '2026-11-24', '2026-11-27 21:36', '2026-11-27T13:36:20.413Z', 'ok', '', 'tokens=173085 tools=7 pushed=false', 0, '**系统健康巡检结论：存在严重异常。**\n\n- **严重：内存占用 99%**，仅剩 0.13 GB；建议立即定位高内存进程并释放资源。\n- **严重：今日提醒疑似漏触发**。规则均启用，但多数 `lastTriggeredAt` 停留在 2026-11-21 或更早；建议检查守护进程调度及规则日志。\n- **严重：Web 日志出现数据库表缺失**，涉及 `hp_role_permissions`、`hp_cache_document`；建议核对并补齐数据库迁移。\n- **警告：检测到实例清理及 Web 异常重启**；建议核查进程监控与退出原因。\n- Web 服务、launcher、提醒守护进程、年度调度器当前均运行中。2026-11-27 为工作日，2026-11-28 为非工作日，均非节假日或调休。', 74652, 173085, 7, 0, '2026-11-27T13:36:20.413Z', 1);
