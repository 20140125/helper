-- ============================================================
-- 补充缓存数据入口（一个表一个文件，位于 sql/cache_data/）
-- 本文件只导入 helper_database.sql 中其它 SQL 文件未覆盖的缓存数据；
-- 顶层 .cache/*.json 的业务数据由 sql/**/*.sql 导入（hp_* 业务表），此处不再重复。
-- API 响应归档按资源类型拆为 hp_cache_res_* 多张表，每行一个缓存文件，body 为原始 JSON 全文。
-- 幂等：每个表文件先 DROP 再 CREATE，重复执行以缓存覆盖。
-- 运行：mysql -u <user> -p <db> < sql/cache_data.sql
-- 生成时间：2026-11-27 22:44:29
-- ============================================================
SET NAMES utf8mb4;

SOURCE sql/cache_data/01_amap_geocode.sql;
SOURCE sql/cache_data/02_dailyword_library.sql;
SOURCE sql/cache_data/03_res_calendar.sql;
SOURCE sql/cache_data/04_res_holiday.sql;
SOURCE sql/cache_data/05_res_weather.sql;
SOURCE sql/cache_data/06_res_horoscope.sql;
SOURCE sql/cache_data/07_res_history.sql;
SOURCE sql/cache_data/08_res_finance.sql;
SOURCE sql/cache_data/09_res_hot_list.sql;
SOURCE sql/cache_data/10_res_quote.sql;
SOURCE sql/cache_data/11_res_video.sql;
SOURCE sql/cache_data/12_res_image.sql;
SOURCE sql/cache_data/13_res_news.sql;
SOURCE sql/cache_data/14_res_ai_doc.sql;
SOURCE sql/cache_data/15_res_other.sql;
SOURCE sql/cache_data/16_meta.sql;
