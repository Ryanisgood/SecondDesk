<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { GLASS_PRESETS, COLOR_THEMES, type GlassStyle } from '../config/themes'
import { applyFullTheme as applyThemeUtil } from '../utils/theme'
import { useDrawerStore, DrawerSide } from '../stores/drawer'
import appLogoUrl from '../assets/app-logo.png'
import FolderCacheManager from './FolderCacheManager.vue'
import { useDialog } from '../composables/useDialog'
import { getIconPath } from '../utils/iconHelper'

// 图标路径
const iconGear = getIconPath('gear')
const iconThemes = getIconPath('themes')
const iconSun = getIconPath('sun')
const iconMoon = getIconPath('moon')
const iconRefresh = getIconPath('refresh')
const iconGrid = getIconPath('grid')
const iconList = getIconPath('list')
const iconLightBulb = getIconPath('light-bulb')
const iconOpenFolder = getIconPath('open-folder')
const iconWindow = getIconPath('window')
const iconDatabaseManagement = getIconPath('database-management')
const iconInfo = getIconPath('info')

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'watch-path-changed', path: string | null): void
}>()

const drawerStore = useDrawerStore()
const dialog = useDialog()

// 主题状态（精简为 5 种颜色）
type ThemeColor = 'blue' | 'green' | 'purple' | 'amber' | 'pink'
type ThemeMode = 'light' | 'dark' | 'auto'
type GlassPreset = 'clear' | 'standard' | 'deep' | 'minimal' | 'custom'

const themeMode = ref<ThemeMode>('light')
const themeColor = ref<ThemeColor>('blue')
const glassPreset = ref<GlassPreset>('standard')

// 自定义毛玻璃设置（使用百分比 0-100）
const customBlur = ref(20)
const customSaturation = ref(160)
const customOpacity = ref(85)
const customOpacitySecondary = ref(60)

// 其他设置保持不变
const autoStart = ref(false)
const showHiddenFiles = ref(false)
const confirmDelete = ref(true)
const viewMode = ref<'grid' | 'list'>('grid')
const showCacheManager = ref(false)

// 背景图片设置
const backgroundImagePath = ref<string | null>(null)
const backgroundOpacity = ref(30)
const backgroundBlur = ref(0)

// 从 localStorage 加载设置
onMounted(async () => {
  loadSettings()

  // 从后端加载开机自启状态
  await loadAutoStartStatus()

  // 监听系统主题变化
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleSystemThemeChange)
  }
})

function loadSettings() {
  try {
    // 加载主题模式
    const savedThemeMode = localStorage.getItem('seconddesk_theme_mode')
    if (savedThemeMode === 'light' || savedThemeMode === 'dark' || savedThemeMode === 'auto') {
      themeMode.value = savedThemeMode
    }

    // 加载主题颜色
    const savedColor = localStorage.getItem('seconddesk_theme_color')
    const validColors = COLOR_THEMES.map(t => t.id)
    if (savedColor && validColors.includes(savedColor)) {
      themeColor.value = savedColor as ThemeColor
    }

    // 加载毛玻璃预设
    const savedGlassPreset = localStorage.getItem('seconddesk_glass_preset')
    if (savedGlassPreset && (savedGlassPreset in GLASS_PRESETS || savedGlassPreset === 'custom')) {
      glassPreset.value = savedGlassPreset as GlassPreset
    }

    // 加载自定义毛玻璃设置
    const savedCustomGlass = localStorage.getItem('seconddesk_custom_glass')
    if (savedCustomGlass) {
      try {
        const custom = JSON.parse(savedCustomGlass)
        customBlur.value = custom.blur || 20
        customSaturation.value = custom.saturation || 160
        customOpacity.value = Math.round((custom.opacity || 0.85) * 100)
        customOpacitySecondary.value = Math.round((custom.opacitySecondary || 0.6) * 100)
      } catch (e) {
        console.error('加载自定义毛玻璃设置失败', e)
      }
    }

    // 应用主题
    triggerApplyTheme()

    const savedAutoStart = localStorage.getItem('seconddesk_autostart')
    if (savedAutoStart) {
      autoStart.value = savedAutoStart === 'true'
    }

    const savedShowHidden = localStorage.getItem('seconddesk_show_hidden')
    if (savedShowHidden) {
      showHiddenFiles.value = savedShowHidden === 'true'
    }

    const savedConfirmDelete = localStorage.getItem('seconddesk_confirm_delete')
    if (savedConfirmDelete) {
      confirmDelete.value = savedConfirmDelete === 'true'
    }

    const savedViewMode = localStorage.getItem('seconddesk_view_mode')
    if (savedViewMode === 'grid' || savedViewMode === 'list') {
      viewMode.value = savedViewMode
    }

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
  } catch (error) {
    console.error('加载设置失败：', error)
  }
}

