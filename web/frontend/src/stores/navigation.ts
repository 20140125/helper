/**
 * 侧边栏导航全局状态
 * @description 启动时读取 /api/navigation，供菜单渲染与管理页共享；
 *   接口失败时保持空数组，home-model 会回退到路由派生菜单，避免白屏。
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { NavigationService } from '@/services/navigation-service';
import type { NavGroup, NavItem } from '@/types/navigation';

export const useNavigationStore = defineStore('navigation', () => {
  /** 分组列表 */
  const groups = ref<NavGroup[]>([]);
  /** 页面列表 */
  const items = ref<NavItem[]>([]);
  /** 是否已成功加载 */
  const loaded = ref(false);
  /** 加载中 */
  const loading = ref(false);

  /** 导航服务实例 */
  const service = new NavigationService();

  /**
   * 加载导航数据
   * @returns {Promise<void>}
   * @description 管理页保存后重复调用即可刷新；失败时保留已有数据
   */
  const load = async (): Promise<void> => {
    loading.value = true;
    try {
      const res = await service.fetchNavigation();
      groups.value = res.data.groups;
      items.value = res.data.items;
      loaded.value = true;
    } catch {
      loaded.value = false;
    } finally {
      loading.value = false;
    }
  };

  return { groups, items, loaded, loading, load };
});
