/**
 * 状态对应的主题色
 * @param status - 申请状态
 */
export const statusTheme = (status: string): 'warning' | 'success' | 'danger' | 'default' => {
  return { pending: 'warning', approved: 'success', rejected: 'danger' }[status] as 'warning' | 'success' | 'danger' ?? 'default';
};

/**
 * 首字母大写
 * @param s - 原字符串
 */
export const capitalize = (s: string): string => {
  return s.charAt(0).toUpperCase() + s.slice(1);
};
