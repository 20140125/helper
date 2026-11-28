import fs from 'fs';
import type { PermissionMeta } from '@/types/rbac';
import { PROJECT_DIR } from '@/utils/paths';
import { readPermissionMetasFromDb, writePermissionMetasToDb } from './db';

/** 权限元信息 JSON 快照路径（数据库不可用时的降级数据） */
const PERMISSION_METAS_FILE = `${PROJECT_DIR}/.cache/permission_metas.json`;

// ==============================
// 本地 JSON 降级
// ==============================

/**
 * 读取本地权限元信息快照
 * @returns {PermissionMeta[]} 权限元信息数组
 */
const readLegacyPermissionMetas = (): PermissionMeta[] => {
  try {
    return JSON.parse(fs.readFileSync(PERMISSION_METAS_FILE, 'utf-8')) as PermissionMeta[];
  } catch {
    console.warn('[RBAC] 读取 permission_metas.json 失败，权限元信息为空');
    return [];
  }
};

// ==============================
// 权限元信息（数据库 hp_permissions 为唯一真源）
// ==============================

/**
 * 读取权限元信息列表
 * @returns {Promise<PermissionMeta[]>} 权限元信息数组
 * @description 优先查库；数据库不可用时降级读取本地 JSON 快照
 */
export const readPermissionMetas = async (): Promise<PermissionMeta[]> => {
  try {
    return await readPermissionMetasFromDb();
  } catch (err) {
    console.warn('[RBAC] 读取 hp_permissions 失败，回退 JSON：', (err as Error).message);
    return readLegacyPermissionMetas();
  }
};

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
