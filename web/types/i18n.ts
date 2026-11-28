// ==============================
// i18n 语言包入库 / 对接相关类型与常量
// @description 前后端共用的语言代码白名单、运行时文案结构与管理页列表结构
// ==============================

/** 支持的语言代码（对应 hp_i18n_messages 的 lang 列） */
export type I18nLang = 'zh' | 'en';

/** 语言代码白名单 */
export const I18N_LANGS: I18nLang[] = ['zh', 'en'];

/** 语言管理列表默认返回条数（页面不分页，配合筛选与关键字定位） */
export const I18N_MESSAGES_PAGE_SIZE = 500;

/** 语言管理列表最大返回条数 */
export const I18N_MESSAGES_MAX_PAGE_SIZE = 500;

/** 单条文案最大长度（防止绕过 TEXT 列写入超长内容） */
export const I18N_VALUE_MAX_LENGTH = 20000;

/** 文案值类型：text=静态文案，function=插值函数源码 */
export type I18nValueType = 'text' | 'function';

/** 前端运行时用的一条语言包记录 */
export interface I18nTranslation {
  /** 精确层级路径数组（可无歧义还原嵌套结构） */
  path: string[];
  /** 静态文案或插值函数源码 */
  value: string;
  /** 值类型 */
  valueType: I18nValueType;
}

/** 运行时语言包：按语言代码分组的扁平记录 */
export type I18nTranslationsMap = Record<I18nLang, I18nTranslation[]>;

/** 语言管理页的一条记录 */
export interface I18nMessage {
  /** 自增主键 */
  id: number;
  /** 语言代码 */
  lang: I18nLang;
  /** 点号拼接的键路径 */
  keyPath: string;
  /** 一级命名空间 */
  namespace: string;
  /** 静态文案或插值函数源码 */
  value: string;
  /** 值类型 */
  valueType: I18nValueType;
  /** 在语言包中的出现顺序 */
  sortOrder: number;
}

/** 语言管理列表结果 */
export interface I18nMessageList {
  /** 当前页记录 */
  items: I18nMessage[];
  /** 过滤后的总条数 */
  total: number;
  /** 当前语言下可用的命名空间 */
  namespaces: string[];
}

/** 语言管理列表查询参数 */
export interface I18nMessageQuery {
  /** 语言代码 */
  lang?: string;
  /** 命名空间 */
  namespace?: string;
  /** 键路径 / 文案关键字 */
  keyword?: string;
  /** 每页条数 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

/** 更新文案请求体 */
export interface UpdateI18nMessageBody {
  /** 新的静态文案 */
  value?: string;
}
