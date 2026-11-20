import type { ThemeStyleOption } from '@/types/theme';
import { useLocaleStore } from '@/stores/locale';

/**
 * 可用主题风格列表（locale-aware）
 * @description 选择器展示用，每种风格都有亮/暗两种模式，由顶栏亮暗按钮控制
 */
export function getThemeStyles(): ThemeStyleOption[] {
  const c = useLocaleStore().t.common;
  return [
    { id: 'default', label: c.themeClassic, icon: '🎯', preview: '#6366f1', themeIds: ['dark', 'light'] },
    { id: 'eye-care', label: c.themeEyeCare, icon: '🌿', preview: '#4caf82', themeIds: ['eye-care', 'eye-care-light'] },
    { id: 'custom', label: c.themeCustom, icon: '🎨', preview: '#07C160', themeIds: ['custom', 'custom'] },
  ];
}

/**
 * 静态备用（非响应式，向后兼容）
 * @description 调用方应优先使用 getThemeStyles() 以获取 locale-aware 的标签
 */
export const THEME_STYLES: ThemeStyleOption[] = [
  { id: 'default', label: '经典', icon: '🎯', preview: '#6366f1', themeIds: ['dark', 'light'] },
  { id: 'eye-care', label: '护眼', icon: '🌿', preview: '#4caf82', themeIds: ['eye-care', 'eye-care-light'] },
  { id: 'custom', label: '自定义', icon: '🎨', preview: '#07C160', themeIds: ['custom', 'custom'] },
];
