import { listSkills, runSkill } from '@/routes/utils';
import type { SkillParamMeta } from '@/types/skill-map';
import type { SkillOutputMode } from '@/utils/skill-map';
import type { ToolImpl, ToolContext, ToolResult } from '@/types/ai-chat';
import { resolveDefaultValue } from '@/utils/skill-map';


/** stdout/stderr 截断长度（字符），与 triggerScriptTool 对齐，防止上下文爆炸 */
const SKILL_OUTPUT_TAIL_LEN = 2000;

/** data / json 模式的内容上限（字符）：榜单第一名在开头，故头部优先截断 */
const SKILL_DATA_HEAD_LEN = 6000;

/**
 * 技能 key 别名表（仿照 scripts/reminder/keyword_map.sh 的 KEYWORD_MAP 设计）
 * @description LLM 在把用户口语翻译成 skill_key 时容易"过度直译"（例如 腾讯热搜 → tencent_hot_search），
 *              与 SKILL_METAS 中真实注册的 key（tencent_hot）对不上。这里维护一张别名映射，
 *              在 findSkillMeta 中作为第二层匹配，避免因此回改脚本名/数据库 key。
 *              ⚠️ 表里 key 必须是"归一化形式"：小写、去空格/连字符/下划线（见 normalizeSkillAlias）。
 *              新增技能或发现新的"直译变体"时，只需在此追加一行。
 */
const SKILL_KEY_ALIASES: Record<string, string> = {
  // ── 天气 ──
  weather: 'weather_card_gen',
  weatherforecast: 'weather_card_gen',
  weathercard: 'weather_card_gen',
  weatheralert: 'weather_alert_card',
  weatheralertcard: 'weather_alert_card',
  airquality: 'air_quality',
  aqi: 'air_quality',
  // ── 日历 / 老黄历（"日历""日历提醒""今日日历"等通通归一到 almanac_card）──
  almanac: 'almanac_card',
  chinesealmanac: 'almanac_card',
  huangli: 'almanac_card',
  laohuangli: 'almanac_card',
  calendar: 'almanac_card',
  calendarcard: 'almanac_card',
  calendarreminder: 'almanac_card',
  todaycalendar: 'almanac_card',
  dailycalendar: 'almanac_card',
  lunarcalendar: 'almanac_card',
  // ── 财经 ──
  astock: 'stock_market',
  ashare: 'stock_market',
  cnstock: 'stock_market',
  hkstock: 'hk_stock',
  hkshare: 'hk_stock',
  usstock: 'us_stock',
  usshare: 'us_stock',
  exchange: 'exchange_rate',
  forex: 'exchange_rate',
  fx: 'exchange_rate',
  crypto: 'crypto_price',
  bitcoin: 'crypto_price',
  btc: 'crypto_price',
  gold: 'gold_silver',
  silver: 'gold_silver',
  goldprice: 'gold_silver',
  oil: 'oil_price_card',
  oilprice: 'oil_price_card',
  // ── 新闻 ──
  ainews: 'ai_news_card',
  entnews: 'ent_news',
  entertainmentnews: 'ent_news',
  internationalnews: 'intl_news',
  worldnews: 'intl_news',
  weibohotsearch: 'weibo_hot',
  weibotrending: 'weibo_hot',
  // ── 影视（每个平台都是独立技能，禁止给 tencent_hot 硬塞 keyword=爱奇艺 这种伪参数）──
  bilibilihotsearch: 'bilibili_hot',
  bilibilitrending: 'bilibili_hot',
  bilibili: 'bilibili_hot',
  bhot: 'bilibili_hot',
  tencenthotsearch: 'tencent_hot',
  tencentvideohot: 'tencent_hot',
  tencentvideo: 'tencent_hot',
  tencent: 'tencent_hot',
  // 腾讯视频的分榜单（电视剧/电影/综艺…）不是独立技能：key 仍是 tencent_hot，
  // 榜单名要走 params.channel，「tencent_tv_hot」这类直译同样归一，避免查不到就放弃
  tencenttv: 'tencent_hot',
  tencenttvhot: 'tencent_hot',
  tencenttvhotsearch: 'tencent_hot',
  tencentdrama: 'tencent_hot',
  tencenttvseries: 'tencent_hot',
  iqiyihotsearch: 'iqiyi_hot',
  iqiyitrending: 'iqiyi_hot',
  iqiyihot: 'iqiyi_hot',
  iqiyi: 'iqiyi_hot',
  aiqiyi: 'iqiyi_hot',
  douyinhotsearch: 'douyin_hot',
  douyintrending: 'douyin_hot',
  douyin: 'douyin_hot',
  tiktokhot: 'douyin_hot',
  tiktok: 'douyin_hot',
  // ── 科技 ──
  github: 'github_trending',
  githubhot: 'github_trending',
  githubpopular: 'github_trending',
  steam: 'steam_hot',
  steamtrending: 'steam_hot',
  steamhotgames: 'steam_hot',
  // ── 生活 ──
  historytoday: 'history_today',
  onthisday: 'history_today',
  earthquake: 'earthquake',
  quake: 'earthquake',
  wallpaper: 'daily_wallpaper',
  bingwallpaper: 'daily_wallpaper',
  qrcode: 'qrcode',
  qr: 'qrcode',
  publicholiday: 'holiday_nager',
  word: 'daily_word',
  dailyquote: 'daily_word',
  quote: 'daily_word',
  zodiac: 'horoscope_card',
  horoscope: 'horoscope_card',
  fortune: 'horoscope_card',
  commutecard: 'commute',
  tongqin: 'commute',
  routecard: 'commute',
  // ── 图表（架构图 / 序列图 / 流程图，LLM 常直译成 architecture / sequence / flow）──
  architecture: 'diagram_card',
  architecturediagram: 'diagram_card',
  systemarchitecture: 'diagram_card',
  arch: 'diagram_card',
  sequence: 'diagram_card',
  sequencediagram: 'diagram_card',
  seq: 'diagram_card',
  diagram: 'diagram_card',
  flow: 'diagram_card',
  flowchart: 'diagram_card',
};

