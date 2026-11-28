-- ============================================================
-- 36. 贾维斯 AI 助手皮肤配置表 (hp_ai_chat_skins)
-- ============================================================
-- 一个登录用户一行，按 JWT req.userEmail 隔离；数据库为唯一真源。
-- skin_id 指向 hp_ai_chat_skin_presets.skin_key（预设定义在 37 号表）。
-- background_url 直接存图片本体 data:image/...;base64,...（LONGTEXT），
-- 不再落 public/uploads 磁盘，也不再保存路径；空串表示未设置自定义背景。
-- 注意：本脚本会 DROP 重建，仅用于初始化或明确要重置时执行。
-- ============================================================
SET NAMES utf8mb4;

DROP TABLE IF EXISTS `hp_ai_chat_skins`;
CREATE TABLE `hp_ai_chat_skins` (
  `id`             INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `user`           VARCHAR(191)  NOT NULL COMMENT '所属用户邮箱（JWT req.userEmail）',
  `skin_id`        VARCHAR(32)   NOT NULL DEFAULT 'default' COMMENT '皮肤预设 ID（hp_ai_chat_skin_presets.skin_key）',
  `background_url` LONGTEXT      NOT NULL COMMENT '自定义背景图本体 data:image/...;base64,...，空串表示未设置',
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user` (`user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贾维斯 AI 助手按用户皮肤配置';
