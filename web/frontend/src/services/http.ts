import axios from 'axios';
import router from '@/router';
import { AUTH_STORAGE_KEY } from '@/constants/auth';

const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// 请求拦截器：自动携带 JWT Token
http.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_STORAGE_KEY);
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// 鉴权相关接口：401 时需要把响应体透传给调用方，用于驱动登录弹框显示
// 不能和业务接口一样被静默挂起，否则 auth store 永远拿不到 token 失效结果
const AUTH_PASSTHROUGH_URLS = ['/auth/verify-token'];

const isAuthPassthroughRequest = (url?: string): boolean => {
  if (!url) return false;
  return AUTH_PASSTHROUGH_URLS.some((path) => url.includes(path));
};

// 响应拦截器：
// 1. 后端返回什么就透传什么，不做任何转译
// 2. 401 时对业务接口静默挂起（不传播错误，也不弹提示）；对鉴权接口透传响应体
// 3. 403 跳转到无权限页面（/403），携带来源路径
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // 鉴权接口（verify-token 等）需要拿到 401 响应体来判断登录态，必须透传
      if (isAuthPassthroughRequest(error.config?.url)) {
        return Promise.resolve(error.response);
      }
      // 业务接口：返回永远不 resolve 的 Promise，让请求静默挂起
      // 所有 try/catch、.then/.catch 均不会被触发，避免弹出错误消息
      return new Promise(() => {});
    }
    if (error?.response?.status === 403) {
      const fromPath = encodeURIComponent(router.currentRoute.value.fullPath);
      router.push({ path: '/unauthorized', query: { from: fromPath, reason: 'api' } });
      // 静默挂起，不向上层传播错误，避免业务代码的 catch 再弹提示
      return new Promise(() => {});
    }
    return Promise.reject(error);
  },
);

export default http;