/**
 * 归一化技能别名：转小写 + 去除空格、连字符、下划线、点
 * @param {string} raw - 原始 LLM 传入的 skill_key
 * @returns {string} 归一化结果，用于匹配 SKILL_KEY_ALIASES
 * @description 与 keyword_map.sh 的归一化思路一致（lower-case + 去 / - 空格），但 JS 这边再多去一层下划线，
 *              这样 "tencent_hot_search" / "TencentHotSearch" / "tencent-hot-search" 都能命中同一别名键
 */
const normalizeSkillAlias = (raw: string): string => {
  return raw.toLowerCase().replace(/[\s\-_.]/g, '');
};

/**
 * 把 LLM 传入的 params 对象按 meta.params 的 name 顺序映射成位置参数数组
 * @param {SkillParamMeta[] | undefined} paramMetas - 技能定义的入参元信息
 * @param {Record<string, unknown> | undefined} userParams - LLM 传入的 params 对象
 * @returns {string[] | undefined} 位置参数数组；技能未声明 params 时返回 undefined（即用 SKILL_METAS 默认 args）
 * @description defaultValue 可能是函数（如 `() => new Date()` 拿当下日期），统一通过 resolveDefaultValue 求值为字符串
 */
const mapSkillParams = (
  paramMetas: SkillParamMeta[] | undefined,
  userParams: Record<string, unknown> | undefined,
): string[] | undefined => {
  if (!paramMetas || paramMetas.length === 0) return undefined;
  return paramMetas.map((meta) => {
    const v = userParams?.[meta.name];
    if (v === undefined || v === null || v === '') {
      return resolveDefaultValue(meta.defaultValue);
    }
    return String(v);
  });
};

/**
 * 构建 list 模式的返回（不传 skill_key 时回吐可用技能清单）
 * @returns {ToolResult} 可用技能清单（仅暴露 LLM 决策需要的字段）
 */
