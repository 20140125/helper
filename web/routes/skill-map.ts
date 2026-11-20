import { Router } from 'express';
import {
  returnResponse,
  ErrorCode,
  listSkills,
  runSkill,
  findExistingCardImage,
  getAmapJsConfig,
  Permission,
} from './utils';

const router = Router();

/**
 * 获取技能清单 + 分组元信息
 * @route GET /api/skill-map
 * @returns 全部技能列表及分组颜色元信息
 * @description 前端一次性拉取，按 category 分组渲染
 */
router.get('/', (_req, res) => {
  const { skills, categories } = listSkills();
  return returnResponse(res, ErrorCode.SUCCESS, { skills, categories }, 'success');
});

/**
 * 获取高德地图 JS API 前端配置
 * @route GET /api/skill-map/amap-config
 * @returns configured / jsKey / securityCode / city / recentPlaces
 * @description 供「地图选点」组件初始化高德 JS SDK；仅登录用户可读，不暴露服务端 REST Key。
 *   configured=false 表示未配置 JS Key，前端降级为普通输入框
 */
router.get('/amap-config', (_req, res) => {
  // 展开成对象字面量：AmapJsConfig 是 interface，直接传不满足 Record<string, unknown> 的索引签名
  return returnResponse(res, ErrorCode.SUCCESS, { ...getAmapJsConfig() }, 'success');
});

/**
 * 查询指定技能已有的卡片图片
 * @route GET /api/skill-map/:key/image
 * @param key - 技能唯一键
 * @returns imageUrl：若 web/public/skill-images/ 下已有对应图片则返回其 URL，否则为空串
 * @description
 *   - 仅读权限即可调用（不需要 SKILL_MAP_EDIT）
 *   - 前端用于"查看图片"按钮：存在则直接预览，不存在则由前端降级调用 POST /:key 执行脚本
 */
router.get('/:key/image', (req, res) => {
  const { key } = req.params;
  if (!key) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少 key 参数');
  }
  const imageUrl = findExistingCardImage(key);
  return returnResponse(res, ErrorCode.SUCCESS, { key, imageUrl }, 'success');
});

/**
 * 执行指定技能脚本
 * @route POST /api/skill-map/:key
 * @param key - 技能唯一键（必须在 SKILL_META_MAP 中注册）
 * @body  args - 可选字符串数组；按 SkillItem.params 顺序传入，缺位/空串视为使用默认值
 * @returns stdout / stderr / imageUrl / time
 * @description 需要 SKILL_MAP_EDIT 权限才能执行；只允许执行白名单中的脚本，防命令注入；
 *   args 在 utils 层做白名单 / 长度限制 / select 枚举校验，路由层只做基础类型校验
 */
router.post('/:key', async (req, res) => {
  const { key } = req.params;
  if (!key) {
    return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少 key 参数');
  }

  // 细粒度权限：执行脚本需 EDIT 权限；读权限在 withPermission 里统一校验
  const permissions = req.userPermissions ?? [];
  if (!permissions.includes(Permission.SKILL_MAP_EDIT)) {
    return returnResponse(
      res,
      ErrorCode.FORBIDDEN,
      { requiredPermission: Permission.SKILL_MAP_EDIT },
      '权限不足，无法执行此操作',
    );
  }

  // 解析 body.args：必须是字符串数组（每项 string），最多 8 个；非法时一律视为未传
  const rawArgs: unknown = req.body?.args;
  let overrideArgs: string[] | undefined;
  if (Array.isArray(rawArgs) && rawArgs.length <= 8 && rawArgs.every((x) => typeof x === 'string')) {
    overrideArgs = rawArgs as string[];
  }

  try {
    const { stdout, stderr, imageUrl } = await runSkill(key, overrideArgs);
    return returnResponse(
      res,
      ErrorCode.SUCCESS,
      {
        key,
        stdout,
        stderr,
        imageUrl,
        time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' }),
      },
      'success',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 脚本未注册 → 404；其他 → 500
    const code = message.startsWith('技能不存在') ? ErrorCode.NOT_FOUND : ErrorCode.INTERNAL_SERVER_ERROR;
    return returnResponse(res, code, {}, message);
  }
});

export default router;
