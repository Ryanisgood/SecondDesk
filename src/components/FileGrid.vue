<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useFileStore, type FileItem, type VirtualFolder, type DisplayItem, type SortMode } from '../stores/files'
import { useBatchSelectStore } from '../stores/batchSelect'
import { getFileIcon, preloadIcons } from '../utils/iconMapper'
import { useDragDrop } from '../composables/useDragDrop'
import { useLongPress } from '../composables/useLongPress'
import { getItemPath } from '../types/drag'
import ContextMenu from './ContextMenu.vue'
import VirtualFolderContextMenu from './VirtualFolderContextMenu.vue'
import RenameDialog from './RenameDialog.vue'
import VirtualFolderRenameDialog from './VirtualFolderRenameDialog.vue'
import NewItemDialog from './NewItemDialog.vue'
import BackgroundContextMenu from './BackgroundContextMenu.vue'
import VirtualFolderIcon from './VirtualFolderIcon.vue'
import VirtualFolderModal from './VirtualFolderModal.vue'
import { useDialog } from '../composables/useDialog'
import { getIconPath } from '../utils/iconHelper'
import { useI18n } from '../i18n'

// 图标路径
const iconEmpty = getIconPath('empty')

interface Props {
  viewMode?: 'grid' | 'list'
  iconSize?: 'small' | 'medium' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  viewMode: 'grid',
  iconSize: 'medium'
})

const fileStore = useFileStore()
const batchStore = useBatchSelectStore()
const dialog = useDialog()
const { t } = useI18n()

// 当前选中的单个项目（非批量模式下的视觉选中）
const selectedItemId = ref<string | null>(null)

// 长按检测
const { isLongPressing, handlePointerDown, handlePointerMove, handlePointerUp, cancelLongPress, resetLongPressState } = useLongPress({
  onLongPress: (id: string) => {
    // 清除单选状态
    selectedItemId.value = null
    batchStore.startBatchSelect(id)
  }
})

// 获取显示名称（隐藏 .url 和 .lnk 扩展名，聚合视图下显示重名后缀）
function getDisplayName(file: FileItem): string {
  // 聚合视图：优先使用 store 的重名映射
  const storeDisplayName = fileStore.getDisplayName(file)
  const name = storeDisplayName !== file.fileName ? storeDisplayName : file.fileName

  const lower = name.toLowerCase()
  if (lower.endsWith('.url') || lower.endsWith('.lnk')) {
    return name.slice(0, name.lastIndexOf('.'))
  }
  return name
}

// 处理图标加载失败
function handleIconError(e: Event) {
  const img = e.target as HTMLImageElement
  // 使用默认未知文件图标
  import('../assets/file_icos/unkonw.png').then(module => {
    img.src = module.default
  })
}

// 使用 displayItems 代替 filteredFiles（包含虚拟分组）
const displayItems = computed(() => fileStore.displayItems)

// 判断当前是否是自定义 manual 分类
const isCustomManualCategory = computed(() => {
  return fileStore.getActiveCustomCategory() !== null
})
let ignoreClicksUntil = 0

// 拖拽系统
const { state: dragState, startDrag, handleDragOver, handleDragOverGap, clearDragTarget, endDrag } = useDragDrop()

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuFile = ref<FileItem | null>(null)

// 虚拟分组右键菜单状态
const vfContextMenuVisible = ref(false)
const vfContextMenuPosition = ref({ x: 0, y: 0 })
const vfContextMenuFolder = ref<VirtualFolder | null>(null)

// 空白处右键菜单状态
const backgroundMenuVisible = ref(false)
const backgroundMenuPosition = ref({ x: 0, y: 0 })

// 虚拟分组弹窗状态
const virtualFolderModalVisible = ref(false)
const activeVirtualFolder = ref<VirtualFolder | null>(null)

// 新建文件/文件夹对话框状态
const newItemDialogVisible = ref(false)
const newItemIsDir = ref(false)

// 网格容器引用（用于间隙检测）
const fileGridRef = ref<HTMLElement | null>(null)

const emit = defineEmits<{
  (e: 'auto-hide-suspend'): void
  (e: 'auto-hide-resume'): void
  (e: 'file-opened'): void
}>()

// 重命名对话框状态
const renameDialogVisible = ref(false)
const renameDialogFile = ref<FileItem | null>(null)

// 虚拟分组重命名对话框状态
const vfRenameDialogVisible = ref(false)
const vfRenameDialogFolder = ref<VirtualFolder | null>(null)

// 预加载图标
onMounted(() => {
  preloadIcons()
})

