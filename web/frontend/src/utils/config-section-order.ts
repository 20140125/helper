/** 配置页卡片分列顺序的本地存储键（个人布局偏好，无需服务端持久化） */
const STORAGE_KEY = 'helper.config.sectionColumns';

/**
 * 读取已保存的双列卡片顺序
 * @returns {string[][]} 两列的 section key 列表；无记录或数据损坏时返回空数组
 */
export const readSectionColumns = (): string[][] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 2) return [];
    return parsed.map((column) =>
      Array.isArray(column) ? column.filter((key): key is string => typeof key === 'string') : [],
    );
  } catch {
    return [];
  }
};

/**
 * 保存双列卡片顺序
 * @param {string[][]} columns - 两列的 section key 列表
 * @returns {void}
 * @description 隐私模式等禁用 localStorage 的场景静默忽略，不影响拖拽交互
 */
export const writeSectionColumns = (columns: string[][]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch {
    // 忽略写入失败
  }
};
