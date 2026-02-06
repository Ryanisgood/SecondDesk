import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useDialog } from '../composables/useDialog'
import { getIconPath } from '../utils/iconHelper'

export interface FileItem {
  fileName: string
  fileType: string
  file: string
  filePath: string
  ico: string
  index: number
  fType: string
  isFavorite: boolean
  sysApp: boolean
}

// 虚拟分组接口
export interface VirtualFolder {
  id: string                    // "vf_" + timestamp
  name: string                  // 显示名称
  icon: string                  // 可选自定义图标（emoji）
  memberPaths: string[]         // 包含的文件路径
  createdAt: number             // 创建时间戳
  position: number              // 在网格中的位置（已弃用，使用 iconOrderMap）
  isFavorite: boolean           // 是否收藏
}

// 显示项联合类型（文件或虚拟分组）
export type DisplayItem =
  | { type: 'file'; data: FileItem }
  | { type: 'virtualFolder'; data: VirtualFolder }

// 文件夹缓存信息接口
export interface FolderCacheInfo {
  pathKey: string
  displayName: string
  hasIconOrder: boolean
  hasSortMode: boolean
  hasVirtualFolders: boolean
  virtualFolderCount: number
  hasFavorites: boolean
  favoritesCount: number
}

// localStorage 持久化辅助函数 - 收藏 v1 key (用于迁移)
const FAVORITES_STORAGE_KEY = 'seconddesk_favorites'

// 新版：收藏按路径存储
type FavoritesMap = Record<string, string[]>
const FAVORITES_MAP_KEY = 'seconddesk_favorites_map_v2'

function loadFavoritesMapFromStorage(): FavoritesMap {
  try {
    // 首先尝试加载 v2 格式
    const v2Data = localStorage.getItem(FAVORITES_MAP_KEY)
    if (v2Data) {
      const parsed = JSON.parse(v2Data)
      if (parsed && typeof parsed === 'object') {
        return parsed as FavoritesMap
      }
    }

    // 如果没有 v2 数据，尝试从 v1 迁移
    const v1Data = localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (v1Data) {
      const v1Favorites = JSON.parse(v1Data) as string[]
      if (Array.isArray(v1Favorites) && v1Favorites.length > 0) {
        // 将旧数据归属到桌面
        const migrated: FavoritesMap = { '__desktop__': v1Favorites }
        // 保存迁移后的数据
        localStorage.setItem(FAVORITES_MAP_KEY, JSON.stringify(migrated))
        // 移除旧数据
        localStorage.removeItem(FAVORITES_STORAGE_KEY)
        return migrated
      }
    }
  } catch (error) {
    console.error('加载收藏映射失败：', error)
  }
  return {}
}

function saveFavoritesMapToStorage(map: FavoritesMap) {
  try {
    localStorage.setItem(FAVORITES_MAP_KEY, JSON.stringify(map))
  } catch (error) {
    console.error('保存收藏映射失败：', error)
  }
}

// 虚拟分组存储 - v1 key (用于迁移)
const VIRTUAL_FOLDERS_STORAGE_KEY = 'seconddesk_virtual_folders_v1'

// 新版：虚拟分组按路径存储
type VirtualFoldersMap = Record<string, VirtualFolder[]>
const VIRTUAL_FOLDERS_MAP_KEY = 'seconddesk_virtual_folders_map_v2'

function loadVirtualFoldersMapFromStorage(): VirtualFoldersMap {
  try {
    // 首先尝试加载 v2 格式
    const v2Data = localStorage.getItem(VIRTUAL_FOLDERS_MAP_KEY)
    if (v2Data) {
      const parsed = JSON.parse(v2Data)
      if (parsed && typeof parsed === 'object') {
        return parsed as VirtualFoldersMap
      }
    }

    // 如果没有 v2 数据，尝试从 v1 迁移
    const v1Data = localStorage.getItem(VIRTUAL_FOLDERS_STORAGE_KEY)
    if (v1Data) {
      const v1Folders = JSON.parse(v1Data) as VirtualFolder[]
      if (Array.isArray(v1Folders) && v1Folders.length > 0) {
        // 将旧数据归属到桌面
        const migrated: VirtualFoldersMap = { '__desktop__': v1Folders }
        // 保存迁移后的数据
        localStorage.setItem(VIRTUAL_FOLDERS_MAP_KEY, JSON.stringify(migrated))
        // 移除旧数据
        localStorage.removeItem(VIRTUAL_FOLDERS_STORAGE_KEY)
        return migrated
      }
    }
  } catch (error) {
    console.error('加载虚拟分组映射失败：', error)
  }
  return {}
}

function saveVirtualFoldersMapToStorage(map: VirtualFoldersMap) {
  try {
    localStorage.setItem(VIRTUAL_FOLDERS_MAP_KEY, JSON.stringify(map))
  } catch (error) {
    console.error('保存虚拟分组映射失败：', error)
  }
}

type IconOrderState = {
  favorites: string[]      // 收藏的文件路径
  normals: string[]        // 普通项（文件路径 + 虚拟分组 ID，如 "vf_xxx"）
}

type IconOrderMap = Record<string, IconOrderState>

const DESKTOP_PATH_KEY = '__desktop__'
const ALL_PATHS_KEY = '__all__'
const ICON_ORDER_STORAGE_KEY = 'seconddesk_icon_order_v1'
const SORT_MODE_STORAGE_KEY = 'seconddesk_sort_mode_v1'

export type SortMode = 'manual' | 'nameAsc' | 'nameDesc' | 'typeAsc'

function getPathKey(path: string | null): string {
  return path ?? DESKTOP_PATH_KEY
}

function loadIconOrderFromStorage(): IconOrderMap {
  try {
    const stored = localStorage.getItem(ICON_ORDER_STORAGE_KEY)
    if (!stored) return {}

    const parsed = JSON.parse(stored)
    if (parsed && typeof parsed === 'object') {
      return parsed as IconOrderMap
    }
  } catch (error) {
    console.error('加载图标排序失败：', error)
  }
  return {}
}

function saveIconOrderToStorage(orderMap: IconOrderMap) {
  try {
    localStorage.setItem(ICON_ORDER_STORAGE_KEY, JSON.stringify(orderMap))
  } catch (error) {
    console.error('保存图标排序失败：', error)
  }
}

function loadSortModeFromStorage(): Record<string, SortMode> {
  try {
    const stored = localStorage.getItem(SORT_MODE_STORAGE_KEY)
    if (!stored) return {}

    const parsed = JSON.parse(stored)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, SortMode>
    }
  } catch (error) {
    console.error('加载排序方式失败：', error)
  }
  return {}
}

function saveSortModeToStorage(map: Record<string, SortMode>) {
  try {
    localStorage.setItem(SORT_MODE_STORAGE_KEY, JSON.stringify(map))
  } catch (error) {
    console.error('保存排序方式失败：', error)
  }
}

function compareByName(a: FileItem, b: FileItem) {
  return a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' })
}

function compareByTypeThenName(a: FileItem, b: FileItem) {
  const t = (a.fType || '').localeCompare(b.fType || '')
  if (t !== 0) return t
  return compareByName(a, b)
}

function applySortModeToList(list: FileItem[], mode: SortMode): FileItem[] {
  if (mode === 'manual') return list

  const favorites = list.filter(f => f.isFavorite)
  const normals = list.filter(f => !f.isFavorite)

  const sortFn =
    mode === 'nameAsc'
      ? (a: FileItem, b: FileItem) => compareByName(a, b)
      : mode === 'nameDesc'
        ? (a: FileItem, b: FileItem) => compareByName(b, a)
        : (a: FileItem, b: FileItem) => compareByTypeThenName(a, b)

  favorites.sort(sortFn)
  normals.sort(sortFn)
  return [...favorites, ...normals]
}

function syncIconOrderState(
  existingState: IconOrderState | undefined,
  fileList: FileItem[],
  virtualFolders: VirtualFolder[] = []
): IconOrderState {
  const prev = existingState ?? { favorites: [], normals: [] }

  // 收藏的文件 + 收藏的虚拟分组
  const favoritesInList = fileList.filter(f => f.isFavorite).map(f => f.filePath)
  const favoriteVfIds = virtualFolders.filter(vf => vf.isFavorite).map(vf => vf.id)

  // 普通文件 + 普通虚拟分组
  const normalsInList = fileList.filter(f => !f.isFavorite).map(f => f.filePath)
  const normalVfIds = virtualFolders.filter(vf => !vf.isFavorite).map(vf => vf.id)

  const favoritesSet = new Set([...favoritesInList, ...favoriteVfIds])
  const normalsSet = new Set([...normalsInList, ...normalVfIds])

  // 同步收藏列表
  const nextFavorites: string[] = []
  const seenFavorites = new Set<string>()
  for (const id of prev.favorites) {
    if (favoritesSet.has(id) && !seenFavorites.has(id)) {
      seenFavorites.add(id)
      nextFavorites.push(id)
    }
  }
  // 添加新的收藏文件
  for (const filePath of favoritesInList) {
    if (!seenFavorites.has(filePath)) {
      seenFavorites.add(filePath)
      nextFavorites.push(filePath)
    }
  }
  // 添加新的收藏虚拟分组
  for (const vfId of favoriteVfIds) {
    if (!seenFavorites.has(vfId)) {
      seenFavorites.add(vfId)
      nextFavorites.push(vfId)
    }
  }

  // 同步普通列表
  const nextNormals: string[] = []
  const seenNormals = new Set<string>()
  for (const id of prev.normals) {
    if (normalsSet.has(id) && !seenNormals.has(id)) {
      seenNormals.add(id)
      nextNormals.push(id)
    }
  }
  // 添加新的普通文件
  for (const filePath of normalsInList) {
    if (!seenNormals.has(filePath)) {
      seenNormals.add(filePath)
      nextNormals.push(filePath)
    }
  }
  // 添加新的普通虚拟分组
  for (const vfId of normalVfIds) {
    if (!seenNormals.has(vfId)) {
      seenNormals.add(vfId)
      nextNormals.push(vfId)
    }
  }

  return { favorites: nextFavorites, normals: nextNormals }
}

