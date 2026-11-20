/**
 * Access Log 文本协议标识符
 *
 * @description
 *   后端 `utils/access-log.ts` 按固定格式写入日志文件，前端 viewer
 *   需按相同字面量切分/解析。此处集中定义前端侧所需的 marker 常量，
 *   避免在组件模板/脚本中出现中文字面量字符串。
 *
 * @important
 *   **与后端 `web/utils/access-log.ts` 中的写入格式必须保持一致**。
 *   如需改为英文 marker（如 USER:/STATUS:/BODY:），前后端必须同步变更。
 */

/** 元信息行分隔符 */
export const ACCESS_LOG_META_SEPARATOR = '|';

/** 用户字段前缀 */
export const ACCESS_LOG_USER_MARKER = '用户:';

/** 响应状态字段前缀 */
export const ACCESS_LOG_STATUS_MARKER = '状态:';

/** 耗时字段前缀 */
export const ACCESS_LOG_DURATION_MARKER = '耗时:';

/** 响应体段前缀 */
export const ACCESS_LOG_BODY_MARKER = '响应:';
