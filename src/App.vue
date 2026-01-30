<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, computed } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useFileStore } from './stores/files'
import { useDrawerStore, DrawerState } from './stores/drawer'
import { useBatchSelectStore } from './stores/batchSelect'
import { GLASS_PRESETS, COLOR_THEMES, type GlassStyle } from './config/themes'
import FileGrid from './components/FileGrid.vue'
import DateTimeDisplay from './components/DateTimeDisplay.vue'
import CategoryTabs from './components/CategoryTabs.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import GlobalDialog from './components/GlobalDialog.vue'
import BatchActionBar from './components/BatchActionBar.vue'
import MoveTargetPicker from './components/MoveTargetPicker.vue'
import appLogoUrl from './assets/app-logo.png'
import { getIconPath } from './utils/iconHelper'

// 图标路径
const iconGear = getIconPath('gear')
const iconSettings = getIconPath('setting')

const fileStore = useFileStore()
const drawerStore = useDrawerStore()
const batchStore = useBatchSelectStore()
const categoryTabsRef = ref<InstanceType<typeof CategoryTabs> | null>(null)
const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const iconSize = ref<'small' | 'medium' | 'large'>('medium')
const showSettings = ref(false)
const themeColor = ref('blue')
const glassPreset = ref<string>('standard')
const isAdjustingWindow = ref(false)
const autoHideSuspendCount = ref(0)
const autoHideSuspended = computed(() => autoHideSuspendCount.value > 0)
const savedAutoHideSettings = ref<{
  hideOnMouseLeave: boolean
  hideOnFocusLost: boolean
} | null>(null)

// 背景图片设置
const backgroundImagePath = ref<string | null>(null)
const backgroundOpacity = ref(30)
const backgroundBlur = ref(0)

// 计算背景图片样式
const backgroundImageUrl = computed(() => {
  if (!backgroundImagePath.value) return null
  return convertFileSrc(backgroundImagePath.value)
})

const backgroundImageStyle = computed(() => {
  if (!backgroundImageUrl.value) return {}
  return {
    backgroundImage: `url(${backgroundImageUrl.value})`,
    opacity: backgroundOpacity.value / 100,
    filter: backgroundBlur.value > 0 ? `blur(${backgroundBlur.value}px)` : 'none',
  }
})

let mouseLeaveTimer: number | null = null
let hasMouseEntered = false
let focusLostTimer: number | null = null
let isDragging = false
let dragEndTimer: number | null = null
let lastMoveTime = 0
let movedUnlisten: (() => void) | null = null
let focusUnlisten: (() => void) | null = null
let justOpened = false
let justOpenedTimer: number | null = null
let isComposing = false
let typingSuspendUntil = 0
let isSearchFocused = false
let isMouseInside = true
let isWindowFocused = true

let unlistenDrawerToggle: (() => void) | null = null
let unlistenDrawerOpen: (() => void) | null = null
let unlistenOpenSettings: (() => void) | null = null
let unlistenFilesChanged: (() => void) | null = null
let unlistenWindowAdjustStart: (() => void) | null = null

let pendingFsRefresh = false
let fsRefreshTimer: number | null = null

async function runFilesRefresh(reason: string) {
  pendingFsRefresh = false
  if (fsRefreshTimer !== null) {
    clearTimeout(fsRefreshTimer)
    fsRefreshTimer = null
  }
  if (fileStore.loading) {
    pendingFsRefresh = true
    return
  }
  try {
    await fileStore.loadFiles()
  } catch (error) {
    console.error(`刷新文件列表失败(${reason}):`, error)
  }
}

function scheduleFilesRefresh(reason: string) {
  pendingFsRefresh = true

  // 窗口隐藏时不做重刷新，避免阻塞边缘触发/快捷键响应；待窗口显示后再补刷新
  if (!drawerStore.isVisible) {
    return
  }

  if (fsRefreshTimer !== null) {
    clearTimeout(fsRefreshTimer)
  }

  fsRefreshTimer = window.setTimeout(() => {
    fsRefreshTimer = null
    if (!pendingFsRefresh) return
    void runFilesRefresh(reason)
  }, 150)
}

