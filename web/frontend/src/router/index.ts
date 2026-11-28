import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '@/views/dashboard.vue';
import Trigger from '@/views/trigger.vue';
import Config from '@/views/config.vue';
import Logs from '@/views/logs.vue';
import Rules from '@/views/rules.vue';
import RbacRoles from '@/views/rbac-roles.vue';
import RbacUsers from '@/views/rbac-users.vue';
import RbacPermissions from '@/views/rbac-permissions.vue';
import AutoFormPlayground from '@/views/auto-form-playground.vue';
import MessageTemplates from '@/views/message-templates.vue';
import ApiManagement from '@/views/api-management.vue';
import ApiCategories from '@/views/api-categories.vue';
import Greetings from '@/views/greetings.vue';
import ReminderQuotes from '@/views/reminder-quotes.vue';
import Approvals from '@/views/approvals.vue';
import PermissionRequests from '@/views/permission-requests.vue';
import AiCost from '@/views/ai-cost.vue';
import AiModels from '@/views/ai-models.vue';
import Knowledge from '@/views/knowledge.vue';
import Database from '@/views/database.vue';
import I18nMessages from '@/views/i18n-messages.vue';
import Forbidden from '@/views/forbidden.vue';
import { useAuthStore } from '@/stores/auth';
import { useBootstrapStore } from '@/stores/bootstrap';
import { usePermissionStore } from '@/stores/permission';
import { Permission } from '@/types/permission';

export interface RouteMeta {
  label: string;
  icon?: string;
  /** 是否在侧边栏菜单中显示 */
  inMenu?: boolean;
  /** 页面所需的权限码（满足任一即可访问） */
  permissions?: Permission[];
  /** 是否仅超级管理员可访问（权限码之外的身份兜底） */
  superAdminOnly?: boolean;
  /** 侧边栏菜单分组名称（同名路由会归入同一分组） */
  menuGroup?: string;
}

