import { ref, computed, onMounted, onBeforeUnmount, type Ref, type ComputedRef, watch } from 'vue';
import { MOBILE_BREAKPOINT } from '@/constants/layout';
import { useRouter, useRoute } from 'vue-router';
import router from '@/router';
import { useStatusStore } from '@/stores/status';
import { useThemeStore } from '@/stores/theme';
import type { MenuItem, MenuGroup } from '@/types/home';
import type { AutoThemeTimes, ThemeStyle } from '@/types/theme';
import { THEME_STYLES } from '@/constants/theme';
import { BaseModel, Permission } from '@/models/base-model';
import enConfig from 'tdesign-vue-next/es/locale/en_US';
import { useTabBarStore } from '@/stores/tab-bar';

/**
 * 首页数据模型类
 * @description 管理首页的所有业务逻辑，包括侧边栏控制、菜单导航、主题切换等
 */
export class HomeModel extends BaseModel {
  // ==============================
  // 依赖注入（router、store）
  // ==============================

  /**
   * Vue Router 实例
   * @type {ReturnType<typeof useRouter>}
   * @description 用于页面路由跳转
   */
  vueRouter: ReturnType<typeof useRouter> = useRouter();

  /**
   * Vue Route 实例
   * @type {ReturnType<typeof useRoute>}
   * @description 用于获取当前路由信息
   */
  route: ReturnType<typeof useRoute> = useRoute();

  /**
   * 系统状态存储实例
   * @type {ReturnType<typeof useStatusStore>}
   * @description 用于访问系统运行状态数据
   */
  statusStore: ReturnType<typeof useStatusStore> = useStatusStore();

  /**
   * 主题存储实例
   * @type {ReturnType<typeof useThemeStore>}
   * @description 用于访问和修改主题配置
   */
  themeStore: ReturnType<typeof useThemeStore> = useThemeStore();

  /**
   * TabBar 存储实例
   * @type {ReturnType<typeof useTabBarStore>}
   * @description 用于访问和修改 TabBar 配置
   */
  tabBarStore: ReturnType<typeof useTabBarStore> = useTabBarStore();

  // ==============================
  // 状态变量（ref）
  // ==============================

  /**
   * 侧边栏折叠状态
   * @type {Ref<boolean>}
   * @description 移动端默认折叠
   */
  collapsed: Ref<boolean> = ref(window.innerWidth <= MOBILE_BREAKPOINT);

  /**
   * 移动端抽屉侧边栏开关
   * @type {Ref<boolean>}
   * @description 控制移动端抽屉侧边栏的显示/隐藏
   */
  sidebarOpen: Ref<boolean> = ref(false);

  /**
   * TDesign 本地化配置
   * @type {ComputedRef<typeof enConfig | undefined>}
   * @description 根据当前语言设置 TDesign 本地化配置
   */
  tdesignLocale: ComputedRef<typeof enConfig | undefined> = computed(() => (this.localeStore.lang === 'en' ? enConfig : undefined));


  // ==============================
  // 静态数据
  // ==============================

  /**
   * 菜单分组 key → 翻译名称映射
   */
  private get GROUP_KEY_MAP(): Record<string, string> {
    const m = this.localeStore.t.menu;
    return {
      overview: m.overview,
      features: m.features,
      operations: m.operations,
      devtools: m.devtools,
      rbac: m.rbac,
    };
  }

  /**
   * 所有菜单项列表（未过滤权限）
   * @description 从路由配置派生菜单，保持单一数据源
   */
  private get allMenuItems(): { value: string; label: string; icon: string; group?: string; permissions?: Permission[]; superAdminOnly?: boolean }[] {
    const menu = this.localeStore.t.menu as Record<string, string>;
    const groupMap = this.GROUP_KEY_MAP;
    return router
      .getRoutes()
      .filter((r) => r.meta?.inMenu)
      .map((r) => {
        const labelKey = ((r.meta.label as string) ?? '').replace('menu.', '');
        return {
          value: r.name as string,
          label: menu[labelKey] ?? labelKey,
          icon: (r.meta.icon as string) ?? '',
          group: r.meta.menuGroup ? (groupMap[r.meta.menuGroup as string] ?? r.meta.menuGroup as string) : undefined,
          permissions: (r.meta.permissions as Permission[] | undefined),
          superAdminOnly: (r.meta.superAdminOnly as boolean | undefined),
        };
      });
  }

  /**
   * 根据权限过滤后的菜单项列表
   * @type {ComputedRef<MenuItem[]>}
   * @description 仅展示用户有权限访问的菜单项；权限列表为空时（未加载完成）显示全部菜单
   */
  menuItems: ComputedRef<MenuItem[]> = computed(() => {
    // 超级管理员专属入口先按身份过滤，避免权限误配时出现在其他角色菜单里
    const items = this.allMenuItems.filter((item) => !item.superAdminOnly || this.authStore.isAdmin);
    // 权限列表为空时（尚未加载或未登录），展示全部菜单，避免空白导航
    if (this.permissionStore.permissions.length === 0) {
      return items;
    }
    return items.filter((item) => {
      if (!item.permissions || item.permissions.length === 0) return true;
      return this.permissionStore.hasAnyPermission(item.permissions);
    });
  });

