/**
 * 格式化时间为 MySQL DATETIME 文本
 * @param {Date} date - 时间对象
 * @returns {string} YYYY-MM-DD HH:mm:ss
 * @description 文件 mtime 与数据库时间列统一按本地时间展示，避免时区二次偏移
 */
export const formatTimestamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
