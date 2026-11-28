import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { createI18nService } from '@/services/i18n-service';
import { parseTemplateFunction } from '@/utils/i18n-template';
import type { I18nTranslation, I18nTranslationsMap } from '@/types/i18n';
import type { Locale } from '@/types/locale';

// ==============================
// 支持的语言类型
// ==============================

export type LangCode = 'zh' | 'en';

const LOCALE_STORAGE_KEY = 'helper_locale';

/** 库内语言包缓存键：数据库不可用时用上一次成功加载的数据兜底 */
const LOCALE_CACHE_KEY = 'helper_i18n_messages';

/** 空兜底：数据库不可用且无缓存时，避免访问 t 报错 */
const EMPTY_LOCALE = {} as Locale;

/** 缓存结构：直接保存后端返回的一次性 zh / en 扁平记录（可 JSON 序列化） */
type LocaleCache = I18nTranslationsMap;

/**
 * 按精确层级路径写入一条文案
 * @param {Record<string, unknown>} target - 语言包根对象
 * @param {string[]} path - path_json 给出的层级路径
 * @param {unknown} value - 静态文案或安全还原后的插值函数
 * @returns {void} 无返回值
 * @description 下一级为数字下标时自动创建数组，键名自带点号的词条也能准确落位
 */
const assignPath = (target: Record<string, unknown>, path: string[], value: unknown): void => {
  if (path.length === 0) return;
  let node = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    if (!node[key] || typeof node[key] !== 'object') {
      node[key] = /^\d+$/.test(path[i + 1] ?? '') ? [] : {};
    }
    node = node[key] as Record<string, unknown>;
  }
  node[path[path.length - 1]] = value;
};

/**
 * 用库内文案构建运行时语言包
 * @param {I18nTranslation[]} messages - 后端返回的扁平记录
 * @returns {Locale} 完整语言包对象
 * @description 静态文案与插值函数都来自数据库；函数走受限表达式解析，非法源码跳过
 */
const buildLocale = (messages: I18nTranslation[]): Locale => {
  const base: Record<string, unknown> = {};
  for (const item of messages) {
    if (!Array.isArray(item.path) || item.path.length === 0) continue;
    const value = item.valueType === 'function' ? parseTemplateFunction(item.value) : item.value;
    if (value === undefined) continue;
    assignPath(base, item.path, value);
  }
  return base as unknown as Locale;
};

/**
 * 读取 localStorage 中的语言包缓存
 * @returns {Partial<Record<LangCode, Locale>> | null} 缓存构建的语言包，失败返回 null
 * @description 启动时同步读取，保证刷新页面瞬间就有文案；数据损坏时静默忽略
 */
const readCache = (): Partial<Record<LangCode, Locale>> | null => {
  try {
    const raw = localStorage.getItem(LOCALE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocaleCache>;
    return {
      zh: buildLocale(parsed.zh ?? []),
      en: buildLocale(parsed.en ?? []),
    };
  } catch {
    return null;
  }
};

// ==============================
// Locale Store
// ==============================

export class LocaleStore {
  /** 当前语言代码 */
  lang = ref<LangCode>(
    (localStorage.getItem(LOCALE_STORAGE_KEY) as LangCode | null) ?? 'zh',
  );

  /** 当前生效的语言包（启动时先取缓存，库数据到达后整体替换） */
  dbLocales = shallowRef<Partial<Record<LangCode, Locale>>>(readCache() ?? {});

  /** 是否正在从数据库加载语言包 */
  dbLoading = ref<boolean>(false);

  /** 当前语言文案对象 */
  t = computed<Locale>(() => this.dbLocales.value[this.lang.value] ?? EMPTY_LOCALE);

  /** 当前语言下的表单默认 labelWidth
   * @description 中文 200px，英文宽度翻倍所以需要 300px，供 AutoForm / 业务表单组件统一读取
   */
  formLabelWidth = computed<string>(() => (this.lang.value === 'en' ? '300px' : '200px'));

  /**
   * 从数据库加载全部语言包
   * @returns {Promise<void>} 无返回值
   * @description 一次请求取回 zh / en；成功时写入 localStorage 缓存，失败时保留缓存，不再依赖内置语言包文件
   */
  loadFromDatabase = async (): Promise<void> => {
    this.dbLoading.value = true;
    try {
      const res = await createI18nService().fetchTranslations();
      const messages: LocaleCache = res.data?.translations ?? { zh: [], en: [] };
      this.dbLocales.value = {
        zh: buildLocale(messages.zh ?? []),
        en: buildLocale(messages.en ?? []),
      };
      try {
        localStorage.setItem(LOCALE_CACHE_KEY, JSON.stringify(messages));
      } catch (err) {
        console.warn('[locale] 语言包缓存写入失败：', err);
      }
    } catch (err) {
      console.warn('[locale] 数据库语言包加载失败，使用本地缓存：', err);
      this.dbLocales.value = readCache() ?? this.dbLocales.value;
    } finally {
      this.dbLoading.value = false;
    }
  };

  /**
   * 重新加载数据库语言包
   * @returns {Promise<void>} 无返回值
   * @description 语言管理页保存文案后调用，让当前会话立即用上新文案
   */
  reload = (): Promise<void> => this.loadFromDatabase();

  /** 切换语言 */
  toggle = (): void => {
    this.lang.value = this.lang.value === 'zh' ? 'en' : 'zh';
    localStorage.setItem(LOCALE_STORAGE_KEY, this.lang.value);
  };

  /** 设置语言 */
  setLang = (code: LangCode): void => {
    this.lang.value = code;
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
  };
}

export const useLocaleStore = defineStore('locale', () => {
  const store = new LocaleStore();
  return {
    ...store,
  };
});
