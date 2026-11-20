// AI Chat 后端工具 barrel 重导出
// 注意：本目录仅供后端（Node/Express）使用；前端可复用的 SSE 解析、UI 消息转换
// 已迁移到 web/frontend/src/utils/ai-chat/，避免前后端互相耦合。

export {
  getLlmConfigForModel,
  validateLlmConfig,
  getAvailableModels,
  isModelStreamable,
  isVideoModel,
  isVisionModel,
  chatCompletion,
  chatCompletionStream,
  videoGeneration,
} from './llm-client';

export {
  listConversations,
  readConversation,
  writeConversation,
  deleteConversation,
  createConversation,
  appendMessage,
  replaceMessages,
} from './conversation-store';

export { runAgentLoop, type AgentEvent, type RunAgentLoopInput } from './agent-loop';

export {
  appendRunTrace,
  listRunTraces,
  pruneTraceFiles,
} from './trace-store';

export {
  estimateCost,
  summarizeTraces,
} from './trace-stats';

export {
  runInspection,
  buildInspectionPrompt,
  type InspectionInput,
  type InspectionResult,
} from './inspection';

export {
  startInspectionScheduler,
  readInspectorConfig,
  getInspectorStatus,
  startInspectionNow,
  type InspectorConfig,
  type InspectorStatus,
  type InspectionRunRecord,
} from './inspection-scheduler';

export {
  handleIncomingMessage,
  verifyWebhookToken,
  type IncomingMessageInput,
  type IncomingMessageResult,
} from './chat-webhook';

export {
  readMemory,
  writeMemory,
  clearMemory,
  addMemoryItems,
  pickMemoryForPrompt,
} from './memory-store';

export {
  extractMemories,
  rememberFromTurn,
  isMemoryEnabled,
} from './memory';

export {
  listApprovals,
  findApproval,
  updateApproval,
  executeApproval,
  createApproval,
  notifyApprovalResult,
  cancelPendingApprovals,
} from './approval-store';

export {
  searchKnowledge,
  buildKnowledgeIndex,
  resetKnowledgeIndex,
} from './knowledge';

export {
  runSubAgent,
  type SubAgentInput,
  type SubAgentResult,
} from './sub-agent';

export {
  ALL_TOOLS,
  getAvailableTools,
  buildToolDefinitions,
  findTool,
} from './tools';

export { buildSystemPrompt } from './system-prompt';

export {
  resolveSkillsDir,
  listSkillDocs,
  listSkillMetas,
  findSkillDoc,
  findSkillDocByTool,
  resetSkillDocsCache,
} from './skill-docs';

export {
  generatePlan,
  runReflection,
  formatPlanAsMessage,
  formatReflectionAsMessage,
  advancePlanStep,
  skipRestPlanSteps,
  lastUserText,
  lastAssistantText,
} from './planning';

export { handleGenerativeModel, isGenerativeModel } from './generative-model';

export {
  isImageContentPart,
  isContentPartArray,
  extractMessageText,
  extractMessageImages,
  sanitizeImageDataUrls,
  buildUserContent,
} from './content';
