// 输入解析器 - 分析用户输入，识别意图类型
import type { ParseResult, InputType } from '../types/search'
import { detectURL } from './urlDetector'

// 路径检测模式
const PATH_PATTERNS = {
  // Windows 绝对路径：C:\, D:\, E:\ 等
  windowsAbsolute: /^[A-Z]:\\/i,

  // UNC 路径：\\server\share
  unc: /^\\\\/,

  // 相对路径：./, ../
  relative: /^\.\.?\//,
}

// 系统文件夹快捷词（中英文）
const SYSTEM_FOLDERS: Record<string, string> = {
  // 英文
  'desktop': 'Desktop',
  'downloads': 'Downloads',
  'documents': 'Documents',
  'pictures': 'Pictures',
  'music': 'Music',
  'videos': 'Videos',
  'home': 'UserProfile',

  // 中文
  '桌面': 'Desktop',
  '下载': 'Downloads',
  '文档': 'Documents',
  '图片': 'Pictures',
  '音乐': 'Music',
  '视频': 'Videos',
  '主文件夹': 'UserProfile',
}

/**
 * 检测输入是否为文件路径
 */
export function isPath(input: string): boolean {
  const trimmed = input.trim()

  // 检查是否匹配路径模式
  return Object.values(PATH_PATTERNS).some(pattern => pattern.test(trimmed))
}

/**
 * 检测输入是否为系统文件夹快捷词
 */
export function isSystemFolderShortcut(input: string): boolean {
  const lowerInput = input.toLowerCase().trim()
  return lowerInput in SYSTEM_FOLDERS
}

/**
 * 获取系统文件夹标准名称
 */
export function getSystemFolderName(input: string): string | null {
  const lowerInput = input.toLowerCase().trim()
  return SYSTEM_FOLDERS[lowerInput] ?? null
}

/**
 * 解析命令输入（以 > 或 cmd: 开头）
 */
function parseCommand(input: string): ParseResult {
  // 移除命令前缀
  let commandStr = input
  if (commandStr.startsWith('>')) {
    commandStr = commandStr.slice(1).trim()
  } else if (commandStr.toLowerCase().startsWith('cmd:')) {
    commandStr = commandStr.slice(4).trim()
  }

  // 分割命令和参数（简单实现，不处理引号）
  const parts = commandStr.split(/\s+/)
  const command = parts[0] || ''
  const args = parts.slice(1)

  return {
    type: 'command',
    data: {
      command,
      args: args.length > 0 ? args : undefined,
    },
  }
}

/**
 * 解析导航输入（URL 或路径）
 */
function parseNavigate(input: string): ParseResult {
  const trimmed = input.trim()

  // 1. 检测 URL
  const urlResult = detectURL(trimmed)
  if (urlResult.isURL && urlResult.normalized) {
    return {
      type: 'navigate',
      data: {
        type: 'url',
        value: trimmed,
        normalized: urlResult.normalized,
      },
    }
  }

  // 2. 检测系统文件夹快捷词
  if (isSystemFolderShortcut(trimmed)) {
    return {
      type: 'navigate',
      data: {
        type: 'system_folder',
        value: trimmed,
        normalized: getSystemFolderName(trimmed) || trimmed,
      },
    }
  }

  // 3. 检测文件路径
  if (isPath(trimmed)) {
    return {
      type: 'navigate',
      data: {
        type: 'path',
        value: trimmed,
        normalized: trimmed,
      },
    }
  }

  // 默认作为搜索
  return {
    type: 'search',
    data: {
      query: trimmed,
    },
  }
}

/**
 * 检测输入类型
 */
export function detectInputType(query: string): InputType {
  const trimmed = query.trim()

  if (!trimmed) return 'auto'

  // 1. 检测命令模式（以 > 或 cmd: 开头）
  if (trimmed.startsWith('>') || trimmed.toLowerCase().startsWith('cmd:')) {
    return 'command'
  }

  // 2. 检测 URL
  const urlResult = detectURL(trimmed)
  if (urlResult.isURL && (urlResult.confidence ?? 0) >= 0.7) {
    return 'navigate'
  }

  // 3. 检测路径
  if (isPath(trimmed)) {
    return 'navigate'
  }

  // 4. 检测系统文件夹快捷词
  if (isSystemFolderShortcut(trimmed)) {
    return 'navigate'
  }

  // 5. 默认为搜索
  return 'search'
}

/**
 * 主解析函数 - 解析用户输入并返回解析结果
 */
export function parseInput(query: string): ParseResult {
  const trimmed = query.trim()

  if (!trimmed) {
    return {
      type: 'search',
      data: { query: '' },
    }
  }

  // 1. 命令模式
  if (trimmed.startsWith('>') || trimmed.toLowerCase().startsWith('cmd:')) {
    return parseCommand(trimmed)
  }

  // 2. 导航模式（URL、路径、系统文件夹）
  const inputType = detectInputType(trimmed)
  if (inputType === 'navigate') {
    return parseNavigate(trimmed)
  }

  // 3. 搜索模式
  return {
    type: 'search',
    data: {
      query: trimmed,
    },
  }
}