function getEffectiveTheme(): 'light' | 'dark' {
  if (themeMode.value === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return themeMode.value
}

function getCustomGlassConfig(): GlassStyle | undefined {
  if (glassPreset.value === 'custom') {
    return {
      name: '自定义',
      blur: customBlur.value,
      saturation: customSaturation.value,
      opacity: customOpacity.value / 100,
      opacitySecondary: customOpacitySecondary.value / 100
    }
  }
  return undefined
}

function triggerApplyTheme() {
  applyThemeUtil(themeMode.value, themeColor.value, glassPreset.value, getCustomGlassConfig())
}

function handleSystemThemeChange() {
  if (themeMode.value === 'auto') {
    triggerApplyTheme()
  }
}

function handleThemeModeChange(newMode: ThemeMode) {
  themeMode.value = newMode
  localStorage.setItem('seconddesk_theme_mode', newMode)
  triggerApplyTheme()
}

function handleThemeColorChange(newColor: ThemeColor) {
  themeColor.value = newColor
  localStorage.setItem('seconddesk_theme_color', newColor)
  triggerApplyTheme()
}

function handleGlassPresetChange(preset: GlassPreset) {
  glassPreset.value = preset
  localStorage.setItem('seconddesk_glass_preset', preset)

  if (preset !== 'custom') {
    const presetConfig = GLASS_PRESETS[preset]
    customBlur.value = presetConfig.blur
    customSaturation.value = presetConfig.saturation
    customOpacity.value = Math.round(presetConfig.opacity * 100)
    customOpacitySecondary.value = Math.round(presetConfig.opacitySecondary * 100)
  }

  triggerApplyTheme()
}

function handleCustomGlassChange() {
  glassPreset.value = 'custom'
  localStorage.setItem('seconddesk_glass_preset', 'custom')

  const customGlass = {
    name: '自定义',
    blur: customBlur.value,
    saturation: customSaturation.value,
    opacity: customOpacity.value / 100,
    opacitySecondary: customOpacitySecondary.value / 100
  }

  localStorage.setItem('seconddesk_custom_glass', JSON.stringify(customGlass))
  triggerApplyTheme()
}

async function loadAutoStartStatus() {
  try {
    const enabled = await invoke<boolean>('get_auto_start')
    autoStart.value = enabled
    // 同步到 localStorage
    localStorage.setItem('seconddesk_autostart', enabled.toString())
  } catch (error) {
    console.error('加载开机自启状态失败：', error)
    // 如果获取失败，从 localStorage 读取
    const savedAutoStart = localStorage.getItem('seconddesk_autostart')
    if (savedAutoStart) {
      autoStart.value = savedAutoStart === 'true'
    }
  }
}

async function handleAutoStartChange(value: boolean) {
  try {
    await invoke('set_auto_start', { enabled: value })
    autoStart.value = value
    localStorage.setItem('seconddesk_autostart', value.toString())
    await dialog.success(value ? '已开启开机自启动' : '已关闭开机自启动')
  } catch (error) {
    await dialog.error(`设置开机自启失败：${error}`)
    // 恢复原状态
    autoStart.value = !value
  }
}

function handleShowHiddenChange(value: boolean) {
  showHiddenFiles.value = value
  localStorage.setItem('seconddesk_show_hidden', value.toString())
  // 刷新文件列表
  window.location.reload()
}

function handleConfirmDeleteChange(value: boolean) {
  confirmDelete.value = value
  localStorage.setItem('seconddesk_confirm_delete', value.toString())
}

// 文件监控配置函数
async function handleFileWatcherEnabledChange(enabled: boolean) {
  drawerStore.config.fileWatcher.enabled = enabled
  await drawerStore.saveConfig()
}

async function handleSelectWatchPath() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const { getCurrentWindow } = await import('@tauri-apps/api/window')

    // 隐藏窗口以便选择文件夹
    const appWindow = getCurrentWindow()
    await appWindow.hide()

    try {
      const selectedPath = await invoke<string | null>('select_folder')
      if (selectedPath) {
        drawerStore.config.fileWatcher.customPath = selectedPath
        await drawerStore.saveConfig()
        emit('watch-path-changed', selectedPath)
      }
    } finally {
      // 无论成功还是取消，都重新显示窗口
      await appWindow.show()
      await appWindow.setFocus()
    }
  } catch (error) {
    console.error('选择文件夹失败:', error)
    await dialog.error(`选择文件夹失败: ${error}`)
  }
}

async function handleResetWatchPath() {
  drawerStore.config.fileWatcher.customPath = null
  await drawerStore.saveConfig()
  emit('watch-path-changed', null)
}

