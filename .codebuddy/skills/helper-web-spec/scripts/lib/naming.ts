/**
 * 命名转换
 *
 * 背景：4 个生成脚本各自实现了一份转换，规则还不一样 ——
 * `api_v2` 在 generate-component 里得到 `Api_v2`（下划线残留，非法标识符），
 * 在另外三个里得到 `ApiV2`；kebabCase 遇到 `XMLHTTPRequest` 会压成 `xmlhttprequest`。
 * 项目约定是全 kebab 文件名（ai-chat.vue / reminder-quotes.ts / api-management-model.ts），
 * 这里统一实现并对输入做合法性校验，避免把中文、空格、路径分隔符写进文件名。
 */

/** 把任意写法拆成单词：连字符、下划线、空格、camel 边界、大小写块边界、字母与数字边界 */
const splitWords = (input: string): string[] =>
  input
    // camel / Pascal 边界：userCard → user Card
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // 连续大写后的首个小写：XMLHTTPRequest → XMLHTTP Request
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // 数字与后续字母之间切分：api2Go → api2 Go（但 v2 不会被拆成 v 2）
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .split(/[\s\-_.]+/)
    .filter(Boolean);

/** kebab-case：UserCard / user_card / XMLHTTPRequest → user-card / user-card / xmlhttp-request */
export const toKebabCase = (input: string): string =>
  splitWords(input).map(w => w.toLowerCase()).join('-');

/** PascalCase：user-card / api_v2 → UserCard / ApiV2 */
export const toPascalCase = (input: string): string =>
  splitWords(input)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');

/** camelCase：user-card → userCard */
export const toCamelCase = (input: string): string => {
  const pascal = toPascalCase(input);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

/**
 * 名称合法性校验
 * 允许 kebab、camel、Pascal 三种写法，纯字母开头，可含数字，禁止中文/空格/路径分隔符。
 */
export const isValidName = (input: string): boolean => /^[A-Za-z][A-Za-z0-9]*([-_]?[A-Za-z0-9]+)*$/.test(input);

/**
 * 校验并规范化名称
 * @returns ok=false 时携带错误原因，调用方应直接退出而不是继续生成
 */
export const validateName = (input: string): { ok: boolean; reason?: string } => {
  if (!input || !input.trim()) return { ok: false, reason: '名称不能为空' };
  if (!isValidName(input)) {
    return { ok: false, reason: `名称「${input}」不合法：仅允许字母开头的 kebab / camel / Pascal 写法，不要含中文、空格或路径符号` };
  }
  return { ok: true };
};
