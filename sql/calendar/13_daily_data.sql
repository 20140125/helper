
-- ============================================================
-- 13. 每日数据缓存表 (daily_data_*.json)
-- ============================================================
CREATE TABLE `hp_daily_data` (
  `id`                   INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  `date`                 DATE            NOT NULL COMMENT '数据日期',
  `fetch_time`           DATETIME        NOT NULL COMMENT '数据获取时间',
  `weather`              TEXT            NULL     COMMENT '天气信息（Markdown 格式）',
  `history`              TEXT            NULL     COMMENT '历史上的今天（Markdown 格式）',
  `almanac`              TEXT            NULL     COMMENT '老黄历（Markdown 格式）',
  `horoscope`            TEXT            NULL     COMMENT '星座运势（Markdown 格式）',
  `inspirational_quote`  VARCHAR(500)    NULL     COMMENT '每日励志语录',
  `created_at`           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日数据缓存表';

INSERT INTO `hp_daily_data` (`date`, `fetch_time`, `weather`, `history`, `almanac`, `horoscope`, `inspirational_quote`) VALUES
('2026-04-01', '2026-04-01 01:00:14',
 '## 🌤️ 深圳天气||**当前温度**：22℃|**天气状况**：多云|**湿度**：88%|**风向风力**：北风 3-4级|**空气质量**：AQI 38||### 未来天气||📅 **2026-04-01**：阴转雷阵雨，22|📅 **2026-04-02**：雷阵雨，20/27℃|📅 **2026-04-03**：雷阵雨，20/25℃||💡 天气数据来自聚合数据',
 '## 📜 历史上的今天\n\n**4月1日**\n\n• **2023年** - JR北海道铁道线路留萌本线（留萌至石狩沼田）废止。\n• **2022年** - 東南水泥拆除廢棄工廠不慎壓毀高壓電塔。\n• **2019年** - 內閣官房長官菅義偉公布新年號為「令和」。\n• **2018年** - JR西日本铁道线路三江线废止。\n\n💡 **数据来源**：维基百科（100%真实数据）',
 '## 📅 今日黄历||**阳历**：2026-04-01|**农历**：丙午(马)年二月十四|**五行**：覆灯火||✅ **宜**：会亲友 理发 签订合同 交易 纳财 开业 安床 造仓 结网 开光 针灸|❌ **忌**：搬家 搬新房 栽种||**冲煞**：冲猪煞东',
 '## ✨ 今日星座运势（白羊座）||> **综合运势**: 75||**详细运势**：|- 💕 爱情运：65|- 💼 事业运：90|- 💰 财运：65|- 💪 健康运：73||**幸运提示**：|- 🎨 幸运色：草绿|- 🔢 幸运数字：33|- 🤝 速配星座：金牛座',
 '成功不是终点，失败也不是末日，唯有勇气才能永续。');