function scheduleFocusLostHide() {
  if (focusLostTimer !== null) {
    clearTimeout(focusLostTimer)
  }

  const delayMs = Math.max(
    300,
    typingSuspendUntil > Date.now() ? typingSuspendUntil - Date.now() + 50 : 0
  )

  focusLostTimer = window.setTimeout(() => {
    focusLostTimer = null

    if (isWindowFocused) return
    if (
      drawerStore.isVisible &&
      !showSettings.value &&
      !isDragging &&
      !isAdjustingWindow.value &&
      !autoHideSuspended.value &&
      !justOpened
    ) {
      if (isTypingSuspendActive()) {
        scheduleFocusLostHide()
        return
      }
      drawerStore.setState(DrawerState.Hidden)
      hasMouseEntered = false
    }
  }, delayMs)
}

function bumpTypingSuspend(ms = 4000) {
  typingSuspendUntil = Math.max(typingSuspendUntil, Date.now() + ms)
}

function isTypingSuspendActive() {
  return isComposing || Date.now() < typingSuspendUntil
}

function suspendAutoHide() {
  autoHideSuspendCount.value++
}

function resumeAutoHide() {
  autoHideSuspendCount.value = Math.max(0, autoHideSuspendCount.value - 1)
}

function handleCompositionStart() {
  isComposing = true
  bumpTypingSuspend()
}

function handleCompositionUpdate() {
  bumpTypingSuspend()
}

function handleCompositionEnd() {
  isComposing = false
  bumpTypingSuspend(1200)
}

function scheduleDragEndCheck() {
  if (dragEndTimer !== null) {
    clearTimeout(dragEndTimer)
  }
  dragEndTimer = window.setTimeout(() => {
    if (Date.now() - lastMoveTime >= 200) {
      isDragging = false
    }
    dragEndTimer = null
  }, 250)
}

function handleDocumentMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  const isDragRegion = target.hasAttribute('data-tauri-drag-region') ||
    target.closest('[data-tauri-drag-region]')

  if (isDragRegion && !target.classList.contains('no-drag')) {
    isDragging = true
    lastMoveTime = Date.now()
    scheduleDragEndCheck()
  }
}

function handleDocumentMouseUp() {
  if (!isDragging) return
  lastMoveTime = Date.now()
  scheduleDragEndCheck()
}

