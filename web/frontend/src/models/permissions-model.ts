import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { RbacService } from '@/services/rbac-service';
import { usePlaygroundStore } from '@/stores/playground';
import { type PermissionMeta, type PermissionGroup, PermissionType, type IPermissionFormData, type PermissionUpdatePayload } from '@/types/rbac';
import type { AutoFormField } from '@/types/auto-form';
import { enhanceFields, type HandlerRegistry } from '@/utils/field-enhancer';
import { createRbacHandlers } from '@/utils/handler-registry';
import { FormMode } from '@/constants/form';
import { BaseModel, Permission } from '@/models/base-model';
import { MessagePlugin } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import { PermissionFormData } from '@/data/initiate-data';

/**
 * 权限列表页面数据模型类
 * @description 管理系统全量权限码的展示逻辑，按分组归类呈现
 */
export class PermissionsModel extends BaseModel {
  // ==============================
  // 依赖注入（service、store）
  // ==============================

  /**
   * RBAC 服务实例
   * @type {RbacService}
   * @description 用于权限元信息的增删改查接口调用
   */
  rbacService: RbacService = new RbacService();

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
   * 权限元信息列表
   * @type {Ref<PermissionMeta[]>}
   * @description 系统全量权限码及其元信息
   */
  permissionMetas: Ref<PermissionMeta[]> = ref([]);

  /**
   * 搜索关键词
   * @type {Ref<string>}
   * @description 用于按 code/label/description 模糊匹配
   */
  searchKeyword: Ref<string> = ref('');

  /**
   * 权限抽屉显隐状态
   * @type {Ref<boolean>}
   * @description 控制新建/编辑权限抽屉的展开
   */
  permissionDrawerVisible: Ref<boolean> = ref(false);

  /**
   * 权限抽屉提交状态
   * @type {Ref<boolean>}
   * @description 是否正在提交保存
   */
  permissionDrawerSaving: Ref<boolean> = ref(false);

  /**
   * 是否为编辑模式
   * @type {Ref<boolean>}
   * @description false 表示新增模式，true 表示编辑模式
   */
  isEditing: Ref<boolean> = ref(false);

  /**
   * 抽屉当前模式
   * @type {ComputedRef<FormMode>}
   * @description isEditing 为 true 时为 Edit，否则为 Create
   */
  permissionFormMode: ComputedRef<FormMode> = computed(
    () => (this.isEditing.value ? FormMode.Edit : FormMode.Create),
  );

  /**
   * 表单数据
   * @type {Ref<IPermissionFormData>}
   * @description auto-form 组件的 v-model 绑定值；_isEditing 为内部标记供 handler 判断
   */
  permissionFormData: Ref<IPermissionFormData> = ref({ ...PermissionFormData });

  /**
   * auto-form 组件实例引用
   * @type {Ref<{ validate: () => Promise<boolean | Record<string, unknown>> } | null>}
   * @description 用于提交前调用 validate() 验证表单
   */
  formRef: Ref<{ validate: () => Promise<boolean | Record<string, unknown>> } | null> = ref(null);

  // ==============================
  // 静态数据
  // ==============================

  /**
   * 权限列表表格列定义
   * @type {ComputedRef<PrimaryTableCol[]>}
   * @description 仅保留列元信息（colKey/title/width 等），具体单元格 UI 由视图层（permission-group-panel.vue）通过具名插槽渲染；跟随 i18n 实时刷新
   */
  columns: ComputedRef<PrimaryTableCol[]> = computed(() => {
    const t = this.localeStore.t.rbac;
    return [
      { colKey: 'code', title: t.colPermCode, width: 260 },
      { colKey: 'type', title: t.colType, width: 100 },
      { colKey: 'label', title: t.colName, width: 160 },
      { colKey: 'route', title: t.colRoute, width: 200 },
      { colKey: 'description', title: t.colDesc, ellipsis: true },
      { colKey: 'operate', title: t.colActions, width: 100, fixed: 'right' },
    ];
  });

