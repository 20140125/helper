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
  collectContentLibraryDiff,
  hasContentLibraryDiff,
  syncContentLibraryFromFiles,
  syncContentLibraryIfStale,
  readGreetingsFromDb,
  readReminderQuotesFromDb,
  readTemplatesFromDb,
} from './content-library';
export type { ContentLibraryDiff } from './content-library';
export {
  collectCalendarCacheDiff,
  hasCalendarCacheDiff,
  syncCalendarCacheFromFiles,
  syncCalendarCacheIfStale,
  readCalendarCacheEntry,
  readCalendarCacheJson,
  listCalendarCacheKeys,
  listApiResponseFilesFromDb,
  listDailyDataFilesFromDb,
  readApiResponseEntriesFromDb,
} from './calendar-cache';
export {
  collectShellWritersDiff,
  hasShellWritersDiff,
  syncShellWritersFromFiles,
  syncShellWritersIfStale,
  readShellCacheJson,
} from './shell-writers';
export type { ShellWritersDiff } from './shell-writers';
export type { CalendarCacheDiff, CalendarCacheEntry } from './calendar-cache';
export { listTables, describeTable, previewTableRows } from './schema';
export { runReadOnlyQuery, runWriteQuery } from './sql-runner';
export { listSqlScripts, readSqlScript, expandInitScript, initializeDatabase } from './scripts';
export {
  isI18nLang,
  readAllI18nTranslations,
  listI18nMessages,
  updateI18nMessage,
} from './i18n';
export {
  ensureKnowledgeDocSchema,
  listKnowledgeDocRows,
  upsertKnowledgeDocRows,
  saveUserKnowledgeDoc,
  deleteKnowledgeDocRow,
} from './knowledge';