// ==================== 点击处理 ====================

// 判断项目是否为当前选中项（非批量模式）
function isSingleSelected(item: DisplayItem): boolean {
  if (batchStore.isActive) return false
  const id = item.type === 'file' ? item.data.filePath : item.data.id
  return selectedItemId.value === id
}

// 单击处理
function handleItemClick(item: DisplayItem) {
  if (Date.now() < ignoreClicksUntil) return

  // 如果刚刚触发了长按，忽略此次点击
  if (isLongPressing.value) {
    resetLongPressState()
    return
  }

  const id = item.type === 'file' ? item.data.filePath : item.data.id

  // 批量选择模式下，切换选中状态
  if (batchStore.isActive) {
    batchStore.toggleSelect(id)
    return
  }

  // 虚拟分组：单击直接打开
  if (item.type === 'virtualFolder') {
    handleVirtualFolderClick(item.data)
    return
  }

  // 文件：单击选中（视觉选中，不进入批量模式）
  selectedItemId.value = id
}

// 双击处理：打开文件
function handleItemDoubleClick(item: DisplayItem) {
  if (Date.now() < ignoreClicksUntil) return

  if (isLongPressing.value) {
    resetLongPressState()
    return
  }

  // 清除单选状态
  selectedItemId.value = null

  // 退出批量选择模式
  if (batchStore.isActive) {
    batchStore.exitBatchSelect()
  }

  if (item.type === 'file') {
    handleFileClick(item.data)
  } else {
    handleVirtualFolderClick(item.data)
  }
}

// 获取项目的唯一 ID
function getItemId(item: DisplayItem): string {
  return item.type === 'file' ? item.data.filePath : item.data.id
}

// 判断项目是否被选中
function isItemSelected(item: DisplayItem): boolean {
  return batchStore.isSelected(getItemId(item))
}

function handleFileClick(file: FileItem) {
  // 所有文件（包括文件夹）都用 openFile 打开
  // openFile 会调用 `start` 命令，会正确打开文件夹
  fileStore.openFile(file.filePath)

  // 关闭右键菜单
  closeContextMenu()
  closeBackgroundMenu()

  // 通知父组件文件已打开（用于隐藏窗口等后续操作）
  emit('file-opened')
}

function handleVirtualFolderClick(folder: VirtualFolder) {
  // 关闭所有右键菜单
  closeContextMenu()
  closeVirtualFolderContextMenu()
  closeBackgroundMenu()

  activeVirtualFolder.value = folder
  virtualFolderModalVisible.value = true
  emit('auto-hide-suspend')
}

function closeVirtualFolderModal() {
  virtualFolderModalVisible.value = false
  activeVirtualFolder.value = null
  emit('auto-hide-resume')
}

function handleVirtualFolderRemoveFile(filePath: string) {
  if (!activeVirtualFolder.value) return
  fileStore.removeFromVirtualFolder(activeVirtualFolder.value.id, filePath)

  // 如果文件夹为空，关闭弹窗
  const members = fileStore.getVirtualFolderMembers(activeVirtualFolder.value.id)
  if (members.length === 0) {
    closeVirtualFolderModal()
  }
}

function handleVirtualFolderOpenFile(file: FileItem) {
  // 先关闭虚拟分组弹窗
  closeVirtualFolderModal()
  // 再打开文件（会触发 file-opened 事件）
  handleFileClick(file)
}

// ==================== 右键菜单 ====================

function handleItemRightClick(item: DisplayItem, event: MouseEvent) {
  if (item.type === 'file') {
    handleRightClick(item.data, event)
  } else {
    handleVirtualFolderRightClick(item.data, event)
  }
}

function handleRightClick(file: FileItem, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  setBackgroundMenuVisible(false)
  closeVirtualFolderContextMenu()

  contextMenuFile.value = file
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  setFileMenuVisible(true)
}

function handleVirtualFolderRightClick(folder: VirtualFolder, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  closeContextMenu()
  setBackgroundMenuVisible(false)

  vfContextMenuFolder.value = folder
  vfContextMenuPosition.value = { x: event.clientX, y: event.clientY }
  setVirtualFolderMenuVisible(true)
}

function closeContextMenu() {
  setFileMenuVisible(false)
}

function closeVirtualFolderContextMenu() {
  setVirtualFolderMenuVisible(false)
}

function setFileMenuVisible(visible: boolean) {
  if (contextMenuVisible.value === visible) return
  contextMenuVisible.value = visible
  if (visible) {
    emit('auto-hide-suspend')
  } else {
    emit('auto-hide-resume')
    contextMenuFile.value = null
  }
}