onMounted(async () => {
  // 禁用浏览器默认右键菜单
  document.addEventListener('contextmenu', (e) => {
    // 允许输入框使用右键菜单
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }
    e.preventDefault()
  })

  // 加载抽屉配置
  await drawerStore.loadConfig()

  // 监听后端抽屉事件
  if (unlistenDrawerToggle) {
    unlistenDrawerToggle()
    unlistenDrawerToggle = null
  }
  unlistenDrawerToggle = await listen('drawer:toggle', async () => {
    await drawerStore.toggle()
    if (drawerStore.isVisible) {
      hasMouseEntered = true  // 用户主动唤出，允许自动隐藏
      // 设置保护期，防止快捷键呼出后立即失焦隐藏
      justOpened = true
      if (justOpenedTimer !== null) {
        clearTimeout(justOpenedTimer)
      }
      justOpenedTimer = window.setTimeout(() => {
        justOpened = false
        justOpenedTimer = null
      }, 500) // 500ms 保护期

      if (pendingFsRefresh) {
        scheduleFilesRefresh('drawer:toggle(open)')
      }
    }
  })

  if (unlistenDrawerOpen) {
    unlistenDrawerOpen()
    unlistenDrawerOpen = null
  }
  unlistenDrawerOpen = await listen('drawer:open', async () => {
    await drawerStore.setState(DrawerState.Open)
    hasMouseEntered = true  // 用户主动唤出，允许自动隐藏
    // 设置保护期
    justOpened = true
    if (justOpenedTimer !== null) {
      clearTimeout(justOpenedTimer)
    }
    justOpenedTimer = window.setTimeout(() => {
      justOpened = false
      justOpenedTimer = null
    }, 500)

    if (pendingFsRefresh) {
      scheduleFilesRefresh('drawer:open')
    }
  })

  if (unlistenOpenSettings) {
    unlistenOpenSettings()
    unlistenOpenSettings = null
  }
  unlistenOpenSettings = await listen('open-settings', () => {
    showSettings.value = true
  })

  // 监听文件系统变化事件
  if (unlistenFilesChanged) {
    unlistenFilesChanged()
    unlistenFilesChanged = null
  }
  unlistenFilesChanged = await listen<{ changeType: string; paths: string[] }>('files:changed', async () => {
    scheduleFilesRefresh('files:changed')
  })

  const appWindow = getCurrentWindow()
  if (unlistenWindowAdjustStart) {
    unlistenWindowAdjustStart()
    unlistenWindowAdjustStart = null
  }
  unlistenWindowAdjustStart = await listen('window-adjust-start', (event) => {
    isAdjustingWindow.value = true
    savedAutoHideSettings.value = event.payload as {
      hideOnMouseLeave: boolean
      hideOnFocusLost: boolean
    }
  })

  // 监听窗口失焦事件
  const setupFocusListener = async () => {
    if (focusUnlisten) {
      focusUnlisten()
      focusUnlisten = null
    }

    if (drawerStore.config.behavior.hideOnFocusLost) {
      try {
        isWindowFocused = await appWindow.isFocused()
      } catch {
        // ignore
      }

      if (!isWindowFocused && drawerStore.isVisible && !isDragging) {
        scheduleFocusLostHide()
      }

      focusUnlisten = await appWindow.onFocusChanged(({ payload: focused }) => {
        isWindowFocused = focused
        if (focused) {
          if (focusLostTimer !== null) {
            clearTimeout(focusLostTimer)
            focusLostTimer = null
          }
        } else if (drawerStore.isVisible) {
          // 中文/日文等 IME 输入时，系统候选窗可能导致应用失焦，避免输入过程中误隐藏（由 scheduleFocusLostHide 处理）

          if (isDragging) {
            return
          }

          const now = Date.now()
          if (isSearchFocused && typingSuspendUntil <= now + 250) {
            bumpTypingSuspend(1500)
          }

          scheduleFocusLostHide()
        }
      })
    }
  }

  await setupFocusListener()

  // 监听窗口移动事件
  if (movedUnlisten) {
    movedUnlisten()
    movedUnlisten = null
  }
  movedUnlisten = await appWindow.onMoved(() => {
    if (!isDragging) return
    lastMoveTime = Date.now()
    scheduleDragEndCheck()
  })

  // 设置鼠标事件监听器
  const setupMouseListeners = () => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseleave', handleMouseLeave)
    document.removeEventListener('mouseenter', handleMouseEnter)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)
  }

  setupMouseListeners()

  watch(
    () => drawerStore.config.behavior.hideOnMouseLeave,
    (enabled) => {
      setupMouseListeners()
      if (enabled && drawerStore.isVisible && isMouseInside) {
        hasMouseEntered = true
      }
    }
  )

  watch(
    () => drawerStore.config.behavior.hideOnFocusLost,
    () => {
      setupFocusListener()
    }
  )

  watch(
    () => drawerStore.isVisible,
    (visible) => {
      if (visible && pendingFsRefresh) {
        scheduleFilesRefresh('drawer-visible')
      }
    }
  )

  // 批量选择模式时暂停自动隐藏
  watch(
    () => batchStore.isActive,
    (active) => {
      if (active) {
        suspendAutoHide()
      } else {
        resumeAutoHide()
      }
    }
  )

  watch(
    () => fileStore.loading,
    (loading) => {
      if (!loading && pendingFsRefresh && drawerStore.isVisible) {
        scheduleFilesRefresh('loading-finished')
      }
    }
  )

  // 监听 ESC 键
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('compositionstart', handleCompositionStart)
  document.addEventListener('compositionupdate', handleCompositionUpdate)
  document.addEventListener('compositionend', handleCompositionEnd)

  // 监听拖动事件
  document.addEventListener('mousedown', handleDocumentMouseDown)
  document.addEventListener('mouseup', handleDocumentMouseUp)

  // 加载视图模式设置
  const savedViewMode = localStorage.getItem('seconddesk_view_mode')
  if (savedViewMode === 'grid' || savedViewMode === 'list') {
    viewMode.value = savedViewMode
  }

  // 加载图标尺寸设置
  const savedIconSize = localStorage.getItem('seconddesk_icon_size')
  if (savedIconSize === 'small' || savedIconSize === 'medium' || savedIconSize === 'large') {
    iconSize.value = savedIconSize
  }

  // 加载主题设置
  const savedThemeMode = localStorage.getItem('seconddesk_theme_mode') || 'light'
  const savedThemeColor = localStorage.getItem('seconddesk_theme_color') || 'blue'
  const savedGlassPreset = localStorage.getItem('seconddesk_glass_preset') || 'standard'

  themeColor.value = savedThemeColor
  glassPreset.value = savedGlassPreset

  // 应用完整主题
  applyFullTheme(savedThemeMode)

  // 监听系统主题变化
  if (savedThemeMode === 'auto' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      applyFullTheme(savedThemeMode)
    })
  }

  await fileStore.loadFiles()

  // 加载背景图片设置
  const savedBackground = localStorage.getItem('seconddesk_background')
  if (savedBackground) {
    try {
      const bg = JSON.parse(savedBackground)
      backgroundImagePath.value = bg.path || null
      backgroundOpacity.value = bg.opacity ?? 30
      backgroundBlur.value = bg.blur ?? 0
    } catch (e) {
      console.error('加载背景图片设置失败', e)
    }
  }

  // 监听背景图片变化事件
  window.addEventListener('background-changed', ((event: CustomEvent) => {
    const { path, opacity, blur } = event.detail
    backgroundImagePath.value = path
    backgroundOpacity.value = opacity
    backgroundBlur.value = blur
  }) as EventListener)

  // 启动时自动隐藏：如果启用了自动隐藏，启动后先隐藏窗口
  // 用户通过托盘/快捷键/边缘触发来显示
  if (drawerStore.config.behavior.hideOnMouseLeave ||
      drawerStore.config.behavior.hideOnFocusLost) {
    setTimeout(async () => {
      await drawerStore.setState(DrawerState.Hidden)
    }, 100)
  }
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseleave', handleMouseLeave)
  document.removeEventListener('mouseenter', handleMouseEnter)
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousedown', handleDocumentMouseDown)
  document.removeEventListener('mouseup', handleDocumentMouseUp)
  document.removeEventListener('compositionstart', handleCompositionStart)
  document.removeEventListener('compositionupdate', handleCompositionUpdate)
  document.removeEventListener('compositionend', handleCompositionEnd)

  if (focusUnlisten) {
    focusUnlisten()
    focusUnlisten = null
  }
  if (unlistenDrawerToggle) {
    unlistenDrawerToggle()
    unlistenDrawerToggle = null
  }
  if (unlistenDrawerOpen) {
    unlistenDrawerOpen()
    unlistenDrawerOpen = null
  }
  if (unlistenOpenSettings) {
    unlistenOpenSettings()
    unlistenOpenSettings = null
  }
  if (unlistenFilesChanged) {
    unlistenFilesChanged()
    unlistenFilesChanged = null
  }
  if (unlistenWindowAdjustStart) {
    unlistenWindowAdjustStart()
    unlistenWindowAdjustStart = null
  }
  if (movedUnlisten) {
    movedUnlisten()
    movedUnlisten = null
  }
  if (mouseLeaveTimer !== null) {
    clearTimeout(mouseLeaveTimer)
    mouseLeaveTimer = null
  }
  if (focusLostTimer !== null) {
    clearTimeout(focusLostTimer)
    focusLostTimer = null
  }
  if (dragEndTimer !== null) {
    clearTimeout(dragEndTimer)
    dragEndTimer = null
  }
  if (justOpenedTimer !== null) {
    clearTimeout(justOpenedTimer)
    justOpenedTimer = null
  }
  if (fsRefreshTimer !== null) {
    clearTimeout(fsRefreshTimer)
    fsRefreshTimer = null
  }
})

