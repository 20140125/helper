// ==============================
// 数据库管理工具函数 barrel
// @description routes/utils.ts 统一从这里重导出，路由文件不直接引用子模块
// ==============================

export { readDatabaseConfig, getPool, executeSql, getDatabaseStatus } from './connection';
export { toDateText, normalizeDbDateTime } from './datetime';
export {
  normalizeCacheKey,
  ensureCacheTables,
  isApiResponseKey,
  resolveCachePeriod,
  resolveCacheTarget,
  listResRoutes,
  buildCacheUnionSql,
} from './cache-routing';
export {
  readTableBody,
  writeTableBody,
  tableKeyExists,
  deleteTableKey,
  listTableEntries,
  tableKeyMtime,
} from './cache-tables';
export {
  ensureCacheStoreTable,
  readCacheBody,
  readCacheJson,
  writeCacheBody,
  writeCacheJson,
  deleteCacheKey,
  cacheKeyExists,
  listCacheKeys,
  listCacheEntries,
} from './cache-store';
export {
  readGreetingsFromDb,
  readReminderQuotesFromDb,
  readTemplatesFromDb,
} from './content-library';
export {
  readCalendarCacheJson,
  listCalendarCacheKeys,
  listApiResponseFilesFromDb,
  listDailyDataFilesFromDb,
  readApiResponseEntriesFromDb,
} from './calendar-cache';
export { listTables, describeTable, previewTableRows } from './schema';
export { runReadOnlyQuery, runWriteQuery } from './sql-runner';
export { listSqlScripts, readSqlScript, expandInitScript, initializeDatabase } from './scripts';
export {
  isI18nLang,
  readAllI18nTranslations,
  listI18nMessages,
  updateI18nMessage,
  listI18nPairs,
  updateI18nPair,
} from './i18n';
export {
  listCacheAdminTables,
  listCacheAdminEntries,
  readCacheAdminEntry,
  writeCacheAdminEntry,
  deleteCacheAdminEntry,
  validateCacheAdminWrite,
} from './cache-admin';
export type {
  CacheAdminTable,
  CacheAdminEntry,
  CacheAdminList,
  CacheAdminQuery,
  CacheAdminDetail,
  CacheAdminWriteBody,
  CacheAdminPeriod,
} from '@/types/cache-admin';
export {
  listAmapGeocodeEntries,
  writeAmapGeocodeEntry,
  deleteAmapGeocodeEntry,
  validateAmapGeocodeWrite,
} from './amap-geocode';
export type { AmapGeocodeEntry, AmapGeocodeWriteBody } from '@/types/amap-geocode';
export {
  ensureKnowledgeDocSchema,
  listKnowledgeDocRows,
  upsertKnowledgeDocRows,
  saveUserKnowledgeDoc,
  deleteKnowledgeDocRow,
} from './knowledge';
