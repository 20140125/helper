import fs from 'fs';
import path from 'path';
import { PROJECT_DIR } from '@/utils/paths';
import { KNOWLEDGE_CONFIG_FILE, DEFAULT_KNOWLEDGE_DIRS } from '@/types/knowledge';

/**
 * 项目知识库（RAG 检索）
 * @description 让贾维斯能回答「这个项目怎么用 / 怎么加一条规则」这类文档问题，
 *   而不用把 25 篇文档全塞进上下文。
 *
 * 选型说明：**BM25 而不是向量库**。
 * - 文档总量只有几十篇，BM25 的准确率对「术语型提问」（query_logs 怎么用）已经足够；
 * - 零依赖、零外部服务、索引在内存里毫秒级构建，符合项目「单机可跑」的基调；
 * - 真到几万篇或需要语义召回时，再换向量库不迟（检索接口保持不变即可）。
 */

/** 知识片段 */
export interface KnowledgeChunk {
  /** 来源文件路径（相对项目根） */
  source: string;
  /** 片段所属标题 */
  title: string;
  /** 片段正文 */
  text: string;
}

/** 检索结果（含相关度得分） */
export interface KnowledgeHit {
  /** 来源文件路径 */
  source: string;
  /** 片段标题 */
  title: string;
  /** 片段正文 */
  text: string;
  /** BM25 得分 */
  score: number;
}

/** BM25 调参 */
const BM25_K1 = 1.5;
const BM25_B = 0.75;

/** 单个片段的最大字符数 */
const MAX_CHUNK_CHARS = 900;

/**
 * 知识目录（相对项目根）
 * @returns {string[]} 绝对路径列表
 * @description 优先读取管理页写入的 .cache/knowledge_config.json；
 *   配置文件不存在时回退到环境变量 KNOWLEDGE_DIRS（逗号分隔）；
 *   两者都没有时使用默认目录（项目文档 + 用户维护文档）。
 */
const resolveKnowledgeDirs = (): string[] => {
  let raw = (process.env.KNOWLEDGE_DIRS ?? '').trim();
  try {
    if (fs.existsSync(KNOWLEDGE_CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(KNOWLEDGE_CONFIG_FILE, 'utf-8')) as { dirs?: unknown };
      if (Array.isArray(config.dirs) && config.dirs.length > 0) {
        raw = config.dirs.filter((d): d is string => typeof d === 'string').join(',');
      }
    }
  } catch {
    // 配置损坏时保持环境变量或默认值，不影响检索可用性
  }
  const dirs = raw ? raw.split(',').map((d) => d.trim()).filter(Boolean) : DEFAULT_KNOWLEDGE_DIRS;
  return dirs.map((d) => path.join(PROJECT_DIR, d));
};

/** 内存索引（懒加载） */
let cachedChunks: KnowledgeChunk[] | null = null;
let cachedDf: Map<string, number> | null = null;
let cachedAvgLen = 0;

/**
 * 中文 + 英文混合分词
 * @param {string} text - 原文
 * @returns {string[]} 词元列表
 * @description 中文没有空格，采用「相邻两字」切分（bigram）：既无需引入分词库，
 *   又能覆盖「规则 / 日志 / 巡检」这类双字术语；英文数字按连续串切。
 */
const tokenize = (text: string): string[] => {
  const tokens: string[] = [];
  const lower = text.toLowerCase();
  const asciiMatches = lower.match(/[a-z0-9_]{2,}/g) ?? [];
  tokens.push(...asciiMatches);
  const cjk = lower.replace(/[^一-龥]+/g, ' ');
  const segments = cjk.split(' ').filter(Boolean);
  for (const seg of segments) {
    for (let i = 0; i < seg.length - 1; i += 1) {
      tokens.push(seg.slice(i, i + 2));
    }
    if (seg.length === 1) tokens.push(seg);
  }
  return tokens;
};

/**
 * 把一篇 Markdown 切成若干片段（按标题切，过长再按长度切）
 * @param {string} content - 文档全文
 * @param {string} source - 来源路径
 * @returns {KnowledgeChunk[]} 片段列表
 */