function setVirtualFolderMenuVisible(visible: boolean) {
  if (vfContextMenuVisible.value === visible) return
  vfContextMenuVisible.value = visible
  if (visible) {
    emit('auto-hide-suspend')
  } else {
    emit('auto-hide-resume')
    vfContextMenuFolder.value = null
  }
}

function setBackgroundMenuVisible(visible: boolean) {
  if (backgroundMenuVisible.value === visible) return
  backgroundMenuVisible.value = visible
  if (visible) {
    emit('auto-hide-suspend')
  } else {
    emit('auto-hide-resume')
  }
}

function closeBackgroundMenu() {
  setBackgroundMenuVisible(false)
}

function handleBackgroundRightClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('.file-item') || target.closest('.virtual-folder-icon')) return

  event.preventDefault()
  event.stopPropagation()

  closeContextMenu()
  closeVirtualFolderContextMenu()
  backgroundMenuPosition.value = { x: event.clientX, y: event.clientY }
  setBackgroundMenuVisible(true)
}

// 点击空白处：清除单选状态
function handleBackgroundClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('.file-item') || target.closest('.virtual-folder-icon')) return

  // 清除单选状态
  selectedItemId.value = null
}

// ==================== 右键菜单事件处理 ====================

function handleContextMenuOpen(file: FileItem) {
  handleFileClick(file)
}

function handleContextMenuShowInExplorer(file: FileItem) {
  fileStore.showInExplorer(file.filePath)
}

function handleContextMenuRename(file: FileItem) {
  renameDialogFile.value = file
  renameDialogVisible.value = true
}

async function handleContextMenuDelete(file: FileItem) {
  const confirmDelete = await dialog.confirmDanger(
    t('context.deleteFileConfirm', { name: file.fileName }),
    { title: t('context.deleteFileTitle') }
  )
  if (!confirmDelete) return

  try {
    await fileStore.deleteFile(file.filePath, true)
  } catch (error) {
    await dialog.error(t('context.deleteFailed', { error }))
  }
}

function handleContextMenuToggleFavorite(file: FileItem) {
  fileStore.toggleFavorite(file.filePath)
}

async function handleContextMenuProperties(file: FileItem) {
  try {
    await invoke('show_file_properties', { filePath: file.filePath })
  } catch (error) {
    await dialog.error(t('context.propertiesFailed', { error }))
  }
}

function handleContextMenuRemoveFromCategory(file: FileItem) {
  const category = fileStore.getActiveCustomCategory()
  if (!category) return
  fileStore.removeFilesFromCategory(category.id, [file.filePath])
}

// ==================== 虚拟分组右键菜单事件处理 ====================

function handleVFContextMenuOpen(folder: VirtualFolder) {
  handleVirtualFolderClick(folder)
}

function handleVFContextMenuRename(folder: VirtualFolder) {
  vfRenameDialogFolder.value = folder
  vfRenameDialogVisible.value = true
  emit('auto-hide-suspend')
}

async function handleVFContextMenuDelete(folder: VirtualFolder) {
  const confirmDelete = await dialog.confirmDanger(
    t('virtualFolder.deleteConfirm', { name: folder.name }),
    { title: t('virtualFolder.deleteTitle') }
  )
  if (!confirmDelete) {
    closeVirtualFolderContextMenu()
    return
  }

  fileStore.deleteVirtualFolder(folder.id)
  closeVirtualFolderContextMenu()
}

function handleVFContextMenuToggleFavorite(folder: VirtualFolder) {
  fileStore.toggleVirtualFolderFavorite(folder.id)
}

async function handleBackgroundRefresh() {
  await fileStore.loadFiles(fileStore.currentPath ?? undefined)
}

function handleBackgroundNew(isDir: boolean) {
  newItemIsDir.value = isDir
  newItemDialogVisible.value = true
}

async function handleNewItemConfirm(name: string) {
  try {
    const parentPath = await fileStore.getCurrentDirectoryPath()
    await fileStore.createFile(parentPath, name, newItemIsDir.value)
    newItemDialogVisible.value = false
  } catch (error) {
    await dialog.error(t('error.createFile', { error }))
  }
}

function closeNewItemDialog() {
  newItemDialogVisible.value = false
}

function handleBackgroundSetSortMode(mode: SortMode) {
  fileStore.setSortModeForCurrentPath(mode)
}

async function handleBackgroundUndoDelete() {
  try {
    await fileStore.undoLastDelete()
  } catch (error) {
    await dialog.error(`${error}`)
  }
}

