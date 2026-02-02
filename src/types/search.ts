// 搜索相关类型定义

// 输入类型
export type InputType = 'command' | 'navigate' | 'search' | 'auto'

// 命令输入
export interface CommandInput {
  command: string
  args?: string[]
}

// 导航输入
export interface NavigateInput {
  type: 'url' | 'path' | 'system_folder'
  value: string
  normalized?: string  // 标准化后的值（URL 添加协议等）
}

// 搜索输入
export interface SearchInput {
  query: string
}

// 解析结果
export type ParseResult =
  | { type: 'command'; data: CommandInput }
  | { type: 'navigate'; data: NavigateInput }
  | { type: 'search'; data: SearchInput }

// 命令定义
export type CommandCategory = 'system' | 'file' | 'app' | 'search' | 'custom'

export interface Command {
  id: string
  name: string
  description: string
  aliases: string[]
  icon: string
  execute: (args?: string[]) => Promise<void>
  category: CommandCategory
  keywords?: string[]  // 额外的搜索关键词
}

// 建议项类型
export type SuggestionType = 'command' | 'file' | 'navigate' | 'history'

export interface Suggestion {
  id: string
  type: SuggestionType
  title: string
  description?: string
  icon: string
  shortcut?: string  // 快捷键提示
  score?: number     // 匹配分数（用于排序）
  action: () => void | Promise<void>
}

// 建议分组
export interface SuggestionGroup {
  title: string
  items: Suggestion[]
}

// 搜索历史项
export interface SearchHistoryItem {
  id: string
  type: InputType
  query: string
  timestamp: number
  frequency: number  // 使用频率
}

// URL 检测结果
export interface URLDetectionResult {
  isURL: boolean
  protocol?: string      // http, https, ftp, file 等
  normalized?: string    // 标准化后的 URL
  confidence?: number    // 置信度 (0-1)
}
