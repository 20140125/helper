import type { FormData, Predicate } from '@/types/handler-registry';
import { useLocaleStore } from '@/stores/locale';
import { PermissionType } from '@/types/rbac';

export type { FormData, Predicate } from '@/types/handler-registry';

/** ── 谓词组合子 ───────────────────────────────────────── */

/** 任一谓词为 true 则返回 true */
export const anyOf = (...predicates: Predicate[]): Predicate =>
  (data) => predicates.some((p) => p(data));

/** 所有谓词均为 true 才返回 true */
export const allOf = (...predicates: Predicate[]): Predicate =>
  (data) => predicates.every((p) => p(data));

/** 谓词取反 */
export const negate = (predicate: Predicate): Predicate =>
  (data) => !predicate(data);

/** ── 通用谓词 ───────────────────────────────────────────── */

/** 当前是否处于"编辑模式"（由 auto-form 注入 _isEditing） */
export const isEditing: Predicate = (data) => data._isEditing === true;

/** 权限类型是否为"查看" */
export const isViewPermission: Predicate = (data) => data.type === PermissionType.View;

/** 权限类型是否为"编辑" */
export const isEditPermission: Predicate = (data) => data.type === PermissionType.Edit;

/** ── 规则生成器 ─────────────────────────────────────────── */

/**
 * 按谓词生成 required 规则
 * @param predicate - 仅当返回 true 时生成 required 规则
 * @param message - 规则提示文案
 */
export const requiredWhen = (predicate: Predicate, message: string) =>
  (data: FormData) => (predicate(data) ? [{ required: true, message }] : []);

/** ── Locale 访问 ────────────────────────────────────────── */

/** 延迟读取当前 locale 文本，确保切换语言后提示同步更新 */
export const getLocaleText = () => useLocaleStore().t;
