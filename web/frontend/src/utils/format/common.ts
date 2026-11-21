/**
 * 将 UTC 时间戳格式化为服务器时区（Asia/Hong_Kong，UTC+8）的时间字符串
 * 与电脑本地时区无关，保证显示的始终是服务器真实时间
 * @param {number} timestamp - UTC 时间戳（毫秒）
 * @returns {string} 格式化后的时间字符串（如 "2026/03/13 09:42:28"）
 */
export const formatServerTime = (timestamp: number): string => new Date(timestamp).toLocaleString('zh-CN', {
  timeZone: 'Asia/Hong_Kong',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * 格式化聊天消息时间戳为紧凑格式
 * 与电脑本地时区无关，始终使用服务器时区（Asia/Hong_Kong，UTC+8）
 * @param {number} timestamp - UTC 时间戳（毫秒）
 * @returns {string} 格式化后的时间字符串（今天显示 HH:mm，否则显示 MM-DD HH:mm）
 */
export const formatChatTime = (timestamp: number): string => {
  const d = new Date(timestamp);
  const now = new Date();
  
  const timeStr = formatServerTime(timestamp);

  const dDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
  const nowDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
  const isToday = dDate.getFullYear() === nowDate.getFullYear()
    && dDate.getMonth() === nowDate.getMonth()
    && dDate.getDate() === nowDate.getDate();

  if (isToday) return timeStr;

  const monthNum = String(dDate.getMonth() + 1).padStart(2, '0');
  const dayNum = String(dDate.getDate()).padStart(2, '0');
  return `${monthNum}-${dayNum} ${timeStr}`;
};

/**
 * 格式化文件大小
 * @param {number} bytes - 文件字节数
 * @returns {string} 格式化后的文件大小字符串（如 "1.2 KB"、"3.4 MB"）
 */
export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * 将已用/总量字节数格式化为 "X.X GB / Y.Y GB (Z%)"（i18n 无关）
 * @param {number} used - 已使用字节数
 * @param {number} total - 总字节数
 * @returns {string} 格式化后的占用字符串
 */
export const formatBytesUsage = (used: number, total: number): string => {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return '未知';
  const toGB = (bytes: number): string => (bytes / 1024 / 1024 / 1024).toFixed(1);
  const percent = Math.round((used / total) * 100);
  return `${toGB(used)} GB / ${toGB(total)} GB (${percent}%)`;
};


/**
 * 将可能包含子目录的文件名编码为安全的 URL 路径
 * @description 仅对每个路径段调用 encodeURIComponent，保留 / 分隔符以匹配后端通配符路由
 * @param filename - 原始文件名（可能包含子目录路径，如 api_responses/foo.json）
 * @returns 编码后的 URL 路径段
 */
export const encodeFilenamePath = (filename: string): string =>
  filename.split('/').map(encodeURIComponent).join('/');
