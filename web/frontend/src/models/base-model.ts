import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { useRouter } from 'vue-router';
import { usePermissionStore } from '@/stores/permission';
import { Permission } from '@/types/permission';
import { MOBILE_BREAKPOINT } from '@/constants/layout';
import { useLocaleStore } from '@/stores/locale';
import { useAuthStore } from '@/stores/auth';

/**
 * 页面数据模型基类
 * @description 封装所有 Model 共享的通用状态和生命周期逻辑，子类通过继承复用
 *
 * 提供的通用能力：
 * - `isMobile`：响应式移动端检测（窗口宽度 <= 768px）
 * - `pageLoading`：页面加载状态（默认 `ref(false)`，子类可用 getter 覆盖为 computed 语义）
 * - `permissionStore`：权限 Store 实例（所有 Model 共享，无需子类重复导入）
 * - `canEdit`：基于当前路由元数据自动解析的编辑权限判断（自动匹配对应的 EDIT 权限码）
 * - `startResizeListener` / `stopResizeListener`：管理 resize 事件监听
 * - `onResize`：窗口尺寸变化回调（子类可 override 扩展行为）
 *
 * 子类使用方式：
 * ```typescript
 * export class MyModel extends BaseModel {
 *   mounted = (): void => {
 *     this.startResizeListener();  // 注册 resize 监听
 *     this.loadData();             // 子类自身的初始化逻辑
 *   };
 *
 *   beforeUnmount = (): void => {
 *     this.stopResizeListener();   // 移除 resize 监听
 *     clearInterval(this.timer);   // 子类自身的清理逻辑
 *   };
 * }
 * ```
 *
 * 如需扩展 resize 行为（如 HomeModel 额外处理侧边栏折叠），子类可 override `onResize`：
 * ```typescript
 * protected override onResize = (): void => {
 *   this.isMobile.value = window.innerWidth <= 768;
 *   this.collapsed.value = this.isMobile.value;
 * };
 * ```
 *
 * 如需将 pageLoading 改为 computed 语义（如 TriggerModel、DashboardModel），
 * 子类可用 computed override 覆盖：
 * ```typescript
 * override pageLoading = computed(() => this.toolsLoading.value || this.runningKey.value);
 * ```
 */
export class BaseModel {
  // ==============================
  // 通用依赖
  // ==============================

  /**
   * 权限存储实例
   * @type {ReturnType<typeof usePermissionStore>}
   * @description 所有 Model 共享的权限 Store，无需子类单独导入
   */
  permissionStore: ReturnType<typeof usePermissionStore> = usePermissionStore();

  /**
   *  i18n 文案 Store（跟随当前语言切换）
   * @type {ReturnType<typeof useLocaleStore>}
   * @description 跟随当前语言切换的国际化文案 Store
   */
  localeStore: ReturnType<typeof useLocaleStore> = useLocaleStore();

  /**
   * i18n 文案根（响应式 computed）
   * @type {ComputedRef<ReturnType<typeof useLocaleStore>['t']>}
   * @description 在 useXxxModel 中通过 `return { ...model }` 自动暴露给 view 层，
   *              view 层模板可直接使用 `{{ t.xxx.yyy }}`，无需各 useXxxModel 重复桥接。
   *              如需暴露子树，可在 useXxxModel 中显式覆盖（如 forbidden-model）。
   */
  t: ComputedRef<ReturnType<typeof useLocaleStore>['t']> = computed(() => this.localeStore.t);

  /**
   * 鉴权存储实例
   * @type {ReturnType<typeof useAuthStore>}
   * @description 用于初始化时校验 JWT Token 有效性
   */
  authStore: ReturnType<typeof useAuthStore> = useAuthStore();

  // ==============================
  // 通用状态变量
  // ==============================