function handleViewModeChange(mode: 'grid' | 'list') {
  viewMode.value = mode
  localStorage.setItem('seconddesk_view_mode', mode)
  // 刷新页面以应用视图模式
  window.location.reload()
}

// 背景图片相关函数
function saveBackgroundSettings() {
  const config = {
    path: backgroundImagePath.value,
    opacity: backgroundOpacity.value,
    blur: backgroundBlur.value
  }
  localStorage.setItem('seconddesk_background', JSON.stringify(config))
  // 触发 App.vue 更新背景
  window.dispatchEvent(new CustomEvent('background-changed', { detail: config }))
}

async function handleSelectBackgroundImage() {
  try {
    const path = await invoke<string | null>('select_background_image')
    if (path) {
      backgroundImagePath.value = path
      saveBackgroundSettings()
    }
  } catch (error) {
    await dialog.error(`选择图片失败：${error}`)
  }
}

function handleClearBackgroundImage() {
  backgroundImagePath.value = null
  saveBackgroundSettings()
}

function handleBackgroundSettingsChange() {
  saveBackgroundSettings()
}

// 计算背景图片预览 URL
const backgroundImageUrl = computed(() => {
  if (!backgroundImagePath.value) return undefined
  return convertFileSrc(backgroundImagePath.value)
})

async function handleClearCache() {
  const confirmed = await dialog.confirmDanger(
    '确定要清除所有缓存数据吗？这将清除收藏、分类等所有设置。',
    { title: '清除缓存' }
  )
  if (confirmed) {
    try {
      // 清除所有 seconddesk 相关的 localStorage
      const keys = Object.keys(localStorage).filter(k => k.startsWith('seconddesk_'))
      keys.forEach(key => localStorage.removeItem(key))

      await dialog.success('缓存已清除，应用将刷新')
      window.location.reload()
    } catch (error) {
      await dialog.error(`清除缓存失败：${error}`)
    }
  }
}

async function handleResetSettings() {
  const confirmed = await dialog.confirm('确定要重置所有设置为默认值吗？', { title: '重置设置' })
  if (confirmed) {
    // 重置所有设置
    handleThemeModeChange('light')
    handleThemeColorChange('blue')
    handleGlassPresetChange('standard')
    await handleAutoStartChange(false)
    showHiddenFiles.value = false
    localStorage.setItem('seconddesk_show_hidden', 'false')
    handleConfirmDeleteChange(true)
    handleViewModeChange('grid')

    await dialog.success('设置已重置')
  }
}

function handleClose() {
  emit('close')
}

// 抽屉配置函数
async function handleEdgeTriggerChange(enabled: boolean) {
  drawerStore.config.edgeTrigger.enabled = enabled
  await drawerStore.saveConfig()
}

async function handleDrawerSideChange(side: DrawerSide) {
  drawerStore.config.edgeTrigger.side = side
  await drawerStore.saveConfig()
}

async function handleDelayChange(delay: number) {
  drawerStore.config.edgeTrigger.delayMs = delay
  await drawerStore.saveConfig()
}

async function handlePeekSizeChange(size: number) {
  drawerStore.config.edgeTrigger.peekSize = size
  await drawerStore.saveConfig()
}

async function handleHotkeyEnabledChange(enabled: boolean) {
  drawerStore.config.hotkey.enabled = enabled
  await drawerStore.saveConfig()
}

async function handleAnimationDurationChange(duration: number) {
  drawerStore.config.animation.duration = duration
  await drawerStore.saveConfig()
}

// 自动隐藏模式: 'none' | 'mouse' | 'focus'
type AutoHideMode = 'none' | 'mouse' | 'focus'

const autoHideMode = computed<AutoHideMode>(() => {
  const { hideOnMouseLeave, hideOnFocusLost } = drawerStore.config.behavior
  if (hideOnMouseLeave) return 'mouse'
  if (hideOnFocusLost) return 'focus'
  return 'none'
})

async function setAutoHideMode(mode: AutoHideMode) {
  switch (mode) {
    case 'none':
      drawerStore.config.behavior.hideOnMouseLeave = false
      drawerStore.config.behavior.hideOnFocusLost = false
      break
    case 'mouse':
      drawerStore.config.behavior.hideOnMouseLeave = true
      drawerStore.config.behavior.hideOnFocusLost = false
      break
    case 'focus':
      drawerStore.config.behavior.hideOnMouseLeave = false
      drawerStore.config.behavior.hideOnFocusLost = true
      break
  }
  await drawerStore.saveConfig()
}

async function handleDisableInFullscreenChange(enabled: boolean) {
  drawerStore.config.behavior.disableInFullscreen = enabled
  await drawerStore.saveConfig()
}

