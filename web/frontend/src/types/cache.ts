import type { ApiResponse } from './api';

/** 缓存文件信息 */
export interface CacheFile {
  name: string;
  size: number;
  mtime: string;
}

/**
 * 缓存文件列表响应接口
 * @description 获取缓存文件列表的响应数据结构
 */
export type CacheFilesResponse = ApiResponse<{ files: CacheFile[] }>;

/**
 * 缓存文件内容响应接口
 * @description 读取缓存文件内容的响应数据结构
 */
export type CacheFileContentResponse = ApiResponse<{ content: string }>;

/**
 * 缓存操作结果接口
 * @description 缓存文件操作的返回结果（无数据返回）
 */
export type CacheResult = ApiResponse;
