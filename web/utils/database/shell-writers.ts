/**
 * shell 写入型缓存（自定义规则 / 每日一词 / 高德地理编码）的 KV 查询薄封装
 *
 * 设计说明：
 *   - 三份 JSON 已并入缓存分表（已有业务表），原 hp_shell_cache_files 镜像表 / 兼容视图已移除；
 *     运行时通过 cache-store 读 KV，不再读磁盘文件，也不再对镜像表 CREATE TABLE / INSERT；
 *   - 结构化缓存表与文件 mtime 水位同步已下线，sync / diff 仅保留导出名与「无差异」兼容结构。
 */
import { readCacheJson } from './cache-store';

/** 文件与数据库的差异报告（保留兼容结构，恒为「无差异」） */
export interface ShellWritersDiff {
  file: { files: number; rules: number; dailyword: number; amap: number; mtime: number };
  db: { files: number; rules: number; dailyword: number; amap: number };
  stale: boolean;
}

/** 零值同步条数（sync / diff 共用） */
const zeroCounts = (): { files: number; rules: number; dailyword: number; amap: number } => ({
  files: 0, rules: 0, dailyword: 0, amap: 0,
});

/**
 * 从 KV 全量同步查询镜像与结构化缓存表
 * @returns {Promise<{ files: number; rules: number; dailyword: number; amap: number }>} 同步条数
 * @description KV 已是唯一真源，无需重建结构化表；保留导出名与签名，返回零值
 */
export const syncShellWritersFromFiles = async (): Promise<{
  files: number; rules: number; dailyword: number; amap: number;
}> => zeroCounts();

/**
 * 文件有更新时自动同步
 * @returns {Promise<void>}
 * @description KV 为唯一真源，不存在文件 mtime 水位；保留导出名为 no-op，供既有调用方 await
 */
export const syncShellWritersIfStale = async (): Promise<void> => {
  // 真源在库，无需按文件水位触发同步
};

/**
 * 统计文件与数据库的差异
 * @returns {Promise<ShellWritersDiff>} 差异报告
 * @description 恒返回「无差异」结构：file 与 db 计数一致且不 stale
 */
export const collectShellWritersDiff = async (): Promise<ShellWritersDiff> => ({
  file: { files: 0, rules: 0, dailyword: 0, amap: 0, mtime: 0 },
  db: zeroCounts(),
  stale: false,
});

/**
 * 判断是否需要同步
 * @param {ShellWritersDiff} diff - 差异报告
 * @returns {boolean} 任一数量不一致或标记为 stale 时返回 true
 */
export const hasShellWritersDiff = (diff: ShellWritersDiff): boolean =>
  diff.stale
  || (Object.keys(diff.file).filter((key) => key !== 'mtime') as Array<keyof ShellWritersDiff['db']>)
    .some((key) => diff.file[key] !== diff.db[key]);

/**
 * 读取 KV 里的 JSON 文件
 * @param {string} key - 缓存键（如 custom_rules.json）
 * @returns {Promise<T | null>} 解析结果，键不存在或解析失败时返回 null
 */
export const readShellCacheJson = async <T>(key: string): Promise<T | null> =>
  readCacheJson<T>(key);
