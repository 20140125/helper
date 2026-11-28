export type { Rule } from '@/types/rule';
export type { Webhook } from '@/types/webhook';

export { PROJECT_DIR } from '@/utils/paths';

// 通用响应（从独立模块重导出，避免循环依赖）
export {
  ErrorCode,
  returnResponse,
  createHttpError,
  badRequest,
  notFound,
  resolveHttpErrorCode,
} from '@/utils/response';

// 从各 utils 模块重新导出，保持路由文件的引用路径不变
export { ENV_FILE } from '@/types/env';
export { readEnvFile, writeEnvFile, formatEnvValue } from '@/utils/env';
export { ScriptResult, formatDate, runScript } from '@/utils/script';
export type { LauncherStatus } from '@/types/launcher';
export type { RoutePermissionConfig } from '@/types/permission';
export { readRules, writeRules } from '@/utils/storage';
export { readWebhooks, writeWebhooks } from '@/utils/storage';
export type {
  AiModelGroup,
  AiModelEntry,
  AiModelGroupBody,
  AiModelPricing,
  AiModelFetchBody,
  AiModelTestBody,
  AiModelTestResult,
  AiModelEntryTestResult,
  RemoteModelOption,
} from '@/types/ai-model-config';
export {
  readAiModelGroups,
  writeAiModelGroups,
  maskAiModelGroup,
  validateAiModelGroupBody,
  buildAiModelGroup,
  findAiModelGroupByModel,
  ensureSingleDefaultModel,
} from '@/utils/ai-model-config';
export { fetchRemoteModels } from '@/utils/ai-model-config-fetch';
export { testModelAvailability } from '@/utils/ai-model-config-test';
export {
  saveAuthCode,
  getAuthCode,
  consumeAuthCode,
  getAuthTargetEmail,
  getAuthMailFromName,
  createMailTransporter,
  generateAuthCode,
  isAdminEmail,
  signJwt,
  verifyJwt,
  readUsers,
  recordUserLogin,
  setAuthCookie,
  clearAuthCookie,
  buildAuthCodeMailHtml,
} from '@/utils/auth';
export {
  DEFAULT_AUTH_CODE_KEY,
  ensureEnvConfigSeed,
  readEnvConfigMap,
  upsertEnvConfig,
  getDefaultAuthCode,
} from '@/utils/env-config';
export { ensureRbacSchema } from '@/utils/rbac/db';
export { type TemplateData, type PlaygroundTemplateInput } from '@/types/playground';
export {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplateFields,
  deleteTemplateById,
  parseAndValidateFields,
} from '@/utils/playground';
export { runDaemonScript } from '@/utils/daemon';
export {
  isValidFilename,
  validateCacheWriteParams,
  writeCacheFile,
  listCacheFiles,
  countCacheFiles,
  readCacheFile,
} from '@/utils/cache';
export { ensureRuntimeDir, resolvePidFile, readPidFile } from '@/utils/runtime';
export {
  runWebScript,
  readLauncherPid,
  readWebServiceStatus,
  startWebService,
  stopWebService,
  restartWebServiceByNode,
} from '@/utils/web-service';
export { WebServiceStatus } from '@/types/web-service';
export {
  readLauncherStatus,
  webScriptExists,
  startWebServiceByLauncher,
  scheduleWebServiceRestart,
} from '@/utils/launcher';
export { DEFAULT_LOG_PAGE_SIZE } from '@/types/log';
export {
  listLogSources,
  isLogSourceValid,
  readSourceLogRows,
  clearLogSource,
} from '@/utils/logs';
export {
  insertRunLog,
  flushRunLogs,
  getLogRetentionDays,
  listRunLogSources,
  readRunLogRows,
  listRunLogRows,
  getRunLogById,
  renderRunLogRows,
  clearRunLogs,
  purgeExpiredRunLogs,
} from '@/utils/run-log';
export { notifyAllWebhooks } from '@/utils/wecom-notify';
export { getOsRelease, getMemoryInfo, getDiskInfo, getSystemUptime, readDaemonPidInfo, readAnnualPid } from '@/utils/system';
export { handleFileUpload, handleSkinBackgroundUpload } from '@/utils/upload';
export {
  handleAppBackgroundUpload,
  handleAppBackgroundImage,
  readAppBackground,
  saveAppBackground,
  clearAppBackground,
  isSafeAppBackgroundUrl,
  ensureAppBackgroundSchema,
} from '@/utils/app-background';
export {
  normalizeSurfaceOpacity,
  readUserAppearance,
  upsertUserAppearance,
  ensureUserAppearanceSchema,
} from '@/utils/user-appearance';
export { UPDATE_TOOLS_SCRIPTS } from '@/types/update-tools';
export {
  validateRequiredArgs,
  buildFinalArgs,
  execUpdateScript,
  resolveUpdateScriptPath,
  updateScriptExists,
} from '@/utils/update-tools';
export {
  readTemplates as readMsgTemplates,
  writeTemplates as writeMsgTemplates,
  readRawTemplates,
  writeRawTemplates,
  renderTemplate,
  loadDailyPlaceholders,
} from '@/utils/templates';
export { attachUserInfo, requirePermission, withPermission } from '@/utils/permission';
export { accessLogMiddleware } from '@/utils/access-log';
export { Permission } from '@/types/permission';
export {
  readRbacConfig,
  writeRbacConfig,
  getUserPermissionsByEmail,
  getUserRoleId,
  getUserRoleConfig,
  readPermissionMetas,
  writePermissionMetas,
  createPermissionMeta,
  updatePermissionMeta,
  readAllPermissionCodes,
  validatePermissionFields,
  requireSuperAdmin,
} from '@/utils/rbac';
export type { RbacConfig, RoleConfig, UserRole, PermissionMeta, PermissionBody } from '@/types/rbac';
export {
  readPermissionRequests,
    writePermissionRequests,
  createPermissionRequest,
  findPendingRequest,
  approveRequest,
  buildApplyMarkdown,
  buildApprovedMarkdown,
  alreadyResolvedHtml,
  approveSuccessHtml,
  sendApprovalEmail,
  sendRejectionEmail,
} from '@/utils/permission-request';
export type {
  PermissionRequest,
  PermissionRequestsStore,
  ApplyPermissionBody,
  ApprovePermissionBody,
  RejectPermissionBody,
} from '@/types/permission-request';
export {
  readApiCategories,
  writeApiCategories,
} from '@/utils/api-categories';
export {
  readApiItems,
  writeApiItems,
  executeProxyRequest,
} from '@/utils/api-management';
export type { ProxyError } from '@/types/api-management';
export type {
  ApiCategory,
  ApiItem,
  CreateApiCategoryBody,
  UpdateApiCategoryBody,
  CreateApiItemBody,
  UpdateApiItemBody,
  ExecuteApiBody,
  ExecuteApiResult,
} from '@/types/api-management';
export { GREETINGS_GROUPS } from '@/types/greetings';
export {
  readGreetingsFile,
  writeGreetingsFile,
  flattenGreetings,
  rebuildGreetingsFile,
  readGreetingItems,
} from '@/utils/greetings';
export type {
  GreetingItem,
  GreetingsGroup,
  GreetingsFile,
  CreateGreetingBody,
  UpdateGreetingBody,
} from '@/types/greetings';
export { REMINDER_QUOTES_BUCKETS } from '@/types/reminder-quotes';
export {
  readReminderQuotesFile,
  writeReminderQuotesFile,
  flattenReminderQuotes,
  rebuildReminderQuotesFile,
  isValidReminderBucket,
  readReminderQuoteItems,
} from '@/utils/reminder-quotes';
export type {
  ReminderQuoteItem,
  ReminderQuotesBucket,
  ReminderQuotesFile,
  CreateReminderQuoteBody,
  UpdateReminderQuoteBody,
} from '@/types/reminder-quotes';
export { TOOLS_IMAGES_DIR, TOOLS_IMAGES_URL_PREFIX } from '@/types/skill-map';
export {
  listSkills,
  runSkill,
  findExistingCardImage,
  getAmapJsConfig,
} from '@/utils/skill-map';
export type {
  SkillItem,
  SkillCategoryMeta,
  SkillMapListData,
  SkillMapRunData,
} from '@/types/skill-map';

