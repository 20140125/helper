import { computed, ref, onMounted, type Ref, type ComputedRef } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { FormMode } from '@/constants/form';
import { NavigationService } from '@/services/navigation-service';
import { useNavigationStore } from '@/stores/navigation';
import { Permission } from '@/types/permission';
import type { AutoFormField, AutoFormOption } from '@/types/auto-form';
import type { NavGroup, NavItem } from '@/types/navigation';

/** 当前编辑的数据类型 */
export type NavigationEditKind = 'group' | 'item';

/**
 * 权限码下拉选项
 * @description 以 Permission 枚举为准；空值表示不限制权限，避免依赖需要 RBAC 权限的元数据接口
 */
const PERMISSION_OPTIONS: AutoFormOption[] = [
  { value: '', label: '—' },
  ...(Object.values(Permission) as string[]).map((code) => ({ value: code, label: code })),
];

/**
 * 导航数据管理页数据模型类
 * @description 管理侧边栏分组与页面注册表的新增、编辑、删除；数据真源为 hp_nav_groups / hp_nav_items
 */
export class NavigationAdminModel extends BaseModel {
  /** 导航服务实例 */
  service: NavigationService = new NavigationService();

  /** 导航全局状态 */
  navStore: ReturnType<typeof useNavigationStore> = useNavigationStore();

  /** vue-router 实例（跳转语言包管理页） */
  private vueRouter: ReturnType<typeof useRouter> = useRouter();

  /** 编辑抽屉显示状态 */
  drawerVisible: Ref<boolean> = ref(false);

  /** 正在保存 */
  saving: Ref<boolean> = ref(false);

  /** 当前编辑的数据类型 */
  editingKind: Ref<NavigationEditKind> = ref('item');

  /** 是否新增模式 */
  isCreate: Ref<boolean> = ref(false);

  /** 编辑前的原始标识（分组 key / 路由名） */
  editingKey: Ref<string> = ref('');

  /** 抽屉表单数据 */
  formData: Ref<Record<string, unknown>> = ref({});

  /** 分组列表（含停用项） */
  groups: ComputedRef<NavGroup[]> = computed(() => this.navStore.groups);

  /** 页面列表（含停用项与隐藏项） */
  items: ComputedRef<NavItem[]> = computed(() => this.navStore.items);

  /** 抽屉标题 */
  drawerHeader: ComputedRef<string> = computed(() => {
    const t = this.localeStore.t.navigationAdmin;
    return this.isCreate.value ? t.createHeader : t.editHeader;
  });

  /** 抽屉模式 */
  formMode: ComputedRef<FormMode> = computed(() =>
    this.isCreate.value ? FormMode.Create : FormMode.Edit);

  /** 分组下拉选项 */
  private groupOptions = computed(() => this.groups.value.map((g) => ({
    value: g.groupKey,
    label: `${g.groupKey} · ${this.resolveLabel(g.labelKey)}`,
  })));

