import path from 'path';
import { CACHE_DIR, PROJECT_DIR } from '@/utils/paths';

/** 用户维护的知识文档目录名（相对项目根） */
export const KNOWLEDGE_USER_DIR = 'knowledge';

/** 用户维护的知识文档目录绝对路径 */
export const KNOWLEDGE_USER_DIR_ABS = path.join(PROJECT_DIR, KNOWLEDGE_USER_DIR);

/** 知识库索引目录配置文件路径 */
export const KNOWLEDGE_CONFIG_FILE = path.join(CACHE_DIR, 'knowledge_config.json');

/** 默认索引目录（项目文档 + 用户维护文档） */
export const DEFAULT_KNOWLEDGE_DIRS = ['docs', KNOWLEDGE_USER_DIR];

/** 单个文档最大字节数（2MB） */
export const KNOWLEDGE_MAX_DOC_BYTES = 2 * 1024 * 1024;

/**
 * 知识文档元信息
 */
export interface KnowledgeDoc {
  /** 文件名（含 .md 后缀） */
  name: string;
  /** 相对项目根的路径 */
  path: string;
  /** 文件字节数 */
  size: number;
  /** 最近修改时间（YYYY-MM-DD HH:mm:ss） */
  updated_at: string;
}

/**
 * 知识库配置
 */
export interface KnowledgeConfig {
  /** 索引目录列表（相对项目根） */
  dirs: string[];
  /** 最近更新时间 */
  updated_at: string;
}

/**
 * 新建知识文档请求体
 */
export interface CreateKnowledgeDocBody {
  /** 文档名（可省略 .md 后缀） */
  name: string;
  /** Markdown 正文 */
  content: string;
}

/**
 * 更新知识文档请求体
 */
export interface UpdateKnowledgeDocBody {
  /** Markdown 正文 */
  content: string;
}

/**
 * 更新索引目录请求体
 */
export interface UpdateKnowledgeDirsBody {
  /** 目录列表（相对项目根） */
  dirs: string[];
}

/**
 * 检索测试请求体
 */
export interface SearchKnowledgeBody {
  /** 检索关键词 */
  query: string;
  /** 返回片段数（1~10） */
  top_k?: number;
}