  /**
   * 分组元信息（顺序、图标）
   * @description 定义侧边栏分组的展示顺序和图标
   */
  private get GROUP_META(): { name: string; icon: string }[] {
    const h = this.localeStore.t.home;
    return [
      { name: h.groupOverview, icon: 'dashboard' },
      { name: h.groupFeatures, icon: 'application' },
      { name: h.groupOps, icon: 'server' },
      { name: h.groupDev, icon: 'code' },
      { name: h.groupRbac, icon: 'lock-on' },
    ];
  }

  /**
   * 按分组聚合的菜单项列表
   * @type {ComputedRef<MenuGroup[]>}
   * @description 按 GROUP_META 定义的顺序聚合；忽略无分组的项
   */
  menuGroups: ComputedRef<MenuGroup[]> = computed(() => {
    const grouped = new Map<string, MenuItem[]>();
    for (const item of this.menuItems.value) {
      if (!item.group) continue;
      const arr = grouped.get(item.group);
      if (arr) arr.push(item);
      else grouped.set(item.group, [item]);
    }
    // 按 GROUP_META 的顺序输出，只保留有菜单项的分组
    return this.GROUP_META
      .filter((meta) => grouped.has(meta.name))
      .map((meta) => ({
        group: meta.name,
        icon: meta.icon,
        items: grouped.get(meta.name)!,
      }));
  });

  // ==============================
  // 计算属性（computed）
  // ==============================

  /**
   * 当前是否处于无权限页面（403）
   * @type {ComputedRef<boolean>}
   * @description 当前路由为 forbidden 时为 true，侧边栏导航全部禁用
   */
  isForbidden: ComputedRef<boolean> = computed(() => this.route.name === 'forbidden');

  /**
   * 当前激活路由名称
   * @type {ComputedRef<string>}
   */
  activeRoute: ComputedRef<string> = computed(() => (this.route.name as string) ?? '');

  /**
   * 水印文本
   * @type {ComputedRef<string>}
   * @description 登录后展示用户邮箱，未登录时展示 hostname
   */
  watermarkText: ComputedRef<string> = computed(() => {
    if (this.authStore.isLoggedIn && this.authStore.email) {
      return this.authStore.email;
    }
    return this.statusStore.hostname;
  });

  /**
   * 当前页面标题
   * @type {ComputedRef<string>}
   * @description 当前激活菜单项的标签文本
   */
  currentPageTitle: ComputedRef<string> = computed(
    () => this.menuItems.value.find((item) => item.value === this.activeRoute.value)?.label ?? '',
  );

  /**
   * 当前页面所属的上级菜单分组名
   * @type {ComputedRef<string>}
   * @description 当前激活菜单项所在分组的本地化名称（如「功能管理」），
   *              用于顶栏面包屑展示上级层级；无分组（如概览页）时为空字符串
   */
  currentPageGroup: ComputedRef<string> = computed(
    () => this.menuItems.value.find((item) => item.value === this.activeRoute.value)?.group ?? '',
  );

  /**
   * 当前主题是否为亮色
   * @type {ComputedRef<boolean>}
   * @description 用于顶栏亮/暗按钮图标显示
   */
  isCurrentThemeLight: ComputedRef<boolean> = computed(() => this.themeStore.isCurrentLight);

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 窗口尺寸变化回调（override BaseModel.onResize）
   * @description 响应窗口尺寸变化，同时更新移动端状态与侧边栏折叠状态
   */
  protected override onResize = (): void => {
    const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
    this.isMobile.value = mobile;
    if (mobile) {
      this.collapsed.value = true;
      this.sidebarOpen.value = false;
    }
  };

  /**
   * 实时渲染用 tab 列表
   * @description 以 store 中的 tab 作为身份源（name/path），
   *              label 和 icon 始终从语言响应式的 menuItems 中实时查表，
   *              从根源避免「打开 tab 时文案被定格」导致切语言不生效的问题。
   *              若 menuItems 中找不到对应项（如权限变化隐藏了菜单），
   *              则回退到 store 中原有值。
   */
  displayTabs = computed(() =>
    this.tabBarStore.tabs.map((tab) => {
      const menuItem = this.menuItems.value.find((item) => item.value === tab.name);
      return {
        ...tab,
        label: menuItem?.label ?? tab.label,
        icon: menuItem?.icon ?? tab.icon,
      };
    }),
  );

  /** 点击 tab 跳转 */
  handleTabNavigate = (name: string): void => {
    this.tabBarStore.setActive(name);
    this.vueRouter.push({ name });
  };

  /** 关闭 tab */
  handleTabClose = (name: string): void => {
    const targetName = this.tabBarStore.closeTab(name);
    if (targetName) {
      this.vueRouter.push({ name: targetName });
    }
  };

  /** 拖拽 tab 换位 */
  handleTabReorder = (fromIndex: number, toIndex: number): void => {
    this.tabBarStore.reorderTabs(fromIndex, toIndex);
  };