  /** 分组表格列 */
  groupColumns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const t = this.localeStore.t.navigationAdmin;
    return [
      { colKey: 'groupKey', title: t.colKey, width: 140 },
      { colKey: 'labelKey', title: t.colLabelKey, width: 200 },
      { colKey: 'icon', title: t.colIcon, width: 140 },
      { colKey: 'sortOrder', title: t.colSort, width: 90 },
      { colKey: 'enabled', title: t.colEnabled, width: 90 },
      { colKey: 'actions', title: t.colActions, width: 140, fixed: 'right' as const },
    ];
  });

  /** 页面表格列 */
  itemColumns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const t = this.localeStore.t.navigationAdmin;
    return [
      { colKey: 'routeName', title: t.colKey, width: 170 },
      { colKey: 'path', title: t.fieldPath, width: 180 },
      { colKey: 'label', title: t.colLabelZh, width: 160 },
      { colKey: 'icon', title: t.colIcon, width: 120 },
      { colKey: 'groupKey', title: t.colGroup, width: 120 },
      { colKey: 'inMenu', title: t.colMenu, width: 100 },
      { colKey: 'sortOrder', title: t.colSort, width: 90 },
      { colKey: 'enabled', title: t.colEnabled, width: 90 },
      { colKey: 'actions', title: t.colActions, width: 140, fixed: 'right' as const },
    ];
  });

  /** 抽屉表单字段（按编辑类型切换） */
  fields: ComputedRef<AutoFormField[]> = computed(() => {
    const t = this.localeStore.t.navigationAdmin;
    const required = [{ required: true, message: this.localeStore.t.common.required }];
    if (this.editingKind.value === 'group') {
      const base: AutoFormField[] = this.isCreate.value
        ? [{ name: 'groupKey', label: t.colKey, type: 'input', rules: required }]
        : [];
      return [
        ...base,
        { name: 'labelKey', label: t.colLabelKey, type: 'input', rules: required },
        { name: 'icon', label: t.colIcon, type: 'input' },
        { name: 'sortOrder', label: t.colSort, type: 'number' },
        { name: 'enabled', label: t.colEnabled, type: 'switch' },
      ];
    }
    const base: AutoFormField[] = this.isCreate.value
      ? [
        { name: 'routeName', label: t.colKey, type: 'input', rules: required },
        { name: 'path', label: t.fieldPath, type: 'input', rules: required },
      ]
      : [];
    return [
      ...base,
      { name: 'labelKey', label: t.colLabelKey, type: 'input', rules: required },
      { name: 'labelZh', label: t.colLabelZh, type: 'input' },
      { name: 'icon', label: t.colIcon, type: 'input' },
      { name: 'groupKey', label: t.colGroup, type: 'select', options: this.groupOptions.value },
      { name: 'sortOrder', label: t.colSort, type: 'number' },
      {
        name: 'permissionCode', label: t.fieldPermission, type: 'select',
        filterable: true, clearable: true,
        // 兼容库里已有的自定义 / 历史权限码，避免编辑时无法回显
        options: (form: Record<string, unknown>): AutoFormOption[] => {
          const current = String(form.permissionCode ?? '');
          return current && !PERMISSION_OPTIONS.some((o) => o.value === current)
            ? [...PERMISSION_OPTIONS, { value: current, label: current }]
            : PERMISSION_OPTIONS;
        },
      },
      { name: 'description', label: t.fieldDescription, type: 'textarea' },
      { name: 'toolsText', label: t.fieldTools, type: 'input' },
      { name: 'inMenu', label: t.colMenu, type: 'switch' },
      { name: 'superAdminOnly', label: t.fieldSuperAdmin, type: 'switch' },
      { name: 'enabled', label: t.colEnabled, type: 'switch' },
    ];
  });

  /** 解析 i18n key 为当前语言文案 */
  private resolveLabel = (key: string): string => {
    const [namespace, name] = key.includes('.') ? key.split('.', 2) : ['', key];
    const dict = (namespace === 'home'
      ? this.localeStore.t.home : this.localeStore.t.menu) as Record<string, string>;
    return dict[name] ?? dict[key] ?? key;
  };

  /** 是否允许编辑（由 CONFIG_VIEW 推导 CONFIG_EDIT） */
  canEditNav = (): boolean => this.canEdit();

  /** 加载导航数据 */
  load = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      await this.navStore.load();
    } catch (err) {
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 打开新增抽屉
   * @param {NavigationEditKind} kind - 分组或页面
   */
  openCreate = (kind: NavigationEditKind): void => {
    if (!this.canEditNav()) return;
    this.editingKind.value = kind;
    this.isCreate.value = true;
    this.editingKey.value = '';
    this.formData.value = kind === 'group'
      ? { groupKey: '', labelKey: '', icon: '', sortOrder: 100, enabled: true }
      : {
        routeName: '', path: '', labelKey: '', labelZh: '', icon: '',
        groupKey: this.groups.value[0]?.groupKey ?? '', sortOrder: 100,
        permissionCode: '', description: '', toolsText: '',
        inMenu: false, superAdminOnly: false, enabled: true,
      };
    this.drawerVisible.value = true;
  };

  /**
   * 打开编辑抽屉
   * @param {NavigationEditKind} kind - 分组或页面
   * @param {NavGroup | NavItem} row - 被编辑的行
   */
  openEdit = (kind: NavigationEditKind, row: NavGroup | NavItem): void => {
    if (!this.canEditNav()) return;
    this.editingKind.value = kind;
    this.isCreate.value = false;
    if (kind === 'group') {
      const g = row as NavGroup;
      this.editingKey.value = g.groupKey;
      this.formData.value = {
        labelKey: g.labelKey, icon: g.icon, sortOrder: g.sortOrder, enabled: g.enabled,
      };
    } else {
      const i = row as NavItem;
      this.editingKey.value = i.routeName;
      this.formData.value = {
        labelKey: i.labelKey, labelZh: i.labelZh, icon: i.icon, groupKey: i.groupKey,
        sortOrder: i.sortOrder, permissionCode: i.permissionCode, description: i.description,
        toolsText: i.coveredByTools.join(', '), inMenu: i.inMenu,
        superAdminOnly: i.superAdminOnly, enabled: i.enabled,
      };
    }
    this.drawerVisible.value = true;
  };

  /** 提交新增或编辑 */
  submit = async (): Promise<void> => {
    if (!this.canEditNav()) return;
    const form = this.formData.value;
    const sortOrder = Number(form.sortOrder) || 0;
    this.saving.value = true;
    try {
      if (this.editingKind.value === 'group') {
        const group: NavGroup = {
          groupKey: String(form.groupKey ?? this.editingKey.value),
          labelKey: String(form.labelKey ?? ''),
          icon: String(form.icon ?? ''),
          sortOrder,
          enabled: form.enabled !== false,
        };
        if (this.isCreate.value) await this.service.saveGroup(group);
        else await this.service.updateGroup(this.editingKey.value, group);
      } else {
        const item: NavItem = {
          routeName: String(form.routeName ?? this.editingKey.value),
          path: String(form.path ?? this.items.value.find((i) => i.routeName === this.editingKey.value)?.path ?? ''),
          labelKey: String(form.labelKey ?? ''),
          labelZh: String(form.labelZh ?? ''),
          icon: String(form.icon ?? ''),
          groupKey: String(form.groupKey ?? ''),
          inMenu: form.inMenu === true,
          sortOrder,
          permissionCode: String(form.permissionCode ?? ''),
          superAdminOnly: form.superAdminOnly === true,
          description: String(form.description ?? ''),
          coveredByTools: String(form.toolsText ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          enabled: form.enabled !== false,
        };
        if (this.isCreate.value) await this.service.saveItem(item);
        else await this.service.updateItem(this.editingKey.value, item);
      }
      MessagePlugin.success(this.localeStore.t.common.saveSuccess);
      this.drawerVisible.value = false;
      await this.navStore.load();
    } catch (err) {
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.saveFailed);
    } finally {
      this.saving.value = false;
    }
  };

  /**
   * 删除分组或页面
   * @param {NavigationEditKind} kind - 分组或页面
   * @param {NavGroup | NavItem} row - 被删除的行
   */
  remove = async (kind: NavigationEditKind, row: NavGroup | NavItem): Promise<void> => {
    if (!this.canEditNav()) return;
    const key = kind === 'group' ? (row as NavGroup).groupKey : (row as NavItem).routeName;
    try {
      if (kind === 'group') await this.service.deleteGroup(key);
      else await this.service.deleteItem(key);
      MessagePlugin.success(this.localeStore.t.common.deleteSuccess);
      await this.navStore.load();
    } catch (err) {
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.deleteFailed);
    }
  };

  /** 跳转到语言包管理页（高级入口，日常中英文请在本页成对修改） */
  goI18n = (): void => {
    void this.vueRouter.push('/i18n-messages?namespace=aiChat');
  };
}

/**
 * Composition API 包装函数
 * @description 将 NavigationAdminModel 包装为页面可用的函数
 */
export const useNavigationAdminModel = () => {
  const model = new NavigationAdminModel();
  onMounted(() => { void model.load(); });
  return { ...model };
};