async function handleHideOnOpenChange(enabled: boolean) {
  drawerStore.config.behavior.hideOnOpen = enabled
  await drawerStore.saveConfig()
}

async function startWindowAdjustment() {
  emit('close')

  await new Promise(resolve => setTimeout(resolve, 100))

  try {
    // 保存当前的自动隐藏设置
    const previousAutoHideSettings = {
      hideOnMouseLeave: drawerStore.config.behavior.hideOnMouseLeave,
      hideOnFocusLost: drawerStore.config.behavior.hideOnFocusLost,
    }

    // 临时禁用自动隐藏
    drawerStore.config.behavior.hideOnMouseLeave = false
    drawerStore.config.behavior.hideOnFocusLost = false
    await drawerStore.saveConfig()

    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_window_adjustable', { adjustable: true })

    const { emit: emitEvent } = await import('@tauri-apps/api/event')
    await emitEvent('window-adjust-start', previousAutoHideSettings)
  } catch (error) {
    console.error('启用窗口调整失败:', error)
  }
}

// 快捷键配置
const isCapturingHotkey = ref(false)
const capturedKeys = ref<string[]>([])

function startCaptureHotkey() {
  isCapturingHotkey.value = true
  capturedKeys.value = []
}

function handleKeyDown(e: KeyboardEvent) {
  if (!isCapturingHotkey.value) return

  e.preventDefault()
  e.stopPropagation()

  const keys: string[] = []

  // 修饰键
  if (e.ctrlKey || e.metaKey) keys.push(e.metaKey && !e.ctrlKey ? 'Command' : 'Ctrl')
  if (e.altKey) keys.push('Alt')
  if (e.shiftKey) keys.push('Shift')

  // 主键（排除纯修饰键）
  if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift' && e.key !== 'Meta') {
    const mainKey = e.key.length === 1 ? e.key.toUpperCase() : e.key
    if (!keys.includes(mainKey)) {
      keys.push(mainKey)
    }
  }

  capturedKeys.value = keys
}

async function handleKeyUp(e: KeyboardEvent) {
  if (!isCapturingHotkey.value) return

  e.preventDefault()
  e.stopPropagation()

  // 确保至少有一个主键（不只是修饰键）
  if (capturedKeys.value.length > 0) {
    const hasMainKey = capturedKeys.value.some(key =>
      key !== 'Ctrl' && key !== 'Alt' && key !== 'Shift' && key !== 'Command'
    )

    if (hasMainKey) {
      const hotkeyString = capturedKeys.value.join('+')
      drawerStore.config.hotkey.keys = hotkeyString
      await drawerStore.saveConfig()
      isCapturingHotkey.value = false
      capturedKeys.value = []

      // 提示用户需要重启应用才能生效
      await dialog.info('快捷键已更新，需要重启应用才能生效', { title: '快捷键设置' })
    }
  }
}

function cancelCaptureHotkey() {
  isCapturingHotkey.value = false
  capturedKeys.value = []
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
})

