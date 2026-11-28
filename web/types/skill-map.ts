import path from 'path';
import { PROJECT_DIR } from '@/utils/paths';

/**
 * 卡片图片落盘目录：web/public/skill-images/
 * @description 业务脚本统一使用 card_utils.sh 暴出的 CARD_OUTPUT_DIR 写入此目录；
 *              生产构建后 web/public 由 express.static 统一托管，图片即可直接通过 /skill-images/xxx.png 访问；
 *              开发模式下由 server.ts 单独挂载同名 URL 前缀兜底。
 */
export const TOOLS_IMAGES_DIR = path.join(PROJECT_DIR, 'web', 'public', 'skill-images');

/** Web 访问卡片图片的 URL 前缀（需与 server.ts 静态挂载及 web/public 物理目录名保持一致） */
export const TOOLS_IMAGES_URL_PREFIX = '/skill-images';

// ==============================
// Skill Map 相关类型定义
// ==============================

/**
 * 技能脚本入参元信息
 * @description 用于前端渲染参数表单 + 路由层做白名单校验；位置参数按数组顺序透传给 shell
 */
export interface SkillParamMeta {
  /** 字段名（仅作前端表单状态 key，不会拼到命令行；命令行参数顺序由数组顺序决定） */
  name: string;
  /** 显示标签 */
  label: string;
  /** 控件类型 */
  type: string;
  /** 占位提示文本 */
  placeholder?: string;
  /** select 选项列表 */
  options?: Array<{ value: string; label: string }>;
  /** 是否必填（前端表单用） */
  required?: boolean;
  /**
   * 单个入参的长度上限（后端校验用，默认 SKILL_ARG_MAX_LEN=64）
   * @description 普通技能的入参都是短值（城市名、星座、日期），64 足够；
   *   但 diagram_card 这类需要整段 JSON 作为入参的技能必须放宽，故支持按参数单独声明上限。
   */
  maxLength?: number;
  /**
   * 默认值（前端初始化表单 + 用户未填时回退使用）
   * @description 支持三种形式：
   *   - `string`：固定默认值（如 'USD'、'today'）
   *   - `() => string`：动态字符串（每次取值时计算，如格式化好的日期/时间）
   *   - `() => Date`：动态日期对象（自动格式化为 'YYYY-MM-DD' 与 auto-form date-picker 协议对齐）
   * 经 resolveDefaultValue 求值后对外永远是 string，前端类型/接口契约保持稳定
   */
  defaultValue?: string | (() => string | Date);
}

/**
 * 常用地点（来自数据库缓存键 amap_geocode.json）
 * @description 脚本每次成功解析地址都会往库里写一条，前端地图选点把它作为「最近用过」的快捷候选
 */
export interface AmapRecentPlace {
  /** 地点名（缓存的 key，即原始输入地址） */
  name: string;
  /** 坐标 "经度,纬度" */
  location: string;
}

/**
 * 高德地图 JS API 前端配置
 * @description 由 GET /api/skill-map/amap-config 下发给前端，供地图选点组件初始化 SDK。
 *   JS API 的 Key 与服务端 REST Key 是两种类型，必须单独申请（控制台「Web端(JS API)」）
 */
export interface AmapJsConfig {
  /** 是否已配置 JS Key（未配置时前端降级为普通输入框） */
  configured: boolean;
  /** 高德 JS API Key（Web 端类型） */
  jsKey: string;
  /** JS API 安全密钥（securityJsCode）；为空表示走服务端代理或未开启安全密钥 */
  securityCode: string;
  /** 地图默认城市（取 WEATHER_CITY_NAME，用于限定搜索范围与初始视野） */
  city: string;
  /** 常用地点候选（按缓存顺序，最多 20 条） */
  recentPlaces: AmapRecentPlace[];
}

