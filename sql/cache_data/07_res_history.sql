-- ============================================================
-- 表：hp_cache_res_history
-- 来源：.cache/api_responses/
-- 由 sql/cache_data.sql 统一加载；也可单独执行本文件
-- ============================================================
SET NAMES utf8mb4;

-- ── hp_cache_res_history  [历史上的今天]  1 个文件 ────────────
DROP TABLE IF EXISTS `hp_cache_res_history`;
CREATE TABLE `hp_cache_res_history` (
  `asset_key` VARCHAR(191) NOT NULL COMMENT '缓存文件名',
  `body` LONGTEXT NOT NULL COMMENT '原始响应 JSON 全文',
  `cache_updated_at` BIGINT NOT NULL DEFAULT 1795791234763,
  PRIMARY KEY (`asset_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='历史上的今天响应';

INSERT INTO `hp_cache_res_history` (`asset_key`, `body`) VALUES
  ('2026-11-21', '{"events": [{"year": "164 BC", "text": "Judas Maccabeus, son of Mattathias of the Hasmonean family, restores the Temple in Jerusalem. This event is commemorated each year by the festival of Hanukkah."}, {"year": "235", "text": "Pope Anterus succeeds Pontian as the nineteenth pope. During the persecutions of emperor Maximinus Thrax he is martyred."}, {"year": "1009", "text": "Lý Công Uẩn is enthroned as emperor of Đại Cồ Việt, founding the Lý dynasty."}, {"year": "1386", "text": "Timur of Samarkand captures and sacks the Georgian capital of Tbilisi, taking King Bagrat V of Georgia captive."}, {"year": "1620", "text": "Plymouth Colony settlers sign the Mayflower Compact (November 11, O.S.)"}, {"year": "1676", "text": "The Danish astronomer Ole Rømer presents the first quantitative measurements of the speed of light."}, {"year": "1783", "text": "In Paris, Jean-François Pilâtre de Rozier and François Laurent d''Arlandes, make the first untethered hot air balloon flight."}, {"year": "1789", "text": "North Carolina ratifies the United States Constitution and is admitted as the 12th U.S. state."}, {"year": "1832", "text": "Wabash College is founded in Crawfordsville, Indiana."}, {"year": "1861", "text": "American Civil War: Confederate President Jefferson Davis appoints Judah Benjamin Secretary of War."}]}');

