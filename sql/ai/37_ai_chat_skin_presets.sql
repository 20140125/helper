-- ============================================================
-- 37. 贾维斯 AI 助手内置皮肤预设表 (hp_ai_chat_skin_presets)
-- ============================================================
-- 预设定义（名称、缩略图、背景、CSS 变量）以数据库为真源，前端启动时从
-- GET /api/ai-chat/skin/presets 读取，后续可后台增删改而不用改前端代码。
-- 5 套初始种子由服务启动时 ensureAiChatSkinSchema() 以 INSERT IGNORE 幂等补入，
-- 与 web/types/ai-chat-skin.ts 的 AI_CHAT_SKIN_PRESET_SEEDS 保持一致，避免两处手写 JSON 漂移。
-- 注意：本脚本会 DROP 重建，仅用于初始化或明确要重置时执行。
-- ============================================================
SET NAMES utf8mb4;

DROP TABLE IF EXISTS `hp_ai_chat_skin_presets`;
CREATE TABLE `hp_ai_chat_skin_presets` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `skin_key`    VARCHAR(32)   NOT NULL COMMENT '皮肤 ID（前端 settings.skinId）',
  `label_zh`    VARCHAR(64)   NOT NULL COMMENT '中文名称',
  `label_en`    VARCHAR(64)   NOT NULL COMMENT '英文名称',
  `swatch`      VARCHAR(512)  NOT NULL DEFAULT '' COMMENT '选择面板缩略图（CSS background-image 值）',
  `bg_image`    VARCHAR(1024) NOT NULL DEFAULT '' COMMENT '聊天窗口背景（CSS background-image 值）',
  `vars_json`   JSON          NOT NULL COMMENT '局部 CSS 变量覆盖（--bg-* / --text-* / --accent-*）',
  `sort_order`  INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '展示顺序',
  `enabled`     TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '是否启用（0=下线，可用作软删除）',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_skin_key` (`skin_key`),
  KEY `idx_enabled_sort` (`enabled`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='贾维斯 AI 助手内置皮肤预设定义';