// 注意：需要在组件卸载时清理事件监听
// 但由于这是设置面板，通常不会频繁创建/销毁，所以暂时省略
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="settings-panel">
      <div class="settings-header">
        <h2 class="settings-title"><img :src="iconGear" class="section-icon" alt="" /> 设置</h2>
        <button class="close-btn" @click="handleClose">✕</button>
      </div>

      <div class="settings-content">
        <!-- 外观设置 -->
        <div class="settings-section">
          <h3 class="section-title"><img :src="iconThemes" class="section-icon" alt="" /> 外观</h3>

          <div class="setting-item">
            <div class="setting-label">主题模式</div>
            <div class="theme-mode-selector">
              <button
                :class="['mode-btn', { active: themeMode === 'light' }]"
                @click="handleThemeModeChange('light')"
                title="亮色模式"
              >
                <img :src="iconSun" class="btn-icon" alt="" /> 亮色
              </button>
              <button
                :class="['mode-btn', { active: themeMode === 'dark' }]"
                @click="handleThemeModeChange('dark')"
                title="暗色模式"
              >
                <img :src="iconMoon" class="btn-icon" alt="" /> 暗色
              </button>
              <button
                :class="['mode-btn', { active: themeMode === 'auto' }]"
                @click="handleThemeModeChange('auto')"
                title="跟随系统"
              >
                <img :src="iconRefresh" class="btn-icon" alt="" /> 系统
              </button>
            </div>
          </div>

          <div class="setting-item color-setting">
            <div class="setting-label">主题颜色</div>
            <div class="color-selector">
              <button
                v-for="theme in COLOR_THEMES"
                :key="theme.id"
                :class="['color-btn', { active: themeColor === theme.id }]"
                :style="{ background: getEffectiveTheme() === 'dark' ? theme.dark.primary : theme.light.primary }"
                @click="handleThemeColorChange(theme.id as ThemeColor)"
                :title="theme.name"
              >
                <span v-if="themeColor === theme.id" class="check-icon">✓</span>
              </button>
            </div>
          </div>

          <div class="setting-item glass-setting">
            <div class="setting-label">毛玻璃风格</div>
            <div class="glass-presets">
              <button
                v-for="(preset, key) in GLASS_PRESETS"
                :key="key"
                :class="['preset-btn', { active: glassPreset === key }]"
                @click="handleGlassPresetChange(key as GlassPreset)"
              >
                {{ preset.name }}
              </button>
              <button
                :class="['preset-btn', { active: glassPreset === 'custom' }]"
                @click="glassPreset = 'custom'"
              >
                自定义
              </button>
            </div>
          </div>

          <!-- 自定义毛玻璃控制 -->
          <div v-if="glassPreset === 'custom'" class="setting-item custom-glass">
            <div class="glass-controls">
              <div class="control-item">
                <label class="control-label">
                  <span>模糊强度</span>
                  <span class="control-value">{{ customBlur }}px</span>
                </label>
                <input
                  type="range"
                  v-model.number="customBlur"
                  min="0"
                  max="40"
                  step="2"
                  @input="handleCustomGlassChange"
                  class="range-slider"
                />
              </div>

              <div class="control-item">
                <label class="control-label">
                  <span>饱和度</span>
                  <span class="control-value">{{ customSaturation }}%</span>
                </label>
                <input
                  type="range"
                  v-model.number="customSaturation"
                  min="100"
                  max="200"
                  step="10"
                  @input="handleCustomGlassChange"
                  class="range-slider"
                />
              </div>

              <div class="control-item">
                <label class="control-label">
                  <span>主背景不透明度</span>
                  <span class="control-value">{{ customOpacity }}%</span>
                </label>
                <input
                  type="range"
                  v-model.number="customOpacity"
                  min="60"
                  max="100"
                  step="5"
                  @input="handleCustomGlassChange"
                  class="range-slider"
                />
              </div>

              <div class="control-item">
                <label class="control-label">
                  <span>次背景不透明度</span>
                  <span class="control-value">{{ customOpacitySecondary }}%</span>
                </label>
                <input
                  type="range"
                  v-model.number="customOpacitySecondary"
                  min="40"
                  max="100"
                  step="5"
                  @input="handleCustomGlassChange"
                  class="range-slider"
                />
              </div>
            </div>
          </div>

          <!-- 背景图片设置 -->
          <div class="setting-item background-setting">
            <div class="setting-label">背景图片</div>
            <div class="background-controls">
              <button
                v-if="!backgroundImagePath"
                class="action-btn small-btn"
                @click="handleSelectBackgroundImage"
              >
                选择图片
              </button>
              <template v-else>
                <div class="background-preview">
                  <img :src="backgroundImageUrl" alt="背景预览" />
                </div>
                <button class="action-btn small-btn danger-btn" @click="handleClearBackgroundImage">
                  清除
                </button>
              </template>
            </div>
          </div>

          <!-- 背景图片调整（有图片时显示） -->
          <div v-if="backgroundImagePath" class="setting-item custom-background">
            <div class="glass-controls">
              <div class="control-item">
                <label class="control-label">
                  <span>图片不透明度</span>
                  <span class="control-value">{{ backgroundOpacity }}%</span>
                </label>
                <input
                  type="range"
                  v-model.number="backgroundOpacity"
                  min="10"
                  max="100"
                  step="5"
                  @input="handleBackgroundSettingsChange"
                  class="range-slider"
                />
              </div>
              <div class="control-item">
                <label class="control-label">
                  <span>图片模糊度</span>
                  <span class="control-value">{{ backgroundBlur }}px</span>
                </label>
                <input
                  type="range"
                  v-model.number="backgroundBlur"
                  min="0"
                  max="20"
                  step="1"
                  @input="handleBackgroundSettingsChange"
                  class="range-slider"
                />
              </div>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-label">默认视图</div>
            <div class="view-selector">
              <button
                :class="['view-btn', { active: viewMode === 'grid' }]"
                @click="handleViewModeChange('grid')"
              >
                <img :src="iconGrid" class="btn-icon" alt="" /> 网格
              </button>
              <button
                :class="['view-btn', { active: viewMode === 'list' }]"
                @click="handleViewModeChange('list')"
              >
                <img :src="iconList" class="btn-icon" alt="" /> 列表
              </button>
            </div>
          </div>
        </div>

        <!-- 行为设置 -->
        <div class="settings-section">
          <h3 class="section-title"><img :src="iconLightBulb" class="section-icon" alt="" /> 行为</h3>

          <div class="setting-item">
            <div class="setting-label">开机自启动</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="autoStart"
                @change="handleAutoStartChange(!autoStart)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-label">显示隐藏文件</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="showHiddenFiles"
                @change="handleShowHiddenChange(!showHiddenFiles)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-label">删除前确认</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="confirmDelete"
                @change="handleConfirmDeleteChange(!confirmDelete)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 文件监控设置 -->
        <div class="settings-section">
          <h3 class="section-title"><img :src="iconOpenFolder" class="section-icon" alt="" /> 文件监控</h3>

          <div class="setting-item">
            <div class="setting-label">启用实时监控</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="drawerStore.config.fileWatcher.enabled"
                @change="handleFileWatcherEnabledChange(!drawerStore.config.fileWatcher.enabled)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div v-if="drawerStore.config.fileWatcher.enabled" class="sub-settings">
            <div class="setting-item column">
              <div class="setting-label">监控文件夹</div>
              <div class="path-input-group">
                <input
                  type="text"
                  class="path-input"
                  :value="drawerStore.config.fileWatcher.customPath || '桌面（默认）'"
                  :readonly="true"
                  :placeholder="'桌面（默认）'"
                />
                <button
                  class="path-btn"
                  @click="handleSelectWatchPath"
                >
                  选择
                </button>
                <button
                  v-if="drawerStore.config.fileWatcher.customPath"
                  class="path-btn reset"
                  @click="handleResetWatchPath"
                >
                  重置
                </button>
              </div>
              <div class="setting-hint">
                选择自定义文件夹进行监控，重置后监控桌面
              </div>
            </div>
          </div>
        </div>

        <!-- 抽屉触发设置 -->
        <div class="settings-section">
          <h3 class="section-title"><img :src="iconWindow" class="section-icon" alt="" /> 抽屉触发</h3>

          <div class="setting-item">
            <div class="setting-label">边缘触发</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="drawerStore.config.edgeTrigger.enabled"
                @change="handleEdgeTriggerChange(!drawerStore.config.edgeTrigger.enabled)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div v-if="drawerStore.config.edgeTrigger.enabled" class="sub-settings">
            <div class="setting-item">
              <div class="setting-label">触发边缘</div>
              <div class="side-selector">
                <button
                  :class="['side-btn', { active: drawerStore.config.edgeTrigger.side === DrawerSide.Left }]"
                  @click="handleDrawerSideChange(DrawerSide.Left)"
                >
                  ⬅️ 左侧
                </button>
                <button
                  :class="['side-btn', { active: drawerStore.config.edgeTrigger.side === DrawerSide.Right }]"
                  @click="handleDrawerSideChange(DrawerSide.Right)"
                >
                  ➡️ 右侧
                </button>
                <button
                  :class="['side-btn', { active: drawerStore.config.edgeTrigger.side === DrawerSide.Top }]"
                  @click="handleDrawerSideChange(DrawerSide.Top)"
                >
                  ⬆️ 顶部
                </button>
                <button
                  :class="['side-btn', { active: drawerStore.config.edgeTrigger.side === DrawerSide.Bottom }]"
                  @click="handleDrawerSideChange(DrawerSide.Bottom)"
                >
                  ⬇️ 底部
                </button>
              </div>
            </div>

            <div class="setting-item">
              <div class="setting-label">触发延迟 ({{ drawerStore.config.edgeTrigger.delayMs }}ms)</div>
              <input
                type="range"
                v-model.number="drawerStore.config.edgeTrigger.delayMs"
                min="100"
                max="1000"
                step="50"
                @change="handleDelayChange(drawerStore.config.edgeTrigger.delayMs)"
                class="range-slider"
              />
            </div>

            <div class="setting-item">
              <div class="setting-label">预览大小 ({{ drawerStore.config.edgeTrigger.peekSize }}px)</div>
              <input
                type="range"
                v-model.number="drawerStore.config.edgeTrigger.peekSize"
                min="50"
                max="300"
                step="10"
                @change="handlePeekSizeChange(drawerStore.config.edgeTrigger.peekSize)"
                class="range-slider"
              />
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-label">全局快捷键</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="drawerStore.config.hotkey.enabled"
                @change="handleHotkeyEnabledChange(!drawerStore.config.hotkey.enabled)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div v-if="drawerStore.config.hotkey.enabled" class="sub-settings">
            <div class="setting-item hotkey-setting">
              <div class="setting-label">快捷键组合</div>
              <div class="hotkey-input-wrapper">
                <button
                  v-if="!isCapturingHotkey"
                  class="hotkey-display"
                  @click="startCaptureHotkey"
                >
                  {{ drawerStore.config.hotkey.keys }}
                </button>
                <div v-else class="hotkey-capture">
                  <div class="capture-display">
                    {{ capturedKeys.length > 0 ? capturedKeys.join(' + ') : '按下快捷键...' }}
                  </div>
                  <button class="cancel-btn" @click="cancelCaptureHotkey">取消</button>
                </div>
              </div>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-label">动画速度 ({{ drawerStore.config.animation.duration }}ms)</div>
            <input
              type="range"
              v-model.number="drawerStore.config.animation.duration"
              min="100"
              max="500"
              step="50"
              @change="handleAnimationDurationChange(drawerStore.config.animation.duration)"
              class="range-slider"
            />
          </div>

          <div class="setting-item auto-hide-setting">
            <div class="setting-label">自动隐藏模式</div>
            <div class="auto-hide-modes">
              <button
                :class="['mode-option-btn', { active: autoHideMode === 'none' }]"
                @click="setAutoHideMode('none')"
              >
                禁用
              </button>
              <button
                :class="['mode-option-btn', { active: autoHideMode === 'mouse' }]"
                @click="setAutoHideMode('mouse')"
              >
                鼠标离开
              </button>
              <button
                :class="['mode-option-btn', { active: autoHideMode === 'focus' }]"
                @click="setAutoHideMode('focus')"
              >
                窗口失焦
              </button>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-label">打开文件后隐藏</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="drawerStore.config.behavior.hideOnOpen"
                @change="handleHideOnOpenChange(!drawerStore.config.behavior.hideOnOpen)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-label">全屏时禁用</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="drawerStore.config.behavior.disableInFullscreen"
                @change="handleDisableInFullscreenChange(!drawerStore.config.behavior.disableInFullscreen)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="setting-item window-adjust-setting">
            <div class="setting-label">窗口位置</div>
            <button class="adjust-window-btn" @click="startWindowAdjustment">
              调整位置与大小
            </button>
          </div>
        </div>

        <!-- 数据管理 -->
        <div class="settings-section">
          <h3 class="section-title"><img :src="iconDatabaseManagement" class="section-icon" alt="" /> 数据管理</h3>

          <!-- 文件夹缓存管理 -->
          <div class="setting-item">
            <div class="setting-label">文件夹缓存管理</div>
            <button class="action-btn small-btn" @click="showCacheManager = true">
              管理
            </button>
          </div>

          <!-- 合并为一行两列 -->
          <div class="data-management-grid">
            <div class="setting-item column-item">
              <div class="setting-label">清除全部缓存</div>
              <button class="action-btn danger small-btn" @click="handleClearCache">
                执行
              </button>
            </div>

            <div class="setting-item column-item">
              <div class="setting-label">重置设置</div>
              <button class="action-btn small-btn" @click="handleResetSettings">
                执行
              </button>
            </div>
          </div>
        </div>

        <!-- 关于 -->
        <div class="settings-section">
          <h3 class="section-title"><img :src="iconInfo" class="section-icon" alt="" /> 关于</h3>

          <div class="about-info">
            <img class="about-logo" :src="appLogoUrl" alt="Second Desk" />
            <div class="app-name">Second Desk</div>
            <div class="app-version">版本 0.1.0</div>
            <div class="app-desc">基于 Rust + Tauri 的高性能桌面文件管理工具</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 文件夹缓存管理弹窗 -->
    <FolderCacheManager v-if="showCacheManager" @close="showCacheManager = false" />
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-overlay-bg);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1.5rem;
  animation: fadeIn 0.2s var(--ease-out-quad);
}

