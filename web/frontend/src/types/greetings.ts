/** 节日祝福语分组 key */
export type GreetingsGroup = 'solar_terms' | 'holidays' | 'lunar_festivals' | 'special_days' | 'birthday';

/** 扯平化祝福语条目 */
export interface GreetingItem {
  /** 唯一 ID */
  id: string;
  /** 所属分组 */
  group: GreetingsGroup;
  /** 条目名称（可选，为空串时列表显示“未命名”） */
  name: string;
  /** 祝福语内容（Markdown） */
  content: string;
}
/** 创建祝福语请求体 */
export interface CreateGreetingPayload {
  /** 所属分组 */
  group: GreetingsGroup;
  /** 条目名称（可选） */
  name?: string;
  /** 祝福语内容 */
  content: string;
}

/** 更新祝福语请求体 */
export interface UpdateGreetingPayload {
  /** 所属分组 */
  group?: GreetingsGroup;
  /** 条目名称 */
  name?: string;
  /** 祝福语内容 */
  content?: string;
}

// ── 响应类型 ──

/** 获取祝福语列表响应 */
export interface GreetingsListResponse {
  /** 业务状态码 */
  code: number;
  /** 响应负载 */
  data: { items: GreetingItem[] };
  /** 响应描述 */
  message: string;
}

/** 单个祝福语响应（创建 / 更新） */
export interface GreetingResponse {
  /** 业务状态码 */
  code: number;
  /** 响应负载，可能不含 item（如删除后） */
  data: { item?: GreetingItem };
  /** 响应描述 */
  message: string;
}

/**
 * 祝福语表单数据类型
 * @description 用于祝福语管理抽屉（新增/编辑）的 v-model 绑定值
 */
export type IGreetingFormData = Partial<GreetingItem>;
