import fs from 'fs';
import path from 'path';
import {
  SKILL_META_MAP,
  SKILL_CATEGORIES,
  TOOLS_IMAGES_DIR,
  TOOLS_IMAGES_URL_PREFIX,
  SKILL_METAS,
} from '@/types/skill-map';
import type { SkillItem, SkillCategoryMeta, SkillParamMeta } from '@/types/skill-map';
import { runScript } from '@/utils/script';
import { readEnvFile } from '@/utils/env';
import { PROJECT_DIR } from '@/utils/paths';
import type { AmapJsConfig, AmapRecentPlace } from '@/types/skill-map';

/** scripts/tools 所在的相对目录（供 runScript 拼接相对路径使用） */
const TOOLS_DIR_REL = path.posix.join('scripts', 'tools');


/**
 * 把 SkillParamMeta.defaultValue 求值为字符串
 * @param dv - 默认值定义；undefined 时返回空串
 * @returns 始终返回字符串
 * @description 求值时机：
 *   1) 后端 listSkills 序列化时（每次 GET /api/skill-map 求一次 → 前端表单初始化拿到当下日期）
 *   2) 后端 resolveSkillArgs 兜底时（用户未填写 → 当下日期透传给脚本）
 *   函数返回 Date 时，使用本地年月日格式化为 YYYY-MM-DD，避免 toISOString 的 UTC 时区偏移
 */
export const resolveDefaultValue = (
  dv: SkillParamMeta['defaultValue'],
): string => {
  if (dv === undefined) return '';
  if (typeof dv === 'string') return dv;
  if (typeof dv !== 'function') return '';
  let raw: string | Date;
  try {
    raw = dv();
  } catch {
    return '';
  }
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return '';
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return typeof raw === 'string' ? raw : '';
};

/**
 * 把 SKILL_METAS 序列化为可经 JSON 传输的版本（params.defaultValue 全部求值为 string）
 * @returns 浅克隆后的 SkillItem 数组；params 内的 defaultValue 全为字符串
 * @description 用于 GET /api/skill-map 响应；避免函数式 defaultValue 在 JSON.stringify 时被丢弃
 */
export const getSerializedSkills = (): SkillItem[] => {
  return SKILL_METAS.map((s) => {
    if (!s.params || s.params.length === 0) return s;
    return {
      ...s,
      params: s.params.map((p) => ({
        ...p,
        defaultValue: resolveDefaultValue(p.defaultValue),
      })),
    };
  });
};


/**
 * 获取全量技能清单及分组信息
 * @returns 技能列表 + 分组元信息
 * @description 通过 getSerializedSkills 把每个 param 的 defaultValue 求值为字符串：
 *   - 函数式默认值（如 `() => new Date()`）会被求成当下日期 YYYY-MM-DD，避免 JSON.stringify 丢失函数；
 *   - 每次调用都会重新求值，因此前端每次拉清单都会拿到"今天"，无需缓存失效控制。
 */
export const listSkills = (): { skills: SkillItem[]; categories: SkillCategoryMeta[] } => {
  return {
    skills: getSerializedSkills(),
    categories: SKILL_CATEGORIES,
  };
};

/**
 * 查找指定技能已存在的卡片图片
 * @param key - 技能唯一键
 * @returns 若 web/public/skill-images/ 下存在对应卡片图片，返回其 Web URL（带时间戳避免缓存）；否则返回空串
 * @description
 *   - 命名约定：卡片图片一般为 <key>_card.png；但个别 key 本身就带 _card（如 oil_price_card）直接产出 <key>.png。
 *     因此同时匹配 <key>.png 与 <key>_card.png 两种，择其一返回。
 *   - 用于"查看图片"入口：若 Already has cached card, 避免二次执行脚本直接返回图片。
 *   - 只认已注册技能（meta 必须在 SKILL_META_MAP 中），防止通过任意 key 枚举目录下文件。
 */
export const findExistingCardImage = (key: string): string => {
  const meta = SKILL_META_MAP.get(key);
  if (!meta || !meta.hasCard) return '';

  const candidates = [`${key}_card.png`, `${key}.png`];
  for (const fileName of candidates) {
    const abs = path.join(TOOLS_IMAGES_DIR, fileName);
    if (fs.existsSync(abs)) {
      return `${TOOLS_IMAGES_URL_PREFIX}/${fileName}?t=${Date.now()}`;
    }
  }
  return '';
};

/**
 * 单个脚本入参的最大长度（按字符），防止前端传入过长字符串引发 shell 异常
 * @description shell 命令行普遍上限 ARG_MAX 远大于此值，但业务参数无需超过 64 字符；超出视为非法
 */
