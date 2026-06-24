// 搜索状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Suggestion, SearchHistoryItem, InputType } from '../types/search'
import { detectInputType, parseInput } from '../utils/searchParser'
import { findCommands } from '../utils/commandRegistry'
import { useFileStore } from './files'
import { useDrawerStore, DrawerState } from './drawer'
import { t } from '../i18n'

// 搜索历史存储 Key
const SEARCH_HISTORY_KEY = 'seconddesk_search_history'

// 最大历史记录数量
const MAX_HISTORY_SIZE = 50

/**
 * 加载搜索历史
 */
function loadSearchHistory(): SearchHistoryItem[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (error) {
    console.error('加载搜索历史失败:', error)
  }
  return []
}

/**
 * 保存搜索历史
 */
function saveSearchHistory(history: SearchHistoryItem[]): void {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history))
  } catch (error) {
    console.error('保存搜索历史失败:', error)
  }
}

export const useSearchStore = defineStore('search', () => {
  // ==================== 状态 ====================
  const query = ref<string>('')                    // 当前搜索查询
  const mode = ref<InputType>('auto')              // 搜索模式
  const suggestions = ref<Suggestion[]>([])        // 建议列表
  const history = ref<SearchHistoryItem[]>(loadSearchHistory())
  const selectedIndex = ref<number>(-1)            // 当前选中的建议索引
  const showSuggestions = ref<boolean>(false)      // 是否显示建议菜单

  // ==================== 计算属性 ====================
  const hasQuery = computed(() => query.value.trim().length > 0)

  const selectedSuggestion = computed(() => {
    if (selectedIndex.value >= 0 && selectedIndex.value < suggestions.value.length) {
      return suggestions.value[selectedIndex.value]
    }
    return null
  })

  // ==================== 方法 ====================

  /**
   * 设置查询并更新模式和建议
   */
  function setQuery(newQuery: string): void {
    query.value = newQuery

    // 更新模式
    mode.value = detectInputType(newQuery)

    // 生成建议
    updateSuggestions()

    // 显示建议菜单
    if (newQuery.trim()) {
      showSuggestions.value = true
    } else {
      showSuggestions.value = false
    }
  }

  /**
   * 更新建议列表
   */
  function updateSuggestions(): void {
    const trimmedQuery = query.value.trim()

    if (!trimmedQuery) {
      suggestions.value = []
      selectedIndex.value = -1
      return
    }

    const parseResult = parseInput(trimmedQuery)
    const newSuggestions: Suggestion[] = []

    // 根据输入类型生成不同的建议
    if (parseResult.type === 'command') {
      // 命令模式：显示匹配的命令
      const matchedCommands = findCommands(parseResult.data.command)
      newSuggestions.push(...matchedCommands.slice(0, 8).map(cmd => {
        let description = cmd.description

        // 为搜索引擎命令添加动态描述
        if (['baidu', 'google', 'bing'].includes(cmd.id)) {
          if (parseResult.data.args && parseResult.data.args.length > 0) {
            const query = parseResult.data.args.join(' ')
            description = t('search.searchFor', { query })
          } else {
            description = t('search.openHome')
          }
        }

        return {
          id: `cmd-${cmd.id}`,
          type: 'command' as const,
          title: cmd.name,
          description,
          icon: cmd.icon,
          action: async () => {
            await cmd.execute(parseResult.data.args)
          },
        }
      }))
    } else if (parseResult.type === 'navigate') {
      // 导航模式：显示导航目标
      const navData = parseResult.data
      newSuggestions.push({
        id: 'nav-target',
        type: 'navigate',
        title: navData.type === 'url'
          ? t('search.openWebsite')
          : navData.type === 'path'
            ? t('search.openFolder')
            : t('search.openSystemFolder'),
        description: navData.normalized || navData.value,
        icon: navData.type === 'url' ? '🌐' : '📁',
        action: async () => {
          const { handleNavigation } = await import('../utils/navigationHandler')
          await handleNavigation(navData.value)
        },
      })
    } else {
      // 搜索模式：显示匹配的文件
      const fileStore = useFileStore()
      const matchedFiles = fileStore.filteredFiles.slice(0, 10)

      newSuggestions.push(...matchedFiles.map(file => ({
        id: `file-${file.filePath}`,
        type: 'file' as const,
        title: file.fileName,
        description: file.filePath,
        icon: '📄',
        action: async () => {
          await fileStore.openFile(file.filePath)
        },
      })))
    }

    // 添加相关历史记录（最多 3 条）
    const relevantHistory = getRelevantHistory(trimmedQuery, 3)
    if (relevantHistory.length > 0 && newSuggestions.length < 10) {
      newSuggestions.push(...relevantHistory.slice(0, 10 - newSuggestions.length).map(item => ({
        id: `history-${item.id}`,
        type: 'history' as const,
        title: item.query,
        description: t('search.recentlyUsed', { count: item.frequency }),
        icon: '🕐',
        action: () => {
          setQuery(item.query)
        },
      })))
    }

    suggestions.value = newSuggestions
    selectedIndex.value = -1  // 重置选中索引
  }

  /**
   * 获取相关历史记录
   */
  function getRelevantHistory(query: string, limit: number = 5): SearchHistoryItem[] {
    const lowerQuery = query.toLowerCase()

    const relevant = history.value
      .filter(item => item.query.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        // 按频率和时间排序
        const freqDiff = b.frequency - a.frequency
        if (freqDiff !== 0) return freqDiff
        return b.timestamp - a.timestamp
      })
      .slice(0, limit)

    return relevant
  }

  /**
   * 添加到历史记录
   */
  function addToHistory(query: string, type: InputType): void {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    const existingIndex = history.value.findIndex(item => item.query === trimmedQuery)

    if (existingIndex >= 0) {
      // 更新现有记录
      const existing = history.value[existingIndex]
      history.value.splice(existingIndex, 1)
      history.value.unshift({
        ...existing,
        timestamp: Date.now(),
        frequency: existing.frequency + 1,
      })
    } else {
      // 添加新记录
      history.value.unshift({
        id: `hist-${Date.now()}`,
        type,
        query: trimmedQuery,
        timestamp: Date.now(),
        frequency: 1,
      })
    }

    // 限制历史记录数量
    if (history.value.length > MAX_HISTORY_SIZE) {
      history.value = history.value.slice(0, MAX_HISTORY_SIZE)
    }

    saveSearchHistory(history.value)
  }

  /**
   * 清空搜索
   */
  function clear(): void {
    query.value = ''
    suggestions.value = []
    selectedIndex.value = -1
    showSuggestions.value = false
    mode.value = 'auto'

    // 同步清空 fileStore 的搜索过滤,恢复显示全部文件
    const fileStore = useFileStore()
    fileStore.searchFiles('')
  }

  /**
   * 执行当前选中的建议或默认操作
   */
  async function execute(): Promise<void> {
    const trimmedQuery = query.value.trim()

    if (!trimmedQuery) return

    // 记录当前操作类型，用于判断是否需要隐藏窗口
    let shouldHide = false
    let shouldClear = false  // 默认不清空，只在 command/navigate 成功时才清空

    try {
      // 如果有选中的建议，执行建议的操作
      if (selectedSuggestion.value) {
        const suggestionType = selectedSuggestion.value.type as InputType

        // command 和 navigate 类型需要隐藏窗口和清空状态
        // file 类型由 App.vue 的 handleFileOpened() 处理
        if (suggestionType === 'command' || suggestionType === 'navigate') {
          shouldHide = true
          shouldClear = true
        }

        await selectedSuggestion.value.action()
        addToHistory(trimmedQuery, mode.value)
      } else {
        // 否则执行默认操作
        const parseResult = parseInput(trimmedQuery)

        if (parseResult.type === 'command') {
          // 命令模式：执行第一个匹配的命令
          const commands = findCommands(parseResult.data.command)
          if (commands.length > 0) {
            await commands[0].execute(parseResult.data.args)
            addToHistory(trimmedQuery, 'command')
            shouldHide = true
            shouldClear = true
          }
        } else if (parseResult.type === 'navigate') {
          // 导航模式：执行导航（在资源管理器或浏览器中打开）
          const { handleNavigation } = await import('../utils/navigationHandler')
          await handleNavigation(parseResult.data.value)
          addToHistory(trimmedQuery, 'navigate')

          // 导航后隐藏窗口和清空状态
          shouldHide = true
          shouldClear = true
        } else {
          // 搜索模式：打开第一个匹配的文件
          // 注意：不在这里清空和隐藏，由 App.vue 的 handleFileOpened() 处理
          const fileStore = useFileStore()
          if (fileStore.filteredFiles.length > 0) {
            await fileStore.openFile(fileStore.filteredFiles[0].filePath)
            addToHistory(trimmedQuery, 'search')
          }
          // search 模式不设置 shouldHide 和 shouldClear
        }
      }

      // 如果是命令或导航操作，且配置了打开后隐藏，则先隐藏窗口
      if (shouldHide) {
        const drawerStore = useDrawerStore()
        if (drawerStore.config.behavior.hideOnOpen) {
          drawerStore.setState(DrawerState.Hidden)
        }
      }

      // 最后清空状态（在隐藏窗口之后）
      if (shouldClear) {
        clear()
      }
    } catch (error) {
      // 执行失败，不清空也不隐藏，让用户可以看到错误
      console.error('执行操作失败:', error)
      // 重新抛出错误，让调用者处理
      throw error
    }
  }

  /**
   * 导航建议列表（↑↓键）
   */
  function navigateSuggestions(direction: 'up' | 'down'): void {
    if (suggestions.value.length === 0) return

    if (direction === 'down') {
      selectedIndex.value = (selectedIndex.value + 1) % suggestions.value.length
    } else {
      selectedIndex.value = selectedIndex.value <= 0
        ? suggestions.value.length - 1
        : selectedIndex.value - 1
    }
  }

  /**
   * 选择建议
   */
  function selectSuggestion(index: number): void {
    if (index >= 0 && index < suggestions.value.length) {
      selectedIndex.value = index
    }
  }

  /**
   * 隐藏建议菜单
   */
  function hideSuggestions(): void {
    showSuggestions.value = false
  }

  /**
   * 显示建议菜单
   */
  function displaySuggestions(): void {
    if (query.value.trim()) {
      showSuggestions.value = true
    }
  }

  /**
   * 清空历史记录
   */
  function clearHistory(): void {
    history.value = []
    saveSearchHistory([])
  }

  return {
    // 状态
    query,
    mode,
    suggestions,
    history,
    selectedIndex,
    showSuggestions,

    // 计算属性
    hasQuery,
    selectedSuggestion,

    // 方法
    setQuery,
    updateSuggestions,
    addToHistory,
    clear,
    execute,
    navigateSuggestions,
    selectSuggestion,
    hideSuggestions,
    displaySuggestions,
    clearHistory,
  }
})
