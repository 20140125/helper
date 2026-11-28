---
name: amap
description: 高德地图能力总入口——POI 搜索、路线规划、地理编码（地址↔坐标）、输入提示、行政区划、静态地图出图（当前 Key 仅开通驾车/步行）；用户问「附近有什么」「从 A 到 B 多久」「XX 的坐标」「这个经纬度是哪儿」「出张地图」时加载
effect: read
tools:
  - amap_poi
  - amap_route
  - amap_geocode
  - amap_inputtips
  - amap_district
  - amap_static_map
---

# 高德地图查询

## 什么时候用

| 用户想干什么 | 工具 |
|---------|------|
| 「附近有什么吃的」「最近的加油站在哪」「某商场地址」 | `amap_poi` |
| 「从 A 到 B 多久」「开车多少公里」 | `amap_route` |
| 「XX 的坐标是多少」「这个经纬度是哪儿」 | `amap_geocode` |
| 「帮我确认这个地点叫什么 / 有哪些候选」 | `amap_inputtips` |
| 「深圳有哪些区」「XX 的行政区划编码」 | `amap_district` |
| 「看看在哪」「出张地图」「标一下位置」 | `amap_static_map` |

**禁止凭模型知识估算路程、耗时、坐标或编造商户地址**——必须查。

## amap_poi：地点搜索

- `keywords` 关键字；给 `location` 时按该点周边查找，可指定半径
- 返回：名称、地址、距离、类型、坐标、电话
- 距离是相对给定 `location` 的；没给 `location` 时按城市搜

## amap_route：路线规划

- 返回距离、预计耗时与关键步骤
- 起点终点支持中文地址或 `经度,纬度`
- `mode`：`driving` 驾车 / `walking` 步行 / `bicycling` 骑行 / `transit` 公交地铁

## amap_geocode：地址 ↔ 坐标

- 传 `address` → 正向解析出 `经度,纬度`（结果写入数据库 `amap_geocode.json` 缓存键，与通勤脚本共用，重复查询不耗额度）
- 传 `location`（`经度,纬度`）→ 逆地理编码出详细地址、省市区与 adcode
- 解析不出来时补 `city` 或换更完整的地址，不要自己猜坐标

## amap_inputtips：地点候选

- 给关键字返回候选（名称 / 所属区县 / 详细地址，部分带坐标），默认 8 条
- 只用于确认「具体是哪个地点」；要商户详情、电话、距离走 `amap_poi`
- 不限定 `city` 时是全国检索（在深圳也能搜到「孝感站」）

## amap_district：行政区划

- 返回省/市/区的 `adcode`、级别与中心坐标；`subdistrict=1` 带下一级
- adcode 可直接喂给天气等下游接口

## amap_static_map：出一张地图

- 返回**本站**图片地址 `/api/amap-static-map?...`，在回答里当图片展示即可
- 严禁自己拼 `restapi.amap.com` 的链接——那会把 AMAP_KEY 泄露出去；Key 只由服务端补
- `location` 支持中文地址（会自动解析成坐标），多个点用 `|` 分隔；可选 `zoom` / `size` / `markers` / `traffic`

## 实测限制（重要）

当前 Key **只开通了驾车与步行**：

- 骑行返回 `SERVICE_NOT_AVAILABLE`
- 公交 / 地铁返回权限不足

被问到地铁 / 公交 / 骑行时：先用默认方式尝试，**失败就如实告诉用户该出行方式未开通**，
不要换参数硬试、更不要自己估算一个耗时。

## 相关

通勤路况卡片（家 ↔ 公司）走 `card_skill` 的 `commute` 技能，不走本工具。

`commute` 的起终点由贾维斯直接传文本，支持三种写法：

- 中文地址（脚本会调地理编码，结果缓存在数据库 `amap_geocode.json` 缓存键）
- `经度,纬度`（坐标直通，最省额度）
- `地名|经度,纬度`（脚本取管道后的坐标，卡片上只显示地名）

默认值：不传 `from` 用「家」、不传 `to` 用「公司」，取自 `.env` 的 `AMAP_HOME_ADDR` / `AMAP_WORK_ADDR`
（这两项由用户在**系统配置页**用地图选点维护，页面能力，不是本工具职责）。

用户没说具体地点时不要替他猜坐标——用默认值（家/公司）或先问一句。