const buildSkillListResult = (): ToolResult => {
  const skills = listSkills().skills.map((s) => ({
    key: s.key,
    category: s.category,
    has_card: s.hasCard,
    params: (s.params ?? []).map((p) => ({
      name: p.name,
      required: Boolean(p.required),
      // listSkills 内部已序列化，p.defaultValue 已是 string；为防御未来直接读 SKILL_METAS 仍走一次 resolve
      default: resolveDefaultValue(p.defaultValue),
    })),
  }));
  return {
    ok: true,
    data: { skills, total: skills.length },
    summary: `可用技能 ${skills.length} 个，请用 skill_key 指定`,
  };
};

/**
 * 校验 skill_key 并返回对应技能元信息
 * @param {string} skillKey - LLM 传入的技能英文键（容许使用别名/直译变体）
 * @returns 命中时返回真实 key + 元信息；未命中返回 undefined
 * @description 三层匹配（参考 keyword_map.sh 思路）：
 *              1) 精确命中 SKILL_METAS.key
 *              2) 归一化后命中 SKILL_KEY_ALIASES（处理 LLM 直译过度的情况）
 *              3) 归一化后命中真实 key 的归一化形式（处理大小写/空格/连字符差异）
 */
const findSkillMeta = (
  skillKey: string,
): {
  resolvedKey: string;
  meta: { key: string; params?: SkillParamMeta[] };
} | undefined => {
  const allSkills = listSkills().skills;
  // 1) 精确命中
  const exact = allSkills.find((s) => s.key === skillKey);
  if (exact) {
    return { resolvedKey: exact.key, meta: exact };
  }
  // 2) 别名表命中（归一化后查表 → 取真实 key → 再回查 SkillItem）
  const normalized = normalizeSkillAlias(skillKey);
  const aliasTarget = SKILL_KEY_ALIASES[normalized];
  if (aliasTarget) {
    const viaAlias = allSkills.find((s) => s.key === aliasTarget);
    if (viaAlias) {
      return { resolvedKey: viaAlias.key, meta: viaAlias };
    }
  }
  // 3) 模糊兜底：归一化 LLM 输入后与归一化 key 比对（处理 "Weather_Card_Gen" 类大小写/分隔符差异）
  const fuzzy = allSkills.find((s) => normalizeSkillAlias(s.key) === normalized);
  if (fuzzy) {
    return { resolvedKey: fuzzy.key, meta: fuzzy };
  }
  return undefined;
};

/**
 * 从 invoke args 中安全地提取用户传入的 params 对象
 * @param {unknown} raw - 原始 args.params
 * @returns {Record<string, unknown> | undefined} 标准化后的对象，未传或非对象时返回 undefined
 */
const extractUserParams = (raw: unknown): Record<string, unknown> | undefined => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return undefined;
};

/**
 * 用一句话描述原始数据的结构，帮 LLM 判断该从哪里取值
 * @param {string} raw - 脚本 stdout
 * @returns {string} 结构说明，如 "JSON 对象，字段：ok、data；数组字段：data(50)"
 */
const describePayload = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '空输出';
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return `JSON 数组，${parsed.length} 条`;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const keys = Object.keys(obj);
      const arrKeys = keys
        .filter((k) => Array.isArray(obj[k]))
        .map((k) => `${k}(${(obj[k] as unknown[]).length})`);
      const head = keys.slice(0, 8).join('、');
      const arrDesc = arrKeys.length > 0 ? `；数组字段：${arrKeys.join('、')}` : '';
      return `JSON 对象，字段：${head}${keys.length > 8 ? ' …' : ''}${arrDesc}`;
    }
  } catch {
    // 非 JSON（如腾讯行情的 GBK 文本），按纯文本描述
  }
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  return `文本，${lines.length} 行`;
};

/**
 * 执行技能并把结果格式化为 ToolResult（含输出截断、imageUrl 拼入 summary）
 * @param {string} skillKey - 技能英文键
 * @param {string[] | undefined} overrideArgs - 已映射好的位置参数；undefined 表示用默认 args
 * @param {SkillOutputMode} mode - 输出模式：card 出图；data / json 出原始数据
 * @returns {Promise<ToolResult>} 标准化的工具结果
 */
