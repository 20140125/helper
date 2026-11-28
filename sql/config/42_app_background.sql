-- ============================================================
-- 42. 系统背景图 (hp_app_background)
-- ============================================================
-- 全站共享、固定单行（id = 1）：图片二进制本体直接入库，数据库为唯一真源，
-- 不再写 hp_env_config.APP_BACKGROUND_URL，也不再落 public/uploads 磁盘。
-- content_hash 为图片内容 MD5，对外短地址为 /uploads/appbg-<hash>，
-- URL 自带版本：换图后地址变化，浏览器可长缓存且不会读到旧图。
-- 注意：本脚本只建表，不删除已有行，避免全库重建冲掉用户上传的背景图；
--       存量库由 web/utils/app-background.ts 的 ensureAppBackgroundSchema 幂等建表并迁移旧文件。
-- ============================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `hp_app_background` (
  `id`            TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '固定单行（系统全局唯一一张背景图）',
  `mime`          VARCHAR(32)      NOT NULL COMMENT '图片 MIME（image/jpeg / png / webp / gif）',
  `image_data`    LONGBLOB         NOT NULL COMMENT '图片二进制本体（最大 5MB）',
  `content_hash`  CHAR(32)         NOT NULL COMMENT '图片内容 MD5，用作对外短地址的版本标识',
  `updated_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统背景图（图片本体入库，全站共享）';
