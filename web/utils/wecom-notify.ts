import https from 'https';
import http from 'http';
import { readWebhooks } from './storage';

// ==============================
// 企微 Webhook 通知工具
// ==============================

/**
 * 判断一行是否为 Markdown 表格分隔行（如 |------|------|）
 * @param {string} line - 单行文本
 * @returns {boolean} 是分隔行返回 true
 */
const isTableSeparatorLine = (line: string): boolean =>
  /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-');

/**
 * 把 Markdown 表格块转换为企微机器人支持的列表格式
 * @param {string[]} lines - 表格块内的行（已拆分）
 * @returns {string[]} 转换后的行
 * @description 企微群机器人 markdown 不支持表格语法，管道符会原样显示；
 *   统一转为「- **第一列**：其余列用 · 连接」的列表行，分隔行与表头行丢弃。
 */
const convertTableBlock = (lines: string[]): string[] => {
  const output: string[] = [];
  // 标准表格（含分隔行）时丢弃表头行——列名转成列表后只是噪音
  const hasSeparator = lines.some(isTableSeparatorLine);
  for (const [i, line] of lines.entries()) {
    if (isTableSeparatorLine(line)) continue;
    if (hasSeparator && i === 0) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '')
      .split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length === 0) continue;
    if (cells.length === 1) {
      output.push(`- ${cells[0]}`);
    } else {
      output.push(`- **${cells[0]}**：${cells.slice(1).join(' · ')}`);
    }
  }
  return output;
};

/**
 * 推送前清洗 Markdown，使其符合企微群机器人的渲染能力
 * @param {string} markdown - 原始 Markdown 内容
 * @returns {string} 清洗后的内容
 * @description 1) 模型参数里常见的字面 \n（双重转义）还原为真实换行；
 *   2) 表格语法转为列表（企微机器人 markdown 不支持表格）。
 */
export const normalizeWecomMarkdown = (markdown: string): string => {
  // 1. 字面 \n 还原为真实换行（仅替换反斜杠+n 两个字符的序列）
  const normalized = markdown.replace(/\\r\\n|\\n/g, '\n');
  // 2. 连续的表格行（以 | 开头）作为一个表格块整体转换
  const result: string[] = [];
  let tableBuffer: string[] = [];
  for (const line of normalized.split('\n')) {
    if (/^\s*\|/.test(line)) {
      tableBuffer.push(line);
    } else {
      if (tableBuffer.length > 0) {
        result.push(...convertTableBlock(tableBuffer));
        tableBuffer = [];
      }
      result.push(line);
    }
  }
  if (tableBuffer.length > 0) result.push(...convertTableBlock(tableBuffer));
  return result.join('\n');
};

/**
 * 通过企微 Webhook 发送 Markdown 消息
 * @param webhookUrl - 目标 Webhook 完整 URL
 * @param markdown - Markdown 格式消息内容
 * @returns Promise<boolean> 是否发送成功
 */
export async function sendWecomMarkdown(webhookUrl: string, markdown: string): Promise<boolean> {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      msgtype: 'markdown',
      markdown: { content: normalizeWecomMarkdown(markdown) },
    });

    const url = new URL(webhookUrl);
    const isHttps = url.protocol === 'https:';
    const options = {
      hostname: url.hostname,
      port: url.port ? Number(url.port) : (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload, 'utf-8'),
      },
    };

    const lib = isHttps ? https : http;
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body) as { errcode?: number };
          resolve(parsed.errcode === 0);
        } catch {
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[wecom-notify] Webhook 请求失败:', err.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * 向系统中所有已配置的 Webhook 发送通知
 * @param markdown - Markdown 格式消息内容
 * @returns Promise<boolean> 全部成功返回 true，任一失败返回 false
 */
export async function notifyAllWebhooks(markdown: string): Promise<boolean> {
  const webhooks = readWebhooks();
  if (webhooks.length === 0) {
    console.warn('[wecom-notify] 未配置任何 Webhook，跳过通知');
    return false;
  }
  const results = await Promise.all(
    webhooks.map((w) => sendWecomMarkdown(w.url, markdown)),
  );
  return results.every(Boolean);
}
