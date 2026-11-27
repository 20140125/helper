-- ============================================================
-- 33. 项目运行日志表（统一收录项目内所有运行日志）
-- 来源：scripts/*.log、web/.runtime/*.jsonl、scripts/web_access.log 等
-- 说明：日志文件仍是唯一真源，本表用于日志入库后的跨模块检索与统计；
--       TEXT 日志按 [时间] [级别] 消息 解析，JSONL 日志按 ts/time/level/message/args 解析。
-- ============================================================
DROP TABLE IF EXISTS `hp_run_logs`;
CREATE TABLE `hp_run_logs` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `logged_at`    DATETIME(3)     NOT NULL COMMENT '日志发生时间（毫秒精度）',
  `ts_ms`        BIGINT          NULL COMMENT '原始毫秒时间戳（JSONL 的 ts）',
  `level`        VARCHAR(16)     NOT NULL DEFAULT 'INFO' COMMENT '级别：DEBUG/INFO/SUCCESS/WARNING/WARN/ERROR/LOG 等',
  `source_type`  VARCHAR(24)     NOT NULL DEFAULT 'script' COMMENT '来源类型：script/web/access/daemon/ai/system',
  `source`       VARCHAR(64)     NOT NULL COMMENT '日志来源标识（LOG_FILES 的 key 或模块名）',
  `log_file`     VARCHAR(255)    NULL COMMENT '原始日志文件相对路径',
  `message`      TEXT            NOT NULL COMMENT '日志正文（无法解析的访问日志等按原文整行入库）',
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
