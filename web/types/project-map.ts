/**
 * 项目结构地图类型
 * @description 让贾维斯能回答「这个功能在哪个文件」，而不只是检索 docs/ 文档。
 *   只存**结构元数据**（路径 / 类型 / 体积 / 一句话描述），不存文件内容——
 *   内容由 read_project_file 按需读，避免把整个仓库塞进上下文。
 */

/** 地图条目类型 */
export type ProjectMapNodeType = 'dir' | 'file';

/** 单个地图条目 */
export interface ProjectMapEntry {
  /** 相对项目根的路径（统一用 / 分隔） */
  path: string;
  /** 目录或文件 */
  type: ProjectMapNodeType;
  /** 扩展名（含点，目录为空串） */
  ext?: string;
  /** 字节体积（仅文件） */
  size?: number;
  /** 一句话描述：取自文件首行注释或首行内容（仅文件） */
  desc?: string;
  /** 直属文件数（仅目录） */
  file_count?: number;
  /** 直属子目录数（仅目录） */
  dir_count?: number;
}

/** 地图查询结果 */
export interface ProjectMapQuery {
  /** 命中的条目 */
  entries: ProjectMapEntry[];
  /** 命中总数（可能大于返回条数） */
  total: number;
  /** 是否被截断 */
  truncated: boolean;
}