const runSkillAndFormat = async (
  skillKey: string,
  overrideArgs: string[] | undefined,
  mode: SkillOutputMode = 'card',
): Promise<ToolResult> => {
  try {
    const result = await runSkill(skillKey, overrideArgs, mode);

    // ── 数据模式：stdout 本身就是数据，头部优先截断（榜单第一名在开头，不能取尾部）
    if (mode !== 'card') {
      const stdout = (result.stdout ?? '').trim();
      if (!stdout) {
        return {
          ok: false,
          data: `技能 ${skillKey} 在 ${mode} 模式下没有返回数据（该技能可能未接入原始数据输出，或本次抓取为空）`,
        };
      }
      const truncated = stdout.length > SKILL_DATA_HEAD_LEN;
      const shape = describePayload(stdout);
      return {
        ok: true,
        data: {
          skill_key: skillKey,
          mode,
          shape,
          content: truncated
            ? `${stdout.slice(0, SKILL_DATA_HEAD_LEN)}\n…（已截断，共 ${stdout.length} 字符）`
            : stdout,
          total_chars: stdout.length,
          truncated,
        },
        summary: `技能 ${skillKey} 原始数据已获取：${shape}${truncated ? '（已截断，仅含开头部分）' : ''}。请把它提炼成自然语言结论，不要整段贴 JSON。`,
      };
    }

    const stdoutTail = result.stdout?.slice(-SKILL_OUTPUT_TAIL_LEN) ?? '';
    const stderrTail = result.stderr?.slice(-SKILL_OUTPUT_TAIL_LEN) ?? '';
    const summaryParts = [`技能 ${skillKey} 执行完成`];
    if (result.imageUrl) summaryParts.push(`已生成卡片：${result.imageUrl}`);
    return {
      ok: true,
      data: {
        skill_key: skillKey,
        image_url: result.imageUrl,
        stdout: stdoutTail,
        stderr: stderrTail,
      },
      summary: summaryParts.join('，'),
    };
  } catch (err) {
    return { ok: false, data: `执行异常：${(err as Error).message}` };
  }
};

/**
 * card_skill 工具实现
 * @description 调用「卡片技能」执行 scripts/tools/ 下的指定脚本，并返回脚本输出（部分技能会同时生成 PNG 卡片图）。
 *              不传 skill_key 时返回当前可用技能清单（key/分类/是否生成卡片/可选参数）。
 *
 * 触发示例（仅供维护者参考，不会发送给 LLM）：
 *   - "当前都有哪些卡片技能可以用？"                    → {}（list 模式）
 *   - "帮我生成一张今天的天气卡片"                      → { skill_key: 'weather_card_gen' }
 *   - "查一下上海今天的天气"                            → { skill_key: 'weather_card_gen', params: { city: '上海' } }
 *   - "北京今天有没有暴雨预警"                          → { skill_key: 'weather_alert_card', params: { city: '北京' } }
 *   - "广州空气质量怎么样"                              → { skill_key: 'air_quality', params: { city: '广州' } }
 *   - "查一下欧元的汇率"                                → { skill_key: 'exchange_rate', params: { base: 'EUR' } }
 *   - "看下今天的老黄历"                              → { skill_key: 'almanac_card' }
 *   - "巨蟹座本周运势"                              → { skill_key: 'horoscope_card', params: { zodiac: '巨蟹座', period: 'week' } }
 *   - "A股市场今日行情"                             → { skill_key: 'stock_market' }
 *   - "上证指数现在多少点？（要看数值）"                → { skill_key: 'stock_market', mode: 'data' }
 *   - "微博热搜前五条是什么？"                        → { skill_key: 'weibo_hot', mode: 'data' }
 *   - "github 今日 trending"                          → { skill_key: 'github_trending' }
 */
