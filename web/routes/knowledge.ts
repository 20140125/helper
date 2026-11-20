import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  returnResponse,
  ErrorCode,
  listKnowledgeDocs,
  readKnowledgeDoc,
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
} from './utils';
import { KNOWLEDGE_MAX_DOC_BYTES } from '@/types/knowledge';
import type {
  CreateKnowledgeDocBody,
  UpdateKnowledgeDocBody,
  UpdateKnowledgeDirsBody,
  SearchKnowledgeBody,
} from '@/types/knowledge';

const router = Router();

/**
 * 获取知识库概览（用户文档列表 + 索引目录配置）
 * @route GET /
 */
router.get('/', (_req: Request, res: Response) => {
  const docs = listKnowledgeDocs();
  const config = readKnowledgeDirs();
  return returnResponse(res, ErrorCode.SUCCESS, { docs, config } as Record<string, unknown>, '');
});

/**
 * 读取知识文档正文
 * @route GET /docs/:name
 */
router.get('/docs/:name', (req: Request, res: Response) => {
  const safeName = normalizeDocName(req.params.name ?? '');
  if (!safeName) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文档名不合法');
  }
  const content = readKnowledgeDoc(safeName);
  if (content === null) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '文档不存在');
  }
  return returnResponse(res, ErrorCode.SUCCESS, { content } as Record<string, unknown>, '');
});

/**
 * 新建知识文档
 * @route POST /docs
 * @body {CreateKnowledgeDocBody}
 */
router.post('/docs', (req: Request, res: Response) => {
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
  if (readKnowledgeDoc(safeName) !== null) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, `文档已存在：${safeName}.md`);
  }

  writeKnowledgeDoc(safeName, content);
  resetKnowledgeIndex();
  const doc = listKnowledgeDocs().find((item) => item.name === `${safeName}.md`);
  return returnResponse(res, ErrorCode.SUCCESS, { doc } as Record<string, unknown>, '创建成功');
});

/**
 * 更新知识文档
 * @route PUT /docs/:name
 * @body {UpdateKnowledgeDocBody}
 */
router.put('/docs/:name', (req: Request, res: Response) => {
  const safeName = normalizeDocName(req.params.name ?? '');
  if (!safeName) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文档名不合法');
  }
  if (readKnowledgeDoc(safeName) === null) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '文档不存在');
  }
  const { content } = (req.body ?? {}) as UpdateKnowledgeDocBody;
  if (typeof content !== 'string' || !content.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文档内容不能为空');
  }
  if (getDocContentBytes(content) > KNOWLEDGE_MAX_DOC_BYTES) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文档内容超过 2MB 限制');
  }

  writeKnowledgeDoc(safeName, content);
  resetKnowledgeIndex();
  const doc = listKnowledgeDocs().find((item) => item.name === `${safeName}.md`);
  return returnResponse(res, ErrorCode.SUCCESS, { doc } as Record<string, unknown>, '更新成功');
});

/**
 * 删除知识文档
 * @route DELETE /docs/:name
 */
router.delete('/docs/:name', (req: Request, res: Response) => {
  const safeName = normalizeDocName(req.params.name ?? '');
  if (!safeName) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '文档名不合法');
  }
  if (!deleteKnowledgeDoc(safeName)) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '文档不存在');
  }
  resetKnowledgeIndex();
  return returnResponse(res, ErrorCode.SUCCESS, {} as Record<string, unknown>, '删除成功');
});

/**
 * 重建知识索引（清空内存缓存并立即重新扫描）
 * @route POST /reindex
 */
router.post('/reindex', (_req: Request, res: Response) => {
  resetKnowledgeIndex();
  const chunks = buildKnowledgeIndex();
  return returnResponse(
    res,
    ErrorCode.SUCCESS,
    { chunkCount: chunks.length, sources: new Set(chunks.map((c) => c.source)).size } as Record<string, unknown>,
    '索引已重建',
  );
});

/**
 * 检索测试（与贾维斯 query_knowledge 工具使用同一检索函数）
 * @route POST /search
 * @body {SearchKnowledgeBody}
 */
router.post('/search', (req: Request, res: Response) => {
  const { query, top_k } = (req.body ?? {}) as SearchKnowledgeBody;
  if (typeof query !== 'string' || !query.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '检索关键词不能为空');
  }
  const rawTopK = Number(top_k);
  const topK = Number.isFinite(rawTopK) ? Math.min(Math.max(Math.floor(rawTopK), 1), 10) : 3;
  const hits = searchKnowledge(query.trim(), topK);
  return returnResponse(res, ErrorCode.SUCCESS, { hits } as Record<string, unknown>, '');
});

/**
 * 更新索引目录配置
 * @route PUT /dirs
 * @body {UpdateKnowledgeDirsBody}
 */
router.put('/dirs', (req: Request, res: Response) => {
  const { dirs } = (req.body ?? {}) as UpdateKnowledgeDirsBody;
  const normalized = normalizeKnowledgeDirs(dirs);
  if (!normalized) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '目录列表不合法：需为项目根内的相对路径，且至少保留一个目录');
  }
  const config = writeKnowledgeDirs(normalized);
  resetKnowledgeIndex();
  return returnResponse(res, ErrorCode.SUCCESS, { config } as Record<string, unknown>, '索引目录已更新');
});

export default router;