/** 技能条目（对应 scripts/tools/ 下一个脚本） */
export interface SkillItem {
  /** 唯一键（= 脚本文件名去 .sh，或同名 +_with_arg 区分参数） */
  key: string;
  /** 展示用图标（emoji） */
  icon: string;
  /** 分组名（中文展示用） */
  category: string;
  /** 脚本文件名（相对 scripts/tools/，含 .sh） */
  script: string;
  /** 脚本执行的默认参数列表（按位置顺序传给 shell；前端可通过 params 覆盖） */
  args: string[];
  /** 该脚本是否会输出 PNG 卡片（最终落盘于 web/public/skill-images/） */
  hasCard: boolean;
  /** 卡片主题色（hex） */
  accent: string;
  /**
   * 可配置的脚本入参元信息（按位置顺序排列）
   * @description 设置后卡片会渲染表单；执行时按数组顺序覆盖 args 透传给 shell；缺省/留空时回退到 defaultValue 或 args 同位置默认值
   */
  params?: SkillParamMeta[];
}

/**
 * 公共假期：常用国家/地区选项（两位代码，对齐 Nager.Date 接口）
 * @description 放在这里集中维护，避免 params 内联导致 SKILL_METAS 过长
 */
const HOLIDAY_COUNTRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'CN', label: '中国' },
  { value: 'US', label: '美国' },
  { value: 'JP', label: '日本' },
  { value: 'GB', label: '英国' },
  { value: 'DE', label: '德国' },
  { value: 'FR', label: '法国' },
  { value: 'KR', label: '韩国' },
  { value: 'SG', label: '新加坡' },
  { value: 'AU', label: '澳大利亚' },
  { value: 'CA', label: '加拿大' },
  { value: 'HK', label: '中国香港' },
];

/**
 * 当前年 / 月 / 日
 * @description 模块加载时求值，仅用于下拉首项的说明文案（如「本月（10 月）」）；
 *              真正传给脚本的默认值用函数式 defaultValue，每次调用都取当下，跨天也准确。
 */
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const CURRENT_DAY = new Date().getDate();

/**
 * 公共假期：年份选项（今年 / 去年 / 明年）
 * @description 首项空值 = 今年（由脚本 ${2:-$(date +%Y)} 兜底）
 */
const HOLIDAY_YEAR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: `今年（${CURRENT_YEAR}）` },
  { value: String(CURRENT_YEAR - 1), label: `${CURRENT_YEAR - 1} 年` },
  { value: String(CURRENT_YEAR), label: `${CURRENT_YEAR} 年` },
  { value: String(CURRENT_YEAR + 1), label: `${CURRENT_YEAR + 1} 年` },
];

/**
 * 腾讯视频热搜：可选榜单（= 接口返回的 ChannelName）
 * @description 接口一次返回 9 个 channel，value 直接就是中文榜单名（脚本按名字精确匹配）；
 *   留空 = 全部榜单；指定后卡片标题与数据都只含该榜单。
 */
const TENCENT_CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部榜单' },
  { value: '热搜', label: '热搜' },
  { value: '电视剧', label: '电视剧' },
  { value: '电影', label: '电影' },
  { value: '综艺', label: '综艺' },
  { value: '动漫', label: '动漫' },
  { value: '少儿', label: '少儿' },
  { value: '纪录片', label: '纪录片' },
  { value: '游戏', label: '游戏' },
  { value: '科技', label: '科技' },
];

/**
 * B站热搜：可选榜单（接口一次返回「置顶」top_list 与「热搜」list 两组）
 * @description value 是脚本内定义的中文榜单名；留空 = 两组全出。
 */
const BILIBILI_CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部榜单' },
  { value: '置顶', label: '置顶' },
  { value: '热搜', label: '热搜' },
];

/**
 * 微博热搜：可选榜单（接口一次返回「要闻」hotgov 与「热搜」band_list 两组）
 * @description value 是脚本内定义的中文榜单名；留空 = 两组全出。
 */
const WEIBO_CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部榜单' },
  { value: '要闻', label: '要闻' },
  { value: '热搜', label: '热搜' },
];

/**
 * 抖音热搜：可选榜单（接口一次返回「热搜」word_list 与「热点」trending_list 两组）
 * @description value 是脚本内定义的中文榜单名；留空 = 两组全出。
 */
const DOUYIN_CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部榜单' },
  { value: '热搜', label: '热搜' },
  { value: '热点', label: '热点' },
];

/**
 * Steam：可选榜单（接口一次返回热销 / 特惠 / 新品 / 即将推出 四组）
 * @description value 是脚本内定义的中文榜单名；留空 = 四组全出。
 */
