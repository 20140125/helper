// ============================================================
// AI 工具调用卡片：参数 / 结果 / 图片字段格式化
// ============================================================

/**
 * 格式化工具调用参数字符串为美化 JSON
 * @param {string} args - 原始 JSON 字符串
 * @returns {string} 美化后的 JSON 字符串；解析失败时原样返回
 */
export const formatToolArgs = (args: string): string => {
  if (!args) return '{}';
  try {
    return JSON.stringify(JSON.parse(args), null, 2);
  } catch {
    return args;
  }
};

/**
 * 格式化工具调用结果为字符串
 * @param {unknown} result - 原始结果（可能是对象/字符串/原始值）
 * @returns {string} 美化后的字符串
 * @description 若结果是带 `image_url` 字段的对象，则在输出中过滤该字段——
 *   因为图片已经由 image-previewer 单独展示，避免与 JSON 文本重复展示。
 */
export const formatToolResult = (result: unknown): string => {
  if (result === null || result === undefined) return '';
  if (typeof result === 'string') return result;
  try {
    if (result && typeof result === 'object' && !Array.isArray(result) && 'image_url' in result) {
      const { image_url: _omit, ...rest } = result as Record<string, unknown>;
      return JSON.stringify(rest, null, 2);
    }
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
};

/**
 * 从工具调用结果中安全地解析出 `image_url` 字段
 * @param {unknown} result - 工具调用结果（仅 card_skill 等少量工具会带）
 * @returns {string} 图片 URL；不存在或类型不符时为空串
 */
export const extractToolImageUrl = (result: unknown): string => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return '';
  const url = (result as Record<string, unknown>).image_url;
  return typeof url === 'string' ? url : '';
};
