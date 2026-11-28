/** 缓存文件信息 */
export interface CacheFileInfo {
  name: string;
  size: number;
  mtime: string;
}

/** 缓存条目信息（数据库真源） */
export interface CacheEntryInfo {
  /** 相对 .cache 的缓存键 */
  key: string;
  /** 内容字节数 */
  size: number;
  /** 最后更新时间（毫秒时间戳） */
  updatedAt: number;
}
