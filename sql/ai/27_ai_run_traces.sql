-- ============================================================
-- 27. 贾维斯运行追踪表 (ai-traces/YYYY-MM.jsonl)
-- ============================================================
DROP TABLE IF EXISTS `hp_ai_run_traces`;
CREATE TABLE `hp_ai_run_traces` (
  `run_id`            VARCHAR(64)   NOT NULL COMMENT '运行唯一 ID',
  `user`              VARCHAR(191)  NOT NULL COMMENT '发起用户邮箱',
  `conversation_id`   VARCHAR(64)   NOT NULL COMMENT '所属会话 ID',
  `model`             VARCHAR(128)  NOT NULL COMMENT '实际使用的模型 ID',
  `started_at`        BIGINT        NOT NULL COMMENT '开始时间戳(ms)',
  `ended_at`          BIGINT        NOT NULL COMMENT '结束时间戳(ms)',
  `duration_ms`       INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '端到端耗时(ms)',
  `iterations`        INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '迭代轮次数',
  `prompt_tokens`     INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '累计提示 token',
  `completion_tokens` INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '累计补全 token',
  `total_tokens`      INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '累计总 token',
  `tool_calls`        INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '工具调用总次数',
  `tool_failures`     INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '工具调用失败次数',
  `planning_enabled`  TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '是否启用规划与反思',
  `reflections`       INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '自我反思轮次',
  `cost_cny`          DECIMAL(10,4) NOT NULL DEFAULT 0 COMMENT '估算成本(元)',
  `error`             TEXT          NULL COMMENT '异常原因',
  `steps`             LONGTEXT      NULL COMMENT '逐轮明细 JSON',
  PRIMARY KEY (`run_id`),
  KEY `idx_user_started` (`user`,`started_at`),
  KEY `idx_model` (`model`),
  KEY `idx_conv` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贾维斯运行追踪（成本/延迟/失败率分析）';