.settings-panel {
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  
  background: var(--bg-primary);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUpFade 0.3s var(--ease-out-quad);
}

/* Header */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: rgba(var(--bg-base-rgb), 0.2);
}

.settings-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* 图标样式 */
.section-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  vertical-align: middle;
}

.btn-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  vertical-align: middle;
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(var(--bg-base-rgb), 0.1);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.close-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
  transform: rotate(90deg);
}

/* Content Area */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  scroll-behavior: smooth;
}

.settings-section {
  margin-bottom: 2rem;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.section-title {
  margin: 0 0 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  padding-left: 0.25rem;
}

/* Card Style for Setting Items */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-radius: var(--radius-lg);
  background: rgba(var(--bg-base-rgb), 0.03);
  border: 1px solid var(--border-color);
  margin-bottom: 0.625rem;
  transition: background 0.2s;
}

.setting-item:hover {
  background: rgba(var(--bg-base-rgb), 0.06);
  border-color: rgba(var(--text-primary), 0.1);
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-label {
  font-size: 0.938rem;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  padding-right: 1rem;
  white-space: nowrap;
}

/* Controls: Theme Selectors */
.theme-mode-selector,
.view-selector {
  display: flex;
  gap: 0.375rem;
  background: rgba(var(--bg-base-rgb), 0.1);
  padding: 0.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.mode-btn,
.view-btn {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.813rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.mode-btn:hover,
.view-btn:hover {
  color: var(--text-primary);
  background: rgba(var(--bg-base-rgb), 0.1);
}

.mode-btn.active,
.view-btn.active {
  background: var(--primary-color);
  color: #fff;
  box-shadow: var(--shadow-sm);
}

/* Color Selector */
.color-setting {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.color-selector {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}

.color-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: var(--bg-primary);
  box-shadow: 0 0 0 2px var(--text-primary);
  transform: scale(1.15);
}

.check-icon {
  color: #fff;
  font-size: 0.875rem;
  font-weight: bold;
}

/* Glass Presets */
.glass-setting {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.glass-presets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 0.5rem;
  width: 100%;
}

.preset-btn {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.813rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.preset-btn:hover {
  background: var(--hover-bg);
  border-color: var(--text-tertiary);
}

.preset-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
  font-weight: 500;
  box-shadow: var(--shadow-sm);
}

/* Sliders */
.range-slider {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--border-color);
  outline: none;
  -webkit-appearance: none;
  cursor: pointer;
  margin-top: 0.25rem;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--bg-primary);
  border: 2px solid var(--primary-color);
  cursor: pointer;
  transition: transform 0.2s;
  box-shadow: var(--shadow-sm);
}

.range-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--border-color);
  border-radius: 24px;
  transition: all 0.3s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--primary-color);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

