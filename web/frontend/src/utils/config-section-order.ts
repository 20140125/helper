/** 配置页卡片排序的本地存储键（个人布局偏好，无需服务端持久化） */
const STORAGE_KEY = 'helper.config.sectionOrder';

/** 旧版双列布局的存储键，仅用于迁移历史排序 */
const LEGACY_KEY = 'helper.config.sectionColumns';

/**
 * 把旧版双列顺序交错还原成线性顺序
 * @param {unknown} parsed - localStorage 中解析出的旧数据
 * @returns {string[]} 线性 section key 列表
 */
const flattenLegacyColumns = (parsed: unknown): string[] => {
  if (!Array.isArray(parsed) || parsed.length !== 2) return [];
  const columns = parsed.map((column) =>
    Array.isArray(column) ? column.filter((key): key is string => typeof key === 'string') : [],
  );
  const order: string[] = [];
  const maxLen = Math.max(0, ...columns.map((column) => column.length));
  for (let i = 0; i < maxLen; i += 1) {
    columns.forEach((column) => {
      if (column[i]) order.push(column[i]);
    });
  }
  return order;
};

/**
 * 读取已保存的卡片线性顺序
 * @returns {string[]} section key 列表；无记录或数据损坏时返回空数组
 * @description 优先读新版扁平顺序；不存在时从旧版双列数据迁移，避免用户丢失拖拽结果
 */
export const readSectionOrder = (): string[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((key): key is string => typeof key === 'string');
      }
    }
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) return flattenLegacyColumns(JSON.parse(legacy));
  } catch {
    // 数据损坏时回退到默认顺序
  }
  return [];
};

/**
 * 保存卡片的线性顺序
 * @param {string[]} order - section key 列表
 * @returns {void}
 * @description 隐私模式等禁用 localStorage 的场景静默忽略，不影响拖拽交互
 */
export const writeSectionOrder = (order: string[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // 忽略写入失败
  }
};