export {
  listConversations,
  readConversation,
  readConversationPage,
  createConversation,
  deleteConversation,
  writeConversation,
  replaceMessages,
  validateLlmConfig,
  getAvailableModels,
  isVisionModel,
  sanitizeImageDataUrls,
  buildUserContent,
  getAvailableTools,
  buildSystemPrompt,
  detectToolScenarios,
  selectToolsByScenario,
  runAgentLoop,
  handleGenerativeModel,
  isGenerativeModel,
  appendRunTrace,
  flushRunTraces,
  listRunTraces,
  pruneRunTraces,
  summarizeTraces,
  runInspection,
  buildInspectionPrompt,
  readInspectorConfig,
  getInspectorStatus,
  startInspectionNow,
  handleIncomingMessage,
  verifyWebhookToken,
  readMemory,
  clearMemory,
  pickMemoryForPrompt,
  rememberFromTurn,
  extractMessageText,
  listApprovals,
  updateApproval,
  executeApproval,
  notifyApprovalResult,
  listSkillMetas,
  findSkillDoc,
  findSkillDocByTool,
  searchKnowledge,
  buildKnowledgeIndex,
  resetKnowledgeIndex,
  validateAiChatSkinBody,
  readAiChatSkin,
  upsertAiChatSkin,
  isValidAiChatSkinKey,
  validateAiChatSkinPresetBody,
  normalizeAiChatSkinPresetVars,
  listAiChatSkinPresets,
  upsertAiChatSkinPreset,
} from '@/utils/ai-chat';

