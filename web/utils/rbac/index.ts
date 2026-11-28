// RBAC barrel — re-exports all public API
export {
  readPermissionMetas,
  readAllPermissionCodes,
  writePermissionMetas,
  createPermissionMeta,
  updatePermissionMeta,
} from './permission-meta';

export {
  readRbacConfig,
  writeRbacConfig,
} from './config';

export {
  getUserRoleConfig,
  getUserPermissionsByEmail,
  getUserRoleId,
  getUserAuthInfo,
} from './user-role';

export { validatePermissionFields } from './validation';

export { requireSuperAdmin } from './middleware';
