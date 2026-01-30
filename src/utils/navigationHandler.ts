// 导航处理器 - 处理 URL 和路径导航
import { invoke } from '@tauri-apps/api/core'
import { detectURL } from './urlDetector'
import { isPath, isSystemFolderShortcut, getSystemFolderName } from './searchParser'
import { useFileStore } from '../stores/files'

/**
 * 处理导航操作
 * @param input 用户输入（URL、路径或系统文件夹快捷词）
 */
export async function handleNavigation(input: string): Promise<void> {
  const trimmed = input.trim()

  if (!trimmed) {
    throw new Error('导航输入不能为空')
  }

  // 1. 检测 URL
  const urlResult = detectURL(trimmed)
  if (urlResult.isURL && urlResult.normalized) {
    await openURL(urlResult.normalized)
    return
  }

  // 2. 检测系统文件夹快捷词
  if (isSystemFolderShortcut(trimmed)) {
    const folderName = getSystemFolderName(trimmed)
    if (folderName) {
      await navigateToSystemFolder(folderName)
      return
    }
  }

  // 3. 检测文件路径
  if (isPath(trimmed)) {
    await navigateToPath(trimmed)
    return
  }

  // 如果都不是，抛出错误
  throw new Error('无法识别的导航目标')
}

/**
 * 打开 URL
 */
async function openURL(url: string): Promise<void> {
  try {
    await invoke('open_url', { url })
  } catch (error) {
    console.error('打开 URL 失败:', error)
    throw new Error(`无法打开 URL: ${url}`)
  }
}

/**
 * 导航到系统文件夹
 */
async function navigateToSystemFolder(folderName: string): Promise<void> {
  try {
    // 获取系统文件夹路径
    const path = await invoke<string>('get_known_folder', { folder: folderName })

    if (!path) {
      throw new Error(`无法获取系统文件夹: ${folderName}`)
    }

    // 加载文件列表
    const fileStore = useFileStore()
    await fileStore.loadFiles(path)
  } catch (error) {
    console.error('导航到系统文件夹失败:', error)
    throw new Error(`无法访问系统文件夹: ${folderName}`)
  }
}

/**
 * 导航到指定路径
 */
async function navigateToPath(path: string): Promise<void> {
  try {
    // 加载文件列表
    const fileStore = useFileStore()
    await fileStore.loadFiles(path)
  } catch (error) {
    console.error('导航到路径失败:', error)
    throw new Error(`无法访问路径: ${path}`)
  }
}

/**
 * 快速检查是否为导航输入
 */
export function isNavigationInput(input: string): boolean {
  const trimmed = input.trim()

  // 检测 URL
  const urlResult = detectURL(trimmed)
  if (urlResult.isURL && (urlResult.confidence ?? 0) >= 0.7) {
    return true
  }

  // 检测路径
  if (isPath(trimmed)) {
    return true
  }

  // 检测系统文件夹快捷词
  if (isSystemFolderShortcut(trimmed)) {
    return true
  }

  return false
}
