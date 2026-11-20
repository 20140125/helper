
-- ============================================================
-- 9. 规则-Webhook 关联表 (custom_rules.json → webhookIds)
-- ============================================================
CREATE TABLE `hp_rule_webhooks` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `rule_id`     INT UNSIGNED NOT NULL COMMENT '规则 ID（引用 hp_custom_rules.id）',
  `webhook_id`  INT UNSIGNED NOT NULL COMMENT 'Webhook ID（引用 hp_webhooks.id）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rule_webhook` (`rule_id`, `webhook_id`),
  KEY `idx_webhook` (`webhook_id`),
  CONSTRAINT `fk_rw_rule`    FOREIGN KEY (`rule_id`)    REFERENCES `hp_custom_rules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rw_webhook` FOREIGN KEY (`webhook_id`) REFERENCES `hp_webhooks` (`id`)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='规则-Webhook 关联表';

-- 通过子查询插入，自动解析 rule_key → rule_id、webhook_key → webhook_id
INSERT INTO `hp_rule_webhooks` (`rule_id`, `webhook_id`)
SELECT cr.id, w.id
FROM `hp_custom_rules` cr, `hp_webhooks` w
WHERE cr.rule_key = 'rule_1774250224527' AND w.webhook_key = 'webhook_1773042854071';

INSERT INTO `hp_rule_webhooks` (`rule_id`, `webhook_id`)
SELECT cr.id, w.id
FROM `hp_custom_rules` cr, `hp_webhooks` w
WHERE cr.rule_key = 'rule_1774251368442' AND w.webhook_key = 'webhook_1773042854071';
