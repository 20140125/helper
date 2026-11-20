/**
 * 知识文档元信息
 */
export interface KnowledgeDoc {
  /** 文件名（含 .md 后缀） */
  name: string;
  /** 相对项目根的路径（唯一标识） */
  path: string;
  /** 所属索引目录 */
  source_dir: string;
  /** 是否为只读系统文档 */
  readonly: boolean;
  /** 文件字节数 */
  size: number;
  /** 最近修改时间 */
  updated_at: string;
  /** 文档类型显示文本（Model 预处理） */
  typeLabel?: string;
  /** 文件大小显示文本（Model 预处理） */
  sizeText?: string;
}

/**
 * 知识库索引配置
 */
export interface KnowledgeConfig {
  /** 索引目录列表（相对项目根） */
  dirs: string[];
  /** 最近更新时间 */
  updated_at: string;
}

/**
 * 检索命中片段
 */
export interface KnowledgeHit {
  /** 来源文件 */
  source: string;
  /** 片段标题 */
  title: string;
  /** 片段正文 */
  text: string;
  /** 相关度得分 */
  score: number;
}

/**
 * 知识库概览响应
 */
export interface KnowledgeOverviewResponse {
  code: number;
  data: { docs: KnowledgeDoc[]; config: KnowledgeConfig };
  message: string;
}

/**
 * 文档写入响应
 */
export interface KnowledgeDocResponse {
  code: number;
  data: { doc?: KnowledgeDoc };
  message: string;
}

/**
 * 文档正文响应
 */
export interface KnowledgeDocContentResponse {
  code: number;
  data: { content: string };
  message: string;
}

/**
 * 索引重建响应
 */
export interface KnowledgeReindexResponse {
  code: number;
  data: { chunkCount: number; sources: number };
  message: string;
}

/**
 * 导入系统文档响应
 */
export interface KnowledgeImportResponse {
  code: number;
  data: { doc: KnowledgeDoc };
  message: string;
}

/**
 * 检索测试响应
 */
export interface KnowledgeSearchResponse {
  code: number;
  data: { hits: KnowledgeHit[] };
  message: string;
}

/**
 * 索引目录更新响应
 */
export interface KnowledgeDirsResponse {
  code: number;
  data: { config: KnowledgeConfig };
  message: string;
}

/**
 * 文档编辑表单数据
 */
export interface KnowledgeDocFormData {
  /** AutoForm v-model 所需的索引签名 */
  [key: string]: unknown;
  /** 文档名（可省略 .md 后缀） */
  name: string;
  /** Markdown 正文 */
  content: string;
}

/**
 * 索引目录编辑表单数据
 */
export interface KnowledgeDirsFormData {
  /** AutoForm v-model 所需的索引签名 */
  [key: string]: unknown;
  /** 逗号分隔的目录文本 */
  dirsText: string;
}
