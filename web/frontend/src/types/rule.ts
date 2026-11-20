import type { ApiResponse } from './api';

/** 规则类型枚举 */
export enum RuleType {
  Date = 'date',
  Weekday = 'weekday',
  LunarDate = 'lunar_date',
  Countdown = 'countdown',
  Monthly = 'monthly',
  Daily = 'daily',
  Workday = 'workday',
}

/** 规则类型选项 */
export interface RuleTypeOption {
  /** 类型值 */
  value: RuleType;
  /** 显示标签 */
  label: string;
  /** 图标 */
  icon: string;
  /** 描述 */
  desc: string;
}

/** 自定义规则 */
export interface Rule {
  id: string;
  name: string;
  type: RuleType;
  condition: string;
  time: string;
  message: string;
  /** 消息模板类型 */
  template_id?: string;
  /** 是否使用自定义内容（true 用 message，false 用 template_id） */
  custom_content?: boolean;
  /** 卡片技能的输出形态：text=数据文本（默认）/ card=图片卡片 */
  output_mode?: 'text' | 'card';
  enabled: boolean;
  webhookIds: string[];
  created_at: string;
  updated_at: string;
  /** 最后触发时间（YYYY-MM-DDTHH:mm:ss，由执行脚本写入） */
  lastTriggeredAt: string;
}

/** 创建/更新规则的请求体 */
export type RulePayload = Omit<Rule, 'id' | 'created_at' | 'updated_at' | 'lastTriggeredAt'>;

/** 规则列表响应 */
export type RulesResponse = ApiResponse<{ rules: Rule[] }>;

/** 单条规则响应 */
export type RuleResponse = ApiResponse<{ rule: Rule }>;

/** 规则操作结果（无数据返回） */
export type RuleResult = ApiResponse;

/** 规则测试结果 */
export type RuleTestResult = ApiResponse<{ stdout: string; stderr: string }>;

/** 规则表单的扁平化数据结构 */
export interface RuleFlatFormData {
  name: string;
  type: RuleType;
  dateCondition: string;
  weekdayCondition: string;
  lunarMonth: string;
  lunarDay: string;
  /** 农历日期聚合字段（lunarMonth + '-' + lunarDay），用于 group 必填校验 */
  lunarDate: string;
  countdownDate: string;
  countdownDays: string;
  monthlyDay: string;
  time: string;
  message: string;
  template_id: string;
  /** 是否使用自定义内容（true 用 message，false 用 template_id） */
  custom_content: boolean;
  enabled: boolean;
  webhookIds: string[];
  [key: string]: unknown;
}

/** 规则表单数据结构 */
export interface RuleFormData {
  /** 规则名称 */
  name: string;
  /** 触发类型 */
  type: RuleType;
  /** 触发条件 */
  condition: string;
  /** 执行时间（HH:mm 格式） */
  time: string;
  /** 提醒内容 */
  message: string;
  /** 消息模板类型 */
  template_id?: string;
  /** 是否使用自定义内容（true 用 message，false 用 template_id） */
  custom_content?: boolean;
  /** 是否启用 */
  enabled: boolean;
  /** 指定通知群 ID 列表，空数组表示发送到所有群 */
  webhookIds: string[];
}