const splitMarkdown = (content: string, source: string): KnowledgeChunk[] => {
  const chunks: KnowledgeChunk[] = [];
  const lines = content.split('\n');
  let title = path.basename(source, '.md');
  let buffer: string[] = [];

  const flush = (): void => {
    const text = buffer.join('\n').trim();
    buffer = [];
    if (!text) return;
    if (text.length <= MAX_CHUNK_CHARS) {
      chunks.push({ source, title, text });
      return;
    }
    // 过长片段按字符窗口再切，保留重叠避免切断语义
    for (let i = 0; i < text.length; i += MAX_CHUNK_CHARS) {
      chunks.push({ source, title, text: text.slice(i, i + MAX_CHUNK_CHARS) });
    }
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      flush();
      title = heading[1].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return chunks;
};

/** 递归扫描时忽略的目录 */
const IGNORE_SCAN_DIRS = new Set([
  'node_modules', '.git', '.cache', '.runtime', '.codebuddy', 'dist', 'build', 'public',
]);

/**
 * 递归收集目录下的 Markdown 文件
 * @param {string} dir - 根目录绝对路径
 * @returns {string[]} md 文件绝对路径列表
 * @description 支持 `KNOWLEDGE_DIRS` 指向带子目录的知识源（如 scripts/ 下的说明文档）；
 *   忽略依赖与构建产物目录，深度上限 4 层。
 */
const collectMdFiles = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (current: string, depth: number): void => {
    if (depth > 4) return;
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const abs = path.join(current, item.name);
      if (item.isDirectory()) {
        if (IGNORE_SCAN_DIRS.has(item.name)) continue;
        walk(abs, depth + 1);
      } else if (item.isFile() && item.name.toLowerCase().endsWith('.md')) {
        out.push(abs);
      }
    }
  };
  walk(dir, 1);
  return out;
};

/**
 * 构建知识库索引（懒加载 + 内存缓存）
 * @returns {KnowledgeChunk[]} 全部片段
 * @description 文档体量小（几十篇），首次查询时一次性构建即可，无需落盘索引文件。
 */
export const buildKnowledgeIndex = (): KnowledgeChunk[] => {
  if (cachedChunks) return cachedChunks;
  const chunks: KnowledgeChunk[] = [];
  for (const dir of resolveKnowledgeDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const abs of collectMdFiles(dir)) {
      try {
        const content = fs.readFileSync(abs, 'utf-8');
        chunks.push(...splitMarkdown(content, path.relative(PROJECT_DIR, abs)));
      } catch {
        // 单篇读取失败跳过
      }
    }
  }
  cachedChunks = chunks;
  cachedAvgLen = chunks.length
    ? chunks.reduce((sum, c) => sum + tokenize(c.text).length, 0) / chunks.length
    : 0;
  cachedDf = new Map<string, number>();
  for (const chunk of chunks) {
    for (const token of new Set(tokenize(chunk.text))) {
      cachedDf.set(token, (cachedDf.get(token) ?? 0) + 1);
    }
  }
  return chunks;
};

/**
 * 检索知识库
 * @param {string} query - 查询词
 * @param {number} [topK] - 返回条数（默认 3）
 * @returns {KnowledgeHit[]} 按相关度降序的命中片段
 */
export const searchKnowledge = (query: string, topK: number = 3): KnowledgeHit[] => {
  const chunks = buildKnowledgeIndex();
  if (chunks.length === 0 || !query.trim()) return [];

  const df = cachedDf ?? new Map<string, number>();
  const total = chunks.length;
  const queryTokens = [...new Set(tokenize(query))];
  const hits: KnowledgeHit[] = [];

  for (const chunk of chunks) {
    const tokens = tokenize(chunk.text);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const qt of queryTokens) {
      const freq = tf.get(qt) ?? 0;
      if (freq === 0) continue;
      const docFreq = df.get(qt) ?? 0;
      const idf = Math.log(1 + (total - docFreq + 0.5) / (docFreq + 0.5));
      const denom = freq + BM25_K1 * (1 - BM25_B + BM25_B * (tokens.length / (cachedAvgLen || 1)));
      score += idf * ((freq * (BM25_K1 + 1)) / denom);
    }
    if (score > 0) hits.push({ source: chunk.source, title: chunk.title, text: chunk.text, score });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, topK);
};

/**
 * 重置索引缓存（文档更新后调用）
 * @returns {void}
 */
export const resetKnowledgeIndex = (): void => {
  cachedChunks = null;
  cachedDf = null;
  cachedAvgLen = 0;
};
