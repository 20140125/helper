import type { AutoFormField, AutoFormGroupChild } from '@/types/auto-form';
import type { HandlerRegistry } from '@/types/handler-registry';
import { useLocaleStore } from '@/stores/locale';

export type { HandlerRegistry } from '@/types/handler-registry';

/** $handler: 前缀 */
const HANDLER_PREFIX = '$handler:';

/** $t: 前缀（i18n key 引用） */
const I18N_PREFIX = '$t:';

/**
 * 判断一个值是否为 $handler:xxx 标记
 */
const isHandlerRef = (val: unknown): val is string =>
  typeof val === 'string' && val.startsWith(HANDLER_PREFIX);

/**
 * 从 $handler:xxx 标记中提取 handler 名称
 */
const extractHandlerName = (val: string): string =>
  val.slice(HANDLER_PREFIX.length);

/**
 * 判断一个值是否为 $t:xxx 标记
 */
const isI18nRef = (val: unknown): val is string =>
  typeof val === 'string' && val.startsWith(I18N_PREFIX);

/**
 * 按点号路径从 locale 对象中取值
 * @param obj - locale 对象（如 zh）
 * @param path - 点号分隔的路径，如 "playground.schema.ruleNameLabel"
 * @returns 对应文案，未命中时返回路径本身（便于排查）
 */
const getByPath = (obj: unknown, path: string): string => {
  const keys = path.split('.');
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur && typeof cur === 'object' && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k];
    } else {
      console.warn(`[field-enhancer] i18n key "${path}" 未在语言包中找到`);
      return path;
    }
  }
  if (typeof cur === 'string') return cur;
  console.warn(`[field-enhancer] i18n key "${path}" 指向的不是字符串`);
  return path;
};

/**
 * 解析 $t:xxx 标记为当前语言对应的文案
 * @description 在取值时读取 useLocaleStore().t（computed），语言切换会随 computed 传导
 * @param val - 待解析的值
 * @returns 若为 $t:xxx 则返回对应文案，否则原样返回
 */
export const resolveI18nString = (val: unknown): unknown => {
  if (!isI18nRef(val)) return val;
  const path = val.slice(I18N_PREFIX.length);
  return getByPath(useLocaleStore().t, path);
};

/**
 * 深度解析对象/数组中的 $t:xxx 标记
 * @description 供 auto-form 组件在渲染时调用，递归替换所有 $t:xxx 为当前语言文案。
 *              读取时经过 useLocaleStore().t (computed)，语言切换会自动响应。
 * @param val - 任意值
 * @returns 深度替换 $t:xxx 后的值（保持结构不变）
 */
export const deepResolveI18n = (val: unknown): unknown => {
  if (isI18nRef(val)) return resolveI18nString(val);
  if (Array.isArray(val)) return val.map((item) => deepResolveI18n(item));
  if (val && typeof val === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      result[k] = deepResolveI18n(v);
    }
    return result;
  }
  return val;
};

/**
 * 解析单个值：
 * 1. 若为 $handler:xxx → 从注册表中查找替换
 * 2. 否则原样返回（$t:xxx 保留原值，由 auto-form 组件渲染时实时解析，跟随语言切换）
 */
const resolveValue = (val: unknown, registry: HandlerRegistry): unknown => {
  if (isHandlerRef(val)) {
    const name = extractHandlerName(val);
    if (!(name in registry)) {
      console.warn(`[field-enhancer] handler "${name}" 未在注册表中找到`);
      return val;
    }
    return registry[name];
  }
  return val;
};

/**
 * 增强 group 子字段
 * @description label / placeholder 中的 $t:xxx 保留原值，
 *              由 auto-form 组件在渲染时实时解析，使其跟随语言切换
 */
const enhanceChild = (child: Record<string, unknown>, registry: HandlerRegistry): AutoFormGroupChild => {
  const result = { ...child };
  // 需要增强的动态属性（options 里可能含 $t:，交由 deepResolveI18n 内部保留 $t: 原值）
  const dynamicKeys = ['options', 'disabled', 'onChange'] as const;
  for (const key of dynamicKeys) {
    if (key in result) {
      result[key] = resolveValue(result[key], registry);
    }
  }
  // label / placeholder：保留 $t:xxx 原值（由 auto-form 渲染时实时解析）
  return result as unknown as AutoFormGroupChild;
};

/**
 * 增强单个字段配置
 * @description 遍历字段的所有动态属性，将 $handler:xxx 替换为注册表中的真实值，
 *              同时将 label / placeholder / help / rules.message 等静态文案中的 $t:xxx 替换为当前语言文案
 */
const enhanceField = (field: Record<string, unknown>, registry: HandlerRegistry): AutoFormField => {
  const result = { ...field };

  // 需要增强的动态属性列表（支持 $handler: 引用）
  const dynamicKeys = [
    'inputType', 'options', 'disabled', 'visible', 'onChange',
    'rules', 'treeData', 'disabledDate', 'uploadRequestMethod',
  ] as const;

  for (const key of dynamicKeys) {
    if (key in result) {
      result[key] = resolveValue(result[key], registry);
    }
  }

  // help 特殊处理：仅解析 $handler: 引用，保留 $t:xxx 原样
  // 原因：help 支持语言响应式切换，$t:xxx 必须延迟到渲染时再解析，
  //      否则 enhanceFields 只在字段加载时调用一次，语言切换后文案无法更新
  if ('help' in result) {
    const helpVal = result.help;
    if (isHandlerRef(helpVal)) {
      const name = extractHandlerName(helpVal);
      if (name in registry) {
        result.help = registry[name];
      } else {
        console.warn(`[field-enhancer] handler "${name}" 未在注册表中找到`);
      }
    }
    // 非 $handler: 的情况（含 $t:、普通字符串、函数）保持原值，交由运行时处理
  }

  // label / placeholder：保留 $t:xxx 原值（由 auto-form 渲染时实时解析，使其跟随语言切换）

  // 递归增强 children（group 类型）
  if (Array.isArray(result.children)) {
    result.children = (result.children as Record<string, unknown>[]).map(
      (child) => enhanceChild(child, registry),
    );
  }

  return result as unknown as AutoFormField;
};

/**
 * 增强字段配置列表
 * @description 核心 API：传入从 JSON 读取的原始 fields 和 handler 注册表，
 *              返回注入了动态逻辑的 AutoFormField[]
 *
 * @param {unknown[]} rawFields - 从 JSON/API 读取的原始字段配置
 * @param {HandlerRegistry} registry - handler 注册表，键为 handler 名称，值为对应的函数/数据
 * @returns {AutoFormField[]} 增强后的字段配置，可直接传给 auto-form 组件
 *
 * @example
 * ```ts
 * const registry: HandlerRegistry = {
 *   'config.passwordToggle': (data) => data._isEditing ? 'text' : 'password',
 *   'config.provinceOptions': PROVINCE_CITY_DATA.map(p => ({ value: p.value, label: p.label })),
 * };
 * const fields = enhanceFields(rawFields, registry);
 * ```
 */
export const enhanceFields = (rawFields: unknown[], registry: HandlerRegistry): AutoFormField[] =>
  (rawFields as Record<string, unknown>[]).map((field) => enhanceField(field, registry));
