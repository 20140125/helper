import type { SqlExecution } from '@/types/database';

/**
 * 把 SQL 结果的列名转换成表格列配置
 * @description colKey 使用序号列名，避免 `COUNT(*)` 等含特殊字符的列名被 t-table 当成路径解析
 */
export const buildResultColumns = (result: SqlExecution | null): Array<Record<string, unknown>> =>
  (result?.columns ?? []).map((name, index) => ({
    colKey: `col_${index}`,
    title: name,
    ellipsis: true,
  }));

/**
 * 把 SQL 结果的二维数组转换成表格行对象
 */
export const buildResultRows = (result: SqlExecution | null): Array<Record<string, unknown>> =>
  (result?.rows ?? []).map((cells, rowIndex) => {
    const row: Record<string, unknown> = { __row: rowIndex + 1 };
    (result?.columns ?? []).forEach((_name, colIndex) => {
      row[`col_${colIndex}`] = cells[colIndex] ?? null;
    });
    return row;
  });

/**
 * 格式化字节数为可读文本
 */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
