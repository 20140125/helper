-- ============================================================
-- 26. 贾维斯会话消息表 (ai-conversations 内的 messages)
-- ============================================================
DROP TABLE IF EXISTS `hp_ai_messages`;
CREATE TABLE `hp_ai_messages` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `conversation_id`   VARCHAR(64)   NOT NULL COMMENT '所属会话 ID',
  `seq`               INT UNSIGNED  NOT NULL COMMENT '会话内消息序号',
  `role`              VARCHAR(32)   NOT NULL COMMENT '角色：system/user/assistant/tool',
  `content`           LONGTEXT      NULL COMMENT '文本内容；多模态为内容片段 JSON',
  `tool_calls`        LONGTEXT      NULL COMMENT 'assistant 工具调用列表 JSON',
  `tool_call_id`      VARCHAR(128)  NULL COMMENT 'tool 消息对应的 tool_call_id',
  `name`              VARCHAR(128)  NULL COMMENT 'tool 消息的工具名',
  `prompt_tokens`     INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '提示 token',
  `completion_tokens` INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '补全 token',
  `total_tokens`      INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '总 token',
  `created_at`        BIGINT        NULL COMMENT '消息创建时间戳(ms)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_conv_seq` (`conversation_id`,`seq`),
  KEY `idx_conv` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贾维斯会话消息';