function applyFullTheme(themeMode: string) {
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
  const colorTheme = COLOR_THEMES.find(t => t.id === themeColor.value) || COLOR_THEMES[0]
  // @ts-ignore - colors 类型在 config 中已更新，但在 App.vue 的推断中可能滞后，暂时忽略 TS 检查
  const colors = isDark ? colorTheme.dark : colorTheme.light

  // 获取毛玻璃设置
  let glass: GlassStyle
  if (glassPreset.value === 'custom') {
    const savedCustomGlass = localStorage.getItem('seconddesk_custom_glass')
    if (savedCustomGlass) {
      try {
        glass = JSON.parse(savedCustomGlass)
      } catch {
        glass = GLASS_PRESETS.standard
      }
    } else {
      glass = GLASS_PRESETS.standard
    }
  } else {
    glass = GLASS_PRESETS[glassPreset.value] || GLASS_PRESETS.standard
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
  // 使用主题配置中的特定背景色，而不是硬编码的灰度
  root.setProperty('--bg-base-rgb', bgBaseRgb)
  
  // 动态生成半透明背景色
  root.setProperty('--bg-primary', `rgba(${bgBaseRgb}, ${glass.opacity})`)
  root.setProperty('--bg-secondary', `rgba(${bgSecondaryRgb}, ${glass.opacitySecondary})`)
  
  if (isDark) {
    // --- Dark Mode ---
    root.setProperty('--hover-bg', 'rgba(255, 255, 255, 0.08)')
    
    // 文字 (使用主题定义的文本色，或者保留默认的高对比度)
    root.setProperty('--text-primary', colors.textPrimary || '#F1F5F9') 
    root.setProperty('--text-secondary', '#94A3B8') 
    root.setProperty('--text-tertiary', '#64748B') 
    
    // 边框 & 玻璃光效
    root.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)')
    root.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)')
    root.setProperty('--glass-shine', 'rgba(255, 255, 255, 0.05)')
    root.setProperty('--glass-highlight', 'rgba(255, 255, 255, 0.1)')
    
    // 阴影系统 (深色模式下阴影是黑色)
    root.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.3)')
    root.setProperty('--shadow-color-strong', 'rgba(0, 0, 0, 0.5)')
    
    // 遮罩
    root.setProperty('--modal-overlay-bg', 'rgba(0, 0, 0, 0.7)')
    
  } else {
    // --- Light Mode ---
    root.setProperty('--hover-bg', `rgba(${hexToRgb(colors.primary)}, 0.08)`) // 亮色模式下 Hover 带一点主色调
    
    // 文字
    root.setProperty('--text-primary', colors.textPrimary || '#0F172A')
    root.setProperty('--text-secondary', '#64748B')
    root.setProperty('--text-tertiary', '#94A3B8')
    
    // 边框 & 玻璃光效
    root.setProperty('--border-color', `rgba(${bgSecondaryRgb}, 0.5)`) // 边框也跟随背景色调
    root.setProperty('--glass-border', 'rgba(255, 255, 255, 0.6)')
    root.setProperty('--glass-shine', 'rgba(255, 255, 255, 0.4)')
    root.setProperty('--glass-highlight', 'rgba(255, 255, 255, 0.8)')
    
    // 阴影系统 (亮色模式下阴影带冷色调，或跟随主色)
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

function handleSearch() {
  bumpTypingSuspend(2500)
  fileStore.searchFiles(searchQuery.value)
}

function handleFileOpened() {
  // 检查是否启用了"打开后隐藏"
  if (drawerStore.config.behavior.hideOnOpen) {
    // 清除搜索状态
    searchQuery.value = ''
    fileStore.searchFiles('')

    // 隐藏窗口
    drawerStore.setState(DrawerState.Hidden)
    hasMouseEntered = false
  }
}

function handleSearchFocus() {
  isSearchFocused = true
}

function handleSearchBlur() {
  isSearchFocused = false

  // If the mouse is already outside, apply hide-on-mouseleave after leaving the search box.
  if (
    drawerStore.isVisible &&
    drawerStore.config.behavior.hideOnMouseLeave &&
    !isMouseInside &&
    hasMouseEntered &&
    !showSettings.value &&
    !isDragging &&
    !isAdjustingWindow.value &&
    !autoHideSuspended.value &&
    !isTypingSuspendActive()
  ) {
    drawerStore.setState(DrawerState.Hidden)
    hasMouseEntered = false
  }
}

function handleSearchKeyDown(e: KeyboardEvent) {
  bumpTypingSuspend(4000)

  // Some environments deliver composition events late; use keydown to give IME a grace period.
  if (e.isComposing || e.key === 'Process' || (e as unknown as { keyCode?: number }).keyCode === 229) {
    bumpTypingSuspend(5000)
  }
}

function handleRefresh() {
  fileStore.loadFiles()
}

function toggleIconSize() {
  const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large']
  const currentIndex = sizes.indexOf(iconSize.value)
  const nextIndex = (currentIndex + 1) % sizes.length
  iconSize.value = sizes[nextIndex]
  localStorage.setItem('seconddesk_icon_size', iconSize.value)
}

function openSettings() {
  showSettings.value = true
}

function closeSettings() {
  showSettings.value = false
}

// 批量选择相关事件处理
function handleOpenTargetPicker() {
  // 目标选择器打开时已由 batchStore 处理
}

function handleCloseTargetPicker() {
  batchStore.closeTargetPicker()
}

function handleOpenCreateCategory() {
  // 收集所有要添加的文件路径（支持虚拟分组）
  const allPaths: string[] = []

  for (const id of batchStore.selectedIdsArray) {
    if (id.startsWith('vf_')) {
      // 虚拟分组：把其成员文件添加到分类
      const members = fileStore.getVirtualFolderMembers(id)
      allPaths.push(...members.map(m => m.filePath))
    } else {
      // 普通文件
      allPaths.push(id)
    }
  }

  // 去重
  const uniquePaths = Array.from(new Set(allPaths))

  // 关闭目标选择器
  batchStore.closeTargetPicker()

  // 调用 CategoryTabs 的方法打开创建分类弹窗，预设选中的文件
  if (categoryTabsRef.value && uniquePaths.length > 0) {
    categoryTabsRef.value.openCreateModalWithFiles(uniquePaths)
  }

  // 退出批量选择模式
  batchStore.exitBatchSelect()
}

async function handleWatchPathChanged(path: string | null) {
  // 切换监控文件夹后，加载新路径的文件
  await fileStore.loadFiles(path ?? undefined)
}

function handleMouseMove() {
  // 鼠标移动时，标记为已进入
  if (drawerStore.isVisible) {
    hasMouseEntered = true
  }
}

function handleMouseEnter() {
  // 鼠标进入窗口时，标记为已进入
  isMouseInside = true
  hasMouseEntered = true

  // 取消待执行的隐藏
  if (mouseLeaveTimer !== null) {
    clearTimeout(mouseLeaveTimer)
    mouseLeaveTimer = null
  }
}

function handleMouseLeave() {
  isMouseInside = false
  if (isDragging || showSettings.value || isAdjustingWindow.value || autoHideSuspended.value) {
    return
  }

  if (isSearchFocused || isTypingSuspendActive()) {
    if (mouseLeaveTimer !== null) {
      clearTimeout(mouseLeaveTimer)
    }
    mouseLeaveTimer = window.setTimeout(() => {
      mouseLeaveTimer = null
      if (!drawerStore.isVisible) return
      if (!drawerStore.config.behavior.hideOnMouseLeave) return
      if (isMouseInside) return
      if (showSettings.value || isDragging || isAdjustingWindow.value || autoHideSuspended.value) return
      if (isSearchFocused || isTypingSuspendActive()) return
      if (!hasMouseEntered) return
      drawerStore.setState(DrawerState.Hidden)
      hasMouseEntered = false
    }, Math.max(400, typingSuspendUntil > Date.now() ? typingSuspendUntil - Date.now() + 50 : 0))
    return
  }

  // 只有在鼠标曾经进入过窗口后,才允许自动隐藏
  if (!hasMouseEntered) {
    return
  }

  if (drawerStore.isVisible && drawerStore.config.behavior.hideOnMouseLeave) {
    if (mouseLeaveTimer !== null) {
      clearTimeout(mouseLeaveTimer)
      mouseLeaveTimer = null
    }

    // 鼠标离开即隐藏
    drawerStore.setState(DrawerState.Hidden)
    hasMouseEntered = false  // 隐藏后重置状态
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (isComposing) {
    return
  }

  if (e.key === 'Escape') {
    // 优先退出批量选择模式
    if (batchStore.isActive) {
      batchStore.exitBatchSelect()
      return
    }

    // 然后处理窗口隐藏
    if (!autoHideSuspended.value && drawerStore.isVisible) {
      drawerStore.setState(DrawerState.Hidden)
    }
  }
}

async function saveWindowAdjustment() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_window_adjustable', { adjustable: false })
    isAdjustingWindow.value = false

    // 恢复之前的自动隐藏设置
    if (savedAutoHideSettings.value) {
      drawerStore.config.behavior.hideOnMouseLeave = savedAutoHideSettings.value.hideOnMouseLeave
      drawerStore.config.behavior.hideOnFocusLost = savedAutoHideSettings.value.hideOnFocusLost
      await drawerStore.saveConfig()
      savedAutoHideSettings.value = null
    }
  } catch (error) {
    console.error('保存窗口调整失败:', error)
  }
}
</script>

