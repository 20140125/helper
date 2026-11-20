import { PROJECT_DIR } from '@/utils/paths';

/** 自定义规则数据文件路径 */
export const RULES_FILE = `${PROJECT_DIR}/.cache/custom_rules.json`;

/** 支持的规则类型枚举 */
export const VALID_TYPES = ['date', 'weekday', 'lunar_date', 'countdown', 'monthly', 'daily', 'workday'] as const;

/**
 * 卡片技能的输出形态
 * @description text=取实时数据渲染成 Markdown 文本（默认，定时推送的主流形态）；
 *              card=委托脚本出 PNG 图片卡片（需要图片时才用）
 */
export const VALID_OUTPUT_MODES = ['text', 'card'] as const;

/** 自定义规则 */
export interface Rule {
  id: string;
  name: string;
  type: string;
  condition: string;
  time: string;
  message: string;
  /** 消息模板 ID（workday 类型可选，使用模板时无需填写 message） */
  template_id?: string;
  enabled: boolean;
  webhookIds: string[];
  created_at: string;
  updated_at: string;
  custom_content: boolean;
  lastTriggeredAt: string;
  /** 卡片技能的输出形态：text=数据文本（默认）/ card=图片卡片 */
  output_mode?: typeof VALID_OUTPUT_MODES[number];
}

/** 创建规则请求体 */
export interface CreateRuleBody {
  name?: string;
  type?: string;
  condition?: string;
  time?: string;
  message?: string;
  /** 消息模板 ID（workday 类型可选，使用模板时无需填写 message） */
  template_id?: string;
  enabled?: boolean;
  webhookIds?: string[];
  custom_content?: boolean;
  /** 卡片技能的输出形态：text=数据文本（默认）/ card=图片卡片 */
  output_mode?: string;
}
