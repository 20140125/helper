-- ============================================================
-- 表：hp_cache_res_other
-- 来源：.cache/api_responses/
-- 由 sql/cache_data.sql 统一加载；也可单独执行本文件
-- ============================================================
SET NAMES utf8mb4;

-- ── hp_cache_res_other  [其它未分类响应]  0 个文件 ────────────
DROP TABLE IF EXISTS `hp_cache_res_other`;
CREATE TABLE `hp_cache_res_other` (
  `asset_key` VARCHAR(191) NOT NULL COMMENT '缓存文件名',
  `body` LONGTEXT NOT NULL COMMENT '原始响应 JSON 全文',
  `cache_updated_at` BIGINT NOT NULL DEFAULT 1795791234763,
  PRIMARY KEY (`asset_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='其它未分类响应响应（基于 .cache/api_responses 分类）';

-- 其它未分类响应：当前缓存中无对应响应，保留空表