const STEAM_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部榜单' },
  { value: '热销', label: '热销' },
  { value: '特惠', label: '特惠' },
  { value: '新品', label: '新品' },
  { value: '即将推出', label: '即将推出' },
];

/** 二维码：可选尺寸（正方形边长，接口限制 100-1000） */
const QRCODE_SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '600（默认）' },
  { value: '200', label: '200' },
  { value: '400', label: '400' },
  { value: '800', label: '800' },
  { value: '1000', label: '1000' },
];

/**
 * 按公历日期取星座
 * @param {number} month - 月份（1-12）
 * @param {number} day - 日期（1-31）
 * @returns {string} 星座中文名
 * @description 分界点与 scripts/get_zodiac_sign.sh 完全一致，避免两处判断打架
 */
const getZodiacByDate = (month: number, day: number): string => {
  const boundaries: Array<{ m: number; d: number; sign: string }> = [
    { m: 1, d: 1, sign: '摩羯座' },
    { m: 1, d: 20, sign: '水瓶座' },
    { m: 2, d: 19, sign: '双鱼座' },
    { m: 3, d: 21, sign: '白羊座' },
    { m: 4, d: 20, sign: '金牛座' },
    { m: 5, d: 21, sign: '双子座' },
    { m: 6, d: 22, sign: '巨蟹座' },
    { m: 7, d: 23, sign: '狮子座' },
    { m: 8, d: 23, sign: '处女座' },
    { m: 9, d: 23, sign: '天秤座' },
    { m: 10, d: 24, sign: '天蝎座' },
    { m: 11, d: 23, sign: '射手座' },
    { m: 12, d: 22, sign: '摩羯座' },
  ];
  let sign = '摩羯座';
  boundaries.forEach((b) => {
    if (month > b.m || (month === b.m && day >= b.d)) sign = b.sign;
  });
  return sign;
};

/** 今日所属星座（模块加载时求值，用于星座参数首项的说明文案） */
const TODAY_ZODIAC = getZodiacByDate(new Date().getMonth() + 1, new Date().getDate());

/** skill-map 分组元信息 */
export interface SkillCategoryMeta {
  /** 分组名（与 SkillItem.category 对应） */
  name: string;
  /** 分组圆点颜色（CSS 颜色值） */
  dotColor: string;
}

/**
 * 全量技能清单（后端权威数据）
 * @description 与 scripts/tools/ 下的脚本一一对应
 *              新增脚本时同步在此登记即可；hasCard=true 的脚本会在 web/public/skill-images/ 产出 <key>_card.png
 *              （脚本统一通过 card_utils.sh 暴露的 CARD_OUTPUT_DIR 变量写入该目录）
 */
