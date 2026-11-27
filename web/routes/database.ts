import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  ErrorCode,
  returnResponse,
  getDatabaseStatus,
  listTables,
  describeTable,
  previewTableRows,
  runReadOnlyQuery,
  runWriteQuery,
  listSqlScripts,
  readSqlScript,
  initializeDatabase,
} from './utils';
import { DATABASE_ROWS_LIMIT, type DatabaseSqlBody, type InitDatabaseBody } from '@/types/database';

const router = Router();

/**
 * 统一处理接口异常
 * @description 业务校验失败与连接失败都把 message 透传给前端展示
 */
const handleError = (res: Response, err: unknown): Response =>
  returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, (err as Error).message);

/** @route GET /status - 连接状态 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await getDatabaseStatus();
    return returnResponse(res, ErrorCode.SUCCESS, { status } as Record<string, unknown>, '');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route GET /tables - 表与视图清单 */
router.get('/tables', async (_req: Request, res: Response) => {
  try {
    const tables = await listTables();
    return returnResponse(res, ErrorCode.SUCCESS, { tables } as Record<string, unknown>, '');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route GET /tables/:name - 表结构（字段、索引、建表语句） */
router.get('/tables/:name', async (req: Request, res: Response) => {
  try {
    const schema = await describeTable(req.params.name ?? '');
    return returnResponse(res, ErrorCode.SUCCESS, { schema } as Record<string, unknown>, '');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route GET /tables/:name/rows - 表数据预览 */
router.get('/tables/:name/rows', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || DATABASE_ROWS_LIMIT;
    const offset = Number(req.query.offset) || 0;
    const result = await previewTableRows(req.params.name ?? '', limit, offset);
    return returnResponse(res, ErrorCode.SUCCESS, { result } as Record<string, unknown>, '');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route GET /scripts - 建表 SQL 脚本清单 */
router.get('/scripts', (_req: Request, res: Response) => {
  try {
    const scripts = listSqlScripts();
    return returnResponse(res, ErrorCode.SUCCESS, { scripts } as Record<string, unknown>, '');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route GET /script?path= - 读取单个 SQL 脚本内容 */
router.get('/script', (req: Request, res: Response) => {
  try {
    const relPath = String(req.query.path ?? '');
    const content = readSqlScript(relPath);
    return returnResponse(res, ErrorCode.SUCCESS, { path: relPath, content } as Record<string, unknown>, '');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route POST /query - 只读 SQL 查询（按 view 权限放行） */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { sql } = (req.body ?? {}) as DatabaseSqlBody;
    const result = await runReadOnlyQuery(sql ?? '');
    return returnResponse(res, ErrorCode.SUCCESS, { result } as Record<string, unknown>, '');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route POST /execute - 执行写 SQL（超级管理员 + edit 权限） */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { sql } = (req.body ?? {}) as DatabaseSqlBody;
    const result = await runWriteQuery(sql ?? '');
    return returnResponse(res, ErrorCode.SUCCESS, { result } as Record<string, unknown>, '');
  } catch (err) {
    return handleError(res, err);
  }
});

/** @route POST /init - 执行 helper_database.sql 初始化（需输入库名二次确认） */
router.post('/init', async (req: Request, res: Response) => {
  try {
    const { confirmName } = (req.body ?? {}) as InitDatabaseBody;
    const result = await initializeDatabase(confirmName ?? '');
    return returnResponse(res, ErrorCode.SUCCESS, { result } as Record<string, unknown>, '数据库初始化完成');
  } catch (err) {
    return handleError(res, err);
  }
});

export default router;
