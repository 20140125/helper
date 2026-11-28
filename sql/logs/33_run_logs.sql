-- ============================================================
-- 33. 项目运行日志表（全系统日志的唯一持久化落点）
-- 来源：shell 脚本（log_utils.sh/log_db.sh）、Web console 劫持、HTTP 访问日志中间件
-- 说明：日志不再写入任何文件；每条日志在 stderr 输出的同时直接 INSERT 本表。
--       source 由 LOG_FILE 名或调用脚本名推导，context 存 extra/args/访问详情 JSON。
--       过期数据按 LOG_RETENTION_DAYS（默认 15 天）由 Web 定时任务与年度调度器删除。
-- ============================================================
DROP TABLE IF EXISTS `hp_run_logs`;
CREATE TABLE `hp_run_logs` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `logged_at`    DATETIME(3)     NOT NULL COMMENT '日志发生时间（毫秒精度）',
  `ts_ms`        BIGINT          NULL COMMENT '原始毫秒时间戳（JSONL 的 ts）',
  `level`        VARCHAR(16)     NOT NULL DEFAULT 'INFO' COMMENT '级别：DEBUG/INFO/SUCCESS/WARNING/WARN/ERROR/LOG 等',
  `source_type`  VARCHAR(24)     NOT NULL DEFAULT 'script' COMMENT '来源类型：script/web/access/daemon/ai/system',
  `source`       VARCHAR(64)     NOT NULL COMMENT '日志来源标识（LOG_SOURCES 的 key 或模块名）',
  `log_file`     VARCHAR(255)    NULL COMMENT '兼容字段：历史日志文件相对路径，新日志一律为 NULL',
  `message`      TEXT            NOT NULL COMMENT '日志正文（访问日志按原文整块入库）',
  `context`      TEXT            NULL COMMENT '结构化上下文 JSON（log_utils 的 extra / console 的 args / 访问日志详情）',
  `caller`       VARCHAR(255)    NULL COMMENT '调用位置（脚本:行号:函数）',
  `hostname`     VARCHAR(128)    NULL COMMENT '主机名',
  `pid`          INT UNSIGNED    NULL COMMENT '进程 ID',
  `trace_id`     VARCHAR(64)     NULL COMMENT '链路或运行 ID（关联请求 / AI run_id）',
  `user`         VARCHAR(191)    NULL COMMENT '关联用户（邮箱或标识）',
  `created_at`   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '入库时间',
  PRIMARY KEY (`id`),
  KEY `idx_logged_at` (`logged_at`),
  KEY `idx_level_time` (`level`, `logged_at`),
  KEY `idx_source_time` (`source`, `logged_at`),
  KEY `idx_trace` (`trace_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目运行日志（脚本/Web/访问/AI 全量记录）';
