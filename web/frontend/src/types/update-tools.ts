import type { ApiResponse } from './api';

/** update-tools 脚本的单个参数定义 */
export interface UpdateToolParam {
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
  /** 参数类型，默认为文本输入；date-array 表示多日期选择器；select 表示下拉选择器 */
  type?: 'date-array' | 'select';
  /** 下拉选项，type 为 select 时使用 */
  options?: Array<{ label: string; value: string }>;
}

/** update-tools 脚本配置 */
export interface UpdateToolScript {
  key: string;
  label: string;
  filename: string;
  params: UpdateToolParam[];
}

/** update-tools 脚本 key */
export type UpdateToolKey =
  | 'get_holidays'
  | 'apply_tencent_policy'
  | 'generate_holiday_config'
  | 'update_month_config'
  | 'send_update_notification';

/** update-tools 脚本列表响应 */
export type UpdateToolsResult = ApiResponse<{ scripts: UpdateToolScript[] }>;