function closeRenameDialog() {
  renameDialogVisible.value = false
  renameDialogFile.value = null
}

async function handleRenameConfirm(newName: string) {
  if (!renameDialogFile.value) return

  try {
    await fileStore.renameFile(renameDialogFile.value.filePath, newName)
    closeRenameDialog()
  } catch (error) {
    await dialog.error(t('rename.failed', { error }))
  }
}

function closeVFRenameDialog() {
  vfRenameDialogVisible.value = false
  vfRenameDialogFolder.value = null
  emit('auto-hide-resume')
}

function handleVFRenameConfirm(newName: string) {
  if (!vfRenameDialogFolder.value) return

  const success = fileStore.renameVirtualFolder(vfRenameDialogFolder.value.id, newName)
  if (success) {
    closeVFRenameDialog()
  } else {
    dialog.error(t('rename.failed', { error: '' }).trim())
  }
}

function handleToggleFavorite(file: FileItem, event: MouseEvent) {
  event.stopPropagation()
  fileStore.toggleFavorite(file.filePath)
}

// ==================== 拖拽处理 ====================

function handleDragStart(item: DisplayItem, event: DragEvent) {
  // 开始拖拽时取消长按检测，避免拖拽也触发批量选择
  cancelLongPress()

  // 批量选择模式下禁止拖拽
  if (batchStore.isActive) {
    event.preventDefault()
    return
  }

  ignoreClicksUntil = Date.now() + 250
  startDrag(item, event)
}

function handleDragEnter(item: DisplayItem, event: DragEvent) {
  event.preventDefault()

  if (!dragState.isDragging) return

  const draggedPath = dragState.draggedItem ? getItemPath(dragState.draggedItem) : null
  const targetPath = getItemPath(item)

  if (draggedPath === targetPath) return

  // 获取目标元素的位置
  const targetEl = event.currentTarget as HTMLElement
  const rect = targetEl.getBoundingClientRect()

  handleDragOver(event, item, rect)
}

function handleDragOverItem(item: DisplayItem, event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }

  if (!dragState.isDragging) return

  const targetEl = event.currentTarget as HTMLElement
  const rect = targetEl.getBoundingClientRect()

  handleDragOver(event, item, rect)
}

function handleDragEnd() {
  endDrag()
  ignoreClicksUntil = Date.now() + 250
}

// ==================== 容器拖拽处理 ====================

// 计算间隙插入位置
function calculateGapInsertInfo(event: DragEvent) {
  if (!fileGridRef.value) return null

  const container = fileGridRef.value
  const containerRect = container.getBoundingClientRect()

  // 考虑滚动偏移和内边距
  const scrollTop = container.scrollTop
  const padding = 8 // 0.5rem

  // 鼠标相对于容器内容区域的位置（考虑滚动和 padding）
  const mouseX = event.clientX - containerRect.left - padding
  const mouseY = event.clientY - containerRect.top - padding + scrollTop

  // 获取所有图标元素
  const items = container.querySelectorAll('.file-item, .virtual-folder-icon')
  if (items.length === 0) return null

  // 根据 iconSize 估算项目尺寸和间隙
  const sizeMap = {
    small: { width: 80, height: 110, gap: 12 },   // gap: 0.75rem
    medium: { width: 100, height: 130, gap: 16 }, // gap: 1rem
    large: { width: 130, height: 170, gap: 20 }   // gap: 1.25rem
  }
  const config = sizeMap[props.iconSize]
  const { width: itemWidth, height: itemHeight, gap } = config

  // 计算可用宽度和列数
  const contentWidth = containerRect.width - padding * 2
  const columns = Math.floor((contentWidth + gap) / (itemWidth + gap)) || 1

  // 计算单元格尺寸（包含间隙）
  const cellWidth = itemWidth + gap
  const cellHeight = itemHeight + gap

  // 计算鼠标所在的行和列
  const col = Math.max(0, Math.min(Math.floor(mouseX / cellWidth), columns - 1))
  const row = Math.max(0, Math.floor(mouseY / cellHeight))

  // 计算在当前单元格内的相对位置
  const cellX = mouseX - col * cellWidth
  const isInLeftHalf = cellX < itemWidth / 2

  // 计算插入索引
  let insertIndex: number
  if (isInLeftHalf) {
    insertIndex = row * columns + col
  } else {
    insertIndex = row * columns + col + 1
  }

  // 限制范围
  insertIndex = Math.max(0, Math.min(insertIndex, displayItems.value.length))

  // 计算插入线位置（在间隙处）
  const insertCol = insertIndex % columns
  const insertRow = Math.floor(insertIndex / columns)

  // 插入线 x 坐标：在列的左边缘（间隙中间）
  // 如果在第一列，显示在最左边；否则显示在间隙中间
  let lineX: number
  if (insertCol === 0) {
    lineX = padding - 2
  } else {
    lineX = padding + insertCol * cellWidth - gap / 2
  }

  // 插入线 y 坐标（相对于容器内容坐标；滚动由容器自身处理）
  const lineY = padding + insertRow * cellHeight

  return {
    index: insertIndex,
    x: Math.max(padding - 2, lineX),
    y: lineY,
    height: itemHeight
  }
}