  /**
   * 移动端检测状态
   * @type {Ref<boolean>}
   * @description 根据窗口宽度判断是否为移动端布局（<= 768px）
   */
  isMobile: Ref<boolean> = ref(window.innerWidth <= MOBILE_BREAKPOINT);

  /**
   * 页面加载状态
   * @type {Ref<boolean>}
   * @description 通用的页面级 loading 状态，默认为 false。
   *              子类可直接使用（如 `this.pageLoading.value = true`），
   *              也可用 getter 覆盖为 computed 语义
   */
  pageLoading: Ref<boolean> = ref(false);

  // ==============================
  // 权限辅助方法
  // ==============================

  /**
   * 判断用户是否拥有编辑权限
   * @description 支持两种用法：
   *   1. **无参数（自动推导）**：从当前路由 `meta.permissions` 中的 VIEW 权限自动推导 EDIT 权限
   *      - 用户拥有推导出的任一 EDIT 权限即返回 true
   *      - 适用于单权限域页面（如 rules、cache、logs）
   *   2. **传入指定 VIEW 权限**：只推导该权限对应的 EDIT 权限
   *      - 适用于多权限域页面（如 config 页面需区分 CONFIG_EDIT 和 WEBHOOK_EDIT）
   *
   * @param viewPermission - 可选，指定的 VIEW 权限码。传入后只推导该权限对应的 EDIT 权限
   * @returns 是否拥有编辑权限
   *
   * @example
   * ```vue
   * <!-- 单权限域页面：自动推导，无需传参 -->
   * <t-button v-if="canEdit()" @click="handleEdit">编辑</t-button>
   *
   * <!-- 多权限域页面：指定具体权限 -->
   * <t-button v-if="canEdit(Permission.CONFIG_VIEW)" @click="editConfig">修改配置</t-button>
   * <t-button v-if="canEdit(Permission.WEBHOOK_VIEW)" @click="addWebhook">新增机器人</t-button>
   * ```
   */
  canEdit = (viewPermission?: Permission): boolean => {
    try {
      let viewPermissions: Permission[];

      if (viewPermission) {
        // 指定权限：只推导该权限对应的 EDIT
        viewPermissions = [viewPermission];
      } else {
        // 自动推导：从路由 meta.permissions 获取
        const router = useRouter();
        const routePermissions = router.currentRoute.value.meta.permissions as Permission[] | undefined;
        if (!routePermissions || routePermissions.length === 0) return true;
        viewPermissions = routePermissions;
      }

      // 从 VIEW 权限码推导对应的 EDIT 权限码
      const editPermissions = viewPermissions
        .filter((p) => p.endsWith(':view'))
        .map((p) => p.replace(/:view$/, ':edit') as Permission);

      if (editPermissions.length === 0) return true;
      return this.permissionStore.hasAnyPermission(editPermissions);
    } catch (err) {
      // 在非路由上下文中（如 HomeModel）graceful fallback；
      // 同时打印 warn 帮助定位真实 bug（避免被静默吞掉）
      console.warn('[BaseModel.canEdit] fallback to true:', err);
      return true;
    }
  };

  // ==============================
  // resize 监听管理
  // ==============================

  /**
   * 窗口尺寸变化回调
   * @description 默认仅更新 isMobile。子类需要扩展 resize 行为时，可直接 override 此属性
   */
  protected onResize = (): void => {
    this.isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT;
  };

  /**
   * 注册窗口 resize 事件监听
   * @description 子类在 mounted 中调用
   */
  protected startResizeListener = (): void => {
    window.addEventListener('resize', this.onResize);
  };

  /**
   * 移除窗口 resize 事件监听
   * @description 子类在 beforeUnmount 中调用，防止内存泄漏
   */
  protected stopResizeListener = (): void => {
    window.removeEventListener('resize', this.onResize);
  };
}

// ==============================
// 重导出 Permission 枚举，供子类和 View 层统一从 BaseModel 获取
// ==============================
export { Permission } from '@/types/permission';
