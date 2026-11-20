/**
 * 生成列表/表格中展示的内容预览文本
 * @description 将多行文本压成单行、去首尾空白，超长以 `...` 截断。
 * @param content - 原始文本（可能含换行）
 * @param maxLength - 最大字符数（默认 80）
 */
export const buildContentPreview = (content: string, maxLength: number = 80): string => {
  const text = content.replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};
