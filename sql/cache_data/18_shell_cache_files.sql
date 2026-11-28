-- ============================================================
-- 表：hp_shell_cache_files
-- 来源：.cache/custom_rules.json、dailyword_library.json、amap_geocode.json
-- 由 sql/cache_data.sql 统一加载；也可单独执行本文件
-- ============================================================
SET NAMES utf8mb4;

DROP TABLE IF EXISTS `hp_shell_cache_files`;
CREATE TABLE `hp_shell_cache_files` (
  `file_key`   VARCHAR(191) NOT NULL COMMENT '缓存文件名',
  `body`       LONGTEXT      NULL     COMMENT '原始文件全文（JSON）',
  `updated_at` BIGINT        NOT NULL DEFAULT 0 COMMENT '文件 mtime（毫秒）',
  PRIMARY KEY (`file_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='shell 写入型缓存文件的查询镜像';

-- 初始数据为空；由 npm run migrate:cache -- --batch=shell-writers --apply 或运行时自动同步写入
INSERT INTO `hp_cache_meta` (`meta_key`, `meta_value`) VALUES
  ('shell_writers_sync_at', '0')
ON DUPLICATE KEY UPDATE `meta_value` = VALUES(`meta_value`);
