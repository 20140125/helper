import type { I18nLang } from '@/types/i18n';

/** 语言管理列表默认返回条数（页面不分页，与后端 I18N_MESSAGES_PAGE_SIZE 对齐） */
export const I18N_MESSAGES_PAGE_SIZE = 500;

/** 默认筛选命名空间（不再提供「全部分组」，页面只加载该分组文案） */
export const I18N_DEFAULT_NAMESPACE = 'aiChat';

/** 可切换的语言代码 */
export const I18N_LANG_CODES: I18nLang[] = ['zh', 'en'];
