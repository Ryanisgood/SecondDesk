import { GLASS_PRESETS, COLOR_THEMES, type GlassStyle } from '../config/themes'

export function applyFullTheme(themeMode: string, themeColor: string, glassPreset: string, customGlass?: GlassStyle) {
  // 确定有效主题
  let effectiveTheme = themeMode
  if (themeMode === 'auto') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  // 应用深浅色模式
  const isDark = effectiveTheme === 'dark'
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }

  // 获取颜色主题
  const colorTheme = COLOR_THEMES.find(t => t.id === themeColor) || COLOR_THEMES[0]
  // @ts-ignore
  const colors = isDark ? colorTheme.dark : colorTheme.light

  // 获取毛玻璃设置
  let glass: GlassStyle
  if (glassPreset === 'custom' && customGlass) {
    glass = customGlass
  } else {
    glass = GLASS_PRESETS[glassPreset] || GLASS_PRESETS.standard
  }

  // 应用所有 CSS 变量
  const root = document.documentElement.style

  // ==================== 核心品牌色 ====================
  root.setProperty('--primary-color', colors.primary)
  root.setProperty('--primary-color-rgb', colors.primaryRgb)
  root.setProperty('--success-color', colors.success)
  root.setProperty('--warning-color', colors.warning)
  root.setProperty('--danger-color', colors.danger)
  root.setProperty('--info-color', colors.info)
  root.setProperty('--text-on-primary', '#ffffff')

  // ==================== 玻璃物理层 (Glass Physics) ====================
  root.setProperty('--blur-amount', `${glass.blur}px`)
  root.setProperty('--saturation-amount', `${glass.saturation}%`)
  
  // 基础不透明度
  root.setProperty('--bg-opacity', glass.opacity.toString())
  root.setProperty('--bg-opacity-secondary', glass.opacitySecondary.toString())

  // 辅助函数：将 Hex 转为 RGB 字符串 (用于 rgba)
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r}, ${g}, ${b}`
  }

  const bgBaseRgb = hexToRgb(colors.bgBase)
  const bgSecondaryRgb = hexToRgb(colors.bgSecondary)

  // ==================== 语义化颜色系统 (Semantic Colors) ====================
  // 使用主题配置中的特定背景色
  root.setProperty('--bg-base-rgb', bgBaseRgb)
  
  // 动态生成半透明背景色
  root.setProperty('--bg-primary', `rgba(${bgBaseRgb}, ${glass.opacity})`)
  root.setProperty('--bg-secondary', `rgba(${bgSecondaryRgb}, ${glass.opacitySecondary})`)
  
  if (isDark) {
    // --- Dark Mode ---
    root.setProperty('--hover-bg', 'rgba(255, 255, 255, 0.08)')
    
    // 文字
    root.setProperty('--text-primary', colors.textPrimary || '#F1F5F9') 
    root.setProperty('--text-secondary', '#94A3B8') 
    root.setProperty('--text-tertiary', '#64748B') 
    
    // 边框 & 玻璃光效
    root.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)')
    root.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)')
    root.setProperty('--glass-shine', 'rgba(255, 255, 255, 0.05)')
    root.setProperty('--glass-highlight', 'rgba(255, 255, 255, 0.1)')
    
    // 阴影系统
    root.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.3)')
    root.setProperty('--shadow-color-strong', 'rgba(0, 0, 0, 0.5)')
    
    // 遮罩
    root.setProperty('--modal-overlay-bg', 'rgba(0, 0, 0, 0.7)')
    
  } else {
    // --- Light Mode ---
    root.setProperty('--hover-bg', `rgba(${hexToRgb(colors.primary)}, 0.08)`)
    
    // 文字
    root.setProperty('--text-primary', colors.textPrimary || '#0F172A')
    root.setProperty('--text-secondary', '#64748B')
    root.setProperty('--text-tertiary', '#94A3B8')
    
    // 边框 & 玻璃光效
    root.setProperty('--border-color', `rgba(${bgSecondaryRgb}, 0.5)`)
    root.setProperty('--glass-border', 'rgba(255, 255, 255, 0.6)')
    root.setProperty('--glass-shine', 'rgba(255, 255, 255, 0.4)')
    root.setProperty('--glass-highlight', 'rgba(255, 255, 255, 0.8)')
    
    // 阴影系统
    root.setProperty('--shadow-color', `rgba(${hexToRgb(colors.primary)}, 0.08)`)
    root.setProperty('--shadow-color-strong', `rgba(${hexToRgb(colors.primary)}, 0.15)`)
    
    // 遮罩
    root.setProperty('--modal-overlay-bg', `rgba(${bgBaseRgb}, 0.6)`)
  }

  // ==================== 阴影层级 (Elevation) ====================
  root.setProperty('--shadow-sm', '0 1px 2px var(--shadow-color)')
  root.setProperty('--shadow-md', '0 4px 6px -1px var(--shadow-color), 0 2px 4px -1px var(--shadow-color)')
  root.setProperty('--shadow-lg', '0 10px 15px -3px var(--shadow-color), 0 4px 6px -2px var(--shadow-color)')
  root.setProperty('--shadow-xl', '0 20px 25px -5px var(--shadow-color-strong), 0 10px 10px -5px var(--shadow-color-strong)')
  
  // 焦点光晕
  root.setProperty('--focus-ring-color', colors.primary)
  root.setProperty('--focus-ring-opacity', '0.25')
  root.setProperty('--focus-glow', `0 0 0 3px rgba(${colors.primaryRgb}, 0.25)`)
}
