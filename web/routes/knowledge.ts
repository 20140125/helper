import path from 'path';
import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  returnResponse,
  ErrorCode,
  listKnowledgeDocs,
  readKnowledgeDoc,
  readDocByPath,
  isUserDocPath,
  importSystemDoc,
  writeKnowledgeDoc,
  deleteKnowledgeDoc,
  readKnowledgeDirs,
  normalizeKnowledgeDirs,
  writeKnowledgeDirs,
  normalizeDocName,
  getDocContentBytes,
  searchKnowledge,
  buildKnowledgeIndex,
  resetKnowledgeIndex,
  refreshKnowledgeDocs,
} from './utils';
import { KNOWLEDGE_MAX_DOC_BYTES, KNOWLEDGE_USER_DIR } from '@/types/knowledge';
import type {
  CreateKnowledgeDocBody,
  UpdateKnowledgeDocBody,
  UpdateKnowledgeDirsBody,
  SearchKnowledgeBody,
} from '@/types/knowledge';

const router = Router();

/** 把数据库异常转成 500 响应 */
const dbErrorResponse = (res: Response, error: unknown, fallback: string) =>
  returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : fallback);

/**
 * 获取知识库概览（用户文档列表 + 索引目录配置）
 * @route GET /
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const docs = await listKnowledgeDocs();
    const config = await readKnowledgeDirs();
    return returnResponse(res, ErrorCode.SUCCESS, { docs, config } as Record<string, unknown>, '');
  } catch (error) {
    return dbErrorResponse(res, error, '读取知识库概览失败');
  }
});

/**
 * 读取知识文档正文（系统文档与用户文档均可读）
 * @route GET /docs/:docPath
 */
router.get('/docs/:docPath', async (req: Request, res: Response) => {
  try {
    const content = await readDocByPath(req.params.docPath ?? '');
    if (content === null) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, '文档不存在或路径不合法');
    }
    return returnResponse(res, ErrorCode.SUCCESS, { content } as Record<string, unknown>, '');
  } catch (error) {
    return dbErrorResponse(res, error, '读取知识文档失败');
  }
});

/**
 * 导入系统文档为用户文档副本
 * @route POST /docs/:docPath/import
 * @description 原系统文档保持不变，仅复制内容到 knowledge/ 目录供编辑
 */
router.post('/docs/:docPath/import', async (req: Request, res: Response) => {
  try {
    const doc = await importSystemDoc(req.params.docPath ?? '');
    if (!doc) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '导入失败：文档不可访问或用户目录已有同名文档');
    }
    resetKnowledgeIndex();
    return returnResponse(res, ErrorCode.SUCCESS, { doc } as Record<string, unknown>, '已导入为用户文档');
  } catch (error) {
    return dbErrorResponse(res, error, '导入知识文档失败');
  }
});

/**
 * 新建知识文档
 * @route POST /docs
 * @body {CreateKnowledgeDocBody}
 */
router.post('/docs', async (req: Request, res: Response) => {
  const { name, content } = (req.body ?? {}) as CreateKnowledgeDocBody;
  const safeName = normalizeDocName(name ?? '');
  if (!safeName) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文档名不合法：仅支持中文、字母、数字、下划线与横线，不超过 80 字符');
  }
  if (typeof content !== 'string' || !content.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文档内容不能为空');
  }
  if (getDocContentBytes(content) > KNOWLEDGE_MAX_DOC_BYTES) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文档内容超过 2MB 限制');
  }
  try {
    if (readKnowledgeDoc(safeName) !== null) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, `文档已存在：${safeName}.md`);
    }

    await writeKnowledgeDoc(safeName, content);
    resetKnowledgeIndex();
    const doc = (await listKnowledgeDocs()).find((item) => item.path === `${KNOWLEDGE_USER_DIR}/${safeName}.md`);
    return returnResponse(res, ErrorCode.SUCCESS, { doc } as Record<string, unknown>, '创建成功');
  } catch (error) {
    return dbErrorResponse(res, error, '创建知识文档失败');
  }
});

/**
 * 更新用户知识文档（系统文档只读，拒绝修改）
 * @route PUT /docs/:docPath
 * @body {UpdateKnowledgeDocBody}
 */
