import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface WatchPathEntry {
  id: string        // 桌面为 "__desktop__"，自定义为 "wp_" + timestamp
  path: string      // 文件系统路径
  enabled: boolean  // 是否启用
  label: string | null  // 显示名称（null 则用文件夹名）
  builtin: boolean  // 是否内置路径（桌面），不可删除
}

const ACTIVE_VIEW_STORAGE_KEY = 'seconddesk_active_view_path'
const DESKTOP_VIEW_ID = '__desktop__'
const ALL_VIEW_ID = '__all__'
const MAX_WATCH_PATHS = 3

export const useWatchPathsStore = defineStore('watchPaths', () => {
  // 状态：包含所有路径（桌面 + 自定义）
  const watchPaths = ref<WatchPathEntry[]>([])
  const activeViewId = ref<string>(
    localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY) || DESKTOP_VIEW_ID
  )

  // 计算属性
  const isAllView = computed(() => activeViewId.value === ALL_VIEW_ID)
  const isDesktopView = computed(() => activeViewId.value === DESKTOP_VIEW_ID)

  /** 桌面内置条目 */
  const desktopEntry = computed(() => watchPaths.value.find(wp => wp.builtin))

  /** 自定义路径（非内置） */
  const customPaths = computed(() => watchPaths.value.filter(wp => !wp.builtin))

  /** 所有启用的路径 */
  const enabledPaths = computed(() => watchPaths.value.filter(wp => wp.enabled))

  /** 是否可以添加更多路径 */
  const canAddPath = computed(() => watchPaths.value.length < MAX_WATCH_PATHS)

  /** 当前活跃视图的显示名 */
  const activeViewLabel = computed(() => {
    if (isAllView.value) return '所有文件夹'

    const entry = watchPaths.value.find(wp => wp.id === activeViewId.value)
    if (entry) {
      if (entry.builtin) return '桌面'
      return entry.label || getPathFolderName(entry.path)
    }
    return '桌面'
  })

  // 方法
  function getPathFolderName(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || path
  }

  function getEntryLabel(entry: WatchPathEntry): string {
    if (entry.builtin) return '桌面'
    return entry.label || getPathFolderName(entry.path)
  }

  /** 判断某个条目能否被禁用（至少保留1个启用） */
  function canDisable(pathId: string): boolean {
    const enabledCount = watchPaths.value.filter(wp => wp.enabled && wp.id !== pathId).length
    return enabledCount >= 1
  }

  async function loadWatchPaths() {
    try {
      watchPaths.value = await invoke<WatchPathEntry[]>('get_watch_paths')
    } catch (error) {
      console.error('加载监控路径失败:', error)
    }

    // 验证 activeViewId 仍然有效
    if (
      activeViewId.value !== ALL_VIEW_ID &&
      !watchPaths.value.some(wp => wp.id === activeViewId.value)
    ) {
      // 回退到第一个启用的路径
      const firstEnabled = watchPaths.value.find(wp => wp.enabled)
      setActiveView(firstEnabled?.id || DESKTOP_VIEW_ID)
    }
  }

  async function addPath(path: string, label?: string): Promise<WatchPathEntry | null> {
    try {
      const entry = await invoke<WatchPathEntry>('add_watch_path', { path, label: label || null })
      watchPaths.value = [...watchPaths.value, entry]
      return entry
    } catch (error) {
      console.error('添加监控路径失败:', error)
      throw error
    }
  }

  async function removePath(pathId: string) {
    // 前端也做一层保护
    const entry = watchPaths.value.find(wp => wp.id === pathId)
    if (entry?.builtin) {
      throw new Error('内置路径不可删除')
    }

    try {
      await invoke('remove_watch_path', { pathId })
      watchPaths.value = watchPaths.value.filter(wp => wp.id !== pathId)

      // 删除活动路径则切到第一个启用的路径
      if (activeViewId.value === pathId) {
        const firstEnabled = watchPaths.value.find(wp => wp.enabled)
        setActiveView(firstEnabled?.id || DESKTOP_VIEW_ID)
      }
    } catch (error) {
      console.error('删除监控路径失败:', error)
      throw error
    }
  }

  async function setPathEnabled(pathId: string, enabled: boolean) {
    try {
      await invoke('set_watch_path_enabled', { pathId, enabled })
      watchPaths.value = watchPaths.value.map(wp =>
        wp.id === pathId ? { ...wp, enabled } : wp
      )

      // 禁用当前活跃视图时，切到第一个启用的路径
      if (!enabled && activeViewId.value === pathId) {
        const firstEnabled = watchPaths.value.find(wp => wp.enabled)
        setActiveView(firstEnabled?.id || DESKTOP_VIEW_ID)
      }
    } catch (error) {
      console.error('更新路径启用状态失败:', error)
      throw error
    }
  }

  function setActiveView(viewId: string) {
    activeViewId.value = viewId
    localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, viewId)
  }

  async function switchWatcher(paths: string[], pathId: string | null) {
    try {
      await invoke('switch_watcher', { paths, pathId })
    } catch (error) {
      console.error('切换 watcher 失败:', error)
    }
  }

  return {
    // 状态
    watchPaths,
    activeViewId,
    // 常量
    DESKTOP_VIEW_ID,
    ALL_VIEW_ID,
    MAX_WATCH_PATHS,
    // 计算属性
    isAllView,
    isDesktopView,
    desktopEntry,
    customPaths,
    enabledPaths,
    canAddPath,
    activeViewLabel,
    // 方法
    getPathFolderName,
    getEntryLabel,
    canDisable,
    loadWatchPaths,
    addPath,
    removePath,
    setPathEnabled,
    setActiveView,
    switchWatcher,
  }
})
