-- ============================================================
-- 40. 按用户外观偏好表 (hp_user_appearance)
-- ============================================================
-- 一个登录用户一行，按 JWT req.userEmail 隔离；数据库为唯一真源。
-- surface_opacity 为系统背景图遮挡层（卡片 / 顶栏 / 侧栏）的不透明度百分数，
-- 默认 86（与原卡片 color-mix 值一致），允许 20–100，数值越大背景图越淡。
-- 注意：本脚本会 DROP 重建，仅用于初始化或明确要重置时执行；
--       存量库由 web/utils/user-appearance.ts 的 ensureUserAppearanceSchema 幂等建表。
-- ============================================================
SET NAMES utf8mb4;

DROP TABLE IF EXISTS `hp_user_appearance`;
CREATE TABLE `hp_user_appearance` (
  `id`               INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `user`             VARCHAR(191)  NOT NULL COMMENT '所属用户邮箱（JWT req.userEmail）',
  `surface_opacity`  TINYINT UNSIGNED NOT NULL DEFAULT 86 COMMENT '背景图遮挡层不透明度（20–100，越大越不透明）',
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user` (`user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='按用户的系统背景遮挡层外观偏好';
