import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface TabItem {
  /** 路由 name */
  name: string;
  /** 路由 path */
  path: string;
  /** 显示标签文本 */
  label: string;
  /** TDesign icon 名称 */
  icon: string;
}

const TAB_BAR_STORAGE_KEY = 'helper_tab_bar';

class TabBarStore {
  /** 已打开的 tab 列表 */
  tabs = ref<TabItem[]>(this.loadFromStorage());

  /** 当前激活的 tab name */
  activeTab = ref<string>('');

  private loadFromStorage(): TabItem[] {
    try {
      const raw = sessionStorage.getItem(TAB_BAR_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as TabItem[];
    } catch {
      // 忽略解析错误
    }
    return [];
  }

  private saveToStorage(): void {
    sessionStorage.setItem(TAB_BAR_STORAGE_KEY, JSON.stringify(this.tabs.value));
  }

  /**
   * 添加或激活一个 tab
   * @param tab - 要添加的 tab 信息
   */
  addTab = (tab: TabItem): void => {
    const exists = this.tabs.value.find((t) => t.name === tab.name);
    if (!exists) {
      this.tabs.value.push(tab);
      this.saveToStorage();
    }
    this.activeTab.value = tab.name;
  };

  /**
   * 关闭一个 tab，至少保留一个
   * @param name - 要关闭的 tab 的路由 name
   * @returns 需要跳转的目标 tab name（若关闭的是当前激活 tab）
   */
  closeTab = (name: string): string | null => {
    if (this.tabs.value.length <= 1) return null;

    const idx = this.tabs.value.findIndex((t) => t.name === name);
    if (idx === -1) return null;

    this.tabs.value.splice(idx, 1);
    this.saveToStorage();

    // 若关闭的是当前激活 tab，则跳转到相邻 tab
    if (this.activeTab.value === name) {
      const nextTab = this.tabs.value[Math.min(idx, this.tabs.value.length - 1)];
      this.activeTab.value = nextTab.name;
      return nextTab.name;
    }
    return null;
  };

  /**
   * 拖拽排序 tab
   * @param fromIndex - 拖起 tab 的原始下标
   * @param toIndex - 拖放目标位置的下标
   */
  reorderTabs = (fromIndex: number, toIndex: number): void => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= this.tabs.value.length ||
      toIndex >= this.tabs.value.length
    ) {
      return;
    }
    const [moved] = this.tabs.value.splice(fromIndex, 1);
    this.tabs.value.splice(toIndex, 0, moved);
    this.saveToStorage();
  };

  /**
   * 设置当前激活 tab
   */
  setActive = (name: string): void => {
    this.activeTab.value = name;
  };
}

export const useTabBarStore = defineStore('tab-bar', () => {
  const store = new TabBarStore();
  return {
    ...store,
  };
});
