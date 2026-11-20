import os from 'os';

/**
 * 获取本机首个非内部的 IPv4 地址
 * @returns 局域网 IP（如 '21.6.71.174'）；若找不到则返回兜底值 '0.0.0.0'
 * @description
 *   - 用于启动日志展示可复制访问的真实 IP，避免打印 'localhost' 让远程用户困惑
 *   - 优先返回非 lo/docker 等内部接口下的第一个 IPv4
 *   - 绑定监听仍应使用 '0.0.0.0'（监听所有接口），本函数只负责展示
 */
export const getLocalIp = (): string => {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    const addrs = ifaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return '0.0.0.0';
};
