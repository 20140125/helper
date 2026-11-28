/** 运行列表默认每页条数 */
export const AI_CHAT_ADMIN_PAGE_SIZE = 15;

/** 统计范围：仅自己 */
export const AI_CHAT_ADMIN_SCOPE_ME = 'me';

/** 统计范围：全部用户（需管理员权限，后端会校验） */
export const AI_CHAT_ADMIN_SCOPE_ALL = 'all';

/** 可选统计天数（后端按 1~90 夹紧） */
export const AI_CHAT_ADMIN_DAYS_VALUES: readonly number[] = [7, 14, 30, 60, 90];

/** 拥有任一权限即可查看全量数据（与后端 ADMIN_LIKE_PERMISSIONS 保持一致） */
export const AI_CHAT_ADMIN_PERMISSIONS: string[] = ['rbac:view', 'rbac:edit'];

/** 回话内容范围：仅本次运行 */
export const AI_CHAT_ADMIN_MESSAGE_SCOPE_RUN = 'run';

/** 回话内容范围：完整会话 */
export const AI_CHAT_ADMIN_MESSAGE_SCOPE_CONVERSATION = 'conversation';

/** 详情面板 Tab 值 */
export const AI_CHAT_ADMIN_TAB_STEPS = 'steps';
export const AI_CHAT_ADMIN_TAB_MESSAGES = 'messages';
export const AI_CHAT_ADMIN_TAB_TOOLS = 'tools';
