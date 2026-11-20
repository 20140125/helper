// ============================================================
// 通用剪贴板工具
// ============================================================

/**
 * 把文本写入系统剪贴板（带 execCommand fallback）
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} 成功为 true，否则 false
 * @description 注意：在 Safari 上，必须在用户交互事件中调用才能成功
 */
export const writeClipboard = async (text: string): Promise<boolean> => {
  // 优先 Clipboard API（需要 HTTPS 或 localhost）
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 降级
    }
  }

  // 降级：隐藏 textarea + execCommand('copy')
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
};
