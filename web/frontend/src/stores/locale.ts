import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { zh } from '@/locales/zh';
import { en } from '@/locales/en';
import type { Locale } from '@/locales/zh';

// ==============================
// 支持的语言类型
// ==============================

export type LangCode = 'zh' | 'en';

const LOCALE_STORAGE_KEY = 'helper_locale';

const LOCALES: Record<LangCode, Locale> = { zh, en };

// ==============================
// Locale Store
// ==============================

export class LocaleStore {
  /** 当前语言代码 */
  lang = ref<LangCode>(
    (localStorage.getItem(LOCALE_STORAGE_KEY) as LangCode | null) ?? 'zh',
  );

  /** 当前语言文案对象 */
  t = computed<Locale>(() => LOCALES[this.lang.value]);

  /** 当前语言下的表单默认 labelWidth
   * @description 中文 200px，英文宽度翻倍所以需要 300px，供 AutoForm / 业务表单组件统一读取
   */
  formLabelWidth = computed<string>(() => (this.lang.value === 'en' ? '300px' : '200px'));

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
