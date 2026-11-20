import http from 'http';
import https from 'https';
import { PROXY_TIMEOUT_MS, type ExecuteApiBody, type ExecuteApiResult, type ProxyError } from '@/types/api-management';

/**
 * 构造带 query 参数的目标 URL
 * @param {string} url - 原始 URL
 * @param {Record<string, string>} [params] - query 参数
 * @returns {URL | null} 解析成功的 URL 对象，失败返回 null
 */
const buildTargetUrl = (url: string, params?: Record<string, string>): URL | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (params && Object.keys(params).length > 0) {
    Object.entries(params).forEach(([key, value]) => {
      parsed.searchParams.set(key, value);
    });
  }
  return parsed;
};

/**
 * 合并请求头，必要时补全 Content-Type 与 Content-Length
 * @param {Record<string, string>} headers - 原始请求头
 * @param {Buffer} [bodyBuffer] - 请求体 Buffer
 * @returns {Record<string, string>} 合并后的请求头
 */
const buildRequestHeaders = (
  headers: Record<string, string>,
  bodyBuffer?: Buffer,
): Record<string, string> => {
  const merged: Record<string, string> = { ...headers };
  if (bodyBuffer && !merged['content-type'] && !merged['Content-Type']) {
    merged['Content-Type'] = 'application/json';
  }
  if (bodyBuffer) {
    merged['Content-Length'] = String(bodyBuffer.length);
  }
  return merged;
};

/**
 * 代理执行用户指定的 HTTP 请求
 * @param {ExecuteApiBody} payload - 代理请求参数
 * @returns {Promise<ExecuteApiResult | ProxyError>} 成功返回响应，失败返回 error 信息
 */
export const executeProxyRequest = (
  payload: ExecuteApiBody,
): Promise<ExecuteApiResult | ProxyError> => {
  return new Promise((resolve) => {
    const { url, method, headers = {}, params, body } = payload;

    const parsedUrl = buildTargetUrl(url, params);
    if (!parsedUrl) {
      resolve({ error: 'URL 格式不正确' });
      return;
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const requestLib = isHttps ? https : http;
    const bodyBuffer = body ? Buffer.from(body, 'utf-8') : undefined;
    const requestHeaders = buildRequestHeaders(headers, bodyBuffer);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: requestHeaders,
      timeout: PROXY_TIMEOUT_MS,
    };

    const startTime = Date.now();
    const proxyReq = requestLib.request(options, (proxyRes) => {
      const chunks: Buffer[] = [];
      proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on('end', () => {
        resolve({
          status: proxyRes.statusCode ?? 0,
          statusText: proxyRes.statusMessage ?? '',
          headers: proxyRes.headers as Record<string, string | string[] | undefined>,
          body: Buffer.concat(chunks).toString('utf-8'),
          duration: Date.now() - startTime,
        });
      });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      resolve({ error: `请求超时（${PROXY_TIMEOUT_MS / 1000}s）` });
    });

    proxyReq.on('error', (err: Error) => {
      resolve({ error: `请求失败：${err.message}` });
    });

    if (bodyBuffer) {
      proxyReq.write(bodyBuffer);
    }
    proxyReq.end();
  });
};