function handleContainerDragOver(event: DragEvent) {
  if (!dragState.isDragging) {
    return
  }

  event.preventDefault()

  // 检查是否在图标上
  const target = event.target as HTMLElement
  const onIcon = target.closest('.file-item') || target.closest('.virtual-folder-icon')

  if (!onIcon) {
    // 在空白区域，计算间隙插入位置
    const insertInfo = calculateGapInsertInfo(event)
    handleDragOverGap(event, insertInfo ?? undefined)
  }
}

async function handleContainerDrop(event: DragEvent) {
  if (!dragState.isDragging) {
    return
  }

  event.preventDefault()

  // 内部拖拽处理
  endDrag()
  ignoreClicksUntil = Date.now() + 250
}

function handleContainerDragLeave(event: DragEvent) {
  if (!dragState.isDragging) return

  // 只在真正离开容器时清理悬停目标（离开窗口 relatedTarget 可能为 null，但拖拽仍可能继续）
  const relatedTarget = event.relatedTarget as HTMLElement | null
  const currentTarget = event.currentTarget as HTMLElement
  if (relatedTarget && currentTarget.contains(relatedTarget)) return

  clearDragTarget()
}

// 判断项目是否正在被拖拽
function isDraggingItem(item: DisplayItem): boolean {
  if (!dragState.isDragging || !dragState.draggedItem) return false
  return getItemPath(dragState.draggedItem) === getItemPath(item)
}

// 判断项目是否为拖拽目标（显示合并/移动预览）
function isDragTarget(item: DisplayItem): boolean {
  if (!dragState.isDragging || !dragState.targetItem) return false
  return getItemPath(dragState.targetItem) === getItemPath(item)
}

// 获取拖拽目标的 CSS 类
function getDragTargetClass(item: DisplayItem): string {
  if (!isDragTarget(item)) return ''

  if (dragState.showMergePreview) return 'merge-preview'
  if (dragState.showMoveWarning) return 'move-warning'

  return ''
}
</script>

