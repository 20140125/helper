
-- ============================================================
-- 12. 守护进程发送状态表 (daemon_sent_state.json)
-- ============================================================
CREATE TABLE `hp_daemon_sent_state` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `state_key`   VARCHAR(64)     NOT NULL COMMENT '状态键名',
  `state_value` VARCHAR(200)    NOT NULL COMMENT '状态值（日期或时间戳）',
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_key` (`state_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='守护进程消息发送状态跟踪表';

INSERT INTO `hp_daemon_sent_state` (`state_key`, `state_value`, `updated_at`) VALUES
('morning',  '2026-04-01', '2026-04-01 09:00:05'),
('lunch',    '2026-03-31', '2026-04-01 09:00:05'),
('evening',  '2026-03-31', '2026-04-01 09:00:05'),
('weekly',   '2026-03-27', '2026-04-01 09:00:05'),
('birthday', '2026-04-01', '2026-04-01 09:00:05'),
('holiday',  '',           '2026-04-01 09:00:05'),
('prefetch', '2026-04-01', '2026-04-01 09:00:05');
