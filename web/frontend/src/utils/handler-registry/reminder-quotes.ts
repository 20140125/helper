import type { HandlerRegistry } from '@/types/handler-registry';
import { useLocaleStore } from '@/stores/locale';
import { REMINDER_QUOTES_BUCKETS } from '@/constants/reminder-quotes';
import type { ReminderQuotesBucket } from '@/types/reminder-quotes';

/**
 * 获取 bucket → 国际化 label 的映射
 * @description 直接复用 locale 中的 bucketLabels 映射表，未命中时回退显示 key 本身。
 */
const getBucketLabel = (bucket: ReminderQuotesBucket): string => {
  const { t } = useLocaleStore();
  const labels = t.reminderQuotes.bucketLabels as Record<string, string>;
  return labels[bucket] ?? bucket;
};

/**
 * 创建提醒寄语库页面的 handler 注册表
 * @description 将 reminder-quote-form 中的动态选项集中注册，
 *              供 field-enhancer 解析 $handler:reminderQuotes.* 标记。
 *              选项由 REMINDER_QUOTES_BUCKETS 常量 + locale 运行时拼装，
 *              新增/调整桶只需改常量 + locale.bucketLabels，无需再改 json 模板。
 * @returns HandlerRegistry 提醒寄语相关的 handler 注册表
 */
export const createReminderQuotesHandlers = (): HandlerRegistry => ({
  /** 桶下拉选项（按 REMINDER_QUOTES_BUCKETS 的顺序拼装，供新建/编辑表单使用） */
  'reminderQuotes.bucketOptions': (): Array<{ label: string; value: ReminderQuotesBucket }> =>
    REMINDER_QUOTES_BUCKETS.map((b) => ({ label: getBucketLabel(b), value: b })),
});
