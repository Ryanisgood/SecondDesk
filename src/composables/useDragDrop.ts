import { reactive, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { DRAG_THRESHOLDS, DRAG_DATA_TYPES } from '../config/dragConfig'
import type {
  DragState,
  DragIntent,
  TargetType,
  DragDropOptions,
} from '../types/drag'
import { getItemPath } from '../types/drag'
import type { DisplayItem } from '../stores/files'
import { useFileStore } from '../stores/files'
import { useDialog } from './useDialog'

// 初始状态
function createInitialState(): DragState {
  return {
    isDragging: false,
    draggedItem: null,
    draggedPaths: [],
    targetType: null,
    targetItem: null,
    targetRect: null,
    currentIntent: 'none',
    showInsertLine: false,
    insertLinePosition: null,
    showMergePreview: false,
    showMoveWarning: false,
    showPlaceholder: false,
    placeholderIndex: null,
  }
}

export function useDragDrop(options: DragDropOptions = {}) {
  const fileStore = useFileStore()
  const dialog = useDialog()
  const state = reactive<DragState>(createInitialState())

  // 非渲染状态，不需要响应式追踪
  let _hoverStartTime: number | null = null
  let _hoverPosition: { x: number; y: number } | null = null

  // 意图检测定时器
  let intentCheckInterval: number | null = null

  // 重置状态
  function resetState() {
    Object.assign(state, createInitialState())
    _hoverStartTime = null
    _hoverPosition = null
    if (intentCheckInterval) {
      clearInterval(intentCheckInterval)
      intentCheckInterval = null
    }
  }

  // 计算当前拖拽意图
  function determineDragIntent(): DragIntent {
    if (!state.isDragging || !state.targetItem) {
      return state.targetType === 'gap' ? 'reorder' : 'none'
    }

    const now = Date.now()
    const hoverDuration = _hoverStartTime ? now - _hoverStartTime : 0

    // 检查目标类型
    const targetIsRealFolder = state.targetType === 'folder'
    const targetIsVirtualFolder = state.targetType === 'virtual-folder'
    const targetIsFile = state.targetType === 'file'

    // 优先级：真实文件夹 > 虚拟分组 > 排序
    // 1. 真实文件夹：只能 reorder 或 real-move，不能 virtual-merge
    if (targetIsRealFolder) {
      if (hoverDuration >= DRAG_THRESHOLDS.REAL_FOLDER_MS) {
        return 'real-move'
      }
      // 真实文件夹不参与虚拟分组合并
      return 'reorder'
    }

    // 2. 虚拟分组
    if (targetIsVirtualFolder) {
      if (hoverDuration >= DRAG_THRESHOLDS.VIRTUAL_FOLDER_MS) {
        return 'virtual-merge'
      }
      return 'reorder'
    }

    // 3. 普通文件
    if (targetIsFile) {
      if (hoverDuration >= DRAG_THRESHOLDS.VIRTUAL_FOLDER_MS) {
        return 'virtual-merge'
      }
      return 'reorder'
    }

    // 4. 空隙
    return 'reorder'
  }

  // 更新视觉反馈
  function updateVisualFeedback() {
    const intent = state.currentIntent

    // 排序意图：在间隙时由 handleDragOverGap 控制插入线，图标上不显示任何效果
    // 合并/移动意图：在图标上显示预览效果
    state.showPlaceholder = false  // 不再使用覆盖层
    state.showMergePreview = intent === 'virtual-merge'
    state.showMoveWarning = intent === 'real-move'

    // 当不在间隙且不是合并/移动时，隐藏插入线
    if (state.targetType !== 'gap') {
      state.showInsertLine = false
      state.insertLinePosition = null
    }
  }

  // 开始拖拽
  function startDrag(item: DisplayItem, event: DragEvent) {
    state.isDragging = true
    state.draggedItem = item
    state.draggedPaths = [getItemPath(item)]

    // 设置 dataTransfer
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'

      if (item.type === 'file') {
        event.dataTransfer.setData(DRAG_DATA_TYPES.FILE_PATH, item.data.filePath)
        event.dataTransfer.setData('text/plain', item.data.fileName)
      } else {
        event.dataTransfer.setData(DRAG_DATA_TYPES.VIRTUAL_FOLDER_ID, item.data.id)
      }
    }

    // 启动意图检测
    intentCheckInterval = window.setInterval(() => {
      state.currentIntent = determineDragIntent()
      updateVisualFeedback()
    }, DRAG_THRESHOLDS.INTENT_CHECK_INTERVAL_MS)
  }

  // 检测目标类型
  function detectTargetType(item: DisplayItem | null): TargetType {
    if (!item) return 'gap'

    if (item.type === 'virtualFolder') {
      return 'virtual-folder'
    }

    if (item.type === 'file') {
      if (item.data.fType === 'dir') {
        return 'folder'
      }
      return 'file'
    }

    return null
  }

  // 处理拖拽经过
  function handleDragOver(
    event: DragEvent,
    targetItem: DisplayItem | null,
    targetRect: DOMRect | null
  ) {
    event.preventDefault()

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }

    const currentPos = { x: event.clientX, y: event.clientY }

    // 检查目标是否改变
    const newTargetPath = targetItem ? getItemPath(targetItem) : null
    const oldTargetPath = state.targetItem ? getItemPath(state.targetItem) : null

    if (newTargetPath !== oldTargetPath) {
      // 目标改变，重置悬停计时
      state.targetItem = targetItem
      state.targetType = detectTargetType(targetItem)
      state.targetRect = targetRect
      _hoverStartTime = Date.now()
      _hoverPosition = currentPos
    } else {
      // 检查是否移动超过容差
      if (_hoverPosition) {
        const dx = currentPos.x - _hoverPosition.x
        const dy = currentPos.y - _hoverPosition.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance > DRAG_THRESHOLDS.HOVER_TOLERANCE_PIXELS) {
          // 移动过多，重置计时
          _hoverStartTime = Date.now()
          _hoverPosition = currentPos
        }
      }
    }
  }

  // 间隙插入信息
  interface GapInsertInfo {
    index: number           // 插入索引
    x: number               // 插入线 x 坐标（相对于容器）
    y: number               // 插入线 y 坐标（相对于容器）
    height: number          // 插入线高度
  }

  // 处理进入间隙（在图标之间）
  function handleDragOverGap(event: DragEvent, insertInfo?: GapInsertInfo) {
    event.preventDefault()

    state.targetItem = null
    state.targetType = 'gap'
    _hoverStartTime = null
    state.showPlaceholder = false
    state.placeholderIndex = null

    // 设置插入线位置
    if (insertInfo) {
      state.showInsertLine = true
      state.insertLinePosition = {
        type: 'vertical',
        index: insertInfo.index,
        top: insertInfo.y,
        left: insertInfo.x,
        width: 3,
        height: insertInfo.height,
      }
      state.placeholderIndex = insertInfo.index
    } else {
      state.showInsertLine = false
      state.insertLinePosition = null
    }
  }

  // 清除当前悬停目标（不结束拖拽）
  function clearDragTarget() {
    state.targetType = null
    state.targetItem = null
    state.targetRect = null
    _hoverStartTime = null
    _hoverPosition = null

    state.currentIntent = 'none'
    state.showInsertLine = false
    state.insertLinePosition = null
    state.showMergePreview = false
    state.showMoveWarning = false
    state.showPlaceholder = false
    state.placeholderIndex = null
  }

  // 结束拖拽
  async function endDrag() {
    if (!state.isDragging) return

    const intent = determineDragIntent()
    state.currentIntent = intent
    const draggedItem = state.draggedItem
    const targetItem = state.targetItem
    const insertIndex = state.placeholderIndex

    // 清理定时器
    if (intentCheckInterval) {
      clearInterval(intentCheckInterval)
      intentCheckInterval = null
    }

    try {
      switch (intent) {
        case 'reorder':
          // 间隙排序：使用插入索引
          if (state.targetType === 'gap' && insertIndex !== null) {
            await executeReorderByIndex(draggedItem, insertIndex)
          } else if (targetItem) {
            // 图标上排序：使用目标项
            await executeReorder(draggedItem, targetItem)
          }
          break
        case 'virtual-merge':
          await executeVirtualMerge(draggedItem, targetItem)
          break
        case 'real-move':
          await executeRealMove(draggedItem, targetItem)
          break
      }
    } catch (error) {
      console.error('拖拽操作失败：', error)
    }

    // 重置状态
    resetState()
  }

  // 执行排序（支持文件和虚拟分组）
  async function executeReorder(
    draggedItem: DisplayItem | null,
    targetItem: DisplayItem | null
  ) {
    if (!draggedItem || !targetItem) return

    const draggedId = getItemPath(draggedItem)
    const targetId = getItemPath(targetItem)

    if (draggedId === targetId) return

    // 调用 store 的通用排序方法（支持文件路径和虚拟分组 ID）
    fileStore.reorderItems(draggedId, targetId)
    fileStore.persistIconOrder()

    // 触发回调
    options.onReorder?.(draggedId, targetId)
  }

  // 执行基于索引的排序（用于间隙插入）
  async function executeReorderByIndex(
    draggedItem: DisplayItem | null,
    targetIndex: number
  ) {
    if (!draggedItem) return

    const draggedId = getItemPath(draggedItem)

    // 调用 store 的索引排序方法
    fileStore.reorderItemToIndex(draggedId, targetIndex)
    fileStore.persistIconOrder()

    // 触发回调
    options.onReorder?.(draggedId, `index:${targetIndex}`)
  }

  // 执行虚拟分组合并
  async function executeVirtualMerge(
    draggedItem: DisplayItem | null,
    targetItem: DisplayItem | null
  ) {
    if (!draggedItem || !targetItem) return

    const draggedPath = getItemPath(draggedItem)

    // 情况1：拖到已有虚拟分组
    if (targetItem.type === 'virtualFolder') {
      if (draggedItem.type === 'file') {
        fileStore.addToVirtualFolder(targetItem.data.id, [draggedItem.data.filePath])
      }
      options.onVirtualMerge?.([draggedPath], targetItem)
      return
    }

    // 情况2：两个普通文件合并创建新虚拟分组（排除真实文件夹）
    if (draggedItem.type === 'file' && targetItem.type === 'file' && targetItem.data.fType !== 'dir') {
      const paths = [draggedItem.data.filePath, targetItem.data.filePath]
      // 新文件夹插入到目标文件（B文件）的位置
      const targetPath = targetItem.data.filePath
      fileStore.createVirtualFolder(paths, undefined, targetPath)
      options.onVirtualMerge?.(paths, targetItem)
      return
    }
  }

  // 执行真实文件夹移动
  async function executeRealMove(
    draggedItem: DisplayItem | null,
    targetItem: DisplayItem | null
  ) {
    if (!draggedItem || draggedItem.type !== 'file') return
    if (!targetItem || targetItem.type !== 'file') return
    if (targetItem.data.fType !== 'dir') return

    const sourcePath = draggedItem.data.filePath
    const targetDir = targetItem.data.filePath

    try {
      // 调用后端移动文件
      await invoke<string>('move_file', {
        sourcePath,
        targetDir,
      })

      // 如果文件在虚拟分组中，需要更新引用
      const virtualFolder = fileStore.findVirtualFolderByFilePath(sourcePath)
      if (virtualFolder) {
        fileStore.removeFromVirtualFolder(virtualFolder.id, sourcePath)
      }

      // 重新加载文件列表
      await fileStore.loadFiles(fileStore.currentPath ?? undefined)

      options.onRealMove?.([sourcePath], targetDir)
    } catch (error) {
      console.error('移动文件失败：', error)
      await dialog.error(`移动文件失败：${error}`)
    }
  }

  // 取消拖拽
  function cancelDrag() {
    resetState()
  }

  // 清理
  onUnmounted(() => {
    if (intentCheckInterval) {
      clearInterval(intentCheckInterval)
    }
  })

  return {
    state,
    startDrag,
    handleDragOver,
    handleDragOverGap,
    clearDragTarget,
    endDrag,
    cancelDrag,
    resetState,
  }
}
