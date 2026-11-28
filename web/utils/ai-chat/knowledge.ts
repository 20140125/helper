import path from 'path';
import { DEFAULT_KNOWLEDGE_DIRS } from '@/types/knowledge';
import { readCacheJson } from '@/utils/database/cache-store';
import { getKnowledgeDocEntries } from '@/utils/knowledge';

/**
 * 项目知识库（RAG 检索）
 * @description 让贾维斯能回答「这个项目怎么用 / 怎么加一条规则」这类文档问题，
 *   而不用把几十篇文档全塞进上下文。文档全文存 hp_knowledge_docs，
 *   服务启动加载内存快照；数据库不可用时按配置目录扫描 Markdown 文件降级。
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

/** 文件名与标题在 BM25 中的重复次数（标题型查询需要更高权重） */
const FILENAME_TOKEN_WEIGHT = 3;
const TITLE_TOKEN_WEIGHT = 3;

/**
 * 知识目录（相对项目根）
 * @returns {Promise<string[]>} 相对路径列表
 * @description 优先读取管理页写入的缓存键 knowledge_config.json（真源为 已有业务表）；
 *   配置缺省时回退到环境变量 KNOWLEDGE_DIRS（逗号分隔）；
 *   两者都没有时使用默认目录（项目文档 + 用户维护文档）。
 *   目录用于过滤 hp_knowledge_docs 快照中的文档，配置变更无需重建库。
 */
const resolveKnowledgeDirs = async (): Promise<string[]> => {
  let raw = (process.env.KNOWLEDGE_DIRS ?? '').trim();
  try {
    const config = await readCacheJson<{ dirs?: unknown }>('knowledge_config.json');
    if (config && Array.isArray(config.dirs) && config.dirs.length > 0) {
      raw = config.dirs.filter((d): d is string => typeof d === 'string').join(',');
    }
  } catch {
    // 配置损坏时保持环境变量或默认值，不影响检索可用性
  }
  return raw ? raw.split(',').map((d) => d.trim()).filter(Boolean) : DEFAULT_KNOWLEDGE_DIRS;
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
 * 拆出片段的三个词元组：文件名 / 标题 / 正文
 * @param {KnowledgeChunk} chunk - 知识片段
 * @returns {{ fileName: string[]; title: string[]; body: string[] }} 未去重、未加权的词元组
 */
const splitIndexTokens = (chunk: KnowledgeChunk): { fileName: string[]; title: string[]; body: string[] } => ({
  fileName: tokenize(path.basename(chunk.source, '.md')),
  title: tokenize(chunk.title),
  body: tokenize(chunk.text),
});

/**
 * 构建参与 BM25 评分的词元：文件名 + 标题（加权）+ 正文
 * @param {KnowledgeChunk} chunk - 知识片段
 * @returns {string[]} 带权重的词元列表
 * @description 标题行在切块时会被跳过，若不单独加入索引，按文档名/章节名提问会召回失败。
 *   文件名与标题重复若干次以放大词频；IDF 另用未加权词元统计，避免重复污染 df。
 */
const getIndexTokens = (chunk: KnowledgeChunk): string[] => {
  const { fileName, title, body } = splitIndexTokens(chunk);
  const repeat = (tokens: string[], times: number): string[] =>
    Array.from({ length: times }, () => tokens).flat();
  return [
    ...repeat(fileName, FILENAME_TOKEN_WEIGHT),
    ...repeat(title, TITLE_TOKEN_WEIGHT),
    ...body,
  ];
};

/**
 * 构建用于 IDF 统计的词元集合（不加权、按出现与否计）
 * @param {KnowledgeChunk} chunk - 知识片段
 * @returns {Set<string>} 去重后的词元集合
 */
const getIndexTokenSet = (chunk: KnowledgeChunk): Set<string> => {
  const { fileName, title, body } = splitIndexTokens(chunk);
  return new Set([...fileName, ...title, ...body]);
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

/**
 * 构建知识库索引（懒加载 + 内存缓存）
 * @returns {Promise<KnowledgeChunk[]>} 全部片段
 * @description 文档来自 hp_knowledge_docs 的内存快照（数据库不可用时按配置目录扫描文件降级），
 *   按最终索引目录过滤后按标题切块；体量小（几十篇），首次查询一次性构建，无需落盘索引文件。
 */
export const buildKnowledgeIndex = async (): Promise<KnowledgeChunk[]> => {
  if (cachedChunks) return cachedChunks;
  const chunks: KnowledgeChunk[] = [];
  const dirs = await resolveKnowledgeDirs();
  for (const entry of await getKnowledgeDocEntries(dirs)) {
    chunks.push(...splitMarkdown(entry.content, entry.path));
  }
  cachedChunks = chunks;
  cachedAvgLen = chunks.length
    ? chunks.reduce((sum, c) => sum + getIndexTokens(c).length, 0) / chunks.length
    : 0;
  cachedDf = new Map<string, number>();
  for (const chunk of chunks) {
    for (const token of getIndexTokenSet(chunk)) {
      cachedDf.set(token, (cachedDf.get(token) ?? 0) + 1);
    }
  }
  return chunks;
};

/**
 * 检索知识库
 * @param {string} query - 查询词
 * @param {number} [topK] - 返回条数（默认 3）
 * @returns {Promise<KnowledgeHit[]>} 按相关度降序的命中片段
 */
export const searchKnowledge = async (query: string, topK: number = 3): Promise<KnowledgeHit[]> => {
  const chunks = await buildKnowledgeIndex();
  if (chunks.length === 0 || !query.trim()) return [];

  const df = cachedDf ?? new Map<string, number>();
  const total = chunks.length;
  const queryTokens = [...new Set(tokenize(query))];
  const hits: KnowledgeHit[] = [];

  for (const chunk of chunks) {
    const tokens = getIndexTokens(chunk);
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