function sortFilesForDisplay(fileList: FileItem[], orderState: IconOrderState | undefined): FileItem[] {
  const state: IconOrderState = orderState ?? { favorites: [], normals: [] }

  const byPath = new Map<string, FileItem>()
  for (const file of fileList) {
    byPath.set(file.filePath, file)
  }

  const orderedFavorites: FileItem[] = []
  const usedFavoritePaths = new Set<string>()
  for (const filePath of state.favorites) {
    const file = byPath.get(filePath)
    if (file && file.isFavorite) {
      orderedFavorites.push(file)
      usedFavoritePaths.add(filePath)
    }
  }
  for (const file of fileList) {
    if (file.isFavorite && !usedFavoritePaths.has(file.filePath)) {
      orderedFavorites.push(file)
    }
  }

  const orderedNormals: FileItem[] = []
  const usedNormalPaths = new Set<string>()
  for (const filePath of state.normals) {
    const file = byPath.get(filePath)
    if (file && !file.isFavorite) {
      orderedNormals.push(file)
      usedNormalPaths.add(filePath)
    }
  }
  for (const file of fileList) {
    if (!file.isFavorite && !usedNormalPaths.has(file.filePath)) {
      orderedNormals.push(file)
    }
  }

  return [...orderedFavorites, ...orderedNormals]
}

function filterFiles(fileList: FileItem[], query: string): FileItem[] {
  if (!query.trim()) return fileList

  const lowerQuery = query.toLowerCase()
  return fileList.filter(file => file.fileName.toLowerCase().includes(lowerQuery))
}

export type CategoryKind = 'all' | 'auto' | 'custom'

export type CustomCategoryMode = 'manual' | 'types'

export interface DesktopCategory {
  id: string
  kind: CategoryKind
  name: string
  icon: string
  count?: number
  fTypes?: string[]
  filePaths?: string[]
  mode?: CustomCategoryMode
}

export interface FileTypeOption {
  fType: string
  name: string
  icon: string
}

type StoredCustomCategory = {
  id: string
  name: string
  icon: string
  mode: CustomCategoryMode
  filePaths?: string[]
  fTypes?: string[]
}

export type CustomCategoryRule =
  | { mode: 'manual'; filePaths: string[] }
  | { mode: 'types'; fTypes: string[] }

const ALL_CATEGORY_ID = 'all'
const AUTO_CATEGORY_PREFIX = 'type:'
const CUSTOM_CATEGORIES_STORAGE_KEY = 'seconddesk_custom_categories_v1'
const ACTIVE_CATEGORY_STORAGE_KEY = 'seconddesk_active_category_v1'
const PRESET_CATEGORIES_STORAGE_KEY = 'seconddesk_preset_categories_v1'
const CATEGORY_ORDER_STORAGE_KEY = 'seconddesk_category_order_v1'

const FILE_TYPE_OPTIONS: FileTypeOption[] = [
  { fType: 'dir', name: '文件夹', icon: 'open-folder' },
  { fType: 'shortcut', name: '快捷方式', icon: 'link' },
  { fType: 'exe', name: '应用', icon: 'apps' },
  { fType: 'text', name: '文本', icon: 'google-docs' },
  { fType: 'word', name: 'Word', icon: 'google-docs' },
  { fType: 'excel', name: 'Excel', icon: 'excel' },
  { fType: 'powerpoint', name: 'PPT', icon: 'ppt' },
  { fType: 'pdf', name: 'PDF', icon: 'stack-of-books' },
  { fType: 'image', name: '图片', icon: 'image' },
  { fType: 'video', name: '视频', icon: 'video-marketing' },
  { fType: 'audio', name: '音频', icon: 'music' },
  { fType: 'archive', name: '压缩包', icon: 'zip' },
  { fType: 'code', name: '代码', icon: '💻' },
  { fType: 'web', name: 'Web', icon: 'worldwide' },
  { fType: 'config', name: '配置', icon: 'gear' },
  { fType: 'file', name: '其他', icon: 'box' },
]

/**
 * 获取文件类型图标的 URL
 * @param iconName 图标名称（可能是 emoji 或图标文件名）
 * @returns 图标 URL 或原始 emoji
 */
export function getFileTypeIconUrl(iconName: string): string {
  // 如果是 emoji（包含非 ASCII 字符或特定 emoji），直接返回
  if (/[\u{1F300}-\u{1FAD6}]|[\u2600-\u26FF]/u.test(iconName)) {
    return iconName
  }
  // 否则是图标文件名，返回路径
  return getIconPath(iconName)
}

function loadActiveCategoryFromStorage(): string {
  try {
    const stored = localStorage.getItem(ACTIVE_CATEGORY_STORAGE_KEY)
    if (stored && typeof stored === 'string') return stored
  } catch (error) {
    console.error('加载当前分类失败：', error)
  }
  return ALL_CATEGORY_ID
}

function saveActiveCategoryToStorage(categoryId: string) {
  try {
    localStorage.setItem(ACTIVE_CATEGORY_STORAGE_KEY, categoryId)
  } catch (error) {
    console.error('保存当前分类失败：', error)
  }
}

function loadCustomCategoriesFromStorage(): StoredCustomCategory[] {
  try {
    const stored = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    const result: StoredCustomCategory[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue

      const id = typeof item.id === 'string' ? item.id : ''
      const name = typeof item.name === 'string' ? item.name : ''
      const icon = typeof item.icon === 'string' ? item.icon : '🏷️'

      const filePaths = Array.isArray((item as { filePaths?: unknown }).filePaths)
        ? (item as { filePaths: unknown[] }).filePaths.filter(
          (p): p is string => typeof p === 'string' && p.trim().length > 0
        )
        : []

      const fTypes = Array.isArray((item as { fTypes?: unknown }).fTypes)
        ? (item as { fTypes: unknown[] }).fTypes.filter(
          (t): t is string => typeof t === 'string' && t.trim().length > 0
        )
        : []

      const rawMode = (item as { mode?: unknown }).mode
      const mode: CustomCategoryMode | null =
        rawMode === 'manual' || rawMode === 'types'
          ? (rawMode as CustomCategoryMode)
          : fTypes.length > 0
            ? 'types'
            : filePaths.length > 0
              ? 'manual'
              : null

      if (!id || !name || !mode) continue
      if (mode === 'manual' && filePaths.length === 0) continue
      if (mode === 'types' && fTypes.length === 0) continue

      result.push({
        id,
        name,
        icon,
        mode,
        filePaths: mode === 'manual' ? filePaths : undefined,
        fTypes: mode === 'types' ? fTypes : undefined,
      })
    }
    return result
  } catch (error) {
    console.error('加载自定义分类失败：', error)
  }
  return []
}

function saveCustomCategoriesToStorage(categories: StoredCustomCategory[]) {
  try {
    localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(categories))
  } catch (error) {
    console.error('保存自定义分类失败：', error)
  }
}

// 预设分类定义
export interface PresetCategory {
  id: string
  name: string
  icon: string
  fTypes: string[]
}

export const PRESET_CATEGORIES: PresetCategory[] = [
  {
    id: 'preset:apps',
    name: '应用',
    icon: 'apps',
    fTypes: ['exe', 'shortcut'],
  },
  {
    id: 'preset:documents',
    name: '文档',
    icon: 'google-docs',
    fTypes: ['word', 'powerpoint', 'excel', 'pdf', 'text'],
  },
  {
    id: 'preset:media',
    name: '媒体',
    icon: 'video-marketing',
    fTypes: ['image', 'video', 'audio'],
  },
]

function loadEnabledPresetCategoriesFromStorage(): Set<string> {
  try {
    const stored = localStorage.getItem(PRESET_CATEGORIES_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return new Set(Array.isArray(parsed) ? parsed : [])
    }
  } catch (error) {
    console.error('加载预设分类配置失败：', error)
  }
  return new Set()
}

function saveEnabledPresetCategoriesToStorage(enabledIds: Set<string>) {
  try {
    localStorage.setItem(PRESET_CATEGORIES_STORAGE_KEY, JSON.stringify(Array.from(enabledIds)))
  } catch (error) {
    console.error('保存预设分类配置失败：', error)
  }
}

function loadCategoryOrderFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(CATEGORY_ORDER_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (error) {
    console.error('加载分类顺序失败：', error)
  }
  return []
}

