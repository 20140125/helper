import { ref, computed, nextTick, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { RbacService } from '@/services/rbac-service';
import { useAuthStore } from '@/stores/auth';
import { usePlaygroundStore } from '@/stores/playground';
import type { RoleConfig, PermissionMeta, UserInfo, IRoleFormData, IUserRoleFormData } from '@/types/rbac';
import type { Permission } from '@/types/permission';
import { RoleFormData, UserRoleFormData } from '@/data/initiate-data';
import type { AutoFormField } from '@/types/auto-form';
import { enhanceFields, type HandlerRegistry } from '@/utils/field-enhancer';
import { createRbacHandlers } from '@/utils/handler-registry';
import { PermissionSelection } from '@/utils/rbac';
import { FormMode } from '@/constants/form';
import { BaseModel } from '@/models/base-model';
import { MessagePlugin } from 'tdesign-vue-next';

/**
 * RBAC 管理页面数据模型类
 * @description 管理角色列表、用户列表、权限配置等业务逻辑
 */
export class RbacModel extends BaseModel {
  // ==============================
  // 依赖注入（service、store）
  // ==============================

  /**
   * RBAC 服务实例
   * @type {RbacService}
   * @description 用于角色、用户、权限的增删改查接口调用
   */
  rbacService: RbacService = new RbacService();

  /**
   * 鉴权状态存储实例
   * @type {ReturnType<typeof useAuthStore>}
   * @description 用于读取鉴权信息，判断是否为超级管理员
   */
  authStore: ReturnType<typeof useAuthStore> = useAuthStore();

  /**
   * Playground 模板全局存储实例
   * @type {ReturnType<typeof usePlaygroundStore>}
   * @description 缓存全量模板，避免重复请求
   */
  playgroundStore: ReturnType<typeof usePlaygroundStore> = usePlaygroundStore();

  /**
   * 从 JSON 加载的原始字段模板缓存
   * @type {Ref<Record<string, unknown[]>>}
   * @description key 为模板 id，使用 ref 确保响应式更新
   */
  rawTemplates: Ref<Record<string, unknown[]>> = ref({});

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 角色列表
   * @type {Ref<RoleConfig[]>}
   * @description 后端返回的所有角色配置
   */
  roles: Ref<RoleConfig[]> = ref([]);

  /**
   * 用户列表
   * @type {Ref<UserInfo[]>}
   * @description 后端返回的所有用户信息
   */
  users: Ref<UserInfo[]> = ref([]);

  /**
   * 权限元信息列表
   * @type {Ref<PermissionMeta[]>}
   * @description 权限分组与中文说明
   */
  permissionMetas: Ref<PermissionMeta[]> = ref([]);

  /**
   * 所有权限码列表
   * @type {Ref<string[]>}
   * @description 后端注册的权限码全集
   */
  allPermissions: Ref<string[]> = ref([]);

  /**
   * 角色抽屉显隐状态
   * @type {Ref<boolean>}
   * @description 控制新建/编辑角色抽屉的展开
   */
  roleDrawerVisible: Ref<boolean> = ref(false);

  /**
   * 当前正在编辑的角色
   * @type {Ref<RoleConfig | null>}
   * @description 为 null 时表示新建态，非 null 时表示编辑态
   */
  editingRole: Ref<RoleConfig | null> = ref(null);

  /**
   * 角色表单数据
   * @type {Ref<IRoleFormData>}
   * @description auto-form 组件的 v-model 绑定值
   */
  roleFormData: Ref<IRoleFormData> = ref({ ...RoleFormData });

  /**
   * 角色表单 auto-form 组件实例引用
   * @type {Ref<{ validate: () => Promise<boolean | Record<string, unknown>>; clearValidate: (fields?: string[]) => void } | null>}
   * @description 用于提交前调用 validate() 触发表单校验
   */
  roleFormRef: Ref<{ validate: () => Promise<boolean | Record<string, unknown>>; clearValidate: (fields?: string[]) => void } | null> = ref(null);

  /**
   * 用户角色抽屉显隐状态
   * @type {Ref<boolean>}
   * @description 控制修改用户角色抽屉的展开
   */
  userRoleDrawerVisible: Ref<boolean> = ref(false);

  /**
   * 当前正在编辑的用户
   * @type {Ref<UserInfo | null>}
   * @description 抽屉中修改角色的目标用户
   */
  editingUser: Ref<UserInfo | null> = ref(null);

  /**
   * 用户角色表单数据
   * @type {Ref<IUserRoleFormData>}
   * @description auto-form 组件的 v-model 绑定值
   */
  userRoleFormData: Ref<IUserRoleFormData> = ref({ ...UserRoleFormData });

  // ==============================
  // 权限选择工具
  // ==============================

  /**
   * 权限选择工具实例（委托给 PermissionSelection 统一处理权限分组、全选、切换逻辑）
   * @description 通过注入数据源实现复用，避免与 AutoFormPlaygroundModel 重复编写相同的权限操作代码
   */
  permissionSelection = new PermissionSelection({
    getPermissionMetas: () => this.permissionMetas.value,
    getSelectedPermissions: () => this.roleFormData.value.permissions,
    setSelectedPermissions: (permissions) => {
      this.roleFormData.value = { ...this.roleFormData.value, permissions };
    },
  });

  /**
   * 用户角色抽屉中用于只读预览「已选角色」所拥有的权限
   * @description 数据源随 userRoleFormData.roleId 变化；setSelectedPermissions 为 noop（只读）
   */
  userRolePermissionSelection = new PermissionSelection({
    getPermissionMetas: () => this.permissionMetas.value,
    getSelectedPermissions: () => this.selectedUserRolePermissions.value,
    setSelectedPermissions: () => {
      // readonly preview, intentionally noop
    },
  });

  // ==============================
  // 计算属性
  // ==============================

  /**
   * 角色抽屉当前模式
   * @type {ComputedRef<FormMode>}
   */
  roleFormMode: ComputedRef<FormMode> = computed(
    () => (this.editingRole.value ? FormMode.Edit : FormMode.Create),
  );

  /**
   * 查看当前会话是否为超级管理员
   * @type {ComputedRef<boolean>}
   */
  isSuperAdmin: ComputedRef<boolean> = computed(() => this.authStore.isAdmin);

  /**
   * 可分配的角色列表
   * @type {ComputedRef<RoleConfig[]>}
   */
  assignableRoles: ComputedRef<RoleConfig[]> = computed(
    () => this.roles.value.filter((r) => r.id !== 'super_admin'),
  );

  /**
   * 用户角色抽屉当前选中角色所拥有的权限码列表
   * @type {ComputedRef<string[]>}
   */
  selectedUserRolePermissions: ComputedRef<string[]> = computed(() => {
    const roleId = this.userRoleFormData.value.roleId;
    if (!roleId) return [];
    const role = this.roles.value.find((r) => r.id === roleId);
    return role ? [...role.permissions] : [];
  });

  /**
   * RBAC handler 注册表
   * @type {ComputedRef<HandlerRegistry>}
   */
  rbacHandlers: ComputedRef<HandlerRegistry> = computed(() => createRbacHandlers({
    getPermissionMetas: () => this.permissionMetas.value,
    getRoles: () => this.assignableRoles.value,
  }));

  /**
   * 从缓存获取指定模板并增强
   * @param {string} id - 模板 id
   * @returns {AutoFormField[]} 增强后的字段配置
   */
  getEnhancedFields(id: string): AutoFormField[] {
    const raw = this.rawTemplates.value[id];
    if (!raw || raw.length === 0) return [];
    return enhanceFields(raw, this.rbacHandlers.value);
  }

  /**
   * 角色编辑对话框的 auto-form 字段配置
   * @type {ComputedRef<AutoFormField[]>}
   */
  roleFormFields: ComputedRef<AutoFormField[]> = computed(
    () => this.getEnhancedFields('rbac-role-form'),
  );

  /**
   * 用户角色对话框的 auto-form 字段配置
   * @type {ComputedRef<AutoFormField[]>}
   */
  userRoleFormFields: ComputedRef<AutoFormField[]> = computed(
    () => this.getEnhancedFields('rbac-user-role-form'),
  );

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 设置 auto-form 组件实例引用
   * @param {unknown} el - Vue :ref 回调传入的元素或组件实例
   * @returns {void}
   */
  setRoleFormRef = (el: unknown): void => {
    this.roleFormRef.value = el as { validate: () => Promise<boolean | Record<string, unknown>>; clearValidate: (fields?: string[]) => void } | null;
  };

  /**
   * 加载 RBAC 配置
   * @returns {Promise<void>}
   * @description 并行加载角色/用户/权限元信息与 playground 模板，并从缓存中提取所需模板 fields
   */
  loadConfig = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      // 并行加载：角色管理数据 + playground 模板
      const templateIds = ['rbac-role-form', 'rbac-user-role-form'];

      const [{ data: { roles, users, permissionMetas, allPermissions } }] = await Promise.all([
        this.rbacService.fetchRoles(),
        this.playgroundStore.fetchTemplates(),
      ]);

      // 从全局 playground store 缓存中按 id 提取所需的 RBAC 模板 fields
      templateIds.forEach((id) => {
        const fields = this.playgroundStore.getFieldsById(id);
        if (fields.length > 0) {
          this.rawTemplates.value[id] = fields;
        }
      });

      this.roles.value = roles;
      this.users.value = users;
      this.permissionMetas.value = permissionMetas;
      this.allPermissions.value = allPermissions;
    } catch (e) {
      MessagePlugin.error(e instanceof Error ? e.message : this.localeStore.t.rbac.loadFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 打开新增角色对话框
   * @returns {void}
   * @description 重置表单为初始空值，并在两次 nextTick 后清除验证状态
   */
  handleCreateRole = (): void => {
    this.editingRole.value = null;
    this.roleFormData.value = { ...RoleFormData };
    this.roleDrawerVisible.value = true;
    // 双重 nextTick：第 1 次等待 Drawer 渲染，第 2 次等待 AutoForm 内部 t-form 挂载完成
    nextTick(() => nextTick(() => this.roleFormRef.value?.clearValidate()));
  };

  /**
   * 打开编辑角色对话框
   * @param {RoleConfig} role - 要编辑的角色配置
   * @returns {void}
   * @description 将角色数据回填到表单并拔拹出抽屉
   */
  handleEditRole = (role: RoleConfig): void => {
    this.editingRole.value = role;
    this.roleFormData.value = {
      name: role.name,
      description: role.description,
      permissions: [...role.permissions],
    };
    this.roleDrawerVisible.value = true;
    nextTick(() => nextTick(() => this.roleFormRef.value?.clearValidate()));
  };

  /**
   * 提交角色表单（新增或更新）
   * @returns {Promise<void>}
   * @description 先触发 auto-form 验证，通过后调用后端接口保存角色配置并刷新列表
   */
  submitRoleForm = async (): Promise<void> => {
    // 先触发 auto-form 验证
    if (this.roleFormRef.value) {
      const result = await this.roleFormRef.value.validate();
      if (result !== true) return;
    }

    const name = this.roleFormData.value.name.trim();
    if (!name) {
      MessagePlugin.warning(this.localeStore.t.rbac.roleNameRequired);
      return;
    }

    this.pageLoading.value = true;
    try {
      const permissions = this.roleFormData.value.permissions as Permission[];
      const description = (this.roleFormData.value.description || '').trim();

      if (this.editingRole.value) {
        // 更新
        const result = await this.rbacService.updateRole(this.editingRole.value.id, {
          name,
          description,
          permissions,
        });
        MessagePlugin.success(result.message);
      } else {
        // 新增
        const result = await this.rbacService.createRole(name, description, permissions);
        MessagePlugin.success(result.message);
      }
      this.roleDrawerVisible.value = false;
      await this.loadConfig();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      MessagePlugin.error(err?.response?.data?.message ?? err?.message ?? this.localeStore.t.rbac.opFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 删除角色
   * @param {RoleConfig} role - 要删除的角色配置
   * @returns {Promise<void>}
   * @description 调用后端删除接口，成功后刷新配置
   */
  handleDeleteRole = async (role: RoleConfig): Promise<void> => {
    try {
      const result = await this.rbacService.deleteRole(role.id);
      MessagePlugin.success(result.message);
      await this.loadConfig();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      MessagePlugin.error(err?.response?.data?.message ?? err?.message ?? this.localeStore.t.common.deleteFailed);
    }
  };

  /**
   * 打开修改用户角色抽屉
   * @param {UserInfo} user - 要修改角色的用户
   * @returns {void}
   * @description 将用户信息回填到表单并展开抽屉
   */
  handleEditUserRole = (user: UserInfo): void => {
    this.editingUser.value = user;
    this.userRoleFormData.value = {
      email: user.email,
      roleId: user.roleId,
    };
    this.userRoleDrawerVisible.value = true;
  };

  /**
   * 提交用户角色修改
   * @returns {Promise<void>}
   * @description 调用后端修改用户角色接口，成功后刷新配置
   */
  submitUserRole = async (): Promise<void> => {
    if (!this.editingUser.value) return;
    const roleId = this.userRoleFormData.value.roleId;
    if (!roleId) {
      MessagePlugin.warning(this.localeStore.t.rbac.roleRequired);
      return;
    }

    this.pageLoading.value = true;
    try {
      const result = await this.rbacService.updateUserRole(
        this.editingUser.value.email,
        roleId,
      );
      MessagePlugin.success(result.message);
      this.userRoleDrawerVisible.value = false;
      await this.loadConfig();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      MessagePlugin.error(err?.response?.data?.message ?? err?.message ?? this.localeStore.t.rbac.opFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 根据角色 ID 获取角色名称
   * @param {string} roleId - 角色 ID
   * @returns {string} 角色名称，未找到时返回「未知角色」文案
   */
  getRoleName = (roleId: string): string => {
    return this.roles.value.find((r) => r.id === roleId)?.name ?? this.localeStore.t.rbac.unknownRole;
  };

  /**
   * 关闭角色抽屉
   * @returns {void}
   */
  closeRoleDrawer = (): void => {
    this.roleDrawerVisible.value = false;
  };

  /**
   * 关闭用户角色抽屉
   * @returns {void}
   */
  closeUserRoleDrawer = (): void => {
    this.userRoleDrawerVisible.value = false;
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 加载 RBAC 配置并启动窗口 resize 监听
   */
  mounted = (): void => {
    this.loadConfig();
    this.startResizeListener();
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 移除窗口 resize 监听，防止内存泄漏
   */
  beforeUnmount = (): void => {
    this.stopResizeListener();
  };
}

/**
 * Composition API 包装函数
 * @description 将 RbacModel 类包装为 Composition API 可用的函数
 */
export const useRbacModel = () => {
  const model = new RbacModel();

  onMounted(() => model.mounted());
  onBeforeUnmount(() => model.beforeUnmount());

  return {

    ...model,
  };
};
