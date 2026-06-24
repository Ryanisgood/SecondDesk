// 命令注册表 - 管理所有可执行命令
import { invoke } from '@tauri-apps/api/core'
import type { Command } from '../types/search'
import { t, type MessageKey } from '../i18n'

function localizedCommand(command: Command, nameKey: MessageKey, descriptionKey: MessageKey): Command {
  return {
    ...command,
    get name() {
      return t(nameKey)
    },
    get description() {
      return t(descriptionKey)
    },
  }
}

// 内置命令列表
const BUILTIN_COMMANDS: Command[] = [
  // ==================== 系统命令 ====================
  localizedCommand({
    id: 'calc',
    name: '',
    description: '',
    aliases: ['calculator', '计算器', 'cal'],
    icon: '🧮',
    category: 'system',
    keywords: ['数学', 'math', '计算'],
    execute: async () => {
      await invoke('launch_application', { appName: 'calc.exe' })
    },
  }, 'command.calc.name', 'command.calc.description'),
  localizedCommand({
    id: 'cmd',
    name: '',
    description: '',
    aliases: ['command', '命令行'],
    icon: '/src/assets/search/cmd.png',
    category: 'system',
    keywords: ['终端', 'terminal', 'console', '命令'],
    execute: async (args?: string[]) => {
      if (args && args.length > 0) {
        // 执行 CMD 命令
        const command = args.join(' ')
        await invoke('execute_shell_command', {
          shell: 'cmd',
          command,
        })
      } else {
        // 打开空的 CMD 窗口
        await invoke('launch_application', { appName: 'cmd.exe' })
      }
    },
  }, 'command.cmd.name', 'command.cmd.description'),
  localizedCommand({
    id: 'powershell',
    name: 'PowerShell',
    description: '',
    aliases: ['ps', 'pwsh', 'posh'],
    icon: '/src/assets/search/powershell.png',
    category: 'system',
    keywords: ['终端', 'terminal', 'shell', '命令'],
    execute: async (args?: string[]) => {
      if (args && args.length > 0) {
        // 执行 PowerShell 命令
        const command = args.join(' ')
        await invoke('execute_shell_command', {
          shell: 'powershell',
          command,
        })
      } else {
        // 打开空的 PowerShell 窗口
        await invoke('launch_application', { appName: 'powershell.exe' })
      }
    },
  }, 'command.powershell.name', 'command.powershell.description'),
  localizedCommand({
    id: 'notepad',
    name: '',
    description: '',
    aliases: ['记事本', 'note'],
    icon: '📝',
    category: 'system',
    keywords: ['文本', 'text', 'editor'],
    execute: async () => {
      await invoke('launch_application', { appName: 'notepad.exe' })
    },
  }, 'command.notepad.name', 'command.notepad.description'),
  localizedCommand({
    id: 'explorer',
    name: '',
    description: '',
    aliases: ['文件管理器', 'file explorer', 'files'],
    icon: '📁',
    category: 'system',
    keywords: ['文件', 'folder', '目录'],
    execute: async () => {
      await invoke('launch_application', { appName: 'explorer.exe' })
    },
  }, 'command.explorer.name', 'command.explorer.description'),
  localizedCommand({
    id: 'taskmgr',
    name: '',
    description: '',
    aliases: ['task manager', '进程管理'],
    icon: '📊',
    category: 'system',
    keywords: ['进程', 'process', '性能'],
    execute: async () => {
      await invoke('launch_application', { appName: 'taskmgr.exe' })
    },
  }, 'command.taskmgr.name', 'command.taskmgr.description'),
  localizedCommand({
    id: 'mspaint',
    name: '',
    description: '',
    aliases: ['paint', '绘图'],
    icon: '🎨',
    category: 'system',
    keywords: ['图片', 'image', '编辑'],
    execute: async () => {
      await invoke('launch_application', { appName: 'mspaint.exe' })
    },
  }, 'command.mspaint.name', 'command.mspaint.description'),
  localizedCommand({
    id: 'control',
    name: '',
    description: '',
    aliases: ['控制面板', 'settings'],
    icon: '⚙️',
    category: 'system',
    keywords: ['设置', '系统'],
    execute: async () => {
      await invoke('launch_application', { appName: 'control.exe' })
    },
  }, 'command.control.name', 'command.control.description'),
  localizedCommand({
    id: 'regedit',
    name: '',
    description: '',
    aliases: ['registry', '注册表'],
    icon: '📋',
    category: 'system',
    keywords: ['系统', 'system'],
    execute: async () => {
      await invoke('launch_application', { appName: 'regedit.exe' })
    },
  }, 'command.regedit.name', 'command.regedit.description'),
  localizedCommand({
    id: 'msconfig',
    name: '',
    description: '',
    aliases: ['系统配置', 'config'],
    icon: '🔧',
    category: 'system',
    keywords: ['启动', 'startup'],
    execute: async () => {
      await invoke('launch_application', { appName: 'msconfig.exe' })
    },
  }, 'command.msconfig.name', 'command.msconfig.description'),

  // ==================== 搜索引擎 ====================
  localizedCommand({
    id: 'baidu',
    name: '',
    description: '',
    aliases: ['bd', '百度'],
    icon: '/src/assets/search/baidu.png',
    category: 'search',
    keywords: ['搜索', 'search', 'baidu'],
    execute: async (args?: string[]) => {
      if (args && args.length > 0) {
        const query = args.join(' ')
        const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
        await invoke('open_url', { url })
      } else {
        await invoke('open_url', { url: 'https://www.baidu.com' })
      }
    },
  }, 'command.baidu.name', 'command.baidu.description'),
  localizedCommand({
    id: 'google',
    name: '',
    description: '',
    aliases: ['gg', 'google', '谷歌'],
    icon: '/src/assets/search/google.png',
    category: 'search',
    keywords: ['搜索', 'search', 'google'],
    execute: async (args?: string[]) => {
      if (args && args.length > 0) {
        const query = args.join(' ')
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
        await invoke('open_url', { url })
      } else {
        await invoke('open_url', { url: 'https://www.google.com' })
      }
    },
  }, 'command.google.name', 'command.google.description'),
  localizedCommand({
    id: 'bing',
    name: '',
    description: '',
    aliases: ['必应'],
    icon: '/src/assets/search/bing.png',
    category: 'search',
    keywords: ['搜索', 'search', 'bing'],
    execute: async (args?: string[]) => {
      if (args && args.length > 0) {
        const query = args.join(' ')
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`
        await invoke('open_url', { url })
      } else {
        await invoke('open_url', { url: 'https://www.bing.com' })
      }
    },
  }, 'command.bing.name', 'command.bing.description'),
]

// 命令注册表类
class CommandRegistry {
  private commands: Map<string, Command> = new Map()

  constructor() {
    // 注册内置命令
    this.registerCommands(BUILTIN_COMMANDS)
  }

  /**
   * 注册单个命令
   */
  registerCommand(command: Command): void {
    this.commands.set(command.id, command)
  }

  /**
   * 批量注册命令
   */
  registerCommands(commands: Command[]): void {
    commands.forEach(cmd => this.registerCommand(cmd))
  }

  /**
   * 获取命令
   */
  getCommand(id: string): Command | undefined {
    return this.commands.get(id)
  }

  /**
   * 获取所有命令
   */
  getAllCommands(): Command[] {
    return Array.from(this.commands.values())
  }

  /**
   * 查找匹配的命令（支持模糊搜索）
   */
  findCommands(query: string): Command[] {
    if (!query.trim()) {
      return this.getAllCommands()
    }

    const lowerQuery = query.toLowerCase()
    const results: Array<{ command: Command; score: number }> = []

    for (const command of this.commands.values()) {
      let score = 0

      // 精确匹配 ID（最高优先级）
      if (command.id === lowerQuery) {
        score = 1000
      }
      // ID 包含查询（高优先级）
      else if (command.id.toLowerCase().includes(lowerQuery)) {
        score = 800
      }
      // 名称精确匹配
      else if (command.name.toLowerCase() === lowerQuery) {
        score = 900
      }
      // 名称包含查询
      else if (command.name.toLowerCase().includes(lowerQuery)) {
        score = 700
      }
      // 别名匹配
      else if (command.aliases.some(alias => alias.toLowerCase() === lowerQuery)) {
        score = 850
      }
      // 别名包含查询
      else if (command.aliases.some(alias => alias.toLowerCase().includes(lowerQuery))) {
        score = 650
      }
      // 描述包含查询
      else if (command.description.toLowerCase().includes(lowerQuery)) {
        score = 500
      }
      // 关键词匹配
      else if (command.keywords?.some(keyword => keyword.toLowerCase().includes(lowerQuery))) {
        score = 600
      }

      if (score > 0) {
        results.push({ command, score })
      }
    }

    // 按分数降序排序
    results.sort((a, b) => b.score - a.score)

    return results.map(r => r.command)
  }

  /**
   * 执行命令
   */
  async executeCommand(id: string, args?: string[]): Promise<void> {
    const command = this.commands.get(id)
    if (!command) {
      throw new Error(t('command.notFound', { id }))
    }

    try {
      await command.execute(args)
    } catch (error) {
      console.error(`执行命令失败 [${id}]:`, error)
      throw error
    }
  }

  /**
   * 取消注册命令
   */
  unregisterCommand(id: string): boolean {
    return this.commands.delete(id)
  }
}

// 导出单例实例
export const commandRegistry = new CommandRegistry()

// 导出便捷函数
export function registerCommand(command: Command): void {
  commandRegistry.registerCommand(command)
}

export function findCommands(query: string): Command[] {
  return commandRegistry.findCommands(query)
}

export function executeCommand(id: string, args?: string[]): Promise<void> {
  return commandRegistry.executeCommand(id, args)
}

export function getAllCommands(): Command[] {
  return commandRegistry.getAllCommands()
}
