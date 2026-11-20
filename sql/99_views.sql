
-- ============================================================
-- 21. 创建视图：便捷查询
-- ============================================================

-- 视图：用户完整信息（含角色）
CREATE OR REPLACE VIEW `hp_v_user_info` AS
SELECT
  u.id,
  u.email,
  u.is_admin,
  r.role_key,
  r.name AS role_name,
  u.first_login_at,
  u.last_login_at
FROM `hp_users` u
LEFT JOIN `hp_user_roles` ur ON u.id = ur.user_id
LEFT JOIN `hp_roles` r ON ur.role_id = r.id;

-- 视图：角色权限详情
CREATE OR REPLACE VIEW `hp_v_role_permissions` AS
SELECT
  r.id AS role_id,
  r.role_key,
  r.name AS role_name,
  p.code AS permission_code,
  p.group_id,
  p.group_name,
  p.label AS permission_label
FROM `hp_roles` r
JOIN `hp_role_permissions` rp ON r.id = rp.role_id
JOIN `hp_permissions` p ON rp.permission_id = p.id
ORDER BY r.role_key, p.group_id;

-- 视图：规则与 Webhook 详情
CREATE OR REPLACE VIEW `hp_v_rule_details` AS
SELECT
  cr.id,
  cr.rule_key,
  cr.name AS rule_name,
  cr.type,
  cr.condition_value,
  cr.time,
  cr.template_id,
  cr.enabled,
  cr.last_triggered_at,
  w.webhook_key,
  w.name AS webhook_name,
  w.style AS webhook_style
FROM `hp_custom_rules` cr
LEFT JOIN `hp_rule_webhooks` rw ON cr.id = rw.rule_id
LEFT JOIN `hp_webhooks` w ON rw.webhook_id = w.id;

-- 视图：2026 年假期一览
CREATE OR REPLACE VIEW `hp_v_holidays_2026` AS
SELECT
  date,
  name,
  CASE WHEN is_holiday = 1 THEN '放假' ELSE '补班' END AS status,
  CASE wage WHEN 3 THEN '三倍工资' WHEN 2 THEN '双倍工资' ELSE '正常工资' END AS wage_desc,
  target AS related_holiday
FROM `hp_holiday_data`
WHERE year = 2026
ORDER BY date;

-- ============================================================
-- 完成
-- ============================================================
SELECT '✅ Helper 数据库初始化完成！' AS message;
SELECT CONCAT('📊 共创建 ', COUNT(*), ' 张表') AS summary
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE';