  // ==============================
  // 计算属性
  // ==============================

  /**
   * RBAC handler 注册表（供 field-enhancer 替换 $handler:rbac.xxx）
   */
  private get rbacHandlers(): HandlerRegistry {
    return createRbacHandlers({
      getPermissionMetas: () => this.permissionMetas.value,
      getRoles: () => [],
    });
  }

  /**
   * 从缓存获取指定模板并增强
   * @param {string} id - 模板 id
   * @returns {AutoFormField[]} 增强后的字段配置
   */
  private getEnhancedFields(id: string): AutoFormField[] {
    const raw = this.rawTemplates.value[id];
    if (!raw || raw.length === 0) return [];
    return enhanceFields(raw, this.rbacHandlers);
  }

  /**
   * 权限表单的 auto-form 字段配置（从 JSON 模板增强）
   * @type {ComputedRef<AutoFormField[]>}
   */
  permissionFormFields: ComputedRef<AutoFormField[]> = computed(
    () => this.getEnhancedFields('rbac-permission-form'),
  );

  /**
   * 按分组归类的权限列表
   * @type {ComputedRef<PermissionGroup[]>}
   */
  permissionGroups: ComputedRef<PermissionGroup[]> = computed(() => {
    const groupMap = new Map<string, PermissionGroup>();
    for (const meta of this.permissionMetas.value) {
      if (!groupMap.has(meta.group_id)) {
        groupMap.set(meta.group_id, {
          group_id: meta.group_id,
          group_name: this.localeStore.lang === 'zh' ? meta.group_name : meta.group_id,
          items: [],
        });
      }
      groupMap.get(meta.group_id)!.items.push(meta);
    }
    return Array.from(groupMap.values());
  });

