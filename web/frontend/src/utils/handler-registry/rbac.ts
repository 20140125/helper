import type { HandlerRegistry } from '@/types/handler-registry';
import { PermissionType } from '@/types/rbac';
import type { PermissionMeta, RoleConfig } from '@/types/rbac';
import {
  getLocaleText,
  isEditing,
  isViewPermission,
  isEditPermission,
  requiredWhen,
  anyOf,
  type FormData,
  type Predicate,
} from './shared';
import { mergeHandlerRegistries } from './merge';

/** ── 内部常量与类型 ──────────────────────────────────────── */

/** 权限码后缀 */
const PERM_SUFFIX = { view: ':view', edit: ':edit' } as const;

/** createRbacHandlers 的依赖注入项 */
interface RbacDeps {
  getPermissionMetas: () => PermissionMeta[];
  getRoles: () => RoleConfig[];
}

/** ── 纯函数：数据转换 ────────────────────────────────────── */

/** 从路由路径解析出权限码和分组 ID */
const parseRouteToPermission = (raw: string) => {
  const route = raw.replace(/^\/+|\/+$/g, '');
  if (!route) return { code: '', groupId: '' };
  const segments = route.split('/').filter(Boolean);
  return {
    code: segments.join(':') + PERM_SUFFIX.view,
    groupId: segments[0] ?? '',
  };
};

/** 权限元信息 → 权限下拉选项 */
const toPermissionOption = (m: PermissionMeta) => ({ value: m.code, label: m.label });

/** 角色 → 角色下拉选项 */
const toRoleOption = (r: RoleConfig) => ({ value: r.id, label: r.name });

/** 页面路由选项：从已有 view 类型权限中动态提取，按 route 去重 */
const buildPageRouteOptions = (metas: PermissionMeta[]) => {
  const seen = new Set<string>();
  const result: Array<{ value: string; label: string }> = [];
  for (const m of metas) {
    if (m.type === PermissionType.View && m.route && !seen.has(m.route)) {
      seen.add(m.route);
      result.push({ value: m.group_id, label: `${m.group_name} (${m.route})` });
    }
  }
  return result;
};

/** ── Help 提示文案 ─────────────────────────────────────── */

/** 各字段的 help 提示文字映射表（locale-aware，每次调用时动态获取） */
const getRbacHelpTexts = (): Record<string, Partial<Record<PermissionType, string>>> => {
  const t = getLocaleText().rbac;
  return {
    groupId: {
      [PermissionType.View]: t.helpGroupIdView,
      [PermissionType.Edit]: t.helpGroupIdEdit,
    },
    groupName: {
      [PermissionType.Edit]: t.helpNameEdit,
    },
    code: {
      [PermissionType.View]: t.helpCodeView,
      [PermissionType.Edit]: t.helpCodeEdit,
    },
  };
};

/** 根据 help key 和 data.type 返回提示文字 */
const helpFor = (key: string) => (data: FormData) =>
  getRbacHelpTexts()[key]?.[data.type as PermissionType] ?? '';

/** ── 副作用处理器 ───────────────────────────────────────── */

/** 类型切换时清空路由和分组相关字段 */
const clearRouteFields = (_val: unknown, data: FormData) => {
  data.route = '';
  data.route_select = '';
  data.code = '';
  data.group_id = '';
  data.group_name = '';
};

/** 手动输入路由后，自动生成权限码和分组 ID */
const handleRouteInput = (_val: unknown, data: FormData) => {
  const { code, groupId } = parseRouteToPermission(String(data.route ?? ''));
  data.code = code;
  data.group_id = groupId;
};

/** 选择已有路由后（编辑权限场景），联动填充 route / group_id / group_name / code */
const createRouteSelectHandler =
  (getPermissionMetas: () => PermissionMeta[]) =>
  (val: unknown, data: FormData) => {
    const selected = String(val ?? '');
    // val 是 group_id，需要找到对应的 route 和 group_name
    const viewMeta = getPermissionMetas()
      .find((m) => m.type === PermissionType.View && m.group_id === selected);
    data.route = viewMeta?.route ?? selected;
    data.group_id = selected;
    data.group_name = viewMeta?.group_name ?? '';
    // 编辑权限的权限码 = 分组ID:edit
    data.code = selected ? `${selected}${PERM_SUFFIX.edit}` : '';
  };