router.put('/docs/:docPath', async (req: Request, res: Response) => {
  const docPath = req.params.docPath ?? '';
  if (!isUserDocPath(docPath)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '系统文档为只读，请先导入为用户文档再编辑');
  }
  const safeName = normalizeDocName(path.basename(docPath, path.extname(docPath)));
  const { content } = (req.body ?? {}) as UpdateKnowledgeDocBody;
  if (typeof content !== 'string' || !content.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文档内容不能为空');
  }
  if (getDocContentBytes(content) > KNOWLEDGE_MAX_DOC_BYTES) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文档内容超过 2MB 限制');
  }
  try {
    if (!safeName || readKnowledgeDoc(safeName) === null) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, '文档不存在');
    }

    await writeKnowledgeDoc(safeName, content);
    resetKnowledgeIndex();
    const doc = (await listKnowledgeDocs()).find((item) => item.path === `${KNOWLEDGE_USER_DIR}/${safeName}.md`);
    return returnResponse(res, ErrorCode.SUCCESS, { doc } as Record<string, unknown>, '更新成功');
  } catch (error) {
    return dbErrorResponse(res, error, '更新知识文档失败');
  }
});

/**
 * 删除用户知识文档（系统文档只读，拒绝删除）
 * @route DELETE /docs/:docPath
 */
router.delete('/docs/:docPath', async (req: Request, res: Response) => {
  const docPath = req.params.docPath ?? '';
  if (!isUserDocPath(docPath)) {
    return returnResponse(res, ErrorCode.FORBIDDEN, {}, '系统文档为只读，不可删除');
  }
  const safeName = normalizeDocName(path.basename(docPath, path.extname(docPath)));
  try {
    if (!safeName || !(await deleteKnowledgeDoc(safeName))) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, '文档不存在');
    }
    resetKnowledgeIndex();
    return returnResponse(res, ErrorCode.SUCCESS, {} as Record<string, unknown>, '删除成功');
  } catch (error) {
    return dbErrorResponse(res, error, '删除知识文档失败');
  }
});

/**
 * 重建知识索引（刷新数据库快照，清空内存缓存并立即重新扫描）
 * @route POST /reindex
 */
router.post('/reindex', async (_req: Request, res: Response) => {
  try {
    await refreshKnowledgeDocs();
    resetKnowledgeIndex();
    const chunks = await buildKnowledgeIndex();
    return returnResponse(
      res,
      ErrorCode.SUCCESS,
      { chunkCount: chunks.length, sources: new Set(chunks.map((c) => c.source)).size } as Record<string, unknown>,
      '索引已重建',
    );
  } catch (error) {
    return dbErrorResponse(res, error, '重建知识索引失败');
  }
});

/**
 * 检索测试（与贾维斯 query_knowledge 工具使用同一检索函数）
 * @route POST /search
 * @body {SearchKnowledgeBody}
 */
router.post('/search', async (req: Request, res: Response) => {
  const { query, top_k } = (req.body ?? {}) as SearchKnowledgeBody;
  if (typeof query !== 'string' || !query.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '检索关键词不能为空');
  }
  const rawTopK = Number(top_k);
  const topK = Number.isFinite(rawTopK) ? Math.min(Math.max(Math.floor(rawTopK), 1), 10) : 3;
  try {
    const hits = await searchKnowledge(query.trim(), topK);
    return returnResponse(res, ErrorCode.SUCCESS, { hits } as Record<string, unknown>, '');
  } catch (error) {
    return dbErrorResponse(res, error, '检索知识库失败');
  }
});

/**
 * 更新索引目录配置
 * @route PUT /dirs
 * @body {UpdateKnowledgeDirsBody}
 */
router.put('/dirs', async (req: Request, res: Response) => {
  const { dirs } = (req.body ?? {}) as UpdateKnowledgeDirsBody;
  const normalized = normalizeKnowledgeDirs(dirs);
  if (!normalized) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '目录列表不合法：需为项目根内的相对路径，且至少保留一个目录');
  }
  try {
    const config = await writeKnowledgeDirs(normalized);
    // 新目录里的文档需要先同步入库，才能出现在快照与检索结果中
    await refreshKnowledgeDocs();
    resetKnowledgeIndex();
    return returnResponse(res, ErrorCode.SUCCESS, { config } as Record<string, unknown>, '索引目录已更新');
  } catch (error) {
    return dbErrorResponse(res, error, '更新索引目录失败');
  }
});

export default router;
