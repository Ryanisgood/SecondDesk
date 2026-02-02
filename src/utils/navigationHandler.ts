// 导航处理器 - 处理 URL 和路径导航
import { invoke } from '@tauri-apps/api/core'
import { detectURL } from './urlDetector'
import { isPath, isSystemFolderShortcut, getSystemFolderName } from './searchParser'
import { useFileStore } from '../stores/files'

/**
 * 移除字符串首尾的引号（单引号或双引号）
 */
function removeQuotes(str: string): string {
  const trimmed = str.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/**
 * 处理导航操作
 * @param input 用户输入（URL、路径或系统文件夹快捷词）
 */
export async function handleNavigation(input: string): Promise<void> {
  const trimmed = input.trim()

  if (!trimmed) {
    throw new Error('导航输入不能为空')
  }

  // 移除引号（如果有）
  const unquoted = removeQuotes(trimmed)

  // 1. 检测 URL（URL不需要移除引号）
  const urlResult = detectURL(trimmed)
  if (urlResult.isURL && urlResult.normalized) {
    await openURL(urlResult.normalized)
    return
  }

  // 2. 检测系统文件夹快捷词
  if (isSystemFolderShortcut(unquoted)) {
    const folderName = getSystemFolderName(unquoted)
    if (folderName) {
      await navigateToSystemFolder(folderName)
      return
    }
  }

  // 3. 检测文件路径
  if (isPath(trimmed)) {
    await navigateToPath(unquoted)  // 使用移除引号后的路径
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
 * 获取文件夹的显示名称
 */
function getFolderDisplayName(folderName: string): string {
  const nameMap: Record<string, string> = {
    'Desktop': '桌面',
    'Downloads': '下载',
    'Documents': '文档',
    'Pictures': '图片',
    'Music': '音乐',
    'Videos': '视频',
    'UserProfile': '用户',
  }
  return nameMap[folderName] || folderName
}

/**
 * 导航到系统文件夹
 */
async function navigateToSystemFolder(folderName: string): Promise<void> {
  try {
    // 获取系统文件夹路径
    const path = await invoke<string>('get_known_folder', { folder: folderName })

    if (!path) {
      throw new Error(`无法获取${getFolderDisplayName(folderName)}路径`)
    }

    // 在 Windows 资源管理器中打开文件夹
    await invoke('open_file', { filePath: path })
  } catch (error) {
    console.error('导航到系统文件夹失败:', error)

    // 提供更友好的错误消息
    const displayName = getFolderDisplayName(folderName)
    const originalError = error instanceof Error ? error.message : String(error)

    throw new Error(
      `无法打开${displayName}文件夹。请检查系统权限设置。\n详细错误: ${originalError}`
    )
  }
}

/**
 * 导航到指定路径
 */
async function navigateToPath(path: string): Promise<void> {
  try {
    // 在 Windows 资源管理器中打开路径
    await invoke('open_file', { filePath: path })
  } catch (error) {
    console.error('导航到路径失败:', error)
    throw new Error(`无法打开路径: ${path}`)
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
