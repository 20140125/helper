import { readWebServiceStatus, readLauncherStatus } from '@/routes/utils';
import { WEB_PORT } from '@/types/web-service';
import type { ToolImpl, ToolResult } from '@/types/ai-chat';

/**
 * 把回调式状态读取包装成 Promise
 * @template T 状态类型
 * @param {(cb: (status: T) => void) => void} reader - 回调式读取函数
 * @returns {Promise<T>} 状态
 */
const readStatus = <T>(reader: (cb: (status: T) => void) => void): Promise<T> =>
  new Promise<T>((resolve) => reader(resolve));

/**
 * query_service_status 工具实现
 * @description 查询 Web 服务运行状态：9527 主服务进程（web.pid）与 3001 launcher 常驻进程（launcher.pid）是否存活。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "web 服务现在是起来的吗？"                       → {}
 *   - "9527 端口有没有在监听？"                         → {}
 */
export const queryServiceStatusTool: ToolImpl = {
  name: 'query_service_status',
  description:
    `查询 Web 服务运行状态：${WEB_PORT} 主服务进程（web.pid）与 3001 launcher 常驻拉起进程（launcher.pid）是否存活、PID 是多少。`
    + '只读工具，不能启停服务；查服务器资源/守护进程用 query_system_status。',
  parameters: {
    type: 'object',
    properties: {},
  },
  requiredPermissions: ['web-service:view'],
  invoke: async (): Promise<ToolResult> => {
    const web = await readStatus(readWebServiceStatus);
    const launcher = await readStatus(readLauncherStatus);

    const data = {
      web_service: {
        running: web.running,
        pid: web.pid,
        port: WEB_PORT,
      },
      launcher: {
        running: launcher.running,
        pid: launcher.pid,
        port: 3001,
      },
    };

    return {
      ok: true,
      data,
      summary: `Web 服务${web.running ? `运行中（PID ${web.pid}）` : '未运行'}，`
        + `launcher ${launcher.running ? `运行中（PID ${launcher.pid}）` : '未运行'}`,
    };
  },
};