<template>
  <div
    class="file-grid-container"
    @click="handleBackgroundClick"
    @contextmenu="handleBackgroundRightClick"
    @dragover="handleContainerDragOver"
    @drop="handleContainerDrop"
    @dragleave="handleContainerDragLeave"
  >
    <div v-if="fileStore.loading" class="loading">
      <div class="spinner"></div>
      <p>{{ t('common.loading') }}</p>
    </div>

    <div v-else-if="displayItems.length === 0" class="empty">
      <img :src="iconEmpty" class="empty-icon" alt="" />
      <p>{{ t('fileGrid.empty') }}</p>
    </div>

    <div v-else ref="fileGridRef" :class="['file-grid', props.viewMode, `size-${props.iconSize}`]">
      <template v-for="item in displayItems" :key="item.type === 'file' ? item.data.filePath : item.data.id">
        <!-- 虚拟分组 -->
        <VirtualFolderIcon
          v-if="item.type === 'virtualFolder'"
          :folder="item.data"
          :is-dragging="isDraggingItem(item)"
          :is-drag-over="isDragTarget(item) && dragState.showMergePreview"
          :is-selected="isItemSelected(item)"
          :is-batch-mode="batchStore.isActive"
          :icon-size="props.iconSize"
          :view-mode="props.viewMode"
          @click="handleItemClick(item)"
          @contextmenu="handleItemRightClick(item, $event)"
          @dragstart="handleDragStart(item, $event)"
          @dragenter="handleDragEnter(item, $event)"
          @dragover="handleDragOverItem(item, $event)"
          @dragend="handleDragEnd"
          @pointerdown="handlePointerDown(getItemId(item), $event)"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @toggle-favorite="fileStore.toggleVirtualFolderFavorite(item.data.id)"
        />

        <!-- 普通文件 -->
        <div
          v-else
          :class="[
            'file-item',
            { dragging: isDraggingItem(item) },
            { selected: isItemSelected(item) },
            { 'single-selected': isSingleSelected(item) },
            getDragTargetClass(item)
          ]"
          :draggable="!batchStore.isActive"
          @dragstart="handleDragStart(item, $event)"
          @dragenter="handleDragEnter(item, $event)"
          @dragover="handleDragOverItem(item, $event)"
          @dragend="handleDragEnd"
          @pointerdown="handlePointerDown(getItemId(item), $event)"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @click="handleItemClick(item)"
          @dblclick="handleItemDoubleClick(item)"
          @contextmenu="handleItemRightClick(item, $event)"
        >
          <!-- 批量选择模式：复选框 -->
          <div
            v-if="batchStore.isActive"
            class="select-checkbox"
            :class="{ checked: isItemSelected(item) }"
          >
            {{ isItemSelected(item) ? '&#9745;' : '&#9744;' }}
          </div>

          <!-- Grid 模式：收藏按钮绝对定位 -->
          <button
            v-if="props.viewMode === 'grid' && !batchStore.isActive"
            class="favorite-btn"
            :class="{ active: item.data.isFavorite }"
            @click="handleToggleFavorite(item.data, $event)"
          >
            {{ item.data.isFavorite ? '⭐' : '☆' }}
          </button>

          <div class="file-icon">
            <img
              draggable="false"
              :src="getFileIcon(item.data)"
              :alt="item.data.fileName"
              @error="handleIconError"
            />
          </div>

          <div class="file-info">
            <div class="file-name" :title="item.data.fileName">{{ getDisplayName(item.data) }}</div>
            <!-- 列表模式：收藏按钮在 file-info 内部，自动在右侧 -->
            <button
              v-if="props.viewMode === 'list' && !batchStore.isActive"
              class="favorite-btn"
              :class="{ active: item.data.isFavorite }"
              @click="handleToggleFavorite(item.data, $event)"
            >
              {{ item.data.isFavorite ? '⭐' : '☆' }}
            </button>
          </div>

          <!-- 移动警告提示 -->
          <div v-if="isDragTarget(item) && dragState.showMoveWarning" class="move-warning-tooltip">
            {{ t('fileGrid.moveToFolderHint') }}
          </div>
        </div>
      </template>

      <!-- 插入线（在间隙处显示） -->
      <div
        v-if="dragState.showInsertLine && dragState.insertLinePosition"
        class="insert-line"
        :style="{
          top: dragState.insertLinePosition.top + 'px',
          left: dragState.insertLinePosition.left + 'px',
          height: dragState.insertLinePosition.height + 'px'
        }"
      />
    </div>

    <div class="file-count">
      {{ t('fileGrid.count', { count: fileStore.fileCount }) }}
      <span v-if="fileStore.favoriteFiles.length > 0">
        {{ t('fileGrid.favoriteCount', { count: fileStore.favoriteFiles.length }) }}
      </span>
      <span v-if="fileStore.virtualFolders.length > 0">
        {{ t('fileGrid.groupCount', { count: fileStore.virtualFolders.length }) }}
      </span>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <ContextMenu
        v-if="contextMenuVisible"
        :file="contextMenuFile"
        :x="contextMenuPosition.x"
        :y="contextMenuPosition.y"
        :is-custom-manual-category="isCustomManualCategory"
        @close="closeContextMenu"
        @open="handleContextMenuOpen"
        @show-in-explorer="handleContextMenuShowInExplorer"
        @rename="handleContextMenuRename"
        @delete="handleContextMenuDelete"
        @toggle-favorite="handleContextMenuToggleFavorite"
        @properties="handleContextMenuProperties"
        @remove-from-category="handleContextMenuRemoveFromCategory"
      />

      <VirtualFolderContextMenu
        v-if="vfContextMenuVisible"
        :folder="vfContextMenuFolder"
        :x="vfContextMenuPosition.x"
        :y="vfContextMenuPosition.y"
        @close="closeVirtualFolderContextMenu"
        @open="handleVFContextMenuOpen"
        @rename="handleVFContextMenuRename"
        @delete="handleVFContextMenuDelete"
        @toggle-favorite="handleVFContextMenuToggleFavorite"
      />

      <BackgroundContextMenu
        v-if="backgroundMenuVisible"
        :x="backgroundMenuPosition.x"
        :y="backgroundMenuPosition.y"
        :sort-mode="fileStore.getSortModeForCurrentPath()"
        :can-undo-delete="!!fileStore.lastDeletedPath"
        @close="closeBackgroundMenu"
        @refresh="handleBackgroundRefresh"
        @new-file="() => handleBackgroundNew(false)"
        @new-folder="() => handleBackgroundNew(true)"
        @set-sort-mode="handleBackgroundSetSortMode"
        @undo-delete="handleBackgroundUndoDelete"
      />
    </Teleport>

    <!-- 重命名对话框 -->
    <RenameDialog
      v-if="renameDialogVisible"
      :file="renameDialogFile"
      @close="closeRenameDialog"
      @confirm="handleRenameConfirm"
    />

    <!-- 虚拟分组重命名对话框 -->
    <VirtualFolderRenameDialog
      v-if="vfRenameDialogVisible"
      :folder="vfRenameDialogFolder"
      @close="closeVFRenameDialog"
      @confirm="handleVFRenameConfirm"
    />

    <!-- 新建文件/文件夹对话框 -->
    <NewItemDialog
      :visible="newItemDialogVisible"
      :is-dir="newItemIsDir"
      @close="closeNewItemDialog"
      @confirm="handleNewItemConfirm"
    />

    <!-- 虚拟分组弹窗 -->
    <VirtualFolderModal
      v-if="virtualFolderModalVisible && activeVirtualFolder"
      :folder="activeVirtualFolder"
      @close="closeVirtualFolderModal"
      @remove-file="handleVirtualFolderRemoveFile"
      @open-file="handleVirtualFolderOpenFile"
    />
  </div>
