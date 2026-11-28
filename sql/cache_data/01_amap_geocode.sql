-- ============================================================
-- 表：hp_cache_amap_geocode
-- 来源：.cache/amap_geocode.json
-- 由 sql/cache_data.sql 统一加载；也可单独执行本文件
-- ============================================================
SET NAMES utf8mb4;

-- ── hp_cache_amap_geocode  ←  .cache/amap_geocode.json ────────────────────
DROP TABLE IF EXISTS `hp_cache_amap_geocode`;
CREATE TABLE `hp_cache_amap_geocode` (
  `section` VARCHAR(64) NOT NULL COMMENT '缓存文档顶层键',
  `row_key` VARCHAR(191) NOT NULL COMMENT '该项在文档中的路径',
  `data` LONGTEXT NULL COMMENT '该项完整 JSON（一行一条记录）',
  `cache_updated_at` BIGINT NOT NULL DEFAULT 1795790669522,
  PRIMARY KEY (`section`,`row_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='基于 .cache/amap_geocode.json 生成';

INSERT INTO `hp_cache_amap_geocode` (`section`, `row_key`, `data`) VALUES
  ('深圳北站', '', '114.025796,22.608443') ,
  ('深圳市民中心', '', '114.058533,22.544125') ,
  ('深圳宝安国际机场', '', '113.813038,22.622661') ,
  ('腾讯大厦,深圳市南山区深南大道10000号', '', '113.943120,22.540998') ,
  ('华滨大厦,深圳市宝安区新安街道宝城47区', '', '113.889046,22.568173') ,
  ('深圳市宝安区新安街道', '', '113.896907,22.560772');

