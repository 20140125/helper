-- ============================================================
-- 29. 贾维斯副作用审批单表 (ai-approvals.json)
-- ============================================================
DROP TABLE IF EXISTS `hp_ai_approvals`;
CREATE TABLE `hp_ai_approvals` (
  `id`              VARCHAR(64)   NOT NULL COMMENT '审批单 ID',
  `user`            VARCHAR(191)  NOT NULL COMMENT '发起人邮箱',
  `conversation_id` VARCHAR(64)   NOT NULL COMMENT '来源会话 ID',
  `tool`            VARCHAR(128)  NOT NULL COMMENT '待执行的工具名',
  `args`            LONGTEXT      NULL COMMENT '工具参数 JSON',
  `reason`          TEXT          NULL COMMENT '申请理由',
  `status`          VARCHAR(16)   NOT NULL COMMENT 'pending/approved/rejected/executed/failed',
  `created_at`      BIGINT        NOT NULL COMMENT '创建时间戳(ms)',
  `decided_at`      BIGINT        NULL COMMENT '决策时间戳(ms)',
  `decided_by`      VARCHAR(191)  NULL COMMENT '决策人邮箱',
  `result`          TEXT          NULL COMMENT '执行结果摘要',
  PRIMARY KEY (`id`),
  KEY `idx_status_created` (`status`,`created_at`),
  KEY `idx_user` (`user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贾维斯副作用操作审批单';
