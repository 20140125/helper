-- ============================================================
-- 32. 系统环境变量配置表
-- ============================================================
-- 本文件只定义表结构：.env 含数据库密码、JWT_SECRET、各类 API Key 等敏感值，
DROP TABLE IF EXISTS `hp_env_config`;
CREATE TABLE `hp_env_config` (
  `env_key`      VARCHAR(64)   NOT NULL COMMENT '配置项键名（对应 web/.env 中的 KEY）',
  `env_value`    TEXT          NULL COMMENT '配置项值（仅存数据库，敏感值不写入 SQL 文件）',
  `group_name`   VARCHAR(64)   NULL COMMENT '配置分组（数据库/接口密钥/邮件/调度等）',
  `description`  VARCHAR(255)  NULL COMMENT '配置项说明',
  `is_secret`    TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '是否为敏感项（接口返回需脱敏）',
  `sort_order`   INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '展示顺序',
  `updated_at`   VARCHAR(32)   NULL COMMENT '更新时间',
  PRIMARY KEY (`env_key`),
  KEY `idx_group` (`group_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统环境变量配置';
