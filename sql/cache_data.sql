-- ============================================================
-- 补充缓存数据入口（一个表一个文件，位于 sql/cache_data/）
-- 本文件只导入 helper_database.sql 中其它 SQL 文件未覆盖的缓存数据；
-- 顶层 .cache/*.json 的业务数据由 sql/**/*.sql 导入（hp_* 业务表），此处不再重复。
-- API 响应归档按资源类型拆为 hp_cache_res_* 多张表，每行一个缓存文件，body 为原始 JSON 全文。
-- asset_key 只存资源标识，不带与表名重复的类别前缀（如星座表存「双子座」而非「horoscope_双子座」）。
-- 例外：hp_cache_res_hot_list 由 tencenthot_ / weibohot_ / bilibilihot_ / douyinhot_ / iqiyihot_
--       五个平台共用，asset_key 保留平台前缀（如 tencenthot_2026-11），避免同月份撞键。
-- 12 张 hp_cache_res_* 表用 period_type / period_key 显式记录时间粒度，body 内容不变：
--   day    → YYYY-MM-DD：hp_cache_res_history（一行一天）
--   month  → YYYY-MM    ：hp_cache_res_calendar / weather / finance / hot_list / quote（一月一行）
--   year   → YYYY       ：hp_cache_res_holiday（按国家 + 年份一行）、hp_cache_res_horoscope（按星座一行，取当前年份）
--   static → 空          ：hp_cache_res_video / image / news（文件级无日期）
--   auto   → 从键推断    ：hp_cache_res_other（兜底，依次尝试 YYYY-MM-DD / YYYY-MM / YYYY）
-- 例外：hp_cache_dailyword_library 的 row_key 已是 YYYY-MM-DD（按天），hp_cache_amap_geocode 为静态坐标，不设粒度列。
-- 运行时写入与旧库补列分别见 web/utils/database/cache-routing.ts、scripts/cache_db.sh。
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
-- hp_cache_res_ai_doc（AI 文档响应分类）为空表且无运行时消费者，已移除表定义；
-- 兼容旧库：单独执行本文件时也清理残留空表
DROP TABLE IF EXISTS `hp_cache_res_ai_doc`;
SOURCE sql/cache_data/15_res_other.sql;
-- hp_shell_cache_files 兼容视图、hp_cache_files / hp_cache_store / hp_cache_meta 均已下线
DROP VIEW IF EXISTS `hp_shell_cache_files`;
DROP TABLE IF EXISTS `hp_shell_cache_files`;
DROP TABLE IF EXISTS `hp_cache_files`;
DROP TABLE IF EXISTS `hp_cache_store`;
DROP TABLE IF EXISTS `hp_cache_meta`;
-- 缓存键读写 sql/ 里已有的业务表（sql/**/*.sql）与 01~15 号分类表，不再新建表；
-- 旧库残留的 hp_cache_item_* 表已废弃，可按表名手动清理