<template>
  <div id="app" class="app-container">
    <!-- 背景图片层 -->
    <div
      v-if="backgroundImageUrl"
      class="background-image-layer"
      :style="backgroundImageStyle"
    ></div>

    <!-- 顶部工具栏 -->
    <header class="app-header" data-tauri-drag-region>
      <div class="header-left" data-tauri-drag-region>
        <img class="app-logo" :src="appLogoUrl" alt="Second Desk" data-tauri-drag-region />
        <DateTimeDisplay data-tauri-drag-region />
        <button class="icon-btn no-drag" @click="handleRefresh" title="刷新">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>

      <div class="header-center" data-tauri-drag-region>
        <div class="search-box no-drag">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索..."
            @input="handleSearch"
            @focus="handleSearchFocus"
            @blur="handleSearchBlur"
            @keydown="handleSearchKeyDown"
          />
        </div>
      </div>

      <div class="header-right" data-tauri-drag-region>
        <button
          class="icon-btn no-drag"
          @click="toggleIconSize"
          :title="`图标尺寸: ${iconSize === 'small' ? '小' : iconSize === 'medium' ? '中' : '大'}`"
        >
          <svg v-if="iconSize === 'small'" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="7" y="7" width="10" height="10" rx="1"/>
          </svg>
          <svg v-else-if="iconSize === 'medium'" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="5" width="14" height="14" rx="1"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="1"/>
          </svg>
        </button>

        <button
          class="icon-btn no-drag"
          :class="{ active: viewMode === 'grid' }"
          @click="viewMode = 'grid'"
          title="网格视图"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </button>

        <button
          class="icon-btn no-drag"
          :class="{ active: viewMode === 'list' }"
          @click="viewMode = 'list'"
          title="列表视图"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </button>

        <button class="icon-btn no-drag" @click="openSettings" title="设置">
          <img :src="iconSettings" class="toolbar-icon" alt="设置" />
        </button>
      </div>
    </header>

    <!-- 分类标签 + 主内容区容器 -->
    <div class="tabs-content-wrapper">
      <!-- 分类标签 -->
      <CategoryTabs ref="categoryTabsRef" @auto-hide-suspend="suspendAutoHide" @auto-hide-resume="resumeAutoHide" />

      <!-- 主内容区 - 带毛玻璃背景 -->
      <main class="app-main">
        <FileGrid
          :view-mode="viewMode"
          :icon-size="iconSize"
          @auto-hide-suspend="suspendAutoHide"
          @auto-hide-resume="resumeAutoHide"
          @file-opened="handleFileOpened"
        />
      </main>
    </div>

    <!-- 窗口调整浮动按钮 -->
    <div v-if="isAdjustingWindow" class="window-adjust-controls">
      <div class="adjust-tip">
        <img :src="iconGear" class="tip-icon" alt="" />
        <span>拖动窗口调整位置</span>
      </div>
      <button class="save-btn no-drag" @click="saveWindowAdjustment">
        保存位置
      </button>
    </div>

    <!-- 设置面板 -->
    <SettingsPanel v-if="showSettings" @close="closeSettings" @watch-path-changed="handleWatchPathChanged" />

    <!-- 全局对话框 -->
    <GlobalDialog />

    <!-- 批量选择操作栏 -->
    <BatchActionBar
      @open-target-picker="handleOpenTargetPicker"
      @create-category="handleOpenCreateCategory"
    />

    <!-- 批量选择目标选择器 -->
    <MoveTargetPicker
      @close="handleCloseTargetPicker"
      @create-category="handleOpenCreateCategory"
    />
  </div>
