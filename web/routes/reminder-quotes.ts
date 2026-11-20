import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  returnResponse,
  ErrorCode,
  readReminderQuotesFile,
  writeReminderQuotesFile,
  flattenReminderQuotes,
  rebuildReminderQuotesFile,
  isValidReminderBucket,
  REMINDER_QUOTES_BUCKETS,
} from './utils';
import type {
  CreateReminderQuoteBody,
  UpdateReminderQuoteBody,
  ReminderQuoteItem,
} from '@/types/reminder-quotes';

const router = Router();

const genId = (bucket: string): string =>
  `${bucket}::${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * 获取所有寄语条目（扁平化）
 * @route GET /
 */
router.get('/', (_req: Request, res: Response) => {
  const items = flattenReminderQuotes(readReminderQuotesFile());
  return returnResponse(res, ErrorCode.SUCCESS, { items, buckets: REMINDER_QUOTES_BUCKETS } as Record<string, unknown>, '');
});

/**
 * 新建寄语条目
 * @route POST /
 * @body {CreateReminderQuoteBody}
 */
router.post('/', (req: Request, res: Response) => {
  const { bucket, content } = req.body as CreateReminderQuoteBody;
  if (!bucket || !isValidReminderBucket(bucket)) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, 'bucket 非法');
  }
  if (!content?.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '内容不能为空');
  }
  const file = readReminderQuotesFile();
  const items = flattenReminderQuotes(file);
  const createdId = genId(bucket);
  items.push({ id: createdId, bucket, content });
  writeReminderQuotesFile(rebuildReminderQuotesFile(items, file));
  const newItem: ReminderQuoteItem = { id: createdId, bucket, content };
  return returnResponse(res, ErrorCode.SUCCESS, { item: newItem } as Record<string, unknown>, '创建成功');
});

/**
 * 更新寄语条目
 * @route PUT /:id
 * @body {UpdateReminderQuoteBody}
 */
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { bucket, content } = req.body as UpdateReminderQuoteBody;
  const file = readReminderQuotesFile();
  const items = flattenReminderQuotes(file);
  const target = items.find((i) => i.id === id);
  if (!target) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '条目不存在');
  }
  const nextBucket = bucket ?? target.bucket;
  const nextContent = content ?? target.content;
  if (!isValidReminderBucket(nextBucket)) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, 'bucket 非法');
  }
  if (!nextContent.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '内容不能为空');
  }
  const remaining = items.filter((i) => i.id !== id);
  remaining.push({ ...target, bucket: nextBucket, content: nextContent });
  writeReminderQuotesFile(rebuildReminderQuotesFile(remaining, file));
  return returnResponse(res, ErrorCode.SUCCESS, { item: { ...target, bucket: nextBucket, content: nextContent } } as Record<string, unknown>, '更新成功');
});

/**
 * 删除寄语条目
 * @route DELETE /:id
 */
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const file = readReminderQuotesFile();
  const items = flattenReminderQuotes(file);
  const index = items.findIndex((i) => i.id === id);
  if (index === -1) {
    return returnResponse(res, ErrorCode.NOT_FOUND, {}, '条目不存在');
  }
  items.splice(index, 1);
  writeReminderQuotesFile(rebuildReminderQuotesFile(items, file));
  return returnResponse(res, ErrorCode.SUCCESS, {} as Record<string, unknown>, '删除成功');
});

export default router;
