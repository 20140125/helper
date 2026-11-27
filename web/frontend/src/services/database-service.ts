import type {
  DatabaseInitResponse,
  DatabaseSchemaResponse,
  DatabaseScriptResponse,
  DatabaseScriptsResponse,
  DatabaseSqlResponse,
  DatabaseStatusResponse,
  DatabaseTablesResponse,
} from '@/types/database';
import { BaseService } from './base-service';

// ==============================
// Service 类
// ==============================

/**
 * 数据库管理服务类
 * @description 封装连接状态、库表结构、数据预览、SQL 执行与建表脚本初始化接口
 */
export class DatabaseService extends BaseService {
  /**
   * 获取数据库连接状态
   * @returns {Promise<DatabaseStatusResponse>} 连接配置与版本信息
   * @description 服务端主动探测 MySQL 连通性，失败时返回错误文本而非抛异常
   */
  fetchStatus = async (): Promise<DatabaseStatusResponse> => {
    return this.get<DatabaseStatusResponse>('/database/status');
  };

  /**
   * 获取库表清单
   * @returns {Promise<DatabaseTablesResponse>} 当前库的表与视图列表
   * @description 从 information_schema 读取，包含行数、引擎与注释
   */
  fetchTables = async (): Promise<DatabaseTablesResponse> => {
    return this.get<DatabaseTablesResponse>('/database/tables');
  };

  /**
   * 获取单张表的结构
   * @param {string} name - 表名或视图名
   * @returns {Promise<DatabaseSchemaResponse>} 字段、索引与建表语句
   * @description 后端校验表名并确认其属于当前库
   */
  fetchTableSchema = async (name: string): Promise<DatabaseSchemaResponse> => {
    return this.get<DatabaseSchemaResponse>(`/database/tables/${encodeURIComponent(name)}`);
  };

  /**
   * 预览表数据
   * @param {string} name - 表名或视图名
   * @param {number} limit - 返回行数（后端上限 100）
   * @param {number} offset - 偏移量
   * @returns {Promise<DatabaseSqlResponse>} 列名与行数据
   * @description 强制 LIMIT/OFFSET，避免全表拉取
   */
  fetchTableRows = async (name: string, limit: number, offset: number): Promise<DatabaseSqlResponse> => {
    return this.get<DatabaseSqlResponse>(`/database/tables/${encodeURIComponent(name)}/rows`, {
      params: { limit, offset },
    });
  };

  /**
   * 获取建表 SQL 脚本清单
   * @returns {Promise<DatabaseScriptsResponse>} helper_database.sql 与 sql/ 下的脚本
   * @description 用于页面浏览项目内的数据库定义
   */
  fetchScripts = async (): Promise<DatabaseScriptsResponse> => {
    return this.get<DatabaseScriptsResponse>('/database/scripts');
  };

  /**
   * 读取单个 SQL 脚本内容
   * @param {string} scriptPath - 相对项目根的路径
   * @returns {Promise<DatabaseScriptResponse>} 脚本正文
   * @description 后端按白名单校验路径，拒绝目录穿越
   */
  fetchScript = async (scriptPath: string): Promise<DatabaseScriptResponse> => {
    return this.get<DatabaseScriptResponse>('/database/script', { params: { path: scriptPath } });
  };

  /**
   * 执行只读 SQL 查询
   * @param {string} sql - SELECT / SHOW / DESCRIBE / EXPLAIN / WITH 语句
   * @returns {Promise<DatabaseSqlResponse>} 查询结果
   * @description 后端拒绝写入语句与多语句，并对无 LIMIT 的 SELECT 自动限流
   */
  runQuery = async (sql: string): Promise<DatabaseSqlResponse> => {
    return this.post<DatabaseSqlResponse>('/database/query', { sql });
  };

  /**
   * 执行写 SQL
   * @param {string} sql - 单条 DDL / DML 语句
   * @returns {Promise<DatabaseSqlResponse>} 执行结果或受影响行数
   * @description 仅超级管理员且具备 database:edit 权限时可调用
   */
  executeSql = async (sql: string): Promise<DatabaseSqlResponse> => {
    return this.post<DatabaseSqlResponse>('/database/execute', { sql });
  };

  /**
   * 用项目建表脚本重建数据库
   * @param {string} confirmName - 当前数据库名（二次确认）
   * @returns {Promise<DatabaseInitResponse>} 执行脚本数与耗时
   * @description 会删除并重建当前库全部表，操作不可回滚
   */
  initialize = async (confirmName: string): Promise<DatabaseInitResponse> => {
    return this.post<DatabaseInitResponse>('/database/init', { confirmName }, { timeout: 120000 });
  };
}

// ==============================
// 工厂函数和默认导出
// ==============================

/**
 * 创建数据库管理服务实例的工厂函数
 * @description 提供 DatabaseService 类的实例，确保服务实例的一致性
 * @returns {DatabaseService} 数据库管理服务实例
 */
export const createDatabaseService = (): DatabaseService => new DatabaseService();

/**
 * 默认导出的数据库管理服务实例
 * @description 为向后兼容性保留的默认导出，推荐使用 createDatabaseService 工厂函数
 */
export default createDatabaseService();