export const SKILL_METAS: SkillItem[] = [
  // ── 天气 ──
  {
    key: 'weather_card_gen',
    icon: '🌤️',
    category: '天气',
    script: 'weather_card_gen.sh',
    args: [],
    hasCard: true,
    accent: '#5DADE2',
    params: [
      {
        name: 'city',
        label: '城市',
        type: 'input',
        placeholder: '中文/拼音/英文均可，留空 = 深圳',
        required: false,
        defaultValue: '深圳',
      },
    ],
  },
  {
    key: 'weather_alert_card',
    icon: '🚨',
    category: '天气',
    script: 'weather_alert_card_gen.sh',
    args: [],
    hasCard: true,
    accent: '#FF5252',
    params: [
      {
        name: 'city',
        label: '城市',
        type: 'input',
        placeholder: '中文/拼音/英文均可，留空 = 深圳',
        required: false,
        defaultValue: '深圳',
      },
    ],
  },
  {
    key: 'air_quality',
    icon: '💨',
    category: '天气',
    script: 'air_quality.sh',
    args: [],
    hasCard: true,
    accent: '#4CAF50',
    params: [
      {
        name: 'city',
        label: '城市',
        type: 'input',
        placeholder: '中文/拼音/英文均可，留空 = 深圳',
        required: false,
        defaultValue: '深圳',
      },
    ],
  },
  // ── 日历 ──
  { key: 'calendar',        icon: '📅', category: '日历', script: 'calendar.sh',         args: [], hasCard: true,  accent: '#FFD700' },
  {
    key: 'almanac_card',
    icon: '📅',
    category: '日历',
    script: 'almanac_card.sh',
    args: [],
    hasCard: true,
    accent: '#FFD700',
    params: [
      {
        name: 'date',
        label: '日期',
        type: 'date-picker',
        required: false,
        defaultValue: () => new Date(),
      },
    ],
  },
  
  // ── 财经 ──
  { key: 'stock_market',    icon: '📈', category: '财经', script: 'stock_market.sh',       args: [], hasCard: true,  accent: '#FF6B35' },
  { key: 'hk_stock',        icon: '🇭🇰', category: '财经', script: 'hk_stock.sh',           args: [], hasCard: true,  accent: '#FF6B35' },
  { key: 'us_stock',        icon: '🇺🇸', category: '财经', script: 'us_stock.sh',           args: [], hasCard: true,  accent: '#FF6B35' },
  { key: 'exchange_rate',   icon: '💱', category: '财经', script: 'exchange_rate.sh',      args: [], hasCard: true,  accent: '#FF6B35',
    params: [
      {
        name: 'base',
        label: '基准货币',
        type: 'select',
        placeholder: '请选择基准货币（留空 = USD）',
        required: false,
        defaultValue: 'USD',
        options: [
          { value: 'USD', label: '美元 USD' },
          { value: 'CNY', label: '人民币 CNY' },
          { value: 'EUR', label: '欧元 EUR' },
          { value: 'GBP', label: '英镑 GBP' },
          { value: 'JPY', label: '日元 JPY' },
          { value: 'HKD', label: '港币 HKD' },
        ],
      },
    ],
  },
  { key: 'gold_silver',     icon: '🥇', category: '财经', script: 'gold_silver.sh',        args: [], hasCard: true,  accent: '#FF6B35' },
  { key: 'oil_price_card',  icon: '🛢️', category: '财经', script: 'oil_price_card_gen.sh', args: [], hasCard: true,  accent: '#FF6B35' },
  { key: 'crypto_price',    icon: '₿',  category: '财经', script: 'crypto_price.sh',       args: [], hasCard: true,  accent: '#FF6B35' },

  // ── 新闻 ──
  { key: 'ai_news_card',    icon: '📰', category: '新闻', script: 'ai_news_card_gen.sh', args: [], hasCard: true,  accent: '#9B59B6' },
  { key: 'ent_news',        icon: '🎬', category: '新闻', script: 'ent_news.sh',         args: [], hasCard: true,  accent: '#9B59B6' },
  { key: 'intl_news',       icon: '🌍', category: '新闻', script: 'intl_news.sh',        args: [], hasCard: true,  accent: '#9B59B6' },
  {
    key: 'weibo_hot',
    icon: '🔥',
    category: '新闻',
    script: 'weibo_hot.sh',
    args: [],
    hasCard: true,
    accent: '#9B59B6',
    params: [
      {
        name: 'channel',
        label: '榜单',
        type: 'select',
        placeholder: '留空 = 全部榜单',
        required: false,
        defaultValue: '',
        options: WEIBO_CHANNEL_OPTIONS,
      },
    ],
  },

  // ── 影视 ──
  {
    key: 'bilibili_hot',
    icon: '📺',
    category: '影视',
    script: 'bilibili_hot.sh',
    args: [],
    hasCard: true,
    accent: '#00A1D6',
    params: [
      {
        name: 'channel',
        label: '榜单',
        type: 'select',
        placeholder: '留空 = 全部榜单',
        required: false,
        defaultValue: '',
        options: BILIBILI_CHANNEL_OPTIONS,
      },
    ],
  },
  {
    key: 'tencent_hot',
    icon: '🎭',
    category: '影视',
    script: 'tencent_hot.sh',
    args: [],
    hasCard: true,
    accent: '#00A1D6',
    params: [
      {
        name: 'channel',
        label: '榜单',
        type: 'select',
        placeholder: '留空 = 全部榜单',
        required: false,
        defaultValue: '',
        options: TENCENT_CHANNEL_OPTIONS,
      },
    ],
  },
  { key: 'iqiyi_hot',         icon: '🎞️', category: '影视', script: 'iqiyi_hot.sh',         args: [], hasCard: true, accent: '#00A1D6' },
  {
    key: 'douyin_hot',
    icon: '🎵',
    category: '影视',
    script: 'douyin_hot.sh',
    args: [],
    hasCard: true,
    accent: '#00A1D6',
    params: [
      {
        name: 'channel',
        label: '榜单',
        type: 'select',
        placeholder: '留空 = 全部榜单',
        required: false,
        defaultValue: '',
        options: DOUYIN_CHANNEL_OPTIONS,
      },
    ],
  },

  // ── 科技 ──
  { key: 'github_trending', icon: '🐙', category: '科技', script: 'github_trending.sh', args: [], hasCard: true, accent: '#1ABC9C' },
  {
    key: 'steam_hot',
    icon: '🎮',
    category: '科技',
    script: 'steam_hot.sh',
    args: [],
    hasCard: true,
    accent: '#1ABC9C',
    params: [
      {
        name: 'category',
        label: '榜单',
        type: 'select',
        placeholder: '留空 = 全部榜单',
        required: false,
        defaultValue: '',
        options: STEAM_CATEGORY_OPTIONS,
      },
    ],
  },
  { key: 'earthquake',      icon: '🌋', category: '科技', script: 'earthquake.sh',      args: [], hasCard: true, accent: '#1ABC9C' },

  // ── 生活 ──
  { key: 'daily_word',      icon: '📖', category: '生活', script: 'daily_word.sh',      args: [], hasCard: true, accent: '#E74C3C' },
  {
    key: 'history_today',
    icon: '📜',
    category: '生活',
    script: 'history_today_card.sh',
    args: [],
    hasCard: true,
    accent: '#E74C3C',
    params: [
      {
        name: 'month',
        label: '月份',
        type: 'select',
        placeholder: '留空 = 本月',
        required: false,
        // 函数式默认值：每次拉清单 / 执行都取当下，表单直接选中具体月份
        defaultValue: () => String(new Date().getMonth() + 1),
        options: [
          { value: '', label: `本月（${CURRENT_MONTH} 月）` },
          ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 月` })),
        ],
      },
      {
        name: 'day',
        label: '日期',
        type: 'select',
        placeholder: '留空 = 今天',
        required: false,
        defaultValue: () => String(new Date().getDate()),
        options: [
          { value: '', label: `今天（${CURRENT_DAY} 日）` },
          ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 日` })),
        ],
      },
    ],
  },
  { key: 'daily_wallpaper', icon: '🖼️', category: '生活', script: 'daily_wallpaper.sh', args: [], hasCard: true, accent: '#E74C3C' },
  {
    key: 'holiday_nager',
    icon: '🏖️',
    category: '生活',
    script: 'holiday_nager.sh',
    args: [],
    hasCard: true,
    accent: '#E74C3C',
    params: [
      {
        name: 'country',
        label: '国家/地区',
        type: 'select',
        placeholder: '留空 = 中国',
        required: false,
        defaultValue: 'CN',
        options: HOLIDAY_COUNTRY_OPTIONS,
      },
      {
        name: 'year',
        label: '年份',
        type: 'select',
        placeholder: '留空 = 今年',
        required: false,
        defaultValue: () => String(new Date().getFullYear()),
        options: HOLIDAY_YEAR_OPTIONS,
      },
    ],
  },
  {
    key: 'qrcode',
    icon: '🔳',
    category: '生活',
    script: 'qrcode.sh',
    args: [],
    hasCard: true,
    accent: '#E74C3C',
    params: [
      {
        name: 'content',
        label: '内容',
        type: 'input',
        placeholder: '要生成二维码的文本或链接',
        required: true,
        defaultValue: '',
      },
      {
        name: 'size',
        label: '尺寸',
        type: 'select',
        placeholder: '留空 = 600',
        required: false,
        defaultValue: '',
        options: QRCODE_SIZE_OPTIONS,
      },
    ],
  },
  {
    key: 'commute',
    icon: '🚗',
    category: '生活',
    script: 'commute_card.sh',
    args: [],
    hasCard: true,
    accent: '#4CAF50',
    params: [
      {
        name: 'from',
        label: '起点',
        type: 'input',
        // 贾维斯直接传文本：中文地址 / "经度,纬度" / "地名|经度,纬度" / 别名 home/家
        placeholder: '中文地址或"经度,纬度"；留空 = 家',
        required: false,
        defaultValue: '家',
        maxLength: 120,
      },
      {
        name: 'to',
        label: '终点',
        type: 'input',
        placeholder: '中文地址或"经度,纬度"；留空 = 公司',
        required: false,
        defaultValue: '公司',
        maxLength: 120,
      },
    ],
  },
  {
    key: 'horoscope_card',
    icon: '♈',
    category: '生活',
    script: 'horoscope_card.sh',
    args: [],
    hasCard: true,
    accent: '#E74C3C',
    params: [
      {
        name: 'zodiac',
        label: '星座',
        type: 'select',
        placeholder: '请选择星座（留空=按今日日期自动判断）',
        required: false,
        // 函数式默认值：表单直接定位到今日星座（如天秤座），每次拉清单/执行都取当下，跨天也准
        defaultValue: () => getZodiacByDate(new Date().getMonth() + 1, new Date().getDate()),
        options: [
          { value: '', label: `自动判断（今天：${TODAY_ZODIAC}）` },
          { value: '白羊座', label: '白羊座' },
          { value: '金牛座', label: '金牛座' },
          { value: '双子座', label: '双子座' },
          { value: '巨蟹座', label: '巨蟹座' },
          { value: '狮子座', label: '狮子座' },
          { value: '处女座', label: '处女座' },
          { value: '天秤座', label: '天秤座' },
          { value: '天蝎座', label: '天蝎座' },
          { value: '射手座', label: '射手座' },
          { value: '摩羯座', label: '摩羯座' },
          { value: '水瓶座', label: '水瓶座' },
          { value: '双鱼座', label: '双鱼座' },
        ],
      },
      {
        name: 'period',
        label: '周期',
        type: 'select',
        required: false,
        defaultValue: 'today',
        options: [
          { value: 'today',    label: '今日' },
          { value: 'tomorrow', label: '明日' },
          { value: 'week',     label: '本周' },
          { value: 'month',    label: '本月' },
          { value: 'year',     label: '今年' },
        ],
      },
    ],
  },
  // ── 图表 ──
  {
    key: 'diagram_card',
    icon: '🗺️',
    category: '图表',
    script: 'diagram_card.sh',
    args: [],
    hasCard: true,
    accent: '#7C4DFF',
    params: [
      {
        name: 'spec',
        label: '图描述 JSON',
        type: 'textarea',
        placeholder: '{"type":"architecture","title":"...","groups":[{"title":"","nodes":[{"name":""}]}],"edges":[{"from":"","to":"","label":""}]}',
        required: true,
        defaultValue: '',
        // 整段 JSON 作为单个位置参数传入，需突破默认 64 字符上限
        maxLength: 8000,
      },
    ],
  },
];

