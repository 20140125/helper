import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ThemeId, ThemeStyle, CustomThemeColor, AutoThemeTimes } from '@/types/theme';
import { THEME_STYLES, getThemeStyles } from '@/constants/theme';

const STORAGE_KEY = 'helper-theme';
const STORAGE_CUSTOM_COLOR_KEY = 'helper-custom-color';
const STORAGE_AUTO_MODE_KEY = 'helper-theme-auto-mode';
const STORAGE_LIGHT_TIME_KEY = 'helper-theme-light-time';
const STORAGE_DARK_TIME_KEY = 'helper-theme-dark-time';
const AUTO_CHECK_INTERVAL_MS = 60 * 1000;
const DEFAULT_LIGHT_TIME = '07:00';
const DEFAULT_DARK_TIME = '19:00';

/** 根据主色调 hex 计算 RGB 分量 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

/** RGB 转 HSL */
const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: { h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break; }
      case gn: { h = ((bn - rn) / d + 2) / 6; break; }
      case bn: { h = ((rn - gn) / d + 4) / 6; break; }
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

/** HSL 转 hex */
const hslToHex = (h: number, s: number, l: number): string => {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * 解析 HH:mm 时间为当天分钟数
 * @param {string} value - HH:mm 格式时间
 * @returns {number | null} 分钟数，格式非法时返回 null
 */
const parseTimeToMinutes = (value: string): number | null => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

/**
 * 判断当前时间是否落在亮色时段
 * @param {Date} now - 当前时间
 * @param {string} lightTime - 切到亮色的时间
 * @param {string} darkTime - 切到暗色的时间
 * @returns {boolean} true 表示应使用亮色主题
 * @description 支持亮色时段跨零点（如亮 07:00、暗 23:00 为同日区间；亮 22:00、暗 06:00 为跨零点区间）
 */
const isLightPeriod = (now: Date, lightTime: string, darkTime: string): boolean => {
  const current = now.getHours() * 60 + now.getMinutes();
  const light = parseTimeToMinutes(lightTime) ?? 7 * 60;
  const dark = parseTimeToMinutes(darkTime) ?? 19 * 60;
  if (light === dark) return true;
  if (light < dark) return current >= light && current < dark;
  return current >= light || current < dark;
};

/**
 * 根据主色生成 TDesign 品牌色阶（brand1~brand10）
 * 亮色模式：brand1(最浅) ~ brand10(最深)，主色在 brand8
 * 暗色模式：色阶反转，主色更亮（brand3），hover 更亮（brand2），在深色背景上清晰可见
 */
const generateBrandPalette = (hex: string, isLight: boolean): Record<string, string> => {
  const rgb = hexToRgb(hex);
  if (!rgb) return {};
  const [h, s] = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const palette: Record<string, string> = {};

  if (isLight) {
    // 亮色模式：brand1(最浅97%) ~ brand10(最深22%)，主色在 brand8(40%)
    const lightnesses = [97, 93, 87, 78, 68, 58, 48, 40, 32, 22];
    const saturations = [
      Math.min(s * 0.3, 40),
      Math.min(s * 0.45, 55),
      Math.min(s * 0.6, 70),
      Math.min(s * 0.75, 80),
      Math.min(s * 0.88, 90),
      Math.min(s * 0.95, 95),
      Math.min(s, 100),
      Math.min(s, 100),
      Math.min(s, 100),
      Math.min(s, 100),
    ];
    lightnesses.forEach((l, i) => {
      palette[`--td-brand-color-${i + 1}`] = hslToHex(h, saturations[i], l);
    });
    // 亮色模式关键变量：主色在中等亮度，hover 略深
    palette['--td-brand-color'] = hslToHex(h, Math.min(s, 100), 40);
    palette['--td-brand-color-hover'] = hslToHex(h, Math.min(s, 100), 48);
    palette['--td-brand-color-active'] = hslToHex(h, Math.min(s, 100), 32);
    palette['--td-brand-color-focus'] = hslToHex(h, Math.min(s * 0.45, 55), 93);
    palette['--td-brand-color-disabled'] = hslToHex(h, Math.min(s * 0.6, 70), 87);
    palette['--td-brand-color-light'] = hslToHex(h, Math.min(s * 0.3, 40), 97);
    palette['--td-brand-color-light-hover'] = hslToHex(h, Math.min(s * 0.45, 55), 93);
    palette['--td-brand-color-light-active'] = hslToHex(h, Math.min(s * 0.6, 70), 87);
  } else {
    // 暗色模式：色阶反转，brand1(最深15%) ~ brand10(最浅85%)
    // 主色使用较高亮度（65%），在深色背景上清晰可见
    const lightnesses = [15, 22, 30, 38, 48, 58, 65, 72, 80, 88];
    const saturations = [
      Math.min(s, 100),
      Math.min(s, 100),
      Math.min(s, 100),
      Math.min(s, 100),
      Math.min(s * 0.95, 95),
      Math.min(s * 0.88, 90),
      Math.min(s * 0.75, 80),
      Math.min(s * 0.6, 70),
      Math.min(s * 0.45, 55),
      Math.min(s * 0.3, 40),
    ];
    lightnesses.forEach((l, i) => {
      palette[`--td-brand-color-${i + 1}`] = hslToHex(h, saturations[i], l);
    });
    // 暗色模式关键变量：主色高亮度，hover 更亮，active 略深
    palette['--td-brand-color'] = hslToHex(h, Math.min(s, 100), 65);
    palette['--td-brand-color-hover'] = hslToHex(h, Math.min(s * 0.75, 80), 75);
    palette['--td-brand-color-active'] = hslToHex(h, Math.min(s, 100), 55);
    palette['--td-brand-color-focus'] = hslToHex(h, Math.min(s, 100), 22);
    palette['--td-brand-color-disabled'] = hslToHex(h, Math.min(s, 100), 30);
    palette['--td-brand-color-light'] = hslToHex(h, Math.min(s, 100), 15);
    palette['--td-brand-color-light-hover'] = hslToHex(h, Math.min(s, 100), 22);
    palette['--td-brand-color-light-active'] = hslToHex(h, Math.min(s, 100), 30);
  }

  return palette;
};

/** 根据主色调和亮色模式生成自定义主题 CSS 变量 */
const buildCustomVars = (color: string, isLight: boolean): Record<string, string> => {
  const rgb = hexToRgb(color);
  if (!rgb) return {};
  const { r, g, b } = rgb;

  // 生成 TDesign 品牌色阶（区分亮/暗模式）
  const brandPalette = generateBrandPalette(color, isLight);

  // 根据主色生成带色调的文字颜色（亮色/暗色分别处理）
  const [h, s] = rgbToHsl(r, g, b);
  // 亮色模式：文字偏深，带极低饱和度的主色色调
  // 暗色模式：文字偏亮，带极低饱和度的主色色调
  const textPrimaryLight = hslToHex(h, Math.min(s * 0.08, 8), 10);
  const textSecondaryLight = hslToHex(h, Math.min(s * 0.1, 10), 28);
  const textMutedLight = hslToHex(h, Math.min(s * 0.08, 8), 52);
  const textPrimaryDark = hslToHex(h, Math.min(s * 0.08, 8), 90);
  const textSecondaryDark = hslToHex(h, Math.min(s * 0.1, 10), 60);
  const textMutedDark = hslToHex(h, Math.min(s * 0.08, 8), 35);

  if (isLight) {
    return {
      ...brandPalette,
      '--custom-bg-primary': `#f8f9ff`,
      '--custom-bg-secondary': `#f0f2ff`,
      '--custom-bg-card': `#ffffff`,
      '--custom-bg-card-hover': `#f5f7ff`,
      '--custom-border-color': `rgba(${r}, ${g}, ${b}, 0.15)`,
      '--custom-border-hover': `rgba(${r}, ${g}, ${b}, 0.4)`,
      '--custom-text-primary': textPrimaryLight,
      '--custom-text-secondary': textSecondaryLight,
      '--custom-text-muted': textMutedLight,
      '--custom-accent-primary': color,
      '--custom-accent-secondary': color,
      '--custom-accent-primary-rgb': `${r}, ${g}, ${b}`,
      '--custom-accent-secondary-rgb': `${r}, ${g}, ${b}`,
      '--custom-nav-active-color': color,
      '--custom-glow-primary': `rgba(${r}, ${g}, ${b}, 0.2)`,
      '--custom-sidebar-bg': `#ffffff`,
      '--custom-sidebar-text': textPrimaryLight,
      '--custom-sidebar-text-secondary': textSecondaryLight,
      '--custom-topbar-bg': `rgba(255, 255, 255, 0.95)`,
      '--custom-log-code-bg': `#1e2235`,
      '--custom-log-code-color': color,
      '--custom-grid-color': `rgba(${r}, ${g}, ${b}, 0.04)`,
      '--custom-scrollbar-color': `rgba(${r}, ${g}, ${b}, 0.25)`,
      '--custom-input-bg': `rgba(0, 0, 0, 0.03)`,
    };
  }

  return {
    ...brandPalette,
    '--custom-bg-primary': `#0d1117`,
    '--custom-bg-secondary': `#161b22`,
    '--custom-bg-card': `#1c2333`,
    '--custom-bg-card-hover': `#212a3e`,
    '--custom-border-color': `rgba(${r}, ${g}, ${b}, 0.15)`,
    '--custom-border-hover': `rgba(${r}, ${g}, ${b}, 0.4)`,
    '--custom-text-primary': textPrimaryDark,
    '--custom-text-secondary': textSecondaryDark,
    '--custom-text-muted': textMutedDark,
    '--custom-accent-primary': color,
    '--custom-accent-secondary': color,
    '--custom-accent-primary-rgb': `${r}, ${g}, ${b}`,
    '--custom-accent-secondary-rgb': `${r}, ${g}, ${b}`,
    '--custom-nav-active-color': color,
    '--custom-glow-primary': `rgba(${r}, ${g}, ${b}, 0.3)`,
    '--custom-sidebar-bg': `linear-gradient(180deg, #0d1117 0%, #0a0e1a 100%)`,
    '--custom-sidebar-text': textPrimaryDark,
    '--custom-sidebar-text-secondary': textSecondaryDark,
    '--custom-topbar-bg': `rgba(13, 17, 23, 0.95)`,
    '--custom-log-code-bg': `#0a0e1a`,
    '--custom-log-code-color': color,
    '--custom-grid-color': `rgba(${r}, ${g}, ${b}, 0.03)`,
    '--custom-scrollbar-color': `rgba(${r}, ${g}, ${b}, 0.3)`,
    '--custom-input-bg': `rgba(255, 255, 255, 0.04)`,
  };
};

/**
 * 主题管理全局Store类
 * @description 管理应用主题相关的全局状态，包括主题切换和自定义颜色配置
 */
export class ThemeStore {
  // ==============================
  // 状态变量
  // ==============================

  /**
   * 当前主题ID
   * @description 当前激活的主题标识符，持久化存储在 localStorage
   */
  currentTheme = ref<ThemeId>(
    (localStorage.getItem(STORAGE_KEY) as ThemeId) || 'dark',
  );

  /**
   * 自定义颜色配置
   * @description 自定义主题的主色调和亮色模式配置，持久化存储在 localStorage
   */
  customColor = ref<CustomThemeColor>(
    (() => {
      const saved = localStorage.getItem(STORAGE_CUSTOM_COLOR_KEY);
      return saved
        ? (JSON.parse(saved) as CustomThemeColor)
        : { accentPrimary: '#07C160', isLight: false };
    })(),
  );

  /**
   * 是否启用按时间自动切换亮暗主题
   * @description 用户级设置，持久化存储在 localStorage
   */
  autoMode = ref<boolean>(localStorage.getItem(STORAGE_AUTO_MODE_KEY) === '1');

  /**
   * 自动切换时间配置
   * @description lightTime 切到亮色，darkTime 切到暗色，均为 HH:mm 格式
   */
  autoTimes = ref<AutoThemeTimes>({
    lightTime: localStorage.getItem(STORAGE_LIGHT_TIME_KEY) || DEFAULT_LIGHT_TIME,
    darkTime: localStorage.getItem(STORAGE_DARK_TIME_KEY) || DEFAULT_DARK_TIME,
  });

  /** 自动切换定时器句柄 */
  private autoTimer: number | null = null;

  /** 上次自动切换计算出的亮暗状态，避免同一时段反复触发动画 */
  private lastAutoLight: boolean | null = null;

  // ==============================
  // 计算属性（使用箭头函数+computed，便于 ...store 展开）
  // ==============================

  /** 当前主题风格 ID */
  currentStyle = computed<ThemeStyle>(() => {
    const id = this.currentTheme.value;
    const style = THEME_STYLES.find((s) => s.themeIds.includes(id));
    return style?.id ?? 'default';
  });

  /** 当前主题风格标签文本 */
  currentThemeLabel = computed<string>(() => {
    const style = getThemeStyles().find((s) => s.id === this.currentStyle.value);
    return style?.label ?? '';
  });

  /** 当前主题预览色 */
  currentThemePreview = computed<string>(() => {
    if (this.currentTheme.value === 'custom') {
      return this.customColor.value.accentPrimary;
    }
    const style = THEME_STYLES.find((s) => s.id === this.currentStyle.value);
    return style?.preview ?? '#0d1117';
  });

  /** 当前主题是否为亮色模式 */
  isCurrentLight = computed<boolean>(() => {
    const id = this.currentTheme.value;
    if (id === 'custom') return this.customColor.value.isLight;
    return id === 'light' || id === 'eye-care-light';
  });

  // ==============================
  // 公共方法
  // ==============================

  /**
   * 应用自定义 CSS 变量到 :root
   * @param {CustomThemeColor} color - 自定义颜色配置
   * @returns {void}
   * @description 将自定义主题的 CSS 变量写入文档根元素
   */
  applyCustomVars = (color: CustomThemeColor): void => {
    const vars = buildCustomVars(color.accentPrimary, color.isLight);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }

  /**
   * 清除自定义主题遗留的 inline style 变量
   * @returns {void}
   * @description 从 :root 元素移除所有自定义主题动态写入的 CSS 变量，
   *              使非自定义主题的 CSS 选择器声明生效
   */
  clearCustomVars = (): void => {
    const root = document.documentElement;
    // 收集所有需要清除的变量前缀
    const prefixes = ['--custom-', '--td-brand-color'];
    const propsToRemove: string[] = [];
    for (let i = 0; i < root.style.length; i++) {
      const prop = root.style[i];
      if (prefixes.some((prefix) => prop.startsWith(prefix))) {
        propsToRemove.push(prop);
      }
    }
    propsToRemove.forEach((prop) => root.style.removeProperty(prop));
  }

  /**
   * 执行圆形扩散 View Transitions 动画（TDesign官网同款）
   * @param {() => void} doApply - 主题应用回调
   * @param {{ x: number; y: number }} [origin] - 动画起始坐标（点击位置）
   * @returns {void}
   */
  private runViewTransition = (doApply: () => void, origin?: { x: number; y: number }): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    type DocWithViewTransition = Document & {
      startViewTransition: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
    };
    const docWithTransition = document as DocWithViewTransition;
    const transition = docWithTransition.startViewTransition(() => {
      // 在回调里禁用 CSS transition，防止 new snapshot 截图时颜色提前渐变
      document.documentElement.classList.add('theme-transitioning');
      doApply();
    });

    // TDesign 官网同款：圆形从点击位置向外扩散
    transition.ready.then(() => {
      const x = origin?.x ?? w / 2;
      const y = origin?.y ?? h / 2;
      const maxRadius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
      
      // 优化动画参数，更接近TDesign官网效果
      document.documentElement.animate(
        { 
          clipPath: [
            `circle(0px at ${x}px ${y}px)`, 
            `circle(${maxRadius}px at ${x}px ${y}px)`
          ] 
        },
        { 
          duration: 900, 
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)' 
        },
      );
      
      // 同时为旧快照添加淡出效果
      document.documentElement.animate(
        { opacity: [1, 0] },
        { 
          duration: 600,
          easing: 'ease-out',
          pseudoElement: '::view-transition-old(root)' 
        }
      );
    });

    // 动画结束后恢复 CSS transition
    transition.finished.then(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }).catch(() => {
      // 动画取消时也要清理状态
      document.documentElement.classList.remove('theme-transitioning');
    });
  }

  /**
   * 按风格切换主题（自动保留当前亮暗模式）
   * @param {ThemeStyle} styleId - 目标风格 ID
   * @param {{ x: number; y: number }} [origin] - 动画起始坐标
   * @returns {void}
   */
  applyStyle = (styleId: ThemeStyle, origin?: { x: number; y: number }): void => {
    const style = THEME_STYLES.find((s) => s.id === styleId);
    if (!style) return;
    const isLight = this.isCurrentLight.value;
    const targetId = isLight ? style.themeIds[1] : style.themeIds[0];
    this.applyTheme(targetId, origin);
  }

  /**
   * 切换主题（带 View Transitions 过渡动画）
   * @param {ThemeId} id - 目标主题ID
   * @param {{ x: number; y: number }} [origin] - 动画起始坐标（点击位置）
   * @returns {void}
   * @description 切换到指定主题，并持久化存储到 localStorage
   */
  applyTheme = (id: ThemeId, origin?: { x: number; y: number }): void => {
    const doApply = () => {
      this.currentTheme.value = id;
      localStorage.setItem(STORAGE_KEY, id);
      document.documentElement.setAttribute('data-theme', id);

      // 同步设置 TDesign 官方 theme-mode，让内置组件跟随亮/暗切换
      const isLight = id === 'light' || id === 'eye-care-light'
        || (id === 'custom' && this.customColor.value.isLight);
      document.documentElement.setAttribute('theme-mode', isLight ? 'light' : 'dark');

      // 切换到自定义主题时，重新应用自定义变量
      if (id === 'custom') {
        this.applyCustomVars(this.customColor.value);
      } else {
        // 非自定义主题：清除之前自定义主题遗留的 inline style 变量
        // 否则 inline style 优先级最高，会覆盖 CSS 中的 :root[data-theme] 声明
        this.clearCustomVars();
      }
    };

    // 不支持 View Transitions API 时使用 CSS 过渡动画
    if (!('startViewTransition' in document)) {
      const doc = document as Document;
      // 添加过渡类名
      doc.documentElement.classList.add('theme-transitioning');
      
      // 使用 requestAnimationFrame 确保样式更新在下一帧
      requestAnimationFrame(() => {
        doApply();
        
        // 动画结束后移除过渡类名
        setTimeout(() => {
          doc.documentElement.classList.remove('theme-transitioning');
        }, 300);
      });
      return;
    }
    this.runViewTransition(doApply, origin);
  }

  /**
   * 应用自定义颜色（自动切换到 custom 主题）
   * @param {string} color - 主色调 hex 值
   * @param {boolean} isLight - 是否为亮色模式
   * @param {{ x: number; y: number }} [origin] - 动画起始坐标（点击位置）
   * @returns {void}
   * @description 更新自定义颜色配置并自动切换到自定义主题
   */
  applyCustomColor = (color: string, isLight: boolean, origin?: { x: number; y: number }): void => {
    this.customColor.value = { accentPrimary: color, isLight: isLight };
    localStorage.setItem(STORAGE_CUSTOM_COLOR_KEY, JSON.stringify(this.customColor.value));
    // 不在此处提前调用 applyCustomVars，让 applyTheme 的 doApply 回调在
    // View Transitions 快照之后统一执行，保证动画效果与默认主题切换一致
    this.applyTheme('custom', origin);
    // 同步自定义风格的预览色
    const customStyle = THEME_STYLES.find((s) => s.id === 'custom');
    if (customStyle) {
      customStyle.preview = color;
    }
  }

  /**
   * 按当前风格应用指定的亮暗模式
   * @param {boolean} isLight - true 使用亮色，false 使用暗色
   * @param {{ x: number; y: number }} [origin] - 动画起始坐标
   */
  private applyAutoLight = (isLight: boolean, origin?: { x: number; y: number }): void => {
    const style = this.currentStyle.value;
    if (style === 'custom') {
      this.applyCustomColor(this.customColor.value.accentPrimary, isLight, origin);
      return;
    }
    const option = THEME_STYLES.find((s) => s.id === style);
    if (!option) return;
    this.applyTheme(isLight ? option.themeIds[1] : option.themeIds[0], origin);
  };

  /**
   * 检查是否需要根据用户设置的时间切换亮暗主题
   * @param {{ x: number; y: number }} [origin] - 动画起始坐标
   */
  private checkAutoTheme = (origin?: { x: number; y: number }): void => {
    const isLight = isLightPeriod(
      new Date(),
      this.autoTimes.value.lightTime,
      this.autoTimes.value.darkTime,
    );
    if (this.lastAutoLight === isLight) return;
    this.lastAutoLight = isLight;
    this.applyAutoLight(isLight, origin);
  };

  /**
   * 停止自动主题定时器
   */
  stopAutoTheme = (): void => {
    if (this.autoTimer === null) return;
    window.clearInterval(this.autoTimer);
    this.autoTimer = null;
  };

  /**
   * 启动自动主题：立即检查一次，之后每分钟检查
   * @param {{ x: number; y: number }} [origin] - 动画起始坐标
   */
  startAutoTheme = (origin?: { x: number; y: number }): void => {
    this.stopAutoTheme();
    this.checkAutoTheme(origin);
    this.autoTimer = window.setInterval(() => this.checkAutoTheme(), AUTO_CHECK_INTERVAL_MS);
  };

  /**
   * 开启/关闭自动主题
   * @param {boolean} enabled - 是否开启
   * @param {{ x: number; y: number }} [origin] - 动画起始坐标
   */
  setAutoMode = (enabled: boolean, origin?: { x: number; y: number }): void => {
    this.autoMode.value = enabled;
    localStorage.setItem(STORAGE_AUTO_MODE_KEY, enabled ? '1' : '0');
    this.lastAutoLight = null;
    if (enabled) {
      this.startAutoTheme(origin);
    } else {
      this.stopAutoTheme();
    }
  };

  /**
   * 更新自动切换时间
   * @param {string} lightTime - 切到亮色的时间（HH:mm）
   * @param {string} darkTime - 切到暗色的时间（HH:mm）
   * @description 非法时间回退到默认值；开启自动模式时立即按新时间重算
   */
  setAutoTimes = (lightTime: string, darkTime: string): void => {
    const nextLight = parseTimeToMinutes(lightTime) === null ? DEFAULT_LIGHT_TIME : lightTime;
    const nextDark = parseTimeToMinutes(darkTime) === null ? DEFAULT_DARK_TIME : darkTime;
    this.autoTimes.value = { lightTime: nextLight, darkTime: nextDark };
    localStorage.setItem(STORAGE_LIGHT_TIME_KEY, nextLight);
    localStorage.setItem(STORAGE_DARK_TIME_KEY, nextDark);
    this.lastAutoLight = null;
    if (this.autoMode.value) this.startAutoTheme();
  };

  /**
   * 释放自动主题定时器（应用卸载时调用）
   */
  dispose = (): void => {
    this.stopAutoTheme();
  };

  /**
   * 初始化主题
   * @returns {void}
   * @description 页面加载时直接应用主题，不触发过渡动画
   */
  init = (): void => {
    const id = this.currentTheme.value;
    document.documentElement.setAttribute('data-theme', id);

    const isLight = id === 'light' || id === 'eye-care-light'
      || (id === 'custom' && this.customColor.value.isLight);
    document.documentElement.setAttribute('theme-mode', isLight ? 'light' : 'dark');

    if (id === 'custom') {
      this.applyCustomVars(this.customColor.value);
    }

    if (this.autoMode.value) this.startAutoTheme();
  }
}

/**
 * 创建Theme Store实例的工厂函数
 * @description 将ThemeStore类包装为Pinia可用的Store
 */
export const useThemeStore = defineStore('theme', () => {
  const store = new ThemeStore();

  // 初始化时应用主题
  store.init();

  return {
    ...store,
  };
});