const SKILL_ARG_MAX_LEN = 64;

/**
 * 校验并解析前端传入的 args，按 meta.params 顺序生成最终命令行参数数组
 * @param meta - 已注册的技能元信息
 * @param overrideArgs - 前端透传的字符串数组（按 params 顺序对应；缺位 / 空串视为使用默认值）
 * @returns 最终用于 runScript 的 args 数组
 * @description
 *   - 若 meta 未声明 params，直接返回 meta.args（保留旧行为，不允许任意覆盖）
 *   - 若声明了 params，按 params 顺序按位取值：overrideArgs[i] -> meta.params[i].defaultValue -> meta.args[i] -> ''
 *   - select 类型必须命中 options 中的 value 才允许；否则视为非法回退到默认值
 *   - 入参做长度限制；只允许字符串类型；禁止包含空字节
 */
const resolveSkillArgs = (meta: SkillItem, overrideArgs: string[] | undefined): string[] => {
  if (!meta.params || meta.params.length === 0) {
    return meta.args;
  }
  const safeOverride = Array.isArray(overrideArgs) ? overrideArgs : [];
  return meta.params.map((p, i) => {
    const raw = safeOverride[i];
    let value = typeof raw === 'string' ? raw : '';
    // 长度 / 非法字符防御（支持按参数声明放宽上限，如 diagram_card 需要整段 JSON）
    const maxLen = p.maxLength ?? SKILL_ARG_MAX_LEN;
    if (value.length > maxLen || value.includes('\0')) {
      value = '';
    }
    // select 选项白名单校验
    if (p.type === 'select' && value !== '' && Array.isArray(p.options)) {
      const allowed = p.options.some((opt) => opt.value === value);
      if (!allowed) value = '';
    }
    if (value === '') {
      // defaultValue 可能是函数（如日期）→ 走 resolveDefaultValue 统一求值为字符串
      value = resolveDefaultValue(p.defaultValue) || meta.args[i] || '';
    }
    return value;
  });
};

/**
 * 执行指定技能对应的脚本
 * @param key - 技能唯一键（必须在 SKILL_META_MAP 中注册）
 * @param overrideArgs - 前端可选透传的入参数组（按 meta.params 顺序，对应位为空串/缺失则使用默认值）
 * @returns 脚本 stdout/stderr，以及产出卡片图片的 Web 访问 URL（若有）
 * @description
 *   - 路径白名单：只允许执行 SKILL_METAS 中已注册的脚本，防止任意命令注入。
 *   - 参数白名单：仅当 meta.params 声明了入参时才接受 overrideArgs；否则忽略并使用 meta.args。
 *     入参 select 类型必须命中 options.value；input 类型受长度上限保护。
 *   - 图片定位：对 hasCard=true 的脚本，脚本 stdout 末行输出 PNG 绝对路径（见 references/card-spec.md）。
 *     若该路径落在 web/public/skill-images/ 下且文件确实存在，转换为 Web URL 返回给前端。
 *   - 图片推送：对 hasCard=true 的脚本注入 PUSH_CARD_IMAGE=1，由 card_utils.sh 的 render_card
 *     钩子在渲染成功后自动把 PNG 推送到企业微信（crontab/命令行执行不受影响，避免定时刷屏）。
 *   - 超时：继承 runScript 默认 30s；爬虫类脚本超时会抛错，由路由层兜底。
 */
/**
 * 技能输出模式
 * - card：默认，渲染 PNG 卡片（stdout 末行为图片路径）
 * - data：输出脚本抓取到的原始数据（原文，可读文本）
 * - json：同上，合法 JSON 会被美化后输出
 */
export type SkillOutputMode = 'card' | 'data' | 'json';

export const runSkill = async (
  key: string,
  overrideArgs?: string[],
  mode: SkillOutputMode = 'card',
): Promise<{ stdout: string; stderr: string; imageUrl: string }> => {
  const meta = SKILL_META_MAP.get(key);
  if (!meta) {
    throw new Error(`技能不存在：${key}`);
  }

  // runScript 的 scriptName 是相对 PROJECT_DIR 的路径（POSIX 风格）
  const scriptRelPath = path.posix.join(TOOLS_DIR_REL, meta.script);
  // 仅卡片模式才自动推送：data / json 模式不出图，推了就是噪音
  const extraEnv: Record<string, string> = meta.hasCard && mode === 'card' ? { PUSH_CARD_IMAGE: '1' } : {};
  const finalArgs = resolveSkillArgs(meta, overrideArgs);
  // 模式作为首个位置参数传给脚本：card_utils.sh 会解析并 shift，剩余参数顺序不变
  const result = await runScript(
    scriptRelPath,
    mode === 'card' ? finalArgs : [mode, ...finalArgs],
    extraEnv,
  );

  const imageUrl = meta.hasCard && mode === 'card' ? resolveCardImageUrl(result.stdout) : '';

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    imageUrl,
  };
};

