
-- ============================================================
-- 7. Webhook 表 (webhooks.json)
-- ============================================================
CREATE TABLE `hp_webhooks` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `webhook_key`  VARCHAR(64)     NOT NULL COMMENT 'Webhook 唯一标识',
  `name`         VARCHAR(200)    NOT NULL COMMENT 'Webhook 名称',
  `url`          VARCHAR(1000)   NOT NULL COMMENT '企业微信 Webhook URL',
  `style`        VARCHAR(32)     NOT NULL DEFAULT 'default' COMMENT '消息风格（default/brief/formal）',
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_webhook_key` (`webhook_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='企业微信 Webhook 配置表';

INSERT INTO `hp_webhooks` (`webhook_key`, `name`, `url`, `style`, `created_at`, `updated_at`) VALUES
('webhook_1773042854071', '开发二组外聘技术专家',
 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_WEBHOOK_KEY_HERE',
 'default', '2026-03-09 15:54:14', '2026-03-20 19:02:34');
