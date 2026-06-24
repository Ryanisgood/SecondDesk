export interface GlassStyle {
  name: string
  blur: number          // 0-40
  saturation: number    // 100-200
  opacity: number       // 0.6-1.0
  opacitySecondary: number
}

export interface ThemeColors {
  primary: string
  primaryRgb: string
  success: string
  warning: string
  danger: string
  info: string
  // New: Background tints for immersive theming
  bgBase: string      // App background base color
  bgSecondary: string // Card/Sidebar background color
  textPrimary: string // Main text color (allows tinted blacks/whites)
}

export interface ColorTheme {
  id: string
  name: string
  light: ThemeColors
  dark: ThemeColors
}

export const GLASS_PRESETS: Record<string, GlassStyle> = {
  clear: {
    get name() { return t('theme.glass.clear') },
    blur: 40,
    saturation: 180,
    opacity: 0.65,
    opacitySecondary: 0.4
  },
  standard: {
    get name() { return t('theme.glass.standard') },
    blur: 24,
    saturation: 140,
    opacity: 0.88,
    opacitySecondary: 0.7
  },
  deep: {
    get name() { return t('theme.glass.deep') },
    blur: 50,
    saturation: 160,
    opacity: 0.92,
    opacitySecondary: 0.8
  },
  minimal: {
    get name() { return t('theme.glass.minimal') },
    blur: 0,
    saturation: 100,
    opacity: 1.0,
    opacitySecondary: 1.0
  }
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'blue',
    get name() { return t('theme.color.blue') },
    light: {
      primary: '#3B82F6',
      primaryRgb: '59, 130, 246',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#0EA5E9',
      bgBase: '#ffffff',
      bgSecondary: '#f8fafc', // Slate 50
      textPrimary: '#0f172a'
    },
    dark: {
      primary: '#60A5FA',
      primaryRgb: '96, 165, 250',
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#38BDF8',
      bgBase: '#0f172a', // Slate 900
      bgSecondary: '#1e293b', // Slate 800
      textPrimary: '#f1f5f9'
    }
  },
  {
    id: 'mist',
    get name() { return t('theme.color.gray') },
    light: {
      primary: '#64748B',
      primaryRgb: '100, 116, 139',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#0EA5E9',
      bgBase: '#f1f5f9', // Slate 100 (Cool Gray)
      bgSecondary: '#e2e8f0',
      textPrimary: '#334155'
    },
    dark: {
      primary: '#94A3B8',
      primaryRgb: '148, 163, 184',
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#38BDF8',
      bgBase: '#1e293b',
      bgSecondary: '#334155',
      textPrimary: '#f8fafc'
    }
  },
  {
    id: 'warm',
    get name() { return t('theme.color.warm') },
    light: {
      primary: '#D97706',
      primaryRgb: '217, 119, 6',
      success: '#059669',
      warning: '#D97706',
      danger: '#DC2626',
      info: '#0284C7',
      bgBase: '#fffbeb', // Amber 50 (Warm)
      bgSecondary: '#fef3c7',
      textPrimary: '#451a03'
    },
    dark: {
      primary: '#FBBF24',
      primaryRgb: '251, 191, 36',
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#38BDF8',
      bgBase: '#292524', // Stone 800
      bgSecondary: '#44403c',
      textPrimary: '#fef3c7'
    }
  },
  {
    id: 'mint',
    get name() { return t('theme.color.green') },
    light: {
      primary: '#10B981',
      primaryRgb: '16, 185, 129',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#0EA5E9',
      bgBase: '#f0fdf4', // Emerald 50
      bgSecondary: '#dcfce7',
      textPrimary: '#064e3b'
    },
    dark: {
      primary: '#34D399',
      primaryRgb: '52, 211, 153',
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#38BDF8',
      bgBase: '#064e3b',
      bgSecondary: '#065f46',
      textPrimary: '#ecfdf5'
    }
  },
  {
    id: 'neon',
    get name() { return t('theme.color.purple') },
    light: {
      primary: '#8B5CF6',
      primaryRgb: '139, 92, 246',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#0EA5E9',
      bgBase: '#faf5ff', // Purple 50
      bgSecondary: '#f3e8ff',
      textPrimary: '#1e1b4b'
    },
    dark: {
      primary: '#A78BFA',
      primaryRgb: '167, 139, 250',
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#38BDF8',
      bgBase: '#111827', // Gray 900 (Deep)
      bgSecondary: '#1f2937',
      textPrimary: '#f3e8ff'
    }
  },
  {
    id: 'aurora',
    get name() { return t('theme.color.pink') },
    light: {
      primary: '#EC4899',
      primaryRgb: '236, 72, 153',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#0EA5E9',
      bgBase: '#fdf2f8', // Pink 50
      bgSecondary: '#fce7f3',
      textPrimary: '#831843'
    },
    dark: {
      primary: '#F472B6',
      primaryRgb: '244, 114, 182',
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#38BDF8',
      bgBase: '#3f1738', // Deep Purple/Pink
      bgSecondary: '#500724',
      textPrimary: '#fbcfe8'
    }
  }
]
import { t } from '../i18n'