</template>

<style scoped>
.app-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  /* 高级背景：微渐变模拟光照 */
  background: linear-gradient(
    135deg,
    var(--bg-primary) 0%,
    rgba(var(--bg-base-rgb), var(--bg-opacity-secondary)) 100%
  );
  backdrop-filter: blur(var(--blur-amount)) saturate(var(--saturation-amount));
  -webkit-backdrop-filter: blur(var(--blur-amount)) saturate(var(--saturation-amount));

  /* 容器圆角与物理边框 */
  border-radius: var(--radius-lg);
  box-shadow:
    var(--shadow-xl),
    inset 0 0 0 1px var(--glass-border), /* 内描边模拟玻璃厚度 */
    inset 0 1px 0 0 var(--glass-highlight); /* 顶部高光 */

  overflow: hidden;
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  transition: box-shadow 0.3s var(--ease-out-quad);
}

/* 背景图片层 */
.background-image-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  pointer-events: none;
  border-radius: var(--radius-lg);
}

/* 禁用拖动区域的交互元素 */
.no-drag {
  -webkit-app-region: no-drag;
}

/* 顶部工具栏 */
.app-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  z-index: 10;
  
  /* 独立的毛玻璃层 */
  background: rgba(var(--bg-base-rgb), 0.4);
  backdrop-filter: blur(12px); 
  border-bottom: 1px solid var(--glass-border);
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  gap: 1rem;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-logo {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  flex: 0 0 auto;
  box-shadow: var(--shadow-sm);
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

/* 搜索框 - 现代胶囊风格 */
.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: rgba(var(--bg-base-rgb), 0.3);
  border: 1px solid var(--border-color);
  border-radius: 99px; /* 胶囊圆角 */
  min-width: 320px;
  transition: all 0.2s var(--ease-out-quad);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.03);
}

