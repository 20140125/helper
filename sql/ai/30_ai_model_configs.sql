-- ============================================================
-- 30. 贾维斯模型配置组表 (ai-model-configs.json)
-- ============================================================
DROP TABLE IF EXISTS `hp_ai_model_configs`;
CREATE TABLE `hp_ai_model_configs` (
  `id`             VARCHAR(64)   NOT NULL COMMENT '配置组 ID',
  `name`           VARCHAR(128)  NOT NULL COMMENT '配置组名称',
  `base_url`       VARCHAR(512)  NOT NULL COMMENT 'OpenAI 兼容端点 Base URL',
  `api_key`        VARCHAR(512)  NULL COMMENT 'Bearer Token（敏感，仅存服务端，接口返回需脱敏）',
  `max_tokens`     INT UNSIGNED  NOT NULL DEFAULT 4096 COMMENT '单次响应最大 token',
  `models`         LONGTEXT      NULL COMMENT '组内模型列表 JSON',
  `memory_enabled` TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '是否参与长期记忆沉淀',
  `pricing`        LONGTEXT      NULL COMMENT '自定义单价 JSON（元/百万 token）',
  `created_at`     VARCHAR(32)   NULL COMMENT '创建时间',
  `updated_at`     VARCHAR(32)   NULL COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贾维斯模型配置组';
