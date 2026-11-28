
-- ============================================================
-- 20. 权限申请记录表 (permission_requests.json)
-- ============================================================
CREATE TABLE `hp_permission_requests` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `request_id`            VARCHAR(64)     NOT NULL COMMENT '申请记录唯一 ID',
  `email`         VARCHAR(255)    NOT NULL COMMENT '申请人邮箱',
  `from_path`     VARCHAR(500)    NOT NULL COMMENT '申请访问的页面路径',
  `reason`        VARCHAR(1000)   NULL     COMMENT '申请原因',
  `status`        ENUM('pending','approved','rejected')
                                  NOT NULL DEFAULT 'pending' COMMENT '审批状态',
  `reject_reason` VARCHAR(1000)   NULL     COMMENT '拒绝原因（status=rejected 时填写）',
  `resolved_by`   VARCHAR(255)    NULL     COMMENT '审批人（邮箱或 wecom-link）',
  `resolved_at`   DATETIME        NULL     COMMENT '审批时间',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_request_id` (`request_id`),
  KEY `idx_email`  (`email`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限申请记录表';

-- 数据以 .cache/permission_requests.json 为准（自动同步）
INSERT INTO `hp_permission_requests` (`request_id`, `email`, `from_path`, `reason`, `status`, `reject_reason`, `resolved_by`, `resolved_at`, `created_at`) VALUES
  ('pr_1713200000001', 'alice@example.com', '/dashboard', '需要查看团队整体数据看板，方便日常监控', 'rejected', '', 'redacted3@example.com', '2026-10-19 17:54:55', '2026-04-16 09:00:00') ,
  ('pr_1713200000002', 'bob@example.com', '/reports/weekly', '每周需要导出周报数据', 'rejected', '', 'redacted3@example.com', '2026-10-19 17:54:52', '2026-04-16 10:15:00') ,
  ('pr_1713200000003', 'carol@example.com', '/settings/users', NULL, 'approved', NULL, 'redacted3@example.com', '2026-10-19 17:53:24', '2026-04-16 11:30:00') ,
  ('pr_1713200000004', 'dave@example.com', '/analytics', '数据分析工作需要', 'approved', NULL, 'admin@example.com', '2026-04-15 16:30:00', '2026-04-15 14:00:00') ,
  ('pr_1713200000005', 'eve@example.com', '/admin/rbac', '需要管理团队成员权限', 'approved', NULL, 'wecom-link', '2026-04-14 11:00:00', '2026-04-14 09:00:00') ,
  ('pr_1713200000006', 'frank@example.com', '/finance/export', '财务对账需要导出数据', 'rejected', '该页面仅限财务部门访问，请联系财务负责人开通', 'admin@example.com', '2026-04-13 15:00:00', '2026-04-13 10:00:00') ,
  ('pr_1713200000007', 'grace@example.com', '/dashboard', NULL, 'rejected', '申请信息不完整，请补充申请原因后重新提交', 'admin@example.com', '2026-04-12 09:00:00', '2026-04-12 08:30:00') ,
  ('pr_1713200000008', 'henry@example.com', '/monitor/alerts', '负责系统告警监控，需要查看告警列表', 'approved', NULL, 'admin@example.com', '2026-04-11 14:30:00', '2026-04-11 13:00:00') ,
  ('pr_1713200000009', 'iris@example.com', '/reports/monthly', '月度汇报需要', 'approved', NULL, 'redacted3@example.com', '2026/5/6 10:26:27', '2026-04-16 14:00:00') ,
  ('pr_1713200000010', 'jack@example.com', '/settings/webhooks', '需要配置企微通知 Webhook', 'approved', NULL, 'redacted3@example.com', '2026/4/16 16:58:48', '2026-04-16 15:45:00');