// 数据库管理（连接池、库表浏览、SQL 执行、建表脚本初始化）
export {
  getDatabaseStatus,
  listTables,
  describeTable,
  previewTableRows,
  runReadOnlyQuery,
  runWriteQuery,
  listSqlScripts,
  readSqlScript,
  expandInitScript,
  initializeDatabase,
} from '@/utils/database';
export type {
  DatabaseStatus,
  DatabaseTable,
  DatabaseTableSchema,
  DatabaseScriptFile,
  SqlExecution,
  DatabaseInitResult,
} from '@/types/database';

// 前端 i18n 语言包（运行时读库与管理页读写）
export {
  isI18nLang,
  readAllI18nTranslations,
  listI18nMessages,
  updateI18nMessage,
  listI18nPairs,
  updateI18nPair,
} from '@/utils/database';
export type {
  I18nLang,
  I18nTranslation,
  I18nTranslationsMap,
  I18nMessage,
  I18nMessageList,
  I18nMessageQuery,
  I18nPair,
  I18nPairList,
  I18nPairQuery,
  I18nValueType,
} from '@/types/i18n';

// 缓存数据管理页（按 13 张 hp_cache_* 表检索、读写与删除；高德地理编码表已独立成页）
export {
  listCacheAdminTables,
  listCacheAdminEntries,
  readCacheAdminEntry,
  writeCacheAdminEntry,
  deleteCacheAdminEntry,
  validateCacheAdminWrite,
} from '@/utils/database';
export type {
  CacheAdminTable,
  CacheAdminEntry,
  CacheAdminList,
  CacheAdminQuery,
  CacheAdminDetail,
  CacheAdminWriteBody,
  CacheAdminPeriod,
} from '@/types/cache-admin';

// 高德地理编码缓存独立页（hp_cache_amap_geocode）
export {
  listAmapGeocodeEntries,
  writeAmapGeocodeEntry,
  deleteAmapGeocodeEntry,
  validateAmapGeocodeWrite,
} from '@/utils/database';
export type { AmapGeocodeEntry, AmapGeocodeWriteBody } from '@/types/amap-geocode';

export {
  normalizeDocName,
  isUserDocPath,
  listKnowledgeDocs,
  readKnowledgeDoc,
  readDocByPath,
  normalizeKnowledgeDocPath,
  writeKnowledgeDoc,
  deleteKnowledgeDoc,
  importSystemDoc,
  readKnowledgeDirs,
  normalizeKnowledgeDirs,
  writeKnowledgeDirs,
  getDocContentBytes,
  initKnowledgeDocs,
  refreshKnowledgeDocs,
  getKnowledgeDocEntries,
} from '@/utils/knowledge';

// 首页首屏聚合
export type { BootstrapData, BootstrapDataKey, SystemStatusSnapshot } from '@/types/bootstrap';
export { getSystemStatus, buildBootstrapData, parseBootstrapOnly } from '@/utils/bootstrap';

// AI 回话管理页（运行追踪 + 消息流水，只读）
export { listAiChatAdminRuns, getAiChatAdminRunDetail } from '@/utils/ai-chat/admin-queries';
export type {
  AiChatAdminRunRow,
  AiChatAdminRunQuery,
  AiChatAdminRunPage,
  AiChatAdminMessage,
  AiChatAdminRunDetail,
} from '@/types/ai-chat-admin';

// 侧边栏导航与页面注册表（数据库唯一真源）
export {
  listNavigation,
  filterNavigationForUser,
  normalizeNavGroup,
  normalizeNavItem,
  saveNavGroup,
  saveNavItem,
  deleteNavGroup,
  deleteNavItem,
  ensureNavigationSchema,
} from '@/utils/navigation';
export type { NavGroup, NavItem, NavData } from '@/types/navigation';