  /**
   * 切换侧边栏折叠状态
   * @returns {void}
   */
  toggleCollapsed = (): void => {
    this.collapsed.value = !this.collapsed.value;
  };

  /**
   * 打开移动端抽屉侧边栏
   * @returns {void}
   */
  openSidebar = (): void => {
    this.sidebarOpen.value = true;
  };

  /**
   * 关闭移动端抽屉侧边栏
   * @returns {void}
   */
  closeSidebar = (): void => {
    this.sidebarOpen.value = false;
  };

  /**
   * 菜单跳转
   * @param {string} value - 目标路由名称
   * @returns {void}
   * @description 跳转到指定路由，移动端点击后自动关闭抽屉
   */
  handleMenuChange = (value: string): void => {
    if (this.statusStore.webRestarting || this.isForbidden.value) {
      return;
    }
    this.vueRouter.push({ name: value });
    // 移动端点击菜单后关闭抽屉
    if (this.isMobile.value) {
      this.sidebarOpen.value = false;
    }
  };

  /**
   * 颜色选择器输入（实时预览）
   * @param {Event} event - 输入事件
   * @returns {void}
   */
  handleColorInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.themeStore.applyCustomColor(input.value, this.themeStore.customColor.isLight);
  };

  /**
   * 切换亮/暗背景模式
   * @param {MouseEvent} [event] - 鼠标事件（用于 View Transitions 动画起始坐标）
   * @returns {void}
   * @description 在当前风格的亮/暗模式之间切换
   */
  handleColorModeToggle = (event?: MouseEvent): void => {
    const origin = event ? { x: event.clientX, y: event.clientY } : undefined;
    // 手动切换亮暗时退出自动模式，避免定时器立刻覆盖用户选择
    if (this.themeStore.autoMode) this.themeStore.setAutoMode(false);
    const theme = this.themeStore.currentTheme;
    if (theme === 'custom') {
      // 自定义主题切换 isLight 标志
      this.themeStore.applyCustomColor(
        this.themeStore.customColor.accentPrimary,
        !this.themeStore.customColor.isLight,
        origin,
      );
    } else {
      // 其他风格：利用 THEME_STYLES 的 themeIds 在亮暗间切换
      const style = THEME_STYLES.find((s) => s.themeIds.includes(theme));
      if (style) {
        const isLight = this.isCurrentThemeLight.value;
        const targetId = isLight ? style.themeIds[0] : style.themeIds[1];
        this.themeStore.applyTheme(targetId, origin);
      }
    }
  };

  /**
   * 开启/关闭按时间自动切换主题
   * @param {MouseEvent} [event] - 鼠标事件（用于 View Transitions 动画起始坐标）
   */
  handleAutoModeToggle = (event?: MouseEvent): void => {
    const origin = event ? { x: event.clientX, y: event.clientY } : undefined;
    this.themeStore.setAutoMode(!this.themeStore.autoMode, origin);
  };

  /**
   * 更新自动切换时间
   * @param {AutoThemeTimes} times - 亮色/暗色切换时间
   */
  handleAutoTimeChange = (times: AutoThemeTimes): void => {
    this.themeStore.setAutoTimes(times.lightTime, times.darkTime);
  };

  /**
   * 切换主题风格（来自主题选择器）
   * @param {ThemeStyle} styleId - 目标风格 ID
   * @returns {void}
   * @description 应用指定的主题风格，自动保留当前亮暗模式
   */
  handleThemeChange = (styleId: ThemeStyle): void => {
    this.themeStore.applyStyle(styleId);
  };

  // ==============================
  // 生命周期方法
  // ==============================

  /**
   * 组件挂载时调用的生命周期方法
   * @description 启动窗口 resize 监听（全局状态轮询已在路由守卫中启动）
   */
  mounted = async (): Promise<void> => {
    this.startResizeListener();
  };

  /**
   * 组件卸载前调用的生命周期方法
   * @description 停止状态轮询、移除窗口 resize 监听，防止内存泄漏
   */
  beforeUnmount = (): void => {
    this.statusStore.stopPolling();
    this.stopResizeListener();
    this.themeStore.dispose();
  };
}

/**
 * Composition API 包装函数
 * @description 将 HomeModel 类包装为 Composition API 可用的函数
 */
export const useHomeModel = () => {
  const model = new HomeModel();

  // 在组件挂载时调用 mounted 方法
  onMounted(() => { model.mounted(); });

  // 在组件卸载前调用 beforeUnmount 方法
  onBeforeUnmount(() => { model.beforeUnmount(); });

  /** 监听路由变化，自动将 inMenu 的路由添加到 tab 栏 */
  watch(
    () => model.route.name,
    (name) => {
      if (!name || !model.route.meta?.inMenu) return;
      const menuItem = model.menuItems.value.find((item) => item.value === name);
      if (!menuItem) return;
      model.tabBarStore.addTab({
        name: menuItem.value,
        path: model.route.path,
        label: menuItem.label,
        icon: menuItem.icon,
      });
    },
    { immediate: true },
  );

  return {
    ...model,
  };
};
