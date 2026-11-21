/** 底层主题 ID（对应 CSS data-theme 值） */
export type ThemeId = 'dark' | 'light' | 'eye-care' | 'eye-care-light' | 'custom';

/** 主题风格 ID（选择器展示用，每种风格都有亮/暗两种模式） */
export type ThemeStyle = 'default' | 'eye-care' | 'custom';

/** 主题风格选项（选择器下拉菜单展示用） */
export interface ThemeStyleOption {
  id: ThemeStyle;
  label: string;
  icon: string;
  /** 预览色（展示暗色模式下的颜色） */
  preview: string;
  /** 风格对应的底层主题 ID：[暗色, 亮色] */
  themeIds: [ThemeId, ThemeId];
}

/** 自动亮暗切换时间配置 */
export interface AutoThemeTimes {
  /** 切到亮色时间（HH:mm） */
  lightTime: string;
  /** 切到暗色时间（HH:mm） */
  darkTime: string;
}

/** 自定义主题颜色配置 */
export interface CustomThemeColor {
  /** 主色调（accent-primary） */
  accentPrimary: string;
  /** 是否为亮色模式 */
  isLight: boolean;
}