</template>

<style scoped>
.file-grid-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0.75rem 1.5rem 1.5rem;
  min-height: 0;
  position: relative;
}

.loading,
.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 0.95rem;
  font-weight: 500;
  gap: 0.5rem;
}

.empty-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
  opacity: 0.7;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(var(--primary-color-rgb), 0.1);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s var(--ease-in-out-smooth) infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 网格布局核心 */
.file-grid {
  position: relative; /* 用于定位插入线 */
  flex: 1;
  display: grid;
  gap: 1rem;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.5rem; /* 内边距给 Hover 阴影留空间 */
  min-height: 0;
  align-content: start;
}

/* ==================== Grid View ==================== */

.file-grid.grid {
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
}

/* 图标尺寸变体 */
.file-grid.grid.size-small {
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.75rem;
}
.file-grid.grid.size-medium {
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
}
.file-grid.grid.size-large {
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 1.25rem;
}

/* 卡片基础样式 - 极简主义，无背景 */
.file-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 0.5rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out-quad);
  user-select: none;
  /* 解决子元素闪烁 */
  transform: translateZ(0); 
}

/* Hover 态 - 物理上浮效果 */
.file-item:hover {
  background: var(--bg-secondary);
  border-color: var(--glass-border);
  box-shadow: 
    var(--shadow-md),
    inset 0 0 0 1px rgba(255,255,255,0.05); /* 微弱内发光 */
  transform: translateY(-2px);
}

.file-item:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
  background: rgba(var(--bg-base-rgb), 0.4);
}

/* 拖拽中样式 */
.file-item.dragging {
  opacity: 0.4;
  filter: grayscale(0.5);
  transform: scale(0.95);
  box-shadow: none;
  background: transparent;
}

/* 合并预览 (Merge Preview) - 虚线框 */
.file-item.merge-preview {
  z-index: 5;
  background: rgba(var(--primary-color-rgb), 0.08);
  border: 2px dashed var(--primary-color);
  transform: scale(1.05);
  box-shadow: 0 0 0 4px rgba(var(--primary-color-rgb), 0.1);
}

/* 移动警告 (Move Warning) */
.file-item.move-warning {
  border: 2px solid var(--warning-color);
  background: rgba(245, 158, 11, 0.05);
}

/* 批量选择 - 选中状态 */
.file-item.selected {
  background: rgba(var(--primary-color-rgb), 0.12);
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
}

.file-item.selected:hover {
  background: rgba(var(--primary-color-rgb), 0.18);
}

/* 单选状态（非批量模式） */
.file-item.single-selected {
  background: rgba(var(--primary-color-rgb), 0.08);
  border-color: rgba(var(--primary-color-rgb), 0.4);
}

.file-item.single-selected:hover {
  background: rgba(var(--primary-color-rgb), 0.12);
}

/* 批量选择 - 复选框 */
.select-checkbox {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  z-index: 3;
  color: var(--text-tertiary);
  background: rgba(var(--bg-base-rgb), 0.7);
  backdrop-filter: blur(4px);
  border-radius: var(--radius-sm);
  transition: all 0.15s var(--ease-out-quad);
}

.select-checkbox.checked {
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.15);
}

