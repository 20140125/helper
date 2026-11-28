import type { PermissionMeta } from '@/types/rbac';
import { readPermissionMetasFromDb, writePermissionMetasToDb } from './db';

// ==============================
// 权限元信息（数据库 hp_permissions 为唯一真源）
// ==============================

/**
 * 读取权限元信息列表
 * @returns {Promise<PermissionMeta[]>} 权限元信息数组
 * @description 直接查库；数据库异常向上抛出，由路由转成 500，不再降级读本地 JSON
 */
export const readPermissionMetas = async (): Promise<PermissionMeta[]> => readPermissionMetasFromDb();

/**
 * 提取全部权限码
 * @returns {Promise<string[]>} 权限码数组
 * @description 以数据库数据为唯一数据源，替代硬编码的 Object.values(Permission)
 */
export const readAllPermissionCodes = async (): Promise<string[]> => {
  return (await readPermissionMetas()).map((meta) => meta.code);
};

/**
 * 写入权限元信息列表
 * @param {PermissionMeta[]} metas - 权限元信息数组
 * @returns {Promise<void>}
 */
export const writePermissionMetas = async (metas: PermissionMeta[]): Promise<void> => {
  await writePermissionMetasToDb(metas);
};

/**
 * 新增权限元信息
 * @param {PermissionMeta} meta - 新权限元信息
 * @returns {Promise<PermissionMeta>} 新增后的完整权限元信息
 * @throws 权限码已存在时抛出错误
 */
export const createPermissionMeta = async (meta: PermissionMeta): Promise<PermissionMeta> => {
  const metas = await readPermissionMetas();
  if (metas.some((m) => m.code === meta.code)) {
    throw new Error(`权限码 "${meta.code}" 已存在`);
  }
  metas.push(meta);
  await writePermissionMetas(metas);
  return meta;
};

/**
 * 更新权限元信息
 * @param {string} code - 权限码（唯一标识，不可修改）
 * @param {Omit<Partial<PermissionMeta>, 'code'>} updates - 需要更新的字段
 * @returns {Promise<PermissionMeta>} 更新后的完整权限元信息
 * @throws 权限码不存在时抛出错误
 */
export const updatePermissionMeta = async (
  code: string,
  updates: Omit<Partial<PermissionMeta>, 'code'>,
): Promise<PermissionMeta> => {
  const metas = await readPermissionMetas();
  const index = metas.findIndex((m) => m.code === code);
  if (index === -1) {
    throw new Error(`权限码 "${code}" 不存在`);
  }
  metas[index] = { ...metas[index], ...updates, code: metas[index].code };
  await writePermissionMetas(metas);
  return metas[index];
};