/* Sub-settings */
.sub-settings {
  margin-top: -0.5rem;
  margin-bottom: 0.625rem;
  padding: 0.75rem;
  background: rgba(var(--bg-base-rgb), 0.02);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  border: 1px solid var(--border-color);
  border-top: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Path input group */
.path-input-group {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

.path-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 0.875rem;
  min-width: 0;
  text-overflow: ellipsis;
}

.path-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.path-btn:hover {
  background: var(--hover-bg);
  border-color: var(--primary-color);
}

.path-btn.reset {
  color: var(--text-tertiary);
}

.path-btn.reset:hover {
  color: var(--text-primary);
}

.setting-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.25rem;
}

.setting-item.column {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

/* Data Management Grid */
.data-management-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  width: 100%;
}

.column-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  height: 100%;
}

/* Buttons */
.action-btn {
  width: 100%;
  padding: 0.625rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.action-btn:hover {
  background: var(--hover-bg);
  border-color: var(--text-tertiary);
}

.action-btn.danger {
  color: var(--danger-color);
  border-color: rgba(239, 68, 68, 0.3);
}

.action-btn.danger:hover {
  background: var(--danger-color);
  color: #fff;
  border-color: var(--danger-color);
}

.small-btn {
  padding: 0.5rem;
  font-size: 0.813rem;
}

/* Auto Hide Modes */
.auto-hide-setting {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.auto-hide-modes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  width: 100%;
}

.mode-option-btn {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.813rem;
  transition: all 0.2s;
  text-align: center;
}

.mode-option-btn:hover {
  background: var(--hover-bg);
}

.mode-option-btn.active {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
  box-shadow: var(--shadow-sm);
  font-weight: 500;
}

/* About Section */
.about-info {
  text-align: center;
  padding: 1rem;
}

.about-logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  margin-bottom: 0.75rem;
  box-shadow: var(--shadow-md);
}

