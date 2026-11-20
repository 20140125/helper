import fs from 'fs';
import type { PermissionMeta } from '@/types/rbac';
import { PROJECT_DIR, CACHE_DIR } from '@/utils/paths';

/** 权限元信息 JSON 文件路径 */
const PERMISSION_METAS_FILE = `${PROJECT_DIR}/.cache/permission_metas.json`;

// ==============================
// 权限元信息（从 JSON 文件动态读取）
// ==============================

/**
 * 读取权限元信息列表
 * @description 从 .cache/permission_metas.json 动态读取，后续迁移数据库时只需修改此函数的数据源
 * @returns 权限元信息数组
 */
export const readPermissionMetas = (): PermissionMeta[] => {
  try {
    const raw = fs.readFileSync(PERMISSION_METAS_FILE, 'utf-8');
    return JSON.parse(raw) as PermissionMeta[];
  } catch {
    // JSON 文件不存在或解析失败时，返回空数组并输出警告
    console.warn('[RBAC] 读取 permission_metas.json 失败，权限元信息为空');
    return [];
  }
};

/**
 * 从权限元信息中提取所有权限码
 * @description 以 JSON 数据为唯一数据源，替代硬编码的 Object.values(Permission)
 * @returns 权限码字符串数组
 */
export const readAllPermissionCodes = (): string[] => {
  return readPermissionMetas().map((m) => m.code);
};

/**
 * 写入权限元信息列表
 * @param metas - 权限元信息数组
 */
export const writePermissionMetas = (metas: PermissionMeta[]): void => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(PERMISSION_METAS_FILE, JSON.stringify(metas, null, 2), 'utf-8');
};

/**
 * 新增权限元信息
 * @param meta - 新权限元信息（不含 code 字段，由调用方传入完整对象）
 * @returns 新增后的完整权限元信息
 * @throws 权限码已存在时抛出错误
 */
export const createPermissionMeta = (meta: PermissionMeta): PermissionMeta => {
  const metas = readPermissionMetas();
  if (metas.some((m) => m.code === meta.code)) {
    throw new Error(`权限码 "${meta.code}" 已存在`);
  }
  metas.push(meta);
  writePermissionMetas(metas);
  return meta;
};

/**
 * 更新权限元信息
 * @param code - 权限码（唯一标识，不可修改）
 * @param updates - 需要更新的字段
 * @returns 更新后的完整权限元信息
 * @throws 权限码不存在时抛出错误
 */
export const updatePermissionMeta = (
  code: string,
  updates: Omit<Partial<PermissionMeta>, 'code'>,
): PermissionMeta => {
  const metas = readPermissionMetas();
  const index = metas.findIndex((m) => m.code === code);
  if (index === -1) {
    throw new Error(`权限码 "${code}" 不存在`);
  }
  metas[index] = { ...metas[index], ...updates, code: metas[index].code };
  writePermissionMetas(metas);
  return metas[index];
};
