import type { HandlerRegistry } from '@/types/handler-registry';
import PROVINCE_CITY_DATA from '@/data/city-data';
import { getLocaleText, isEditing, type FormData } from './shared';

/** 根据选中省份返回对应城市列表 */
const buildCityOptions = (data: FormData) => {
  const province = PROVINCE_CITY_DATA.find((p) => p.value === data._selectedProvince);
  return province ? province.cities : [];
};

/** Webhook URL 校验规则 */
const buildWebhookUrlRules = (editingWebhookId: string | null | undefined) => {
  const t = getLocaleText().config;
  return [
    { required: !editingWebhookId, message: t.webhookUrlRequired },
    { url: {}, message: t.webhookUrlInvalid },
  ];
};

/**
 * 生日提前天数下拉选项（0~3 天）
 * @description label 通过 locale 动态生成，切换语言时自动刷新；供 config-birthday 表单复用。
 */
const buildAdvanceDaysOptions = () => {
  const schema = getLocaleText().playground.schema as Record<string, string>;
  return [0, 1, 2, 3].map((n) => ({
    value: String(n),
    label: schema[`daysAhead${n}`] ?? `${n}`,
  }));
};

/**
 * 创建配置页面的 handler 注册表
 * @description 将配置页面的所有动态逻辑集中注册，供 config 页面和 playground 等场景复用
 * @param options - 可选配置
 * @param options.isEditing - 是否处于编辑状态（保留以兼容历史签名，当前实际通过 data._isEditing 读取）
 * @param options.editingWebhookId - 当前编辑中的 Webhook id（用于 URL 校验规则）
 * @returns HandlerRegistry 配置相关的 handler 注册表
 */
export const createConfigHandlers = (options?: {
  isEditing?: boolean;
  editingWebhookId?: string | null;
}): HandlerRegistry => ({
  // ── 密码切换（编辑时显示明文，非编辑时显示密码） ──
  'config.passwordToggle': (data: FormData) => isEditing(data) ? 'text' : 'password',

  // ── 省份下拉选项 ──
  'config.provinceOptions': PROVINCE_CITY_DATA.map((p) => ({ value: p.value, label: p.label })),

  // ── 切换省份时清空城市 ──
  'config.onProvinceChange': (_val: unknown, data: FormData) => {
    data.WEATHER_CITY_NAME = '';
  },

  // ── 城市是否禁用（未选省份时禁用） ──
  'config.cityDisabled': (data: FormData) => !data._selectedProvince,

  // ── 城市下拉选项（根据选中省份动态返回） ──
  'config.cityOptions': buildCityOptions,

  // ── 生日提前天数下拉选项（0~3 天） ──
  'config.advanceDaysOptions': buildAdvanceDaysOptions,

  // ── 信息卡片时区下拉选项 ──
  'config.timezoneOptions': [
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
    { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (UTC+8)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8)' },
    { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
    { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
    { value: 'UTC', label: 'UTC (UTC+0)' },
  ],

  // ── Webhook URL 验证规则（编辑时非必填，新增时必填） ──
  'config.webhookUrlRules': buildWebhookUrlRules(options?.editingWebhookId),
});
