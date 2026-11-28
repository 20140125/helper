import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  returnResponse,
  ErrorCode,
  GREETINGS_GROUPS,
  readGreetingsFile,
  writeGreetingsFile,
  flattenGreetings,
  rebuildGreetingsFile,
} from './utils';
import type {
  GreetingItem,
  GreetingsGroup,
  CreateGreetingBody,
  UpdateGreetingBody,
} from '@/types/greetings';

const router = Router();

const isValidGroup = (group: string): group is GreetingsGroup =>
  (GREETINGS_GROUPS as string[]).includes(group);

/** 为新条目生成唯一 ID */
const genId = (group: GreetingsGroup, name: string): string => {
  if (group === 'birthday') {
    return `birthday::${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return `${group}::${name}`;
};

/**
 * 获取所有祝福语条目（扁平化）
 * @route GET /
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = flattenGreetings(await readGreetingsFile());
    return returnResponse(res, ErrorCode.SUCCESS, { items } as Record<string, unknown>, '');
  } catch (error) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '读取祝福语失败');
  }
});

/**
 * 新建祝福语条目
 * @route POST /
 * @body {CreateGreetingBody}
 */
router.post('/', async (req: Request, res: Response) => {
  const { group, name = '', content } = req.body as CreateGreetingBody;
  if (!group || !isValidGroup(group)) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '分组非法');
  }
  if (!content?.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '内容不能为空');
  }
  if (group !== 'birthday' && !name.trim()) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '名称不能为空');
  }
  try {
    const file = await readGreetingsFile();
    // 命名型分组：重名则拒绝
    if (group !== 'birthday' && file[group][name]) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '同名条目已存在');
    }
    if (group === 'birthday') {
      file.birthday.templates.push(content);
    } else {
      file[group][name] = content;
    }
    await writeGreetingsFile(file);
    const newItem: GreetingItem = {
      id: genId(group, name),
      group,
      name: group === 'birthday' ? '' : name,
      content,
    };
    return returnResponse(res, ErrorCode.SUCCESS, { item: newItem } as Record<string, unknown>, '创建成功');
  } catch (error) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '创建祝福语失败');
  }
});

/**
 * 更新祝福语条目
 * @route PUT /:id
 * @body {UpdateGreetingBody}
 */
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { group, name, content } = req.body as UpdateGreetingBody;
  try {
    const file = await readGreetingsFile();
    const items = flattenGreetings(file);
    const target = items.find((i) => i.id === id);
    if (!target) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, '条目不存在');
    }
    const nextGroup = group ?? target.group;
    const nextName = name ?? target.name;
    const nextContent = content ?? target.content;
    if (!isValidGroup(nextGroup)) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '分组非法');
    }
    if (nextGroup !== 'birthday' && !nextName.trim()) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '名称不能为空');
    }
    // 用"先剔除旧条目 → 写入新条目"的方式处理（顺便支持改名 / 改组）
    const remaining = items.filter((i) => i.id !== id);
    remaining.push({ ...target, group: nextGroup, name: nextGroup === 'birthday' ? '' : nextName, content: nextContent });
    const rebuilt = rebuildGreetingsFile(remaining);
    await writeGreetingsFile(rebuilt);
    return returnResponse(res, ErrorCode.SUCCESS, { item: { ...target, group: nextGroup, name: nextName, content: nextContent } } as Record<string, unknown>, '更新成功');
  } catch (error) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '更新祝福语失败');
  }
});

/**
 * 删除祝福语条目
 * @route DELETE /:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const file = await readGreetingsFile();
    const items = flattenGreetings(file);
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, '条目不存在');
    }
    items.splice(index, 1);
    await writeGreetingsFile(rebuildGreetingsFile(items));
    return returnResponse(res, ErrorCode.SUCCESS, {} as Record<string, unknown>, '删除成功');
  } catch (error) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '删除祝福语失败');
  }
});

export default router;
