/**
 * Handler Registry 门面文件
 * @description 统一 re-export 各业务 handler 工厂函数，保持对外调用零变更。
 *              各业务具体实现位于 ./handler-registry/ 目录下：
 *              - rules.ts            规则表单
 *              - config.ts           配置页面
 *              - rbac.ts             RBAC 权限管理
 *              - api-management.ts   API 管理
 *              - message-templates.ts 消息模板
 *              - greetings.ts        节日祝福语
 *              - reminder-quotes.ts  提醒寄语库
 *              - merge.ts            注册表合并工具
 *              - shared.ts           通用谓词 / 规则生成器 / locale 访问
 */

export { createRuleHandlers } from './handler-registry/rules';
export { createConfigHandlers } from './handler-registry/config';
export { createRbacHandlers } from './handler-registry/rbac';
export { createApiManagementHandlers } from './handler-registry/api-management';
export { createMessageTemplatesHandlers } from './handler-registry/message-templates';
export { createGreetingsHandlers } from './handler-registry/greetings';
export { createReminderQuotesHandlers } from './handler-registry/reminder-quotes';
export { mergeHandlerRegistries } from './handler-registry/merge';
