-- ============================================================
-- 表：hp_cache_meta
-- 来源：.cache/api_responses/.last_prune
-- 由 sql/cache_data.sql 统一加载；也可单独执行本文件
-- ============================================================
SET NAMES utf8mb4;

-- ── hp_cache_meta  ←  .cache/api_responses/.last_prune ────────────
DROP TABLE IF EXISTS `hp_cache_meta`;
CREATE TABLE `hp_cache_meta` (
  `meta_key` VARCHAR(128) NOT NULL,
  `meta_value` TEXT NULL,
  `cache_updated_at` BIGINT NOT NULL DEFAULT 1795790669522,
  PRIMARY KEY (`meta_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='缓存目录中的非 JSON 数据';

-- content_library_sync_at 是内容库同步水位（文件 mtime）；置 0 让首次查询自动从 JSON 重建查询表
INSERT INTO `hp_cache_meta` (`meta_key`, `meta_value`) VALUES
  ('last_prune', '2026-11-28'),
  ('content_library_sync_at', '0');