// 扩展 vue-router 的 RouteMeta 类型，使 to.meta 自动包含自定义字段
declare module 'vue-router' {
  interface RouteMeta {
    label?: string;
    icon?: string;
    inMenu?: boolean;
    permissions?: Permission[];
    superAdminOnly?: boolean;
    menuGroup?: string;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    // ---- 概览 ----
    {
      path: '/dashboard',
      name: 'dashboard',
      component: Dashboard,
      meta: { label: 'menu.dashboard', icon: 'dashboard', inMenu: true, menuGroup: 'overview', permissions: [Permission.DASHBOARD_VIEW] } satisfies RouteMeta,
    },
    // ---- 功能管理 ----
    // 注：以下路由贾维斯已能全闭环操作（query_* / manage_*），菜单入口收起，
    //     仅保留直连 URL 与仪表盘跳转的兜底，后续确认无依赖再整体删除
    {
      path: '/rules',
      name: 'rules',
      component: Rules,
      meta: { label: 'menu.rules', icon: 'filter', inMenu: false, menuGroup: 'features', permissions: [Permission.RULES_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/logs',
      name: 'logs',
      component: Logs,
      meta: { label: 'menu.logs', icon: 'file-paste', inMenu: false, menuGroup: 'operations', permissions: [Permission.LOGS_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/config',
      name: 'config',
      component: Config,
      meta: { label: 'menu.config', icon: 'setting', inMenu: false, menuGroup: 'features', permissions: [Permission.CONFIG_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/message-templates',
      name: 'message-templates',
      component: MessageTemplates,
      meta: { label: 'menu.messageTemplates', icon: 'chat', inMenu: false, menuGroup: 'features', permissions: [Permission.TEMPLATES_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/interface-management',
      name: 'api-management',
      component: ApiManagement,
      meta: { label: 'menu.apiManagement', icon: 'api', inMenu: false, menuGroup: 'features', permissions: [Permission.API_MANAGEMENT_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/interface-categories',
      name: 'api-categories',
      component: ApiCategories,
      meta: { label: 'menu.apiCategories', icon: 'folder', inMenu: false, menuGroup: 'features', permissions: [Permission.API_CATEGORY_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/greetings',
      name: 'greetings',
      component: Greetings,
      meta: { label: 'menu.greetings', icon: 'gift', inMenu: false, menuGroup: 'features', permissions: [Permission.GREETINGS_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/reminder-quotes',
      name: 'reminder-quotes',
      component: ReminderQuotes,
      meta: { label: 'menu.reminderQuotes', icon: 'chat', inMenu: false, menuGroup: 'features', permissions: [Permission.REMINDER_QUOTES_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/trigger',
      name: 'trigger',
      component: Trigger,
      meta: { label: 'menu.trigger', icon: 'play-circle', inMenu: false, menuGroup: 'features', permissions: [Permission.TRIGGER_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/approvals',
      name: 'approvals',
      component: Approvals,
      meta: { label: 'menu.approvals', icon: 'check-circle', inMenu: true, menuGroup: 'features', permissions: [Permission.AI_APPROVALS_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/ai-cost',
      name: 'ai-cost',
      component: AiCost,
      meta: { label: 'menu.aiCost', icon: 'chart-bubble', inMenu: true, menuGroup: 'operations', permissions: [Permission.AI_CHAT_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/ai-models',
      name: 'ai-models',
      component: AiModels,
      meta: {
        label: 'menu.aiModels',
        icon: 'robot',
        inMenu: true,
        menuGroup: 'features',
        permissions: [Permission.AI_MODELS_VIEW],
        superAdminOnly: true,
      } satisfies RouteMeta,
    },
    {
      path: '/knowledge',
      name: 'knowledge',
      component: Knowledge,
      meta: {
        label: 'menu.knowledgeBase',
        icon: 'book',
        inMenu: true,
        menuGroup: 'features',
        permissions: [Permission.KNOWLEDGE_BASE_VIEW],
      } satisfies RouteMeta,
    },
    // ---- 系统运维 ----
    {
      path: '/database',
      name: 'database',
      component: Database,
      meta: {
        label: 'menu.database',
        icon: 'server',
        inMenu: true,
        menuGroup: 'operations',
        permissions: [Permission.DATABASE_VIEW],
        superAdminOnly: true,
      } satisfies RouteMeta,
    },
    {
      path: '/i18n-messages',
      name: 'i18n-messages',
      component: I18nMessages,
      meta: {
        label: 'menu.i18nMessages',
        icon: 'file-code',
        inMenu: true,
        menuGroup: 'operations',
      } satisfies RouteMeta,
    },
    // ---- 开发工具 ----
    {
      path: '/auto-form-playground',
      name: 'auto-form-playground',
      component: AutoFormPlayground,
      meta: { label: 'menu.playground', icon: 'form', inMenu: false, menuGroup: 'devtools', permissions: [Permission.PLAYGROUND_VIEW] } satisfies RouteMeta,
    },
    // ---- 权限管理 ----
    {
      path: '/rbac/roles',
      name: 'rbac-roles',
      component: RbacRoles,
      meta: { label: 'menu.rbacRoles', icon: 'user-setting', inMenu: false, menuGroup: 'rbac', permissions: [Permission.RBAC_ROLES_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/rbac/users',
      name: 'rbac-users',
      component: RbacUsers,
      meta: { label: 'menu.rbacUsers', icon: 'user', inMenu: false, menuGroup: 'rbac', permissions: [Permission.RBAC_USERS_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/rbac/permissions',
      name: 'rbac-permissions',
      component: RbacPermissions,
      meta: { label: 'menu.rbacPermissions', icon: 'lock-on', inMenu: false, menuGroup: 'rbac', permissions: [Permission.RBAC_PERMISSIONS_VIEW] } satisfies RouteMeta,
    },
    {
      path: '/rbac/requests',
      name: 'permission-requests',
      component: PermissionRequests,
      meta: { label: 'menu.permissionRequests', icon: 'user-add', inMenu: false, menuGroup: 'rbac', permissions: [Permission.RBAC_REQUESTS_VIEW] } satisfies RouteMeta,
    },
    // ---- 无权限 ----
    {
      path: '/unauthorized',
      name: 'forbidden',
      component: Forbidden,
      meta: { label: 'menu.forbidden', inMenu: false } satisfies RouteMeta,
    },
  ],
});

// 全局前置路由守卫：确保在进入任何页面前先完成认证检查 + 启动全局状态轮询 + 权限校验
// 用「在途 Promise」而非布尔标志：标志若写在 await init() 之后，await 期间的并发导航
// （如 403 跳转）会再次执行 init，进而产生两条 verify-token / logout 请求
let authInitPromise: Promise<void> | null = null;

router.beforeEach(async (to, _from, next) => {
  // 首次导航立即缓存 Promise，后续并发导航共用同一份结果
  if (!authInitPromise) {
    authInitPromise = (async (): Promise<void> => {
      const authStore = useAuthStore();
      await authStore.init();

      // 认证通过后触发一次首屏聚合请求，由聚合 Store 分发数据并启动状态轮询；
      // 不 await，避免阻塞导航；仪表盘 init 会复用同一个在途 Promise
      if (authStore.isLoggedIn) {
        void useBootstrapStore().load();
      }
    })();
  }
  await authInitPromise;

  // 超级管理员专属页面：即使权限码被误配给其他角色，也按身份直接拦截
  // 注意：forbidden(/403) 始终是兜底页面，避免重定向死循环
  if (to.meta.superAdminOnly && to.name !== 'forbidden' && !useAuthStore().isAdmin) {
    return next({
      name: 'forbidden',
      query: { from: encodeURIComponent(to.fullPath), reason: 'route' },
    });
  }

  // 页面级权限校验：如果路由定义了 permissions，则检查用户是否有权限
  // 注意：dashboard 和 forbidden(/403) 是兜底页面，始终允许访问，避免重定向死循环
  const { permissions } = to.meta;
  if (permissions && permissions.length > 0 && to.name !== 'dashboard' && to.name !== 'forbidden') {
    const permissionStore = usePermissionStore();
    // 权限列表不为空时才做校验（为空说明还未加载或未登录，由 auth 逻辑处理）
    if (permissionStore.permissions.length > 0 && !permissionStore.hasAnyPermission(permissions)) {
      // 无权限时跳转到 403 页面，携带来源路径和触发原因
      return next({
        name: 'forbidden',
        query: { from: encodeURIComponent(to.fullPath), reason: 'route' },
      });
    }
  }

  next();
});

export default router;
