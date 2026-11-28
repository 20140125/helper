// AI Chat 工具函数 barrel 导出

// SSE 解析相关
export {
  consumeSseBuffer,
  parseAndDispatchSseBlock,
  dispatchSseEvent,
  consumeSseStream,
  isClientAbort,
} from './sse-parser';

// 消息转换相关
export {
  genId,
  normalizeContent,
  extractMessageImages,
  parseToolResult,
  toUiToolCall,
  toUiMessage,
  convertToUiMessages,
} from './message-converter';

// Markdown 渲染（聊天气泡）
export {
  renderChatMarkdown,
  IMAGE_PLACEHOLDER_CLASS,
  MERMAID_PLACEHOLDER_CLASS,
} from './chat-markdown';

// 工具调用卡片：参数 / 结果 / 图片字段格式化
export {
  formatToolArgs,
  formatToolResult,
  extractToolImageUrl,
} from './tool-call-format';

// 欢迎页相对时间格式化
export {
  formatWelcomeRelativeTime,
  type WelcomeRelativeTimeLabels,
} from './welcome-time';

// 站内路由链接（裸路由补链接）
export { linkifyInternalPaths, internalLinkAttrs } from './internal-link';

// 渲染项推导（时间分隔条 + 回合 turnStart）
export {
  computeTurnBoundary,
  buildAiChatRenderItems,
  AI_CHAT_TIME_GROUP_GAP_MS,
  type AiChatRenderItem,
} from './render-items';

// 消息查找与占位消息构造
export {
  findPrevUserIndex,
  findPrevUserText,
  makePlaceholderMessage,
  findToolCallById,
} from './message-finders';

// 图片附件（上传压缩为 Data URL）
export {
  MAX_ATTACHED_IMAGES,
  fileToCompressedDataUrl,
  pickImageFiles,
} from './image-attachment';

// 皮肤配置：规范化预设/用户配置、图片本体解码与局部 CSS 变量构建
export {
  normalizeAiChatSkinPresets,
  normalizeAiChatSkinSettings,
  buildAiChatSkinStyle,
  toAiChatSkinBlob,
} from './skin';