/**
 * 从脚本 stdout 末行解析 PNG 绝对路径，并转换为 Web URL
 * @param stdout - runScript 返回的 stdout（已去 ANSI）
 * @returns 图片的 Web 访问 URL（带时间戳避免缓存），无法定位时返回空串
 * @description
 *   - 契约：卡片脚本成功时 stdout 末行是 PNG 绝对路径（见 .codebuddy/skills/info-cards/references/card-spec.md）
 *   - 合法目录白名单：仅 TOOLS_IMAGES_DIR（web/public/skill-images/）
 *   - 若末行不是绝对路径、不在白名单目录、或文件不存在，均返回空串（降级为纯文本展示）
 */
const resolveCardImageUrl = (stdout: string): string => {
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';

  const lastLine = lines[lines.length - 1];
  if (!lastLine || !path.isAbsolute(lastLine) || !lastLine.toLowerCase().endsWith('.png')) {
    return '';
  }

  // 合法目录白名单：仅允许 TOOLS_IMAGES_DIR（防止通过 stdout 注入任意路径泄漏文件）
  const normalized = path.normalize(lastLine);
  if (!normalized.startsWith(TOOLS_IMAGES_DIR + path.sep)) {
    return '';
  }

  if (!fs.existsSync(normalized)) {
    return '';
  }

  const fileName = path.basename(normalized);
  // 加时间戳查询串避免浏览器缓存旧卡片
  return `${TOOLS_IMAGES_URL_PREFIX}/${fileName}?t=${Date.now()}`;
};

/** 地理编码缓存文件路径（脚本侧写入，前端「常用地点」候选的唯一数据源） */
const GEOCODE_CACHE_FILE = path.join(PROJECT_DIR, '.cache', 'amap_geocode.json');

/** 高德 JS 配置缓存与有效期（配置不常变，5 分钟内复用，避免频繁读 .env） */
let cachedJsConfig: { at: number; config: AmapJsConfig } | null = null;
const JS_CONFIG_TTL_MS = 5 * 60 * 1000;

/** 「常用地点」最多返回条数（避免缓存膨胀后下拉过长） */
const MAX_RECENT_PLACES = 20;

/**
 * 读取地理编码缓存作为「常用地点」候选
 * @returns {AmapRecentPlace[]} 地点名 + 坐标列表；文件缺失或格式异常时返回空数组
 * @description 缓存由 commute_card.sh 在成功解析地址后写入，形如 { "深圳北站": "114.02,22.60" }
 */
export const listRecentPlaces = (): AmapRecentPlace[] => {
  try {
    if (!fs.existsSync(GEOCODE_CACHE_FILE)) return [];
    const parsed: unknown = JSON.parse(fs.readFileSync(GEOCODE_CACHE_FILE, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string' && /^\d+(\.\d+)?,\d+(\.\d+)?$/.test(v))
      .slice(-MAX_RECENT_PLACES)
      .map(([name, location]) => ({ name, location: location as string }));
  } catch {
    return [];
  }
};

/**
 * 读取高德地图 JS API 的前端配置
 * @returns {AmapJsConfig} JS Key / 安全密钥 / 默认城市 / 常用地点
 * @description
 *   - 进程环境变量优先，为空时回退 readEnvFile() 读 web/.env，避免刚写入配置还没重启就不可用
 *   - configured=false 时前端地图选点不可用，降级为普通文本输入
 */
export const getAmapJsConfig = (): AmapJsConfig => {
  const now = Date.now();
  if (cachedJsConfig && now - cachedJsConfig.at < JS_CONFIG_TTL_MS) return cachedJsConfig.config;

  const env = readEnvFile();
  const pick = (key: string): string => {
    const fromProcess = (process.env[key] ?? '').trim();
    const raw = fromProcess || (env[key] ?? '');
    return raw.trim().replace(/^["']|["']$/g, '');
  };

  const jsKey = pick('AMAP_JS_KEY');
  const config: AmapJsConfig = {
    configured: jsKey.length > 0,
    jsKey,
    securityCode: pick('AMAP_JS_SECRET'),
    city: pick('WEATHER_CITY_NAME') || '深圳',
    recentPlaces: listRecentPlaces(),
  };
  cachedJsConfig = { at: now, config };
  return config;
};
