import type { I18nLang } from '@/types/i18n';

/** 语言管理列表默认返回条数（页面不分页，与后端 I18N_MESSAGES_PAGE_SIZE 对齐） */
export const I18N_MESSAGES_PAGE_SIZE = 500;

/** 中英对照列表每页条数（成对编辑一次渲染两列输入框，分页避免首屏过重的表格） */
export const I18N_PAIRS_PAGE_SIZE = 50;

/** 默认筛选命名空间（保留兼容；中英对照页默认展示全部分组） */
export const I18N_DEFAULT_NAMESPACE = 'aiChat';

/** 可切换的语言代码 */
export const I18N_LANG_CODES: I18nLang[] = ['zh', 'en'];