.search-box:hover {
  background: rgba(var(--bg-base-rgb), 0.5);
  border-color: var(--text-tertiary);
}

.search-box:focus-within {
  background: var(--bg-primary);
  border-color: var(--primary-color);
  box-shadow: 
    var(--focus-glow),
    var(--shadow-md);
  transform: translateY(-1px);
}

.search-icon {
  color: var(--text-tertiary);
  transition: color 0.2s;
}

.search-box:focus-within .search-icon {
  color: var(--primary-color);
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  outline: none;
  width: 100%;
}

.search-box input::placeholder {
  color: var(--text-tertiary);
}

/* 图标按钮 - 纯净风格 */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s var(--ease-out-quad);
}

.icon-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.icon-btn:active {
  background: rgba(var(--primary-color-rgb), 0.1);
  transform: scale(0.96);
}

.icon-btn.active {
  background: rgba(var(--primary-color-rgb), 0.1);
  color: var(--primary-color);
  border-color: rgba(var(--primary-color-rgb), 0.2);
}

.toolbar-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

/* ==================== 标签页与内容区容器 ==================== */
.tabs-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

/* 主内容区 - 透明背景，无边框 */
.app-main {
  flex: 1;
  overflow: hidden;
  min-height: 0;
  display: flex;
  position: relative;
  /* 透明背景，与整体融为一体 */
  background: transparent;
}

/* 窗口调整浮动控制栏 */
.window-adjust-controls {
  position: fixed;
  top: 4rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--bg-primary);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 0.75rem 1.25rem;
  box-shadow: var(--shadow-xl);
  z-index: 9999;
  animation: slideDown 0.3s var(--ease-out-quad);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.adjust-tip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  user-select: none;
}

.tip-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.save-btn {
  padding: 0.5rem 1rem;
  background: var(--primary-color);
  color: var(--text-on-primary);
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.save-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(var(--primary-color-rgb), 0.2);
}

.save-btn:active {
  transform: translateY(0);
}
</style>