export const cardSkillTool: ToolImpl = {
  name: 'card_skill',
  description:
    '调用「卡片技能」运行 scripts/tools/ 下的脚本，取外部实时数据或生成 PNG 卡片；不传 skill_key 返回可用清单。'
    + '用户要看具体数值或榜单条目（“上证多少点”“热搜第一条是什么”“黄金涨了多少”）时必须同时传 mode="data"；'
    + '只传 skill_key 会去渲染图片，你只能拿到图片地址，回答不出数值；用户明确要图片时才不传 mode。'
    + '完整技能 key、多榜单参数（params.channel / params.category）、别名与踩坑：'
    + '先调 load_skill(name="card-skill") 取回说明书再调本工具；不确定用哪个 key 时先不传 skill_key 看清单。'
    + '注意：不要复用上一轮的 skill_key；仅传该技能声明过的 params；不要直译口语为 key。',
  parameters: {
    type: 'object',
    properties: {
      skill_key: {
        type: 'string',
        description: '技能英文键（SKILL_METAS.key），不传则返回清单；允许常见别名',
      },
      params: {
        type: 'object',
        description: '可选，按该技能声明的 params 名传入；按顺序映射为脚本位置参数',
        additionalProperties: { type: 'string' },
      },
      mode: {
        type: 'string',
        enum: ['card', 'data', 'json'],
        description:
          '输出模式，默认 card。card=生成 PNG 卡片（只能拿到图片地址，看不到具体数值）；'
          + 'data=输出脚本抓到的原始数据，用于回答"涨了多少""热搜前几条是什么"这类要看具体数值的问题；'
          + 'json=同 data，接口返回本身是 JSON 时会美化。用户只是要图片就不要传本参数。',
      },
    },
  },
  requiredPermissions: ['skill-map:view', 'skill-map:edit'],
  invoke: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const skillKey = typeof args.skill_key === 'string' ? args.skill_key.trim() : '';
    // list 模式（不传 skill_key）无副作用，只读技能清单，skill-map:view 即可
    if (!skillKey) {
      return buildSkillListResult();
    }
    // 执行模式有副作用（跑脚本/生成卡片），必须持有 skill-map:edit
    if (!(ctx.userPermissions ?? []).includes('skill-map:edit')) {
      return { ok: false, data: '当前用户无权限执行技能脚本（需 skill-map:edit）' };
    }
    const found = findSkillMeta(skillKey);
    if (!found) {
      const availableKeys = listSkills().skills.map((s) => s.key).join(', ');
      return {
        ok: false,
        data: `未知 skill_key=${skillKey}。可用：${availableKeys}`,
      };
    }
    // 未声明参数防御：若 LLM 给一个 args=[] 的技能传了非空 params（典型偷懒复用场景：
    // 上一轮用 tencent_hot 后，本轮把"爱奇艺"当 keyword 继续塞给 tencent_hot），
    // 直接拒绝并提示真实可选 key，强迫 LLM 重新选 skill_key 而不是用伪参数把错误工具掰成对的
    const userParams = extractUserParams(args.params);
    const declaredParamNames = (found.meta.params ?? []).map((p) => p.name);
    if (userParams && Object.keys(userParams).length > 0 && declaredParamNames.length === 0) {
      const passedKeys = Object.keys(userParams).join(', ');
      const availableKeys = listSkills().skills.map((s) => s.key).join(', ');
      return {
        ok: false,
        data: `${found.resolvedKey} 未声明 params，你传了 [${passedKeys}]，说明 skill_key 选错了。可用：${availableKeys}`,
      };
    }
    // 已声明 params 时也校验：未知字段一律报错，避免 LLM 编造字段名
    if (userParams && declaredParamNames.length > 0) {
      const unknownKeys = Object.keys(userParams).filter((k) => !declaredParamNames.includes(k));
      if (unknownKeys.length > 0) {
        return {
          ok: false,
          data: `${found.resolvedKey} 不支持 params [${unknownKeys.join(', ')}]，仅声明 [${declaredParamNames.join(', ')}]`,
        };
      }
    }
    const overrideArgs = mapSkillParams(found.meta.params, userParams);
    const mode: SkillOutputMode = args.mode === 'data' || args.mode === 'json' ? args.mode : 'card';
    return runSkillAndFormat(found.resolvedKey, overrideArgs, mode);
  },
};
