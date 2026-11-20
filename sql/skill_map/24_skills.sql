
-- ============================================================
-- 20.4 技能图谱表 (skill-map.ts → SKILL_METAS)
-- ============================================================

CREATE TABLE `hp_skills` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT                                         COMMENT '自增主键',
  `skill_key`    VARCHAR(64)  NOT NULL                                                        COMMENT '技能唯一键（如 weather_card_gen）',
  `script_name`  VARCHAR(128) NOT NULL                                                        COMMENT '脚本文件名（相对 scripts/tools/，含 .sh）',
  `icon`         VARCHAR(16)  NOT NULL DEFAULT ''                                             COMMENT '展示图标（emoji）',
  `category`     VARCHAR(32)  NOT NULL                                                        COMMENT '分组名（关联 hp_skill_categories.name）',
  `accent`       VARCHAR(16)  NOT NULL DEFAULT ''                                             COMMENT '卡片主题色（hex，如 #5DADE2）',
  `args`         JSON         NULL                                                            COMMENT '脚本默认执行参数列表（JSON 数组）',
  `has_card`     TINYINT(1)   NOT NULL DEFAULT 0                                              COMMENT '是否输出 PNG 卡片：0-否 1-是',
  `enabled`      TINYINT(1)   NOT NULL DEFAULT 1                                              COMMENT '是否启用：0-否 1-是',
  `sort_order`   INT          NOT NULL DEFAULT 0                                              COMMENT '同分组内展示排序，升序',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP                              COMMENT '生成时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP  COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_skill_key` (`skill_key`),
  KEY `idx_category` (`category`),
  KEY `idx_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='技能图谱 - 脚本/卡片元数据';

INSERT INTO `hp_skills`
  (`skill_key`,          `script_name`,                 `icon`,   `category`, `accent`,  `args`,       `has_card`, `enabled`, `sort_order`) VALUES
  -- ── 天气 ──
  ('weather_card_gen',   'weather_card_gen.sh',         '🌤️',    '天气',     '#5DADE2', JSON_ARRAY(), 1, 1,  1),
  ('weather_alert_card', 'weather_alert_card_gen.sh',   '🚨',    '天气',     '#FF5252', JSON_ARRAY(), 1, 1,  2),
  ('air_quality',        'air_quality.sh',              '💨',    '天气',     '#4CAF50', JSON_ARRAY(), 1, 1,  3),
  -- ── 日历 ──
  ('calendar',           'calendar.sh',                 '📅',    '日历',     '#FFD700', JSON_ARRAY(), 1, 1,  1),
  -- ── 财经 ──
  ('stock_market',       'stock_market.sh',             '📈',    '财经',     '#FF6B35', JSON_ARRAY(), 1, 1,  1),
  ('hk_stock',           'hk_stock.sh',                 '🇭🇰',   '财经',     '#FF6B35', JSON_ARRAY(), 1, 1,  2),
  ('us_stock',           'us_stock.sh',                 '🇺🇸',   '财经',     '#FF6B35', JSON_ARRAY(), 1, 1,  3),
  ('exchange_rate',      'exchange_rate.sh',            '💱',    '财经',     '#FF6B35', JSON_ARRAY(), 1, 1,  4),
  ('gold_silver',        'gold_silver.sh',              '🥇',    '财经',     '#FF6B35', JSON_ARRAY(), 1, 1,  5),
  ('oil_price_card',     'oil_price_card_gen.sh',       '🛢️',    '财经',     '#FF6B35', JSON_ARRAY(), 1, 1,  6),
  -- ── 新闻 ──
  ('ai_news_card',       'ai_news_card_gen.sh',         '📰',    '新闻',     '#9B59B6', JSON_ARRAY(), 1, 1,  1),
  ('ent_news',           'ent_news.sh',                 '🎬',    '新闻',     '#9B59B6', JSON_ARRAY(), 1, 1,  2),
  ('intl_news',          'intl_news.sh',                '🌍',    '新闻',     '#9B59B6', JSON_ARRAY(), 1, 1,  3),
  ('weibo_hot',          'weibo_hot.sh',                '🔥',    '新闻',     '#9B59B6', JSON_ARRAY(), 1, 1,  4),
  -- ── 影视 ──
  ('bilibili_hot',      'bilibili_hot.sh',             '📺',    '影视',     '#00A1D6', JSON_ARRAY(), 1, 1,  1),
  ('tencent_hot',       'tencent_hot.sh',              '🎭',    '影视',     '#00A1D6', JSON_ARRAY(), 1, 1,  2),
  ('iqiyi_hot',         'iqiyi_hot.sh',                '🎞️',    '影视',     '#00A1D6', JSON_ARRAY(), 1, 1,  3),
  -- ── 科技 ──
  ('github_trending',    'github_trending.sh',          '🐙',    '科技',     '#1ABC9C', JSON_ARRAY(), 1, 1,  1),
  ('steam_hot',          'steam_hot.sh',                '🎮',    '科技',     '#1ABC9C', JSON_ARRAY(), 1, 1,  2),
  -- ── 生活 ──
  ('daily_word',         'daily_word.sh',               '📖',    '生活',     '#E74C3C', JSON_ARRAY(), 1, 1,  1),
  ('knowledge_graph',    'knowledge_graph.sh',          '🧠',    '生活',     '#E74C3C', JSON_ARRAY(), 1, 1,  2);
