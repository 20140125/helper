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
  ('2026-11-28', '{"events": [{"year": "587", "text": "Treaty of Andelot: King Guntram of Burgundy recognizes Childebert II as his heir."}, {"year": "936", "text": "Shi Jingtang is enthroned as the first emperor of the Later Jin by Emperor Taizong of Liao, following a revolt against Emperor Fei of Later Tang."}, {"year": "1443", "text": "Skanderbeg and his forces liberate Kruja in central Albania and raise the Albanian flag."}, {"year": "1470", "text": "Champa-Đại Việt War: Emperor Lê Thánh Tông of Đại Việt formally launches his attack against Champa."}, {"year": "1520", "text": "An expedition under the command of Ferdinand Magellan passes through the Strait of Magellan."}, {"year": "1582", "text": "In Stratford-upon-Avon, William Shakespeare and Anne Hathaway pay a £40 bond for their marriage licence."}, {"year": "1627", "text": "The Polish-Lithuanian Commonwealth Navy has its greatest and last victory in the Battle of Oliwa."}, {"year": "1660", "text": "At Gresham College, twelve men, including Christopher Wren, Robert Boyle, John Wilkins, and Sir Robert Moray decide to found what is later known as the Royal Society."}, {"year": "1666", "text": "At least 3,000 men of the Royal Scots Army led by Tam Dalyell of the Binns defeat about 900 Covenanter rebels in the Battle of Rullion Green."}, {"year": "1785", "text": "The first Treaty of Hopewell is signed."}]}');