/** 技能 key → SkillItem 映射（供路由层快速查询） */
export const SKILL_META_MAP: Map<string, SkillItem> = new Map(
  SKILL_METAS.map((s) => [s.key, s]),
);

/** 分组元信息（保持页面显示顺序） */
export const SKILL_CATEGORIES: SkillCategoryMeta[] = [
  { name: '天气', dotColor: '#5DADE2' },
  { name: '日历', dotColor: '#FFD700' },
  { name: '财经', dotColor: '#FF6B35' },
  { name: '新闻', dotColor: '#9B59B6' },
  { name: '影视', dotColor: '#00A1D6' },
  { name: '科技', dotColor: '#1ABC9C' },
  { name: '生活', dotColor: '#E74C3C' },
  { name: '图表', dotColor: '#7C4DFF' },
];

// ==============================
// 接口响应类型
// ==============================

/** GET /api/skill-map 响应 data */
export interface SkillMapListData {
  /** 全部技能 */
  skills: SkillItem[];
  /** 分组元信息 */
  categories: SkillCategoryMeta[];
}

/** POST /api/skill-map/:key 响应 data */
export interface SkillMapRunData {
  /** 技能 key */
  key: string;
  /** 脚本标准输出（已去 ANSI） */
  stdout: string;
  /** 脚本标准错误输出 */
  stderr: string;
  /**
   * 产出图片的 Web 访问 URL（仅当脚本 hasCard=true 且成功产出时返回）
   * @description 例如：/skill-images/weibo_hot_card.png?t=1714180000000
   */
  imageUrl: string;
  /** 执行完成时间（zh-CN 本地化） */
  time: string;
}
