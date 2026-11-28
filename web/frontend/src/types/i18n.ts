// ==============================
// i18n 语言包对接相关类型
// @description 运行时读库、语言管理页列表与编辑接口的响应结构
// ==============================

/** 支持的语言代码 */
export type I18nLang = 'zh' | 'en';

/** 文案值类型：text=静态文案，function=插值函数源码（只读） */
export type I18nValueType = 'text' | 'function';

/** 运行时用的一条语言包记录 */
export interface I18nTranslation {
  /** 精确层级路径数组 */
  path: string[];
  /** 静态文案或插值函数源码 */
  value: string;
  /** 值类型 */
  valueType: I18nValueType;
}

/** 按语言分组的运行时语言包（一次返回 zh / en） */
export type I18nTranslationsMap = Record<I18nLang, I18nTranslation[]>;

/** 语言包响应 */
export interface I18nTranslationsResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { translations: I18nTranslationsMap };
  /** 提示信息 */
  message: string;
}

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
  /** 出现顺序 */
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
  lang?: I18nLang;
  /** 命名空间 */
  namespace?: string;
  /** 键路径 / 文案关键字 */
  keyword?: string;
  /** 每页条数 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

/** 语言管理列表响应 */
export interface I18nMessagesResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { result: I18nMessageList };
  /** 提示信息 */
  message: string;
}

/** 更新文案响应 */
export interface UpdateI18nMessageResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { id: number; value: string };
  /** 提示信息 */
  message: string;
}

/** 中英对照的一条文案（同一 key 的 zh / en 合并成一行） */
export interface I18nPair {
  /** 键路径 */
  keyPath: string;
  /** 一级命名空间 */
  namespace: string;
  /** 中文文案 */
  zh: string;
  /** 英文文案 */
  en: string;
  /** 是否含插值函数（只读） */
  hasFunction: boolean;
  /** 出现顺序 */
  sortOrder: number;
}

/** 中英对照列表结果 */
export interface I18nPairList {
  /** 当前页记录 */
  items: I18nPair[];
  /** 过滤后的总条数（按 key 去重） */
  total: number;
  /** 可用命名空间 */
  namespaces: string[];
}

/** 中英对照列表查询参数 */
export interface I18nPairQuery {
  /** 命名空间 */
  namespace?: string;
  /** 键路径 / 中文 / 英文关键字 */
  keyword?: string;
  /** 每页条数 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
}

/** 中英对照列表响应 */
export interface I18nPairsResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { result: I18nPairList };
  /** 提示信息 */
  message: string;
}

/** 一次保存中英文两条文案的响应 */
export interface UpdateI18nPairResponse {
  /** 业务状态码 */
  code: number;
  /** 响应数据 */
  data: { keyPath: string };
  /** 提示信息 */
  message: string;
}