/** ── 分区 Builder：每个函数只负责一个语义维度 ─────────────── */

/** 选项类 handlers（下拉选项） */
const buildOptionHandlers = (deps: RbacDeps): HandlerRegistry => ({
  'rbac.permissionOptions': () => deps.getPermissionMetas().map(toPermissionOption),
  'rbac.roleOptions': () => deps.getRoles().map(toRoleOption),
  'rbac.pageRouteOptions': () => buildPageRouteOptions(deps.getPermissionMetas()),
  'rbac.permissionTypeOptions': () => [
    { label: getLocaleText().rbac.typeViewDesc, value: PermissionType.View },
    { label: getLocaleText().rbac.typeEditDesc, value: PermissionType.Edit },
  ],
});

/** 字段可见性 handlers */
const buildVisibilityHandlers = (): HandlerRegistry => ({
  'rbac.visibleRoute': isViewPermission,
  'rbac.visibleAction': isEditPermission,
});

/** 字段禁用 handlers：编辑模式下一律禁用，分组/名称额外受权限类型影响 */
const buildDisabledHandlers = (): HandlerRegistry => {
  // 在编辑模式下禁用
  const disabledInEditing: Predicate = isEditing;
  // 在编辑模式或已联动填充时禁用 group_id（查看/编辑权限下都由系统填充）
  const disabledForGroupId = anyOf(isEditing, isViewPermission, isEditPermission);
  // 在编辑模式或编辑权限下禁用 group_name（由路由选择联动填充）
  const disabledForGroupName = anyOf(isEditing, isEditPermission);

  return {
    'rbac.typeDisabled': disabledInEditing,
    'rbac.routeDisabled': disabledInEditing,
    'rbac.routeSelectDisabled': disabledInEditing,
    'rbac.groupIdDisabled': disabledForGroupId,
    'rbac.groupNameDisabled': disabledForGroupName,
  };
};

/** 交互联动 handlers（onChange 副作用） */
const buildInteractionHandlers = (deps: RbacDeps): HandlerRegistry => ({
  'rbac.onTypeChange': clearRouteFields,
  'rbac.onRouteChange': handleRouteInput,
  'rbac.onRouteSelectChange': createRouteSelectHandler(deps.getPermissionMetas),
});

/** 校验规则 handlers */
const buildRuleHandlers = (): HandlerRegistry => {
  const t = () => getLocaleText().rbac;
  return {
    'rbac.routeRules': requiredWhen(isViewPermission, t().routeRequired),
    'rbac.routeSelectRules': requiredWhen(isEditPermission, t().linkedRouteRequired),
  };
};

/** Help 提示 handlers */
const buildHelpHandlers = (): HandlerRegistry => ({
  'rbac.groupIdHelp': helpFor('groupId'),
  'rbac.groupNameHelp': helpFor('groupName'),
  'rbac.codeHelp': helpFor('code'),
});

/** ── 对外导出 ──────────────────────────────────────────── */

/**
 * 创建 RBAC 权限管理页面的 handler 注册表
 * @description 将 RBAC 表单中的动态选项集中注册，供 field-enhancer 解析 $handler:rbac.* 标记。
 *              按语义维度拆分为 6 个分区 builder，通过 mergeHandlerRegistries 合并输出：
 *              - 选项类 / 可见性 / 禁用状态 / 交互联动 / 校验规则 / 帮助提示
 *              页面路由选项从 permissionMetas 中动态提取 type=view 的权限，无需硬编码。
 * @param options - 配置项
 * @param options.getPermissionMetas - 获取权限元信息列表的函数
 * @param options.getRoles - 获取角色列表的函数
 * @returns HandlerRegistry RBAC 相关的 handler 注册表
 */
export const createRbacHandlers = (options: RbacDeps): HandlerRegistry =>
  mergeHandlerRegistries(
    buildOptionHandlers(options),
    buildVisibilityHandlers(),
    buildDisabledHandlers(),
    buildInteractionHandlers(options),
    buildRuleHandlers(),
    buildHelpHandlers(),
  );
