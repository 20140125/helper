import { readEnvFile } from '@/utils/env';

/** 下拉选项定义 */
export interface UpdateToolParamOption {
  label: string;
  value: string;
}

/** 更新工具脚本的单个参数定义 */
export interface UpdateToolParam {
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
  type?: string;
  options?: UpdateToolParamOption[];
}

/** 更新工具脚本配置 */
export interface UpdateToolScript {
  filename: string;
  label: string;
  params: UpdateToolParam[];
  autoArgs?: (args: string[], year: string) => string[];
}

/**
 * update-tools 下允许触发的脚本及其参数说明
 * @description key 为脚本标识符，value 包含脚本路径、标签、参数构建函数及参数定义
 */
export const UPDATE_TOOLS_SCRIPTS: Record<string, UpdateToolScript> = {
  get_holidays: {
    filename: 'scripts/update-tools/get_holidays.sh',
    label: '获取节假日数据',
    autoArgs: (_args, year) => [year, 'holiday_data.json'],
    params: [],
  },
  generate_holiday_config: {
    filename: 'scripts/update-tools/generate_holiday_config.sh',
    label: '生成节假日配置文件',
    autoArgs: (args, year) => [
      year,
      'holiday_data.json',
      ...(args[0] ? [args[0]] : []),
    ],
    params: [
      { name: 'special_holiday', label: '特别假日期', placeholder: '选择日期（可多选）', required: false, type: 'date-array' },
    ],
  },
  update_month_config: {
    filename: 'scripts/update-tools/update_month_config.sh',
    label: '更新月份配置数据',
    autoArgs: (_args, year) => [year],
    params: [],
  },
  send_update_notification: {
    filename: 'scripts/update-tools/send_update_notification.sh',
    label: '发送更新通知',
    autoArgs: (args, year) => [
      year,
      args[0] ?? '',  // $2 holiday_status
      args[1] ?? '',  // $3 special_holiday
      args[2] ?? '',  // $4 month_status
      readEnvFile().WECOM_WEBHOOK ?? '',  // $5 webhook_url
    ],
    params: [
      { name: 'holiday_status', label: '节假日状态', placeholder: '请选择状态', required: true, type: 'select', options: [{ label: '✅ 成功', value: '✅ 成功' }, { label: '❌ 失败', value: '❌ 失败' }] },
      { name: 'special_holiday', label: '特别假日期', placeholder: '选择日期（可多选）', required: false, type: 'date-array' },
      { name: 'month_status', label: '月份配置状态', placeholder: '请选择状态', required: true, type: 'select', options: [{ label: '✅ 成功', value: '✅ 成功' }, { label: '❌ 失败', value: '❌ 失败' }] },
    ],
  },
};
