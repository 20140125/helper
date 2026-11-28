import path from 'path';
import { PROJECT_DIR } from '@/utils/paths';

export type { Rule } from '@/types/rule';
export type { Webhook } from '@/types/webhook';

export { PROJECT_DIR, CACHE_DIR } from '@/utils/paths';

/** 已登录用户存储文件路径 */
export const USERS_FILE = path.join(PROJECT_DIR, '.cache', 'users.json');

// 通用响应（从独立模块重导出，避免循环依赖）
export { ErrorCode, returnResponse } from '@/utils/response';

// 从各 utils 模块重新导出，保持路由文件的引用路径不变
export { ENV_FILE } from '@/types/env';
export { readEnvFile, writeEnvFile, formatEnvValue } from '@/utils/env';
export { ScriptResult, formatDate, runScript } from '@/utils/script';
export type { LauncherStatus } from '@/types/launcher';
export type { RoutePermissionConfig } from '@/types/permission';
export { RULES_FILE } from '@/types/rule';
export { WEBHOOKS_FILE } from '@/types/webhook';
export { readRules, writeRules } from '@/utils/storage';
export { readWebhooks, writeWebhooks } from '@/utils/storage';
export { AI_MODEL_CONFIGS_FILE } from '@/types/ai-model-config';
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
// .cache 目录查询函数
export {
  readCacheJsonFile,
  listDailyDataFiles,
  readDailyData,
  listApiResponses,
  readApiResponse,
} from '@/utils/cache';

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
export {
  listLogFiles,
  isLogKeyValid,
  readLogTail,
  clearLogFile,
} from '@/utils/logs';
export {
  insertRunLog,
  flushRunLogs,
  getLogRetentionDays,
  listRunLogSources,
  readRunLogRows,
  renderRunLogRows,
  clearRunLogs,
  purgeExpiredRunLogs,
} from '@/utils/run-log';
export { notifyAllWebhooks } from '@/utils/wecom-notify';
export { getOsRelease, getMemoryInfo, getDiskInfo, getSystemUptime, readDaemonPidInfo, readAnnualPid } from '@/utils/system';
export { handleFileUpload } from '@/utils/upload';
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
export { PERMISSION_REQUESTS_FILE } from '@/types/permission-request';
export type {
  PermissionRequest,
  PermissionRequestsStore,
  ApplyPermissionBody,
  ApprovePermissionBody,
  RejectPermissionBody,
} from '@/types/permission-request';
export { API_CATEGORIES_FILE, API_ITEMS_FILE } from '@/types/api-management';
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
export { GREETINGS_FILE, GREETINGS_GROUPS } from '@/types/greetings';
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
export { REMINDER_QUOTES_FILE, REMINDER_QUOTES_BUCKETS } from '@/types/reminder-quotes';
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

export {
  normalizeDocName,
  isUserDocPath,
  listKnowledgeDocs,
  readKnowledgeDoc,
  readDocByPath,
  resolveDocPath,
  writeKnowledgeDoc,
  deleteKnowledgeDoc,
  importSystemDoc,
  readKnowledgeDirs,
  normalizeKnowledgeDirs,
  writeKnowledgeDirs,
  getDocContentBytes,
  resolveKnowledgeDirPaths,
} from '@/utils/knowledge';

// 首页首屏聚合
export type { BootstrapData, BootstrapDataKey, SystemStatusSnapshot } from '@/types/bootstrap';
export { getSystemStatus, buildBootstrapData, parseBootstrapOnly } from '@/utils/bootstrap';