.move-warning-tooltip {
  position: absolute;
  bottom: -32px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  background: var(--warning-color);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
  white-space: nowrap;
  z-index: 20;
  pointer-events: none;
  box-shadow: var(--shadow-md);
  animation: fadeIn 0.2s ease-out;
}

.move-warning-tooltip::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid var(--warning-color);
}

/* 收藏按钮 */
.favorite-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  left: auto; /* 重置 left */
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--bg-base-rgb), 0.6);
  backdrop-filter: blur(4px);
  border-radius: 50%;
  border: none;
  font-size: 0.75rem;
  color: var(--warning-color);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s var(--ease-out-quad);
  z-index: 2;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.file-item:hover .favorite-btn,
.favorite-btn.active {
  opacity: 1;
  transform: scale(1);
}

.favorite-btn:hover {
  transform: scale(1.15);
  background: #fff;
}

/* 图标区域 */
.file-icon {
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.file-item:hover .file-icon {
  transform: scale(1.05);
}

.file-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  /* 图标投影，增加立体感 */
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
}

/* 图标尺寸控制 */
.file-grid.grid.size-small .file-icon { width: 42px; height: 42px; }
.file-grid.grid.size-medium .file-icon { width: 56px; height: 56px; }
.file-grid.grid.size-large .file-icon { width: 72px; height: 72px; }

/* 文本信息 */
.file-info {
  width: 100%;
  text-align: center;
  padding: 0 2px;
}

.file-name {
  font-size: 0.825rem;
  color: var(--text-secondary); /* 默认稍淡 */
  font-weight: 500;
  line-height: 1.3;
  margin-bottom: 0;
  
  /* 多行截断优化 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  word-break: break-all;
  transition: color 0.2s;
}

.file-item:hover .file-name {
  color: var(--text-primary); /* Hover 变深 */
}

/* ==================== List View ==================== */

.file-grid.list {
  grid-template-columns: 1fr;
  gap: 0.25rem;
}

.file-grid.list .file-item {
  flex-direction: row;
  justify-content: flex-start;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  height: 56px;
  border-radius: var(--radius-sm);
}

.file-grid.list .file-icon {
  width: 32px;
  height: 32px;
  margin-bottom: 0;
}

.file-grid.list .file-info {
  flex: 1;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.file-grid.list .file-name {
  -webkit-line-clamp: 1;
  font-size: 0.875rem;
}

.file-grid.list .favorite-btn {
  position: static;
  opacity: 0.5;
  background: transparent;
  box-shadow: none;
  transform: none;
}

.file-grid.list .favorite-btn.active {
  opacity: 1;
}

/* 底部计数器 - 悬浮胶囊 */
.file-count {
  position: absolute;
  bottom: 1rem;
  right: 1.5rem;
  padding: 0.35rem 0.75rem;
  
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  
  background: rgba(var(--bg-base-rgb), 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: 99px;
  box-shadow: var(--shadow-md);
  
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s var(--ease-out-quad);
  pointer-events: none;
  z-index: 100;
}

.file-grid-container:hover .file-count {
  opacity: 1;
  transform: translateY(0);
}

.file-count span {
  margin-left: 0.5rem;
  color: var(--primary-color);
  font-weight: 600;
}

/* ========== 插入线（间隙排序指示器） ========== */
.insert-line {
  position: absolute;
  width: 3px;
  background: repeating-linear-gradient(
    to bottom,
    rgba(var(--primary-color-rgb), 0.95) 0,
    rgba(var(--primary-color-rgb), 0.95) 7px,
    rgba(var(--primary-color-rgb), 0) 7px,
    rgba(var(--primary-color-rgb), 0) 12px
  );
  border-radius: 2px;
  z-index: 100;
  pointer-events: none;
  box-shadow:
    0 0 8px rgba(var(--primary-color-rgb), 0.35),
    0 0 16px rgba(var(--primary-color-rgb), 0.25);
  background-position: 0 0;
  animation: insertLineDash 0.8s linear infinite;
}

.insert-line::before,
.insert-line::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 10px;
  height: 10px;
  background: rgba(var(--primary-color-rgb), 0.95);
  border-radius: 50%;
  box-shadow:
    0 0 0 2px rgba(var(--bg-base-rgb), 0.75),
    0 0 10px rgba(var(--primary-color-rgb), 0.25);
}

.insert-line::before {
  top: -5px;
}

.insert-line::after {
  bottom: -5px;
}

@keyframes insertLineDash {
  from { background-position: 0 0; }
  to { background-position: 0 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .insert-line { animation: none; }
}
</style>