.app-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.app-version {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-bottom: 0.5rem;
}

/* Side Selector (Drawer) */
.side-selector {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  width: 100%;
}

.side-btn {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.813rem;
  cursor: pointer;
  transition: all 0.2s;
}

.side-btn:hover {
  background: var(--hover-bg);
}

.side-btn.active {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
  font-weight: 500;
}

/* Custom Glass Controls */
.custom-glass {
  flex-direction: column;
  align-items: flex-start;
}

/* Background Image Settings */
.background-setting {
  justify-content: space-between;
}

.background-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.background-preview {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.background-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.custom-background {
  flex-direction: column;
  align-items: flex-start;
}

.small-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.danger-btn {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.danger-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.glass-controls {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.control-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.813rem;
  color: var(--text-secondary);
}

.control-value {
  font-weight: 600;
  color: var(--primary-color);
  min-width: 40px;
  text-align: right;
}

/* Window Adjust */
.window-adjust-setting {
  justify-content: space-between;
}

.adjust-window-btn {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.813rem;
  cursor: pointer;
  transition: all 0.2s;
}

.adjust-window-btn:hover {
  background: var(--hover-bg);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

/* Scrollbar */
.settings-content::-webkit-scrollbar {
  width: 4px;
}

.settings-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 2px;
}
</style>