  /**
   * 经过搜索过滤后的分组列表
   * @type {ComputedRef<PermissionGroup[]>}
   */
  filteredGroups: ComputedRef<PermissionGroup[]> = computed(() => {
    const keyword = this.searchKeyword.value.trim().toLowerCase();
    if (!keyword) return this.permissionGroups.value;

    return this.permissionGroups.value
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.code.toLowerCase().includes(keyword) ||
            item.label.toLowerCase().includes(keyword) ||
            item.description.toLowerCase().includes(keyword),
        ),
      }))
      .filter((group) => group.items.length > 0);
  });

  /**
   * 权限总数
   * @type {ComputedRef<number>}
   */
  totalCount: ComputedRef<number> = computed(() => this.permissionMetas.value.length);

  /**
   * 过滤后的权限总数
   * @type {ComputedRef<number>}
   */
  filteredCount: ComputedRef<number> = computed(
    () => this.filteredGroups.value.reduce((sum, g) => sum + g.items.length, 0),
  );

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 设置表单 auto-form ref
   */
  setFormRef = (el: unknown): void => {
    this.formRef.value = el as { validate: () => Promise<boolean | Record<string, unknown>> } | null;
  };

  /**
   * 加载权限元信息
   */
  loadPermissions = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const templateIds = ['rbac-permission-form'];

      const [{ data: { permissionMetas } }] = await Promise.all([
        this.rbacService.fetchPermissions(),
        this.playgroundStore.fetchTemplates(),
      ]);

      // 从全局 playground store 缓存中按 id 提取所需的模板 fields
      templateIds.forEach((id) => {
        const fields = this.playgroundStore.getFieldsById(id);
        if (fields.length > 0) {
          this.rawTemplates.value[id] = fields;
        }
      });

      this.permissionMetas.value = permissionMetas;
    } catch (e) {
      MessagePlugin.error(e instanceof Error ? e.message : this.localeStore.t.rbac.loadPermsFailed);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 打开新增权限抽屉
   */
  openCreateDrawer = (): void => {
    this.isEditing.value = false;
    this.permissionFormData.value = { ...PermissionFormData };
    this.permissionDrawerVisible.value = true;
  };

  /**
   * 打开编辑权限抽屉
   */
  openEditDrawer = (permission: PermissionMeta): void => {
    this.isEditing.value = true;
    this.permissionFormData.value = {
      ...permission,
      route_select: permission.type === PermissionType.Edit ? (permission.group_id ?? '') : '',
      _isEditing: true,
    };
    this.permissionDrawerVisible.value = true;
  };

  /**
   * 关闭权限抽屉
   */
  closeDrawer = (): void => {
    this.permissionDrawerVisible.value = false;
  };

  /**
   * 验证表单数据
   */
  private validateFormData = async (): Promise<boolean> => {
    if (this.formRef.value) {
      const result = await this.formRef.value.validate();
      return result === true;
    }
    return true;
  };

  /**
   * 验证权限类型
   */
  private validatePermissionType = (type: PermissionType): type is PermissionType => {
    const permType = String(type ?? '').trim() as PermissionType;
    return permType === PermissionType.View || permType === PermissionType.Edit;
  };

  /**
   * 构建权限基础数据
   * @param {IPermissionFormData} form - 表单数据
   * @param {PermissionType} permType - 权限类型
   * @returns {PermissionUpdatePayload} 不含 code 的权限载荷
   */
  private buildPermissionBaseData = (form: IPermissionFormData, permType: PermissionType): PermissionUpdatePayload => {
    const routeValue = permType === PermissionType.Edit
      ? String(form.route_select ?? '').trim()
      : String(form.route ?? '').trim();

    return {
      group_id: String(form.group_id ?? '').trim(),
      group_name: String(form.group_name ?? '').trim(),
      label: String(form.label ?? '').trim(),
      description: String(form.description ?? '').trim(),
      type: permType,
      ...(routeValue ? { route: routeValue } : {}),
    };
  };

  /**
   * 处理权限创建或更新
   */
  private handlePermissionOperation = async (
    editing: boolean,
    code: string,
    baseData: PermissionUpdatePayload
  ): Promise<void> => {
    try {
      const res = editing
        ? await this.rbacService.updatePermission(code, baseData)
        : await this.rbacService.createPermission({ code: code as Permission, ...baseData });

      if (res.code === 0) {
        MessagePlugin.success(editing ? this.localeStore.t.rbac.permUpdateSuccess : this.localeStore.t.rbac.permCreateSuccess);
        this.permissionDrawerVisible.value = false;
        await this.loadPermissions();
      } else {
        MessagePlugin.error(res.message || (editing ? this.localeStore.t.rbac.updateFailed : this.localeStore.t.rbac.createFailed));
      }
    } catch (e) {
      MessagePlugin.error(e instanceof Error ? e.message : (editing ? this.localeStore.t.rbac.updateFailed : this.localeStore.t.rbac.createFailed));
    }
  };

  /**
   * 提交权限表单（根据 isEditing 自动选择新增/编辑）
   */
  submitPermission = async (): Promise<void> => {
    // 表单验证
    const isValid = await this.validateFormData();
    if (!isValid) return;

    const form = this.permissionFormData.value;
    const editing = this.isEditing.value;

    // 权限类型验证
    if (!this.validatePermissionType(form.type)) {
      MessagePlugin.warning(this.localeStore.t.rbac.typeRequired);
      return;
    }

    const permType = String(form.type ?? '').trim() as PermissionType;
    const baseData = this.buildPermissionBaseData(form, permType);

    this.permissionDrawerSaving.value = true;
    try {
      await this.handlePermissionOperation(
        editing,
        String(form.code ?? '').trim(),
        baseData
      );
    } finally {
      this.permissionDrawerSaving.value = false;
    }
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 加载权限列表并启动窗口 resize 监听
   */
  mounted = (): void => {
    this.loadPermissions();
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
 * @description 将 PermissionsModel 类包装为 Composition API 可用的函数
 */
export const usePermissionsModel = () => {
  const model = new PermissionsModel();

  onMounted(() => model.mounted());
  onBeforeUnmount(() => model.beforeUnmount());

  return {

    ...model,
  };
};
