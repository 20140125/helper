/** 用户维护的知识文档目录名（相对项目根） */
export const KNOWLEDGE_USER_DIR = 'knowledge';

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
  /** 相对项目根的路径（唯一标识，供读取/编辑/删除使用） */
  path: string;
  /** 所属索引目录（相对项目根） */
  source_dir: string;
  /** 是否只读系统文档（来自非 knowledge/ 目录，不可编辑或删除） */
  readonly: boolean;
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

/** 知识文档入库表名 */
export const KNOWLEDGE_DOCS_TABLE = 'hp_knowledge_docs';

/**
 * 知识文档入库列（种子 SQL 与运行时 UPSERT 共用）
 * @description 不包含自增 id、由 source_dir + name 派生的 doc_path，
 *   以及数据库维护的 created_at / updated_at
 */
export const KNOWLEDGE_DOCS_COLUMNS =
  '(`name`, `source_dir`, `is_system`, `content`, `content_hash`, `size_bytes`, `file_mtime`)';

/**
 * 知识文档表 DDL（单一来源：生成脚本、--apply 与运行时建表共用）
 * @description 不 DROP 表，避免全库初始化冲掉管理页编辑过的用户文档；
 *   doc_path 不入库，由 source_dir + '/' + name 派生，唯一性由 (source_dir, name) 保证
 */
export const KNOWLEDGE_DOCS_DDL = `CREATE TABLE IF NOT EXISTS \`hp_knowledge_docs\` (
  \`id\`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  \`name\`         VARCHAR(191) NOT NULL COMMENT '文件名（含 .md）',
  \`source_dir\`   VARCHAR(64)  NOT NULL COMMENT '所属索引目录（如 docs / knowledge）',
  \`is_system\`    TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '1=系统文档只读（文件回灌）/ 0=用户文档可编辑（库为真源）',
  \`content\`      LONGTEXT     NOT NULL COMMENT 'Markdown 全文',
  \`content_hash\` CHAR(64)     NOT NULL DEFAULT '' COMMENT '正文 SHA-256，用于文件变更检测',
  \`size_bytes\`   INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '正文 UTF-8 字节数',
  \`file_mtime\`   DATETIME     NULL COMMENT '最近一次同步的源文件修改时间',
  \`created_at\`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_doc\` (\`source_dir\`, \`name\`),
  KEY \`idx_source_dir\` (\`source_dir\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目知识库文档全文（docs/ + knowledge/）';`;

/**
 * 幂等 UPSERT 后缀（种子 SQL 与 --apply 共用）
 * @description 系统文档以文件为准回灌全文；用户文档只在缺失时插入，
 *   不覆盖管理页 / 贾维斯在数据库里编辑过的正文
 */
export const KNOWLEDGE_DOCS_UPSERT = 'ON DUPLICATE KEY UPDATE '
  + '`name` = VALUES(`name`), `source_dir` = VALUES(`source_dir`), `is_system` = VALUES(`is_system`), '
  + '`content` = IF(VALUES(`is_system`) = 1, VALUES(`content`), `hp_knowledge_docs`.`content`), '
  + '`content_hash` = IF(VALUES(`is_system`) = 1, VALUES(`content_hash`), `hp_knowledge_docs`.`content_hash`), '
  + '`size_bytes` = IF(VALUES(`is_system`) = 1, VALUES(`size_bytes`), `hp_knowledge_docs`.`size_bytes`), '
  + '`file_mtime` = IF(VALUES(`is_system`) = 1, VALUES(`file_mtime`), `hp_knowledge_docs`.`file_mtime`)';

/**
 * 待入库的文档记录（由 Markdown 文件扫描生成）
 * @description 生成 SQL、文件同步与运行时 UPSERT 共用；不含数据库维护的时间列；
 *   doc_path 为派生字段，仅用于文件与库记录对齐，不写入数据库
 */
export interface KnowledgeDocSeed {
  /** 相对项目根的文档路径（由 source_dir + name 派生，不入库） */
  doc_path: string;
  /** 文件名（含 .md） */
  name: string;
  /** 所属索引目录 */
  source_dir: string;
  /** 1=系统文档 / 0=用户文档 */
  is_system: number;
  /** Markdown 全文 */
  content: string;
  /** 正文 SHA-256 */
  content_hash: string;
  /** 正文 UTF-8 字节数 */
  size_bytes: number;
  /** 源文件修改时间（MySQL DATETIME 文本） */
  file_mtime: string;
}

/**
 * 知识文档数据库记录
 * @description doc_path 由 SELECT 派生，不是数据库列；file_mtime / updated_at 为 MySQL DATETIME 文本
 */
export interface KnowledgeDocRecord {
  /** 相对项目根的文档路径（由 source_dir + name 派生） */
  doc_path: string;
  /** 文件名（含 .md） */
  name: string;
  /** 所属索引目录 */
  source_dir: string;
  /** 1=系统文档 / 0=用户文档 */
  is_system: number;
  /** Markdown 全文 */
  content: string;
  /** 正文 SHA-256 */
  content_hash: string;
  /** 正文 UTF-8 字节数 */
  size_bytes: number;
  /** 最近同步的源文件修改时间 */
  file_mtime: string | null;
  /** 数据库最近更新时间 */
  updated_at: string;
}

/**
 * 供 BM25 索引使用的文档条目
 */
export interface KnowledgeDocEntry {
  /** 相对项目根的文档路径 */
  path: string;
  /** Markdown 全文 */
  content: string;
}