function saveCategoryOrderToStorage(order: string[]) {
  try {
    localStorage.setItem(CATEGORY_ORDER_STORAGE_KEY, JSON.stringify(order))
  } catch (error) {
    console.error('保存分类顺序失败：', error)
  }
}

export const useFileStore = defineStore('files', () => {
  // 状态
  const files = ref<FileItem[]>([])
  const filteredFiles = ref<FileItem[]>([])
  const currentPath = ref<string | null>(null)  // 改为 null 避免魔法字符串
  const loading = ref<boolean>(false)
  const loadingIcons = ref<boolean>(false)  // 图标加载状态
  const desktopPath = ref<string | null>(null)
  const lastDeletedPath = ref<string | null>(null)
  const favoritesMap = ref<FavoritesMap>(loadFavoritesMapFromStorage())
  const searchQuery = ref<string>('')
  const iconOrderMap = ref<IconOrderMap>(loadIconOrderFromStorage())
  const sortModeMap = ref<Record<string, SortMode>>(loadSortModeFromStorage())
  const customCategories = ref<StoredCustomCategory[]>(loadCustomCategoriesFromStorage())
  const activeCategoryId = ref<string>(loadActiveCategoryFromStorage())
  const enabledPresetCategories = ref<Set<string>>(loadEnabledPresetCategoriesFromStorage())
  const categoryOrder = ref<string[]>(loadCategoryOrderFromStorage())
  const virtualFoldersMap = ref<VirtualFoldersMap>(loadVirtualFoldersMapFromStorage())

  // 聚合视图：各文件夹文件缓存（key=pathKey）
  const folderFilesCache = ref<Record<string, FileItem[]>>({})
  // 聚合视图：重名文件显示名映射（key=filePath, value=带后缀的显示名）
  const fileDisplayNameMap = ref<Map<string, string>>(new Map())

  // 当前路径的收藏集合（兼容旧代码）
  const favoritesSet = computed({
    get: () => {
      const pathKey = getPathKey(currentPath.value)
      const arr = favoritesMap.value[pathKey] ?? []
      return new Set(arr)
    },
    set: (newSet: Set<string>) => {
      const pathKey = getPathKey(currentPath.value)
      favoritesMap.value = {
        ...favoritesMap.value,
        [pathKey]: Array.from(newSet)
      }
      saveFavoritesMapToStorage(favoritesMap.value)
    }
  })

  // 当前路径的虚拟分组（兼容旧代码）
  const virtualFolders = computed({
    get: () => {
      const pathKey = getPathKey(currentPath.value)
      return virtualFoldersMap.value[pathKey] ?? []
    },
    set: (newFolders: VirtualFolder[]) => {
      const pathKey = getPathKey(currentPath.value)
      virtualFoldersMap.value = {
        ...virtualFoldersMap.value,
        [pathKey]: newFolders
      }
      saveVirtualFoldersMapToStorage(virtualFoldersMap.value)
    }
  })

  // 图标提取控制
  let iconExtractionAbortController: AbortController | null = null

  // 计算属性
  const fileCount = computed(() => files.value.length)
  const favoriteFiles = computed(() => files.value.filter(f => f.isFavorite))
  const fileTypeOptions = computed(() => FILE_TYPE_OPTIONS)
  const fileTypeCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {}
    for (const file of files.value) {
      counts[file.fType] = (counts[file.fType] ?? 0) + 1
    }
    return counts
  })
  const autoCategories = computed<DesktopCategory[]>(() => {
    const counts = fileTypeCounts.value
    const result: DesktopCategory[] = []

    for (const option of FILE_TYPE_OPTIONS) {
      const count = counts[option.fType]
      if (!count) continue

      result.push({
        id: `${AUTO_CATEGORY_PREFIX}${option.fType}`,
        kind: 'auto',
        name: option.name,
        icon: option.icon,
        fTypes: [option.fType],
        count,
      })
    }

    const known = new Set(FILE_TYPE_OPTIONS.map(o => o.fType))
    for (const fType of Object.keys(counts).sort()) {
      if (known.has(fType)) continue
      result.push({
        id: `${AUTO_CATEGORY_PREFIX}${fType}`,
        kind: 'auto',
        name: fType,
        icon: '📦',
        fTypes: [fType],
        count: counts[fType],
      })
    }

    return result
  })
  void autoCategories
  const categories = computed<DesktopCategory[]>(() => {
    const counts = fileTypeCounts.value
    const custom = customCategories.value.map<DesktopCategory>(cat => {
      if (cat.mode === 'manual') {
        const pathSet = new Set(cat.filePaths ?? [])
        let count = 0
        for (const file of files.value) {
          if (pathSet.has(file.filePath)) count++
        }

        return {
          id: cat.id,
          kind: 'custom',
          mode: 'manual',
          name: cat.name,
          icon: cat.icon,
          filePaths: cat.filePaths,
          count,
        }
      }

      const fTypes = cat.fTypes ?? []
      return {
        id: cat.id,
        kind: 'custom',
        mode: 'types',
        name: cat.name,
        icon: cat.icon,
        fTypes,
        count: fTypes.reduce((sum, fType) => sum + (counts[fType] ?? 0), 0),
      }
    })

    // 根据用户启用的预设分类生成分类列表
    const presetCats: DesktopCategory[] = PRESET_CATEGORIES.filter(preset =>
      enabledPresetCategories.value.has(preset.id)
    ).map(preset => ({
      id: preset.id,
      kind: 'auto' as CategoryKind,
      name: preset.name,
      icon: preset.icon,
      fTypes: preset.fTypes,
      count: preset.fTypes.reduce((sum, fType) => sum + (counts[fType] ?? 0), 0),
    }))

    const allCategory: DesktopCategory = {
      id: ALL_CATEGORY_ID,
      kind: 'all',
      name: '全部',
      icon: 'open-folder',
      count: files.value.length,
    }

    // 合并所有分类
    const allCategories = [allCategory, ...presetCats, ...custom]

    // 根据保存的顺序排序（"全部"始终在第一位）
    const order = categoryOrder.value
    if (order.length === 0) {
      return allCategories
    }

    const categoryMap = new Map(allCategories.map(cat => [cat.id, cat]))
    const sorted: DesktopCategory[] = [allCategory] // "全部"始终在第一位

    // 按保存的顺序添加其他分类
    for (const id of order) {
      if (id !== ALL_CATEGORY_ID) {
        const cat = categoryMap.get(id)
        if (cat) {
          sorted.push(cat)
          categoryMap.delete(id)
        }
      }
    }

    // 添加未在顺序中的新分类
    categoryMap.delete(ALL_CATEGORY_ID)
    sorted.push(...Array.from(categoryMap.values()))

    return sorted
  })

  function applyAllFilters() {
    let categoryId = activeCategoryId.value

    const isValidCategory = (() => {
      if (categoryId === ALL_CATEGORY_ID) return true

      // 检查是否是预设分类（preset:apps, preset:documents, preset:media）
      if (categoryId.startsWith('preset:')) {
        return categories.value.some(c => c.id === categoryId)
      }

      // 旧的自动分类逻辑（type:xxx）
      if (categoryId.startsWith(AUTO_CATEGORY_PREFIX)) {
        const fType = categoryId.slice(AUTO_CATEGORY_PREFIX.length)
        if (!fType) return false
        return (fileTypeCounts.value[fType] ?? 0) > 0
      }

      return customCategories.value.some(c => c.id === categoryId)
    })()

    if (!isValidCategory) {
      categoryId = ALL_CATEGORY_ID
      activeCategoryId.value = ALL_CATEGORY_ID
      saveActiveCategoryToStorage(ALL_CATEGORY_ID)
    }

    let result = files.value

    if (categoryId !== ALL_CATEGORY_ID) {
      // 处理预设分类
      if (categoryId.startsWith('preset:')) {
        const category = categories.value.find(c => c.id === categoryId)
        if (category?.fTypes) {
          const typeSet = new Set(category.fTypes)
          result = result.filter(file => typeSet.has(file.fType))
        }
      }
      // 旧的自动分类逻辑（type:xxx）
      else if (categoryId.startsWith(AUTO_CATEGORY_PREFIX)) {
        const fType = categoryId.slice(AUTO_CATEGORY_PREFIX.length)
        if (fType) {
          result = result.filter(file => file.fType === fType)
        }
      }
      // 自定义分类
      else {
        const custom = customCategories.value.find(c => c.id === categoryId)
        if (custom?.mode === 'manual') {
          const pathSet = new Set(custom.filePaths ?? [])
          result = result.filter(file => pathSet.has(file.filePath))
        } else if (custom?.mode === 'types') {
          const typeSet = new Set(custom.fTypes ?? [])
          result = result.filter(file => typeSet.has(file.fType))
        }
      }
    }

    result = filterFiles(result, searchQuery.value)
    filteredFiles.value = result
  }

  function setActiveCategory(categoryId: string) {
    activeCategoryId.value = categoryId
    saveActiveCategoryToStorage(categoryId)
    applyAllFilters()
  }

  function createCustomCategory(name: string, rule: CustomCategoryRule): boolean {
    const trimmedName = name.trim()
    if (!trimmedName) return false

    const newCategoryBase = {
      id: `cat_${Date.now()}`,
      name: trimmedName,
      icon: '🏷️',
    }

    if (rule.mode === 'manual') {
      const uniqueFilePaths = Array.from(new Set(rule.filePaths.map(p => p.trim()).filter(Boolean)))
      if (uniqueFilePaths.length === 0) return false

      const newCategory: StoredCustomCategory = {
        ...newCategoryBase,
        mode: 'manual',
        filePaths: uniqueFilePaths,
      }

      customCategories.value = [...customCategories.value, newCategory]
      saveCustomCategoriesToStorage(customCategories.value)
      setActiveCategory(newCategory.id)
      return true
    }

    const uniqueTypes = Array.from(new Set(rule.fTypes.map(t => t.trim()).filter(Boolean)))
    if (uniqueTypes.length === 0) return false

    const newCategory: StoredCustomCategory = {
      ...newCategoryBase,
      mode: 'types',
      fTypes: uniqueTypes,
    }

    customCategories.value = [...customCategories.value, newCategory]
    saveCustomCategoriesToStorage(customCategories.value)
    setActiveCategory(newCategory.id)
    return true
  }

  function updateCustomCategory(categoryId: string, name: string, rule: CustomCategoryRule): boolean {
    const trimmedName = name.trim()
    if (!trimmedName) return false

    const existing = customCategories.value.find(c => c.id === categoryId)
    if (!existing) return false

    if (rule.mode === 'manual') {
      const uniqueFilePaths = Array.from(new Set(rule.filePaths.map(p => p.trim()).filter(Boolean)))
      if (uniqueFilePaths.length === 0) return false

      customCategories.value = customCategories.value.map(c =>
        c.id === categoryId
          ? { ...c, name: trimmedName, mode: 'manual', filePaths: uniqueFilePaths, fTypes: undefined }
          : c
      )
    } else {
      const uniqueTypes = Array.from(new Set(rule.fTypes.map(t => t.trim()).filter(Boolean)))
      if (uniqueTypes.length === 0) return false

      customCategories.value = customCategories.value.map(c =>
        c.id === categoryId
          ? { ...c, name: trimmedName, mode: 'types', fTypes: uniqueTypes, filePaths: undefined }
          : c
      )
    }

    saveCustomCategoriesToStorage(customCategories.value)
    applyAllFilters()
    return true
  }

  function deleteCustomCategory(categoryId: string) {
    const before = customCategories.value.length
    customCategories.value = customCategories.value.filter(c => c.id !== categoryId)
    if (customCategories.value.length === before) return

    saveCustomCategoriesToStorage(customCategories.value)
    if (activeCategoryId.value === categoryId) {
      setActiveCategory(ALL_CATEGORY_ID)
    } else {
      applyAllFilters()
    }
  }

  function addFilesToCategory(categoryId: string, filePaths: string[]): boolean {
    const category = customCategories.value.find(c => c.id === categoryId)
    if (!category || category.mode !== 'manual') return false

    const existingPaths = new Set(category.filePaths ?? [])
    const newPaths = filePaths.filter(p => p && !existingPaths.has(p))

    if (newPaths.length === 0) return false

    const updatedFilePaths = [...(category.filePaths ?? []), ...newPaths]

    customCategories.value = customCategories.value.map(c =>
      c.id === categoryId
        ? { ...c, filePaths: updatedFilePaths }
        : c
    )

    saveCustomCategoriesToStorage(customCategories.value)
    applyAllFilters()
    return true
  }

  // 从自定义分类移除文件
  function removeFilesFromCategory(categoryId: string, filePaths: string[]): boolean {
    const category = customCategories.value.find(c => c.id === categoryId)
    if (!category || category.mode !== 'manual') return false

    const pathsToRemove = new Set(filePaths)
    const newFilePaths = (category.filePaths ?? []).filter(p => !pathsToRemove.has(p))

    // 如果移除后为空，保留空分类，让用户决定是否删除
    customCategories.value = customCategories.value.map(c =>
      c.id === categoryId
        ? { ...c, filePaths: newFilePaths }
        : c
    )

    saveCustomCategoriesToStorage(customCategories.value)
    applyAllFilters()
    return true
  }

  // 获取当前激活的自定义分类（仅 manual 模式）
  function getActiveCustomCategory(): StoredCustomCategory | null {
    const categoryId = activeCategoryId.value
    if (categoryId === 'all') return null
    const custom = customCategories.value.find(c => c.id === categoryId)
    if (custom?.mode === 'manual') return custom
    return null
  }

  if (
    activeCategoryId.value !== ALL_CATEGORY_ID &&
    !activeCategoryId.value.startsWith(AUTO_CATEGORY_PREFIX) &&
    !customCategories.value.some(c => c.id === activeCategoryId.value)
  ) {
    activeCategoryId.value = ALL_CATEGORY_ID
    saveActiveCategoryToStorage(ALL_CATEGORY_ID)
  }

  // 方法
  async function ensureDesktopPath() {
    if (desktopPath.value) return
    try {
      desktopPath.value = await invoke<string>('get_desktop_path')
    } catch (error) {
      console.error('获取桌面路径失败：', error)
    }
  }

  async function getCurrentDirectoryPath(): Promise<string> {
    if (currentPath.value && currentPath.value.trim()) return currentPath.value
    await ensureDesktopPath()
    if (!desktopPath.value) {
      throw new Error('无法获取桌面路径')
    }
    return desktopPath.value
  }

  function getSortModeForCurrentPath(): SortMode {
    const pathKey = getPathKey(currentPath.value)
    return sortModeMap.value[pathKey] ?? 'manual'
  }

  function setSortModeForCurrentPath(mode: SortMode) {
    const pathKey = getPathKey(currentPath.value)
    sortModeMap.value[pathKey] = mode
    saveSortModeToStorage(sortModeMap.value)
    if (mode === 'manual') {
      files.value = sortFilesForDisplay(files.value, iconOrderMap.value[pathKey])
    } else {
      files.value = applySortModeToList(files.value, mode)
    }
    applyAllFilters()
  }

  async function loadFiles(path?: string) {
    const normalizedPath = path && path.trim() ? path.trim() : null
    const pathKey = getPathKey(normalizedPath)

    // 取消之前的图标提取
    if (iconExtractionAbortController) {
      iconExtractionAbortController.abort()
      iconExtractionAbortController = null
    }

    // 先更新当前路径，这样后续的 computed 属性会使用新路径
    currentPath.value = normalizedPath

    loading.value = true
    loadingIcons.value = false

    try {
      // 第一阶段：快速加载文件列表（无图标）
      const result = await invoke<FileItem[]>('get_file_info', {
        path: normalizedPath
      })

      // 恢复收藏状态（使用当前路径的收藏集合）
      const currentFavoritesArr = favoritesMap.value[pathKey] ?? []
      const currentFavorites = new Set(currentFavoritesArr)
      result.forEach(file => {
        file.isFavorite = currentFavorites.has(file.filePath)

        const snake = (file as unknown as { f_type?: unknown }).f_type
        if (!file.fType && typeof snake === 'string') {
          file.fType = snake
        }
        if (!file.fType) {
          file.fType = 'file'
        }
      })

      // 清理虚拟分组中不存在的文件引用（现在 currentPath 已正确设置）
      const existingPaths = new Set(result.map(f => f.filePath))
      virtualFolders.value = virtualFolders.value.map(folder => {
        const validPaths = folder.memberPaths.filter(p => existingPaths.has(p))
        if (validPaths.length !== folder.memberPaths.length) {
          return { ...folder, memberPaths: validPaths }
        }
        return folder
      }).filter(folder => folder.memberPaths.length > 0)

      // 同步排序状态（包含虚拟分组）
      const nextOrderState = syncIconOrderState(iconOrderMap.value[pathKey], result, virtualFolders.value)
      iconOrderMap.value[pathKey] = nextOrderState
      saveIconOrderToStorage(iconOrderMap.value)

      const sortMode = sortModeMap.value[pathKey] ?? 'manual'
      files.value = applySortModeToList(sortFilesForDisplay(result, nextOrderState), sortMode)
      applyAllFilters()

      // 第二阶段：异步批量提取图标
      extractIconsInBatches(result)

    } catch (error) {
      console.error('❌ 加载文件失败：', error)
      useDialog().error(`加载文件列表失败：${error}`)  // 显示错误给用户
      files.value = []
      filteredFiles.value = []
    } finally {
      loading.value = false
    }
  }

  // 分批异步提取图标
  async function extractIconsInBatches(fileList: FileItem[]) {
    // 筛选需要提取图标的文件（.lnk、.url 和 .exe）
    const needIconFiles = fileList.filter(file => {
      const ext = file.fileName.split('.').pop()?.toLowerCase()
      return ext === 'lnk' || ext === 'url' || ext === 'exe'
    })

    if (needIconFiles.length === 0) {
      return
    }

    loadingIcons.value = true

    // 创建新的 AbortController
    iconExtractionAbortController = new AbortController()
    const signal = iconExtractionAbortController.signal

    try {
      const BATCH_SIZE = 10  // 每批处理 10 个文件（exe 提取更耗时）
      const batches: string[][] = []

      // 分批
      for (let i = 0; i < needIconFiles.length; i += BATCH_SIZE) {
        batches.push(needIconFiles.slice(i, i + BATCH_SIZE).map(f => f.filePath))
      }

      // 逐批处理
      for (let i = 0; i < batches.length; i++) {
        // 检查是否被取消
        if (signal.aborted) {
          return
        }

        const batch = batches[i]

        try {
          const icons = await invoke<[string, string][]>('extract_file_icons', {
            filePaths: batch
          })

          // 检查是否被取消
          if (signal.aborted) {
            return
          }

          // 更新图标
          icons.forEach(([filePath, ico]) => {
            const file = files.value.find(f => f.filePath === filePath)
            if (file && ico) {
              file.ico = ico
            }
          })

          // 小延迟，避免阻塞 UI
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        } catch (error) {
          console.error(`❌ 第 ${i + 1} 批提取失败：`, error)
          // 继续处理下一批
        }
      }
    } catch (error) {
      console.error('❌ 图标提取过程出错：', error)
    } finally {
      loadingIcons.value = false
      iconExtractionAbortController = null
    }
  }

  // ==================== 多文件夹聚合视图 ====================

  /** 加载所有文件夹的文件（聚合视图） */
  async function loadAllFoldersFiles(paths: { id: string; path: string }[]) {
    // 取消之前的图标提取
    if (iconExtractionAbortController) {
      iconExtractionAbortController.abort()
      iconExtractionAbortController = null
    }

    currentPath.value = ALL_PATHS_KEY
    loading.value = true
    loadingIcons.value = false

    try {
      const allFiles: FileItem[] = []
      const cache: Record<string, FileItem[]> = {}

      // 对每个路径调用 get_file_info
      for (const { id, path } of paths) {
        try {
          // 桌面需要传 null 以触发双桌面（用户桌面 + 公共桌面）扫描
          const scanPath = id === DESKTOP_PATH_KEY ? null : path
          const result = await invoke<FileItem[]>('get_file_info', { path: scanPath })

          // 恢复收藏状态（从源文件夹的 favoritesMap）
          // 桌面使用 __desktop__ key，自定义路径使用实际路径
          const sourcePathKey = id === DESKTOP_PATH_KEY ? DESKTOP_PATH_KEY : path
          const sourceFavArr = favoritesMap.value[sourcePathKey] ?? []
          const sourceFavSet = new Set(sourceFavArr)
          result.forEach(file => {
            file.isFavorite = sourceFavSet.has(file.filePath)

            const snake = (file as unknown as { f_type?: unknown }).f_type
            if (!file.fType && typeof snake === 'string') {
              file.fType = snake
            }
            if (!file.fType) {
              file.fType = 'file'
            }
          })

          cache[sourcePathKey] = result
          allFiles.push(...result)
        } catch (error) {
          console.error(`加载文件夹失败 (${path}):`, error)
        }
      }

      folderFilesCache.value = cache

      // 计算重名显示名
      computeDisplayNames(allFiles)

      // 使用 __all__ pathKey 的排序
      const pathKey = ALL_PATHS_KEY
      const nextOrderState = syncIconOrderState(iconOrderMap.value[pathKey], allFiles, virtualFolders.value)
      iconOrderMap.value[pathKey] = nextOrderState
      saveIconOrderToStorage(iconOrderMap.value)

      const sortMode = sortModeMap.value[pathKey] ?? 'manual'
      files.value = applySortModeToList(sortFilesForDisplay(allFiles, nextOrderState), sortMode)
      applyAllFilters()

      // 批量提取图标
      extractIconsInBatches(allFiles)
    } catch (error) {
      console.error('❌ 加载聚合文件失败：', error)
      files.value = []
      filteredFiles.value = []
    } finally {
      loading.value = false
    }
  }

  /** 计算重名文件的显示名（追加文件夹名后缀） */
  function computeDisplayNames(allFiles: FileItem[]) {
    const nameMap = new Map<string, FileItem[]>()
    for (const file of allFiles) {
      const existing = nameMap.get(file.fileName) ?? []
      existing.push(file)
      nameMap.set(file.fileName, existing)
    }

    const displayMap = new Map<string, string>()
    for (const [fileName, filesWithName] of nameMap) {
      if (filesWithName.length > 1) {
        for (const file of filesWithName) {
          // 从文件路径提取父文件夹名
          const parts = file.filePath.replace(/\\/g, '/').split('/')
          const parentFolder = parts.length >= 2 ? parts[parts.length - 2] : ''
          displayMap.set(file.filePath, `${fileName} (${parentFolder})`)
        }
      }
    }
    fileDisplayNameMap.value = displayMap
  }

  /** 获取文件的显示名（聚合视图下重名文件带文件夹名后缀） */
  function getDisplayName(file: FileItem): string {
    const mapped = fileDisplayNameMap.value.get(file.filePath)
    return mapped ?? file.fileName
  }

  /** 查找文件所属的源文件夹 pathKey（聚合视图中用于收藏穿透写入） */
  function findSourcePathKey(filePath: string): string | null {
    for (const [cacheKey, fileList] of Object.entries(folderFilesCache.value)) {
      if (fileList.some(f => f.filePath === filePath)) {
        return cacheKey  // __desktop__ 或实际文件夹路径
      }
    }
    return null
  }

  function toggleFavorite(filePath: string) {
    const file = files.value.find(f => f.filePath === filePath)
    if (file) {
      const pathKey = getPathKey(currentPath.value)
      const currentOrderState = iconOrderMap.value[pathKey] ?? syncIconOrderState(undefined, files.value, virtualFolders.value)

      if (file.isFavorite) {
        currentOrderState.favorites = currentOrderState.favorites.filter(p => p !== filePath)
        if (!currentOrderState.normals.includes(filePath)) {
          currentOrderState.normals.unshift(filePath)
        }
      } else {
        currentOrderState.normals = currentOrderState.normals.filter(p => p !== filePath)
        if (!currentOrderState.favorites.includes(filePath)) {
          currentOrderState.favorites.push(filePath)
        }
      }

      file.isFavorite = !file.isFavorite
      iconOrderMap.value[pathKey] = currentOrderState

      // 聚合视图：收藏穿透写回源文件夹
      if (currentPath.value === ALL_PATHS_KEY) {
        const sourceKey = findSourcePathKey(filePath)
        if (sourceKey) {
          const sourceFavArr = favoritesMap.value[sourceKey] ?? []
          const sourceFavSet = new Set(sourceFavArr)
          if (file.isFavorite) {
            sourceFavSet.add(filePath)
          } else {
            sourceFavSet.delete(filePath)
          }
          favoritesMap.value = {
            ...favoritesMap.value,
            [sourceKey]: Array.from(sourceFavSet)
          }
          saveFavoritesMapToStorage(favoritesMap.value)
        }
      } else {
        // 单文件夹视图：原有逻辑
        const newFavorites = new Set(favoritesSet.value)
        if (file.isFavorite) {
          newFavorites.add(filePath)
        } else {
          newFavorites.delete(filePath)
        }
        favoritesSet.value = newFavorites
      }

      // __all__ pathKey 的排序也要更新
      saveIconOrderToStorage(iconOrderMap.value)

      const sortMode = getSortModeForCurrentPath()
      files.value = applySortModeToList(sortFilesForDisplay(files.value, currentOrderState), sortMode)
      applyAllFilters()
    }
  }

  function searchFiles(query: string) {
    searchQuery.value = query
    applyAllFilters()
  }

  // 通用排序函数：支持文件路径和虚拟分组 ID
  function reorderItems(draggedId: string, targetId: string) {
    // 判断是文件还是虚拟分组
    const draggedFile = files.value.find(f => f.filePath === draggedId)
    const draggedVf = virtualFolders.value.find(vf => vf.id === draggedId)
    const targetFile = files.value.find(f => f.filePath === targetId)
    const targetVf = virtualFolders.value.find(vf => vf.id === targetId)

    // 至少要有一个拖拽项和一个目标项
    if (!draggedFile && !draggedVf) return
    if (!targetFile && !targetVf) return

    const draggedIsFavorite = draggedFile?.isFavorite ?? draggedVf?.isFavorite ?? false
    const targetIsFavorite = targetFile?.isFavorite ?? targetVf?.isFavorite ?? false

    const pathKey = getPathKey(currentPath.value)
    const activeSortMode = sortModeMap.value[pathKey] ?? 'manual'

    let currentOrderState = iconOrderMap.value[pathKey] ?? syncIconOrderState(undefined, files.value, virtualFolders.value)
    iconOrderMap.value[pathKey] = currentOrderState

    // 如果用户当前使用的是非 manual 排序（名称/类型），允许拖拽手动调整：
    // 1) 先把当前“屏幕上看到的顺序”固化成 iconOrderMap（避免跳回历史手动排序）
    // 2) 再执行本次拖拽插入
    // 3) 最后把排序模式切回 manual，让后续拖拽保持当前顺序
    if (activeSortMode !== 'manual') {
      const seedFavorites: string[] = []
      const seedNormals: string[] = []
      const seeded = new Set<string>()

      for (const item of displayItems.value) {
        const id = item.type === 'file' ? item.data.filePath : item.data.id
        if (seeded.has(id)) continue
        const isFav = item.type === 'file' ? item.data.isFavorite : item.data.isFavorite
        if (isFav) {
          seedFavorites.push(id)
        } else {
          seedNormals.push(id)
        }
        seeded.add(id)
      }

      // 把未显示的项目追加进去，避免丢失排序状态（例如搜索过滤时）
      const complete = syncIconOrderState(currentOrderState, files.value, virtualFolders.value)
      for (const id of complete.favorites) {
        if (!seeded.has(id)) {
          seedFavorites.push(id)
          seeded.add(id)
        }
      }
      for (const id of complete.normals) {
        if (!seeded.has(id)) {
          seedNormals.push(id)
          seeded.add(id)
        }
      }

      currentOrderState = { favorites: seedFavorites, normals: seedNormals }
      iconOrderMap.value[pathKey] = currentOrderState
    }

    const orderList = draggedIsFavorite ? currentOrderState.favorites : currentOrderState.normals

    if (!orderList.includes(draggedId)) {
      orderList.push(draggedId)
    }

    if (draggedIsFavorite !== targetIsFavorite) {
      // 跨收藏/普通区域拖拽
      const fromIndex = orderList.indexOf(draggedId)
      if (fromIndex === -1) return

      orderList.splice(fromIndex, 1)
      if (draggedIsFavorite) {
        orderList.push(draggedId)
      } else {
        orderList.unshift(draggedId)
      }
    } else {
      // 同区域内排序
      if (!orderList.includes(targetId)) {
        orderList.push(targetId)
      }

      const fromIndex = orderList.indexOf(draggedId)
      const targetIndex = orderList.indexOf(targetId)
      if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) return

      orderList.splice(fromIndex, 1)
      // 目标索引是在移除前计算的：当从上往下拖拽时，需要把插入位置往前挪 1
      const insertIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex
      orderList.splice(insertIndex, 0, draggedId)
    }

    // 拖拽手动调整后，自动切到 manual，但保持当前顺序（由上面的 seed + 本次插入决定）
    if (activeSortMode !== 'manual') {
      sortModeMap.value[pathKey] = 'manual'
      saveSortModeToStorage(sortModeMap.value)
    }

    files.value = applySortModeToList(sortFilesForDisplay(files.value, currentOrderState), 'manual')
    applyAllFilters()
  }

  // 基于索引的排序（用于间隙插入）
  function reorderItemToIndex(draggedId: string, targetDisplayIndex: number) {
    // 判断是文件还是虚拟分组
    const draggedFile = files.value.find(f => f.filePath === draggedId)
    const draggedVf = virtualFolders.value.find(vf => vf.id === draggedId)

    if (!draggedFile && !draggedVf) return

    const draggedIsFavorite = draggedFile?.isFavorite ?? draggedVf?.isFavorite ?? false

    const pathKey = getPathKey(currentPath.value)
    const activeSortMode = sortModeMap.value[pathKey] ?? 'manual'

    let currentOrderState = iconOrderMap.value[pathKey] ?? syncIconOrderState(undefined, files.value, virtualFolders.value)
    iconOrderMap.value[pathKey] = currentOrderState

    // 如果用户当前使用的是非 manual 排序，先固化当前显示顺序
    if (activeSortMode !== 'manual') {
      const seedFavorites: string[] = []
      const seedNormals: string[] = []
      const seeded = new Set<string>()

      for (const item of displayItems.value) {
        const id = item.type === 'file' ? item.data.filePath : item.data.id
        if (seeded.has(id)) continue
        const isFav = item.type === 'file' ? item.data.isFavorite : item.data.isFavorite
        if (isFav) {
          seedFavorites.push(id)
        } else {
          seedNormals.push(id)
        }
        seeded.add(id)
      }

      const complete = syncIconOrderState(currentOrderState, files.value, virtualFolders.value)
      for (const id of complete.favorites) {
        if (!seeded.has(id)) {
          seedFavorites.push(id)
          seeded.add(id)
        }
      }
      for (const id of complete.normals) {
        if (!seeded.has(id)) {
          seedNormals.push(id)
          seeded.add(id)
        }
      }

      currentOrderState = { favorites: seedFavorites, normals: seedNormals }
      iconOrderMap.value[pathKey] = currentOrderState
    }

    // 获取当前显示列表以确定目标位置所在的区域
    const currentDisplayItems = displayItems.value
    const favoriteCount = currentDisplayItems.filter(
      item => item.type === 'file' ? item.data.isFavorite : item.data.isFavorite
    ).length

    // 判断目标索引是在收藏区还是普通区
    const targetIsFavorite = targetDisplayIndex < favoriteCount

    const orderList = draggedIsFavorite ? currentOrderState.favorites : currentOrderState.normals

    if (!orderList.includes(draggedId)) {
      orderList.push(draggedId)
    }

    // 从原位置移除
    const fromIndex = orderList.indexOf(draggedId)
    if (fromIndex === -1) return
    orderList.splice(fromIndex, 1)

    if (draggedIsFavorite === targetIsFavorite) {
      // 同区域内移动
      // 计算在该区域内的相对索引
      const relativeTargetIndex = targetIsFavorite
        ? targetDisplayIndex
        : targetDisplayIndex - favoriteCount

      // 考虑移除后的索引偏移
      const adjustedIndex = Math.min(relativeTargetIndex, orderList.length)
      orderList.splice(adjustedIndex, 0, draggedId)
    } else {
      // 跨区域移动（收藏和普通之间）
      if (draggedIsFavorite) {
        // 从收藏移到普通
        orderList.push(draggedId)
      } else {
        // 从普通移到收藏
        orderList.unshift(draggedId)
      }
    }

    // 拖拽手动调整后，自动切到 manual
    if (activeSortMode !== 'manual') {
      sortModeMap.value[pathKey] = 'manual'
      saveSortModeToStorage(sortModeMap.value)
    }

    files.value = applySortModeToList(sortFilesForDisplay(files.value, currentOrderState), 'manual')
    applyAllFilters()
  }

  // 向后兼容的别名
  function reorderFiles(draggedFilePath: string, targetFilePath: string) {
    reorderItems(draggedFilePath, targetFilePath)
  }

  function persistIconOrder() {
    saveIconOrderToStorage(iconOrderMap.value)
  }

  async function openFile(filePath: string) {
    try {
      await invoke('open_file', { filePath })
    } catch (error) {
      console.error('❌ 打开文件失败：', error)
      useDialog().error(`打开文件失败：${error}`)
    }
  }

  async function showInExplorer(filePath: string) {
    try {
      await invoke('show_file', { filePath })
    } catch (error) {
      console.error('❌ 显示文件失败：', error)
      useDialog().error(`在资源管理器中显示失败：${error}`)
    }
  }

  async function renameFile(oldPath: string, newName: string) {
    try {
      await invoke('rename_file', { oldPath, newName })
      await loadFiles(currentPath.value ?? undefined)  // null 转为 undefined
    } catch (error) {
      console.error('❌ 重命名失败：', error)
      throw error
    }
  }

  async function deleteFile(filePath: string, useRecycleBin = false) {  // 改为 false（回收站未实现）
    try {
      await invoke('remove_file', { filePath, useRecycleBin })
      if (useRecycleBin) {
        lastDeletedPath.value = filePath
      }
      await loadFiles(currentPath.value ?? undefined)  // null 转为 undefined
    } catch (error) {
      console.error('❌ 删除失败：', error)
      throw error
    }
  }

  async function undoLastDelete() {
    if (!lastDeletedPath.value) {
      throw new Error('没有可撤销的删除')
    }
    const filePath = lastDeletedPath.value
    try {
      await invoke('restore_from_trash', { filePath })
      lastDeletedPath.value = null
      await loadFiles(currentPath.value ?? undefined)  // null 转为 undefined
    } catch (error) {
      console.error('撤销删除失败：', error)
      throw error
    }
  }

  async function createFile(parentPath: string, fileName: string, isDir: boolean) {
    try {
      await invoke('new_file', { parentPath, fileName, isDir })
      await loadFiles(currentPath.value ?? undefined)  // null 转为 undefined
    } catch (error) {
      console.error('❌ 创建失败：', error)
      throw error
    }
  }

  function togglePresetCategory(presetId: string) {
    const enabled = enabledPresetCategories.value
    if (enabled.has(presetId)) {
      enabled.delete(presetId)
    } else {
      enabled.add(presetId)
    }
    saveEnabledPresetCategoriesToStorage(enabled)
  }

  function isPresetCategoryEnabled(presetId: string): boolean {
    return enabledPresetCategories.value.has(presetId)
  }

  function reorderCategories(newOrder: string[]) {
    categoryOrder.value = newOrder
    saveCategoryOrderToStorage(newOrder)
  }

  // ==================== 虚拟分组操作 ====================

  // 计算属性：显示项目（文件 + 虚拟分组统一排序）
  const displayItems = computed<DisplayItem[]>(() => {
    const pathKey = getPathKey(currentPath.value)
    const orderState = iconOrderMap.value[pathKey] ?? { favorites: [], normals: [] }
    const sortMode = sortModeMap.value[pathKey] ?? 'manual'

    // 1. 根据分类筛选虚拟分组
    let filteredVirtualFolders = virtualFolders.value
    const categoryId = activeCategoryId.value

    if (categoryId !== 'all') {
      // 获取当前分类配置
      const customCat = customCategories.value.find(c => c.id === categoryId)
      const presetCat = categories.value.find(c => c.id === categoryId)

      if (customCat?.mode === 'manual') {
        // 手动分类：虚拟分组的成员路径必须与分类的 filePaths 有交集
        const categoryPaths = new Set(customCat.filePaths ?? [])
        filteredVirtualFolders = filteredVirtualFolders.filter(vf =>
          vf.memberPaths.some(p => categoryPaths.has(p))
        )
      } else if (presetCat?.fTypes || customCat?.fTypes) {
        // 类型分类：虚拟分组的成员文件类型必须与分类的 fTypes 有交集
        const typeSet = new Set(presetCat?.fTypes ?? customCat?.fTypes ?? [])
        filteredVirtualFolders = filteredVirtualFolders.filter(vf =>
          vf.memberPaths.some(p => {
            const file = files.value.find(f => f.filePath === p)
            return file && typeSet.has(file.fType)
          })
        )
      }
    }

    // 2. 再应用搜索筛选（原有逻辑）
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase()
      filteredVirtualFolders = filteredVirtualFolders.filter(f => {
        // 文件夹名称匹配
        if (f.name.toLowerCase().includes(query)) {
          return true
        }
        // 内部文件匹配
        return f.memberPaths.some(path => {
          const file = files.value.find(file => file.filePath === path)
          return file && file.fileName.toLowerCase().includes(query)
        })
      })
    }

    // 获取所有被虚拟分组包含的文件路径（这些文件不单独显示）
    const pathsInVirtualFolders = new Set<string>()
    for (const folder of virtualFolders.value) {
      for (const path of folder.memberPaths) {
        pathsInVirtualFolders.add(path)
      }
    }

    if (sortMode !== 'manual') {
      const items: DisplayItem[] = []

      for (const folder of filteredVirtualFolders) {
        items.push({ type: 'virtualFolder', data: folder })
      }

      for (const file of filteredFiles.value) {
        if (!pathsInVirtualFolders.has(file.filePath)) {
          items.push({ type: 'file', data: file })
        }
      }

      const compareByItemName = (a: DisplayItem, b: DisplayItem) => {
        const nameA = a.type === 'file' ? a.data.fileName : a.data.name
        const nameB = b.type === 'file' ? b.data.fileName : b.data.name
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
      }

      const compareByItemTypeThenName = (a: DisplayItem, b: DisplayItem) => {
        const typeA = a.type === 'file' ? (a.data.fType || '') : 'virtual-folder'
        const typeB = b.type === 'file' ? (b.data.fType || '') : 'virtual-folder'
        const t = typeA.localeCompare(typeB)
        if (t !== 0) return t
        return compareByItemName(a, b)
      }

      const sortFn =
        sortMode === 'nameAsc'
          ? (a: DisplayItem, b: DisplayItem) => compareByItemName(a, b)
          : sortMode === 'nameDesc'
            ? (a: DisplayItem, b: DisplayItem) => compareByItemName(b, a)
            : (a: DisplayItem, b: DisplayItem) => compareByItemTypeThenName(a, b)

      const favorites = items.filter(item => (item.type === 'file' ? item.data.isFavorite : item.data.isFavorite))
      const normals = items.filter(item => !(item.type === 'file' ? item.data.isFavorite : item.data.isFavorite))
      favorites.sort(sortFn)
      normals.sort(sortFn)
      return [...favorites, ...normals]
    }

    // 构建 ID -> DisplayItem 映射
    const itemMap = new Map<string, DisplayItem>()

    // 添加过滤后的虚拟分组
    for (const folder of filteredVirtualFolders) {
      itemMap.set(folder.id, { type: 'virtualFolder', data: folder })
    }

    // 添加不在虚拟分组中的文件
    for (const file of filteredFiles.value) {
      if (!pathsInVirtualFolders.has(file.filePath)) {
        itemMap.set(file.filePath, { type: 'file', data: file })
      }
    }

    // 按 iconOrderMap 顺序排列
    const result: DisplayItem[] = []
    const addedIds = new Set<string>()

    // 先添加收藏项（按保存的顺序）
    for (const id of orderState.favorites) {
      const item = itemMap.get(id)
      if (item && !addedIds.has(id)) {
        result.push(item)
        addedIds.add(id)
      }
    }

    // 再添加普通项（按保存的顺序）
    for (const id of orderState.normals) {
      const item = itemMap.get(id)
      if (item && !addedIds.has(id)) {
        result.push(item)
        addedIds.add(id)
      }
    }

    // 最后添加未在排序列表中的新项目
    for (const [id, item] of itemMap) {
      if (!addedIds.has(id)) {
        result.push(item)
        addedIds.add(id)
      }
    }

    return result
  })

  // 根据文件路径获取文件信息
  function getFileByPath(filePath: string): FileItem | undefined {
    return files.value.find(f => f.filePath === filePath)
  }

  // 获取虚拟分组的成员文件
  function getVirtualFolderMembers(folderId: string): FileItem[] {
    const folder = virtualFolders.value.find(f => f.id === folderId)
    if (!folder) return []

    const members: FileItem[] = []
    for (const path of folder.memberPaths) {
      const file = files.value.find(f => f.filePath === path)
      if (file) members.push(file)
    }
    return members
  }

  // 创建虚拟分组
  // insertAtPath: 新文件夹应该插入到该路径的位置（替换该路径在排序中的位置）
  function createVirtualFolder(memberPaths: string[], name?: string, insertAtPath?: string): VirtualFolder | null {
    const uniquePaths = Array.from(new Set(memberPaths.filter(p => p.trim())))
    if (uniquePaths.length < 2) return null

    const pathKey = getPathKey(currentPath.value)
    const baseOrderState = syncIconOrderState(iconOrderMap.value[pathKey], files.value, virtualFolders.value)
    const nextOrderState: IconOrderState = {
      favorites: [...baseOrderState.favorites],
      normals: [...baseOrderState.normals],
    }

    // 记录插入目标（B）的原始位置：必须在移除合并文件之前计算
    let targetList: keyof IconOrderState = 'normals'
    let targetIndex = -1
    if (insertAtPath) {
      const favIdx = baseOrderState.favorites.indexOf(insertAtPath)
      const normIdx = baseOrderState.normals.indexOf(insertAtPath)
      if (favIdx !== -1) {
        targetList = 'favorites'
        targetIndex = favIdx
      } else if (normIdx !== -1) {
        targetList = 'normals'
        targetIndex = normIdx
      }
    }

    const targetFile = insertAtPath ? getFileByPath(insertAtPath) : undefined
    const newFolderIsFavorite = targetList === 'favorites' || targetFile?.isFavorite === true

    const newFolder: VirtualFolder = {
      id: `vf_${Date.now()}`,
      name: name || '新文件夹',
      icon: '📁',
      memberPaths: uniquePaths,
      createdAt: Date.now(),
      position: virtualFolders.value.length,
      isFavorite: newFolderIsFavorite,
    }

    virtualFolders.value = [...virtualFolders.value, newFolder]
    // computed setter 自动保存

    // 从排序列表中移除被合并的文件路径（避免“隐藏项”残留在排序状态里）
    const mergedSet = new Set(uniquePaths)
    nextOrderState.favorites = nextOrderState.favorites.filter(id => !mergedSet.has(id))
    nextOrderState.normals = nextOrderState.normals.filter(id => !mergedSet.has(id))

    // 插入新文件夹：优先插入到 B（insertAtPath）的原位置；否则追加到末尾
    if (insertAtPath && targetIndex !== -1) {
      const originalList = targetList === 'favorites' ? baseOrderState.favorites : baseOrderState.normals
      const removedBeforeTarget = originalList
        .slice(0, targetIndex)
        .reduce((acc, id) => (mergedSet.has(id) ? acc + 1 : acc), 0)

      const insertIndex = Math.max(0, targetIndex - removedBeforeTarget)
      const list = targetList === 'favorites' ? nextOrderState.favorites : nextOrderState.normals
      list.splice(Math.min(insertIndex, list.length), 0, newFolder.id)
    } else {
      const list = newFolder.isFavorite ? nextOrderState.favorites : nextOrderState.normals
      if (!list.includes(newFolder.id)) {
        list.push(newFolder.id)
      }
    }

    iconOrderMap.value[pathKey] = nextOrderState
    saveIconOrderToStorage(iconOrderMap.value)

    return newFolder
  }

  // 添加文件到虚拟分组
  function addToVirtualFolder(folderId: string, filePaths: string[]): boolean {
    const folder = virtualFolders.value.find(f => f.id === folderId)
    if (!folder) return false

    const existingPaths = new Set(folder.memberPaths)
    const newPaths = filePaths.filter(p => p && !existingPaths.has(p))
    if (newPaths.length === 0) return false

    virtualFolders.value = virtualFolders.value.map(f =>
      f.id === folderId
        ? { ...f, memberPaths: [...f.memberPaths, ...newPaths] }
        : f
    )
    // computed setter 自动保存
    return true
  }

  // 从虚拟分组移除文件
  function removeFromVirtualFolder(folderId: string, filePath: string): boolean {
    const folder = virtualFolders.value.find(f => f.id === folderId)
    if (!folder) return false

    const newMemberPaths = folder.memberPaths.filter(p => p !== filePath)

    // 如果移除后少于1个成员，删除整个文件夹
    if (newMemberPaths.length < 1) {
      deleteVirtualFolder(folderId)
      return true
    }

    virtualFolders.value = virtualFolders.value.map(f =>
      f.id === folderId
        ? { ...f, memberPaths: newMemberPaths }
        : f
    )
    // computed setter 自动保存
    return true
  }

  // 重新排序虚拟分组内的成员
  function reorderVirtualFolderMembers(folderId: string, draggedPath: string, targetPath: string): boolean {
    const folder = virtualFolders.value.find(f => f.id === folderId)
    if (!folder) return false

    const paths = [...folder.memberPaths]
    const fromIndex = paths.indexOf(draggedPath)
    const toIndex = paths.indexOf(targetPath)

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return false

    // 移动元素
    paths.splice(fromIndex, 1)
    paths.splice(toIndex, 0, draggedPath)

    virtualFolders.value = virtualFolders.value.map(f =>
      f.id === folderId
        ? { ...f, memberPaths: paths }
        : f
    )
    // computed setter 自动保存
    return true
  }

  // 删除虚拟分组
  function deleteVirtualFolder(folderId: string): boolean {
    const before = virtualFolders.value.length
    virtualFolders.value = virtualFolders.value.filter(f => f.id !== folderId)
    if (virtualFolders.value.length === before) return false

    // computed setter 自动保存

    // 同步清理 iconOrderMap 中的残留 ID
    const pathKey = getPathKey(currentPath.value)
    const orderState = iconOrderMap.value[pathKey]
    if (orderState) {
      orderState.favorites = orderState.favorites.filter(id => id !== folderId)
      orderState.normals = orderState.normals.filter(id => id !== folderId)
      saveIconOrderToStorage(iconOrderMap.value)
    }

    return true
  }

  // 重命名虚拟分组
  function renameVirtualFolder(folderId: string, newName: string): boolean {
    const trimmedName = newName.trim()
    if (!trimmedName) return false

    const folder = virtualFolders.value.find(f => f.id === folderId)
    if (!folder) return false

    virtualFolders.value = virtualFolders.value.map(f =>
      f.id === folderId
        ? { ...f, name: trimmedName }
        : f
    )
    // computed setter 自动保存
    return true
  }

  // 更新虚拟分组图标
  function updateVirtualFolderIcon(folderId: string, icon: string): boolean {
    const folder = virtualFolders.value.find(f => f.id === folderId)
    if (!folder) return false

    virtualFolders.value = virtualFolders.value.map(f =>
      f.id === folderId
        ? { ...f, icon }
        : f
    )
    // computed setter 自动保存
    return true
  }

  // 切换虚拟分组收藏状态
  function toggleVirtualFolderFavorite(folderId: string) {
    const folder = virtualFolders.value.find(f => f.id === folderId)
    if (!folder) return

    const pathKey = getPathKey(currentPath.value)
    const currentOrderState = iconOrderMap.value[pathKey] ?? syncIconOrderState(undefined, files.value, virtualFolders.value)

    // 更新虚拟分组收藏状态
    const newIsFavorite = !folder.isFavorite
    virtualFolders.value = virtualFolders.value.map(f =>
      f.id === folderId
        ? { ...f, isFavorite: newIsFavorite }
        : f
    )
    // computed setter 自动保存

    // 更新排序列表
    if (newIsFavorite) {
      // 从 normals 移到 favorites
      currentOrderState.normals = currentOrderState.normals.filter(id => id !== folderId)
      if (!currentOrderState.favorites.includes(folderId)) {
        currentOrderState.favorites.push(folderId)
      }
    } else {
      // 从 favorites 移到 normals
      currentOrderState.favorites = currentOrderState.favorites.filter(id => id !== folderId)
      if (!currentOrderState.normals.includes(folderId)) {
        currentOrderState.normals.unshift(folderId)
      }
    }

    iconOrderMap.value[pathKey] = currentOrderState
    saveIconOrderToStorage(iconOrderMap.value)

    const sortMode = getSortModeForCurrentPath()
    files.value = applySortModeToList(sortFilesForDisplay(files.value, currentOrderState), sortMode)
    applyAllFilters()
  }

  // 查找文件所属的虚拟分组
  function findVirtualFolderByFilePath(filePath: string): VirtualFolder | undefined {
    return virtualFolders.value.find(f => f.memberPaths.includes(filePath))
  }

  // 清理虚拟分组中不存在的文件引用
  function cleanupVirtualFolders() {
    const existingPaths = new Set(files.value.map(f => f.filePath))
    let changed = false

    virtualFolders.value = virtualFolders.value.map(folder => {
      const validPaths = folder.memberPaths.filter(p => existingPaths.has(p))
      if (validPaths.length !== folder.memberPaths.length) {
        changed = true
        return { ...folder, memberPaths: validPaths }
      }
      return folder
    }).filter(folder => folder.memberPaths.length > 0)

    if (changed) {
      // computed setter 自动保存
    }
  }

  // 获取所有有缓存数据的文件夹列表
  function getCachedFoldersList(): FolderCacheInfo[] {
    const pathKeys = new Set<string>()

    // 收集 iconOrderMap 中的路径
    Object.keys(iconOrderMap.value).forEach(key => pathKeys.add(key))

    // 收集 sortModeMap 中的路径
    Object.keys(sortModeMap.value).forEach(key => pathKeys.add(key))

    // 收集 virtualFoldersMap 中的路径
    Object.keys(virtualFoldersMap.value).forEach(key => pathKeys.add(key))

    // 收集 favoritesMap 中的路径
    Object.keys(favoritesMap.value).forEach(key => pathKeys.add(key))

    return Array.from(pathKeys).map(pathKey => ({
      pathKey,
      displayName: pathKey === DESKTOP_PATH_KEY ? '桌面（默认）' : pathKey,
      hasIconOrder: !!iconOrderMap.value[pathKey],
      hasSortMode: !!sortModeMap.value[pathKey],
      hasVirtualFolders: (virtualFoldersMap.value[pathKey]?.length ?? 0) > 0,
      virtualFolderCount: virtualFoldersMap.value[pathKey]?.length ?? 0,
      hasFavorites: (favoritesMap.value[pathKey]?.length ?? 0) > 0,
      favoritesCount: favoritesMap.value[pathKey]?.length ?? 0
    }))
  }

  // 清除指定文件夹的缓存数据
  function clearFolderCache(pathKey: string) {
    // 删除图标排序
    if (iconOrderMap.value[pathKey]) {
      delete iconOrderMap.value[pathKey]
      saveIconOrderToStorage(iconOrderMap.value)
    }

    // 删除排序模式
    if (sortModeMap.value[pathKey]) {
      delete sortModeMap.value[pathKey]
      saveSortModeToStorage(sortModeMap.value)
    }

    // 删除虚拟分组
    if (virtualFoldersMap.value[pathKey]) {
      delete virtualFoldersMap.value[pathKey]
      saveVirtualFoldersMapToStorage(virtualFoldersMap.value)
    }

    // 删除收藏
    if (favoritesMap.value[pathKey]) {
      delete favoritesMap.value[pathKey]
      saveFavoritesMapToStorage(favoritesMap.value)
    }

    // 如果清除的是当前路径，重新应用过滤
    if (getPathKey(currentPath.value) === pathKey) {
      applyAllFilters()
    }
  }

  return {
    // 状态
    files,
    filteredFiles,
    currentPath,
    loading,
    loadingIcons,
    categories,
    activeCategoryId,
    virtualFolders,
    displayItems,
    // 计算属性
    fileCount,
    favoriteFiles,
    fileTypeOptions,
    // 常量
    ALL_PATHS_KEY,
    // 方法
    loadFiles,
    loadAllFoldersFiles,
    getDisplayName,
    toggleFavorite,
    searchFiles,
    setActiveCategory,
    createCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
    addFilesToCategory,
    removeFilesFromCategory,
    getActiveCustomCategory,
    reorderFiles,
    reorderItems,
    reorderItemToIndex,
    persistIconOrder,
    openFile,
    showInExplorer,
    renameFile,
    deleteFile,
    undoLastDelete,
    createFile,
    ensureDesktopPath,
    getCurrentDirectoryPath,
    getSortModeForCurrentPath,
    setSortModeForCurrentPath,
    lastDeletedPath,
    togglePresetCategory,
    isPresetCategoryEnabled,
    reorderCategories,
    // 虚拟分组方法
    getFileByPath,
    getVirtualFolderMembers,
    createVirtualFolder,
    addToVirtualFolder,
    removeFromVirtualFolder,
    reorderVirtualFolderMembers,
    deleteVirtualFolder,
    renameVirtualFolder,
    updateVirtualFolderIcon,
    toggleVirtualFolderFavorite,
    findVirtualFolderByFilePath,
    cleanupVirtualFolders,
    // 缓存管理方法
    getCachedFoldersList,
    clearFolderCache,
  }
})
