import type { DisplayItem } from '../stores/files'

// 拖拽意图类型
export type DragIntent =
  | 'none'           // 无操作
  | 'reorder'        // 排序（改变位置）
  | 'virtual-merge'  // 虚拟分组合并（创建或添加）
  | 'real-move'      // 真实文件夹移动（文件系统操作）

// 目标类型
export type TargetType =
  | 'gap'            // 空隙/插槽
  | 'file'           // 普通文件
  | 'folder'         // 真实文件夹
  | 'virtual-folder' // 虚拟分组
  | null

// 拖拽状态
export interface DragState {
  // 基础状态
  isDragging: boolean
  draggedItem: DisplayItem | null
  draggedPaths: string[]           // 支持多选拖拽

  // 目标检测
  targetType: TargetType
  targetItem: DisplayItem | null
  targetRect: DOMRect | null

  // 悬停计时（已移至普通变量，不需响应式）
  // hoverStartTime: number | null
  // hoverPosition: { x: number; y: number } | null

  // 当前意图
  currentIntent: DragIntent

  // 视觉反馈状态
  showInsertLine: boolean
  insertLinePosition: InsertLinePosition | null
  showMergePreview: boolean
  showMoveWarning: boolean

  // 占位符状态
  showPlaceholder: boolean
  placeholderIndex: number | null
}

// 插入线位置（支持水平和垂直方向）
export interface InsertLinePosition {
  type: 'horizontal' | 'vertical'
  index: number
  top: number
  left: number | string
  width: number | string
  height: number
}

// 拖拽操作结果
export interface DragResult {
  success: boolean
  intent: DragIntent
  error?: string
}

// 命中检测结果
export interface HitTestResult {
  type: 'gap' | 'icon'
  item?: DisplayItem
  position?: number
  rect?: DOMRect
}

// 拖拽事件处理器选项
export interface DragDropOptions {
  // 回调函数
  onReorder?: (draggedPath: string, targetPath: string) => void
  onVirtualMerge?: (draggedPaths: string[], targetItem: DisplayItem) => void
  onRealMove?: (draggedPaths: string[], targetFolderPath: string) => void

  // 配置
  enableReorder?: boolean
  enableVirtualMerge?: boolean
  enableRealMove?: boolean
}

// 辅助类型：从 DisplayItem 提取路径
export function getItemPath(item: DisplayItem): string {
  if (item.type === 'file') {
    return item.data.filePath
  } else {
    return item.data.id
  }
}

// 辅助类型：判断是否为文件夹（真实）
export function isRealFolder(item: DisplayItem): boolean {
  return item.type === 'file' && item.data.fType === 'dir'
}

// 辅助类型：判断是否为虚拟分组
export function isVirtualFolder(item: DisplayItem): boolean {
  return item.type === 'virtualFolder'
}

// 辅助类型：从 DisplayItem 获取显示名称
export function getItemName(item: DisplayItem): string {
  if (item.type === 'file') {
    return item.data.fileName
  } else {
    return item.data.name
  }
}
