import { Router } from 'express';
import {
  readMsgTemplates as readTemplates,
  readRawTemplates,
  writeRawTemplates,
  writeMsgTemplates as writeTemplates,
  renderTemplate,
  loadDailyPlaceholders,
  returnResponse,
  ErrorCode,
} from './utils';

const router = Router();

/**
 * GET /
 * @description 获取所有模板配置
 * @returns {{ ok: boolean; data: object }} 完整模板配置对象
 */
router.get('/', async (_req, res) => {
  try {
    const templates = await readTemplates();
    return returnResponse(res, ErrorCode.SUCCESS, templates, 'success');
  } catch (error) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '读取模板失败');
  }
});

/**
 * GET /raw
 * @description 读取 message_templates.json 文件的完整原始字符串，供前端 JSON 编辑器展示
 * @returns {{ ok: boolean; data: string }} 原始 JSON 字符串
 */
router.get('/raw', async (_req, res) => {
  try {
    const data = await readRawTemplates();
    return returnResponse(res, ErrorCode.SUCCESS, { content: data }, 'success');
  } catch (error) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '读取失败');
  }
});

/**
 * PUT /raw
 * @description 将前端编辑器中的完整 JSON 字符串写回 message_templates.json 文件
 * @body {{ content: string }} 完整的 JSON 字符串内容
 * @returns {{ ok: boolean; message: string }} 保存结果
 */
router.put('/raw', async (req, res) => {
  const { content } = req.body as { content?: string };

  if (!content || typeof content !== 'string') {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '内容不能为空');
  }

  try {
    await writeRawTemplates(content);
    return returnResponse(res, ErrorCode.SUCCESS, {}, '保存成功');
  } catch (error) {
    // JSON 格式错误属于参数问题（400）；缓存库写入失败属于服务端异常（500）
    if (error instanceof SyntaxError) {
      return returnResponse(res, ErrorCode.BAD_REQUEST, {}, `JSON 格式错误：${error.message}`);
    }
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '保存失败');
  }
});

/**
 * GET /meta/placeholders
 * @description 获取所有支持的模板占位符及其描述
 * @returns {{ ok: boolean; data: Record<string, string> }} 占位符键值映射
 */
router.get('/meta/placeholders', async (_req, res) => {
  try {
    const templates = await readTemplates();
    return returnResponse(res, ErrorCode.SUCCESS, { placeholders: templates.placeholders ?? {} }, 'success');
  } catch (error) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '读取失败');
  }
});

/**
 * POST /preview
 * @description 使用测试数据渲染模板，返回预览效果和未替换的占位符
 * @body {{ type: string; style: string; template?: string }}
 *   - type/style: 消息类型和风格（必需）
 *   - template: 自定义模板内容（可选，不传则从存储中读取对应模板）
 * @returns {{ ok: boolean; data: { preview: string; unresolved: string[] | null } }}
 * @description 只渲染 `templates` 里真实存在的正文（技能类没有独立正文，取不到即 404；
 *   它们的推送排版由脚本侧 LLM 负责，不在本页维护）。
 */
router.post('/preview', async (req, res) => {
  const { type, style, template: customTemplate } = req.body as {
    type?: string;
    style?: string;
    template?: string;
  };

  if (!type || !style) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '参数不完整：需要 type 和 style');
  }

  try {
    let template: string;

    if (customTemplate && typeof customTemplate === 'string') {
      // 使用传入的自定义模板内容（编辑器实时预览场景）
      template = customTemplate;
    } else {
      // 从存储中读取模板正文：取不到就是没有，不做任何类型兜底回退
      const templates = await readTemplates();
      const templateMap = templates.templates as Record<string, Record<string, string>>;
      const stored = templateMap[type]?.[style];

      if (!stored) {
        return returnResponse(res, ErrorCode.NOT_FOUND, {}, `模板不存在: ${type}.${style}`);
      }
      template = stored;
    }

    // 自动从每日缓存读取真实数据填充占位符
    const autoPlaceholders = await loadDailyPlaceholders(type);
    const { rendered, unresolved } = renderTemplate(template, autoPlaceholders);

    return returnResponse(res, ErrorCode.SUCCESS, {
      preview: rendered,
      unresolved: unresolved.length > 0 ? unresolved : null,
    }, 'success');
  } catch (error) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '预览失败');
  }
});

/**
 * GET /:type/:style
 * @description 获取指定消息类型和风格的模板内容
 * @returns {{ ok: boolean; data: { type: string; style: string; template: string } }}
 */
router.get('/:type/:style', async (req, res) => {
  const { type, style } = req.params;

  try {
    const templates = await readTemplates();
    const templateMap = templates.templates as Record<string, Record<string, string>>;

    if (!templateMap[type]) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, `消息类型不存在: ${type}`);
    }
    if (!templateMap[type][style]) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, `消息风格不存在: ${style}`);
    }

    return returnResponse(res, ErrorCode.SUCCESS, { type, style, template: templateMap[type][style] }, 'success');
  } catch (error) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '读取失败');
  }
});

/**
 * GET /:type
 * @description 获取指定消息类型下所有风格的模板内容
 * @returns {{ ok: boolean; data: Record<string, string> }}
 */
router.get('/:type', async (req, res) => {
  const { type } = req.params;

  try {
    const templates = await readTemplates();
    const templateMap = templates.templates as Record<string, Record<string, string>>;

    if (!templateMap[type]) {
      return returnResponse(res, ErrorCode.NOT_FOUND, {}, `消息类型不存在: ${type}`);
    }

    return returnResponse(res, ErrorCode.SUCCESS, templateMap[type], 'success');
  } catch (error) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '读取失败');
  }
});

/**
 * PUT /:type/:style
 * @description 更新指定消息类型和风格的模板内容
 * @body {{ template: string }}
 * @returns {{ ok: boolean; data: { type: string; style: string; template: string } }}
 */
router.put('/:type/:style', async (req, res) => {
  const { type, style } = req.params;
  const { template } = req.body as { template?: string };

  if (!template || typeof template !== 'string') {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '模板内容不能为空');
  }

  try {
    const templates = await readTemplates();
    const templateMap = templates.templates as Record<string, Record<string, string>>;

    // 按传入 type 原样保存：只维护有独立正文的模板，不做类型回退
    templateMap[type] = templateMap[type] ?? {};
    templateMap[type][style] = template;
    await writeTemplates(templates);

    return returnResponse(res, ErrorCode.SUCCESS, { type, style, template }, '模板更新成功');
  } catch (error) {
    return returnResponse(res, ErrorCode.INTERNAL_SERVER_ERROR, {}, error instanceof Error ? error.message : '更新失败');
  }
});

export default router;
