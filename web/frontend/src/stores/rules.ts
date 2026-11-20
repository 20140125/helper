import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { RuleService } from '@/services/rule-service';
import type { Rule, RulePayload, RuleTestResult } from '@/types/rule';
import { MessagePlugin } from 'tdesign-vue-next';
import { useLocaleStore } from '@/stores/locale';

/**
 * 规则管理全局Store类
 * @description 管理规则相关的全局状态，供多个页面/组件共享使用
 */
export class RulesStore {
  // ==============================
  // 状态变量
  // ==============================
  public rules = ref<Rule[]>([]);
  public loading = ref(false);

  // ==============================
  // 私有变量（不导出）
  // ==============================
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  // ==============================
  // 依赖注入
  // ==============================
  private ruleService: RuleService = new RuleService();
  private messagePlugin = MessagePlugin;

  // ==============================
  // 计算属性（使用箭头函数+computed，便于 ...store 展开）
  // ==============================
  
  /** 启用规则数量 */
  enabledRulesCount = computed<number>(() => {
    return this.rules.value.filter(rule => rule.enabled).length;
  });

  /** 禁用规则数量 */
  disabledRulesCount = computed<number>(() => {
    return this.rules.value.filter(rule => !rule.enabled).length;
  });

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 获取规则列表
   * @param {boolean} force - 是否强制刷新，默认 false（有缓存时跳过请求）
   * @returns {Promise<void>}
   * @description 从服务端获取规则数据并更新状态；有缓存时默认复用，避免重复请求
   */
  fetchRules = async (force = false): Promise<void> => {    if (!force && this.rules.value.length > 0) return;
    this.loading.value = true;
    try {
      const { data: { rules } } = await this.ruleService.fetchRules();
      this.rules.value = rules;
    } catch {
      // 请求失败时保持原有数据，不阻塞页面
    } finally {
      this.loading.value = false;
    }
  }

  /**
   * 创建新规则
   * @param {RulePayload} payload - 规则创建参数
   * @returns {Promise<Rule>}
   * @description 创建新规则并添加到规则列表
   */
  addRule = async (payload: RulePayload): Promise<Rule> => {
    const { data: { rule } } = await this.ruleService.createRule(payload);
    this.rules.value.push(rule);
        this.messagePlugin.success(useLocaleStore().t.common.createSuccess);
    return rule;
  }

  /**
   * 编辑规则
   * @param {string} id - 规则ID
   * @param {Partial<RulePayload>} payload - 规则更新参数
   * @returns {Promise<Rule>}
   * @description 更新指定规则的信息
   */
  editRule = async (id: string, payload: Partial<RulePayload>): Promise<Rule> => {
    const { data: { rule } } = await this.ruleService.updateRule(id, payload);
    const idx = this.rules.value.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.rules.value[idx] = rule;
    }
        this.messagePlugin.success(useLocaleStore().t.common.updateSuccess);
    return rule;
  }

  /**
   * 拖拽排序后重排规则
   * @param {number} from - 被拖动规则的原索引
   * @param {number} to - 被拖动规则的目标索引
   * @returns {Promise<void>}
   * @description 本地先重排保证即时反馈，再整体持久化到服务端；
   *              成功时以服务端返回为准（防御并发增删），失败时保留本地顺序并提示
   */
  reorderRules = async (from: number, to: number): Promise<void> => {
    const list = [...this.rules.value];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    this.rules.value = list;
    try {
      const { data: { rules } } = await this.ruleService.updateRuleOrder(list.map((r) => r.id));
      this.rules.value = rules;
    } catch {
      this.messagePlugin.error(useLocaleStore().t.rules.reorderFailed);
    }
  }

  /**
   * 删除规则
   * @param {string} id - 规则ID
   * @returns {Promise<void>}
   * @description 删除指定规则
   */
  removeRule = async (id: string): Promise<void> => {
    await this.ruleService.deleteRule(id);
    this.rules.value = this.rules.value.filter((r) => r.id !== id);
      this.messagePlugin.success(useLocaleStore().t.common.deleteSuccess);
  }

  /**
   * 测试规则
   * @param {string} id - 规则ID
   * @returns {Promise<RuleTestResult>}
   * @description 对指定规则进行测试
   */
  runTest = async (id: string): Promise<RuleTestResult> => {
    const data = await this.ruleService.testRule(id);
    return data;
  }

  /**
   * 开始轮询规则状态
   * @param {number} interval - 轮询间隔（毫秒），默认30000
   * @returns {void}
   */
  startPolling = (interval: number = 30000): void => {
    this.fetchRules(true);
    if (this.pollingTimer !== null) return;
    this.pollingTimer = setInterval(() => this.fetchRules(true), interval);
  }

  /**
   * 停止轮询规则状态
   * @returns {void}
   */
  stopPolling = (): void => {
    if (this.pollingTimer !== null) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}

/**
 * 创建Rules Store实例的工厂函数
 * @description 将RulesStore类包装为Pinia可用的Store
 */
export const useRulesStore = defineStore('rules', () => {
  const store = new RulesStore();
  
  return {
    ...store,
  };
});
