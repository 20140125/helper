import { PermissionType, type IPermissionFormData, type IRoleFormData, type IUserRoleFormData } from "@/types/rbac";
import type { IApiItemFormData, IApiCategoryFormData } from "@/types/api-management";
import type { IGreetingFormData } from "@/types/greetings";
import type { IReminderQuoteFormData } from "@/types/reminder-quotes";
import type { IWebhookInlineFormData } from "@/types/config";

/**
 * 权限表单数据
 * @type {IPermissionFormData}
 */
export const PermissionFormData: IPermissionFormData = {
  code: '',
  group_id: '',
  group_name: '',
  label: '',
  description: '',
  type: PermissionType.View,
  route: '',
  route_select: '',
  _isEditing: false,
};

/**
 * 角色表单数据
 * @type {IRoleFormData}
 */
export const RoleFormData: IRoleFormData = {
  name: '',
  description: '',
  permissions: [],
};

/**
 * 用户角色表单数据
 * @type {IUserRoleFormData}
 */
export const UserRoleFormData: IUserRoleFormData = {
  email: '',
  roleId: '',
};

/**
 * API 条目表单数据
 * @type {IApiItemFormData}
 * @description 用于 API 管理抽屉新增态的初始默认值；method 默认 GET、enabled 默认 true、其余字段为空
 */
export const ApiItemFormData: IApiItemFormData = {
  category_id: '',
  item_key: '',
  name: '',
  method: 'GET',
  path: '',
  description: '',
  enabled: true,
};

/**
 * API 分类表单数据
 * @type {IApiCategoryFormData}
 */
export const ApiCategoryFormData: IApiCategoryFormData = {
  name: '',
  category_key: '',
  description: '',
};

/**
 * 节日祝福语表单数据
 * @type {IGreetingFormData}
 * @description 默认分组取 solar_terms（节气），与原 openCreate 行为一致
 */
export const GreetingFormData: IGreetingFormData = {
  group: 'solar_terms',
  name: '',
  content: '',
};

/**
 * 提醒寄语表单数据
 * @type {IReminderQuoteFormData}
 * @description bucket 由调用方根据当前筛选/默认 bucket 动态注入，此处仅给出 content 默认空值
 */
export const ReminderQuoteFormData: IReminderQuoteFormData = {
  content: '',
};

/**
 * Webhook 行内表单数据
 * @type {IWebhookInlineFormData}
 */
export const WebhookInlineFormData: IWebhookInlineFormData = {
  name: '',
  url: '',
  style: '',
};