<script setup lang="ts">
import { ref, computed, nextTick, onUnmounted, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { type VirtualFolder, type FileItem, useFileStore } from '../stores/files'
import { getFileIcon } from '../utils/iconMapper'
import { DRAG_THRESHOLDS } from '../config/dragConfig'
import { computeMenuPosition } from '../utils/menuPosition'
import { useDialog } from '../composables/useDialog'
import { getIconPath } from '../utils/iconHelper'
import { useI18n } from '../i18n'

// 图标路径
const iconDelete = getIconPath('delete')
const iconEmpty = getIconPath('empty')
const iconOpenFolder = getIconPath('open-folder')
const iconLocation = getIconPath('location')
const iconExport = getIconPath('export')
const iconInfo = getIconPath('info')
const iconRefresh = getIconPath('refresh')
const iconPencil = getIconPath('pencil')

interface Props {
  folder: VirtualFolder
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'remove-file', filePath: string): void
  (e: 'open-file', file: FileItem): void
}>()

const fileStore = useFileStore()
const dialog = useDialog()
const { t } = useI18n()

// 获取显示名称（隐藏 .url 和 .lnk 扩展名）
function getDisplayName(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.url') || lower.endsWith('.lnk')) {
    return fileName.slice(0, fileName.lastIndexOf('.'))
  }
  return fileName
}

// 处理图标加载失败
function handleIconError(e: Event) {
  const img = e.target as HTMLImageElement
  import('../assets/file_icos/unkonw.png').then(module => {
    img.src = module.default
  })
}

// 编辑状态
const isEditingName = ref(false)
const editingName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

// 拖拽状态
const draggedFilePath = ref<string | null>(null)
const dragOverFilePath = ref<string | null>(null)
const isOutsideGrid = ref(false)
const gridRef = ref<HTMLElement | null>(null)

// 拖拽到真实文件夹状态
const dragOverFolderPath = ref<string | null>(null)
const folderHoverStartTime = ref<number | null>(null)
const isMoveToFolderReady = ref(false)

// 悬停检测定时器
let folderHoverCheckInterval: number | null = null

// ==================== 右键菜单状态 ====================
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuFile = ref<FileItem | null>(null)
const contextMenuRef = ref<HTMLDivElement | null>(null)

// 空白处右键菜单状态
const bgMenuVisible = ref(false)
const bgMenuPosition = ref({ x: 0, y: 0 })
const bgMenuRef = ref<HTMLDivElement | null>(null)

// 启动悬停检测
function startFolderHoverCheck() {
  if (folderHoverCheckInterval) return
  folderHoverCheckInterval = window.setInterval(() => {
    if (dragOverFolderPath.value && folderHoverStartTime.value) {
      const now = Date.now()
      const hoverDuration = now - folderHoverStartTime.value
      if (hoverDuration >= DRAG_THRESHOLDS.REAL_FOLDER_MS) {
        isMoveToFolderReady.value = true
      }
    }
  }, 100)
}

// 停止悬停检测
function stopFolderHoverCheck() {
  if (folderHoverCheckInterval) {
    clearInterval(folderHoverCheckInterval)
    folderHoverCheckInterval = null
  }
}

// 清理
onUnmounted(() => {
  stopFolderHoverCheck()
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('contextmenu', handleDocumentClick)
})

onMounted(() => {
  // 延迟添加监听器，避免立即触发
  setTimeout(() => {
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('contextmenu', handleDocumentClick)
  }, 0)
})

function handleDocumentClick(event: MouseEvent) {
  // 关闭文件右键菜单
  if (contextMenuVisible.value && contextMenuRef.value && !contextMenuRef.value.contains(event.target as Node)) {
    closeContextMenu()
  }
  // 关闭空白处右键菜单
  if (bgMenuVisible.value && bgMenuRef.value && !bgMenuRef.value.contains(event.target as Node)) {
    closeBgMenu()
  }
}

// 获取成员文件（按 memberPaths 顺序）
const memberFiles = computed<FileItem[]>(() => {
  return fileStore.getVirtualFolderMembers(props.folder.id)
})

// 开始编辑名称
function startEditName() {
  editingName.value = props.folder.name
  isEditingName.value = true
  nextTick(() => {
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  })
}

// 保存名称
function saveName() {
  const trimmed = editingName.value.trim()
  if (trimmed && trimmed !== props.folder.name) {
    fileStore.renameVirtualFolder(props.folder.id, trimmed)
  }
  isEditingName.value = false
}

// 取消编辑
function cancelEditName() {
  isEditingName.value = false
}

// 处理名称输入键盘事件
function handleNameKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    saveName()
  } else if (event.key === 'Escape') {
    cancelEditName()
  }
}

// 点击文件
function handleFileClick(file: FileItem) {
  // 如果正在拖拽，忽略点击
  if (draggedFilePath.value) return
  emit('open-file', file)
}

// 从文件夹移出
function handleRemoveFile(file: FileItem, event: MouseEvent) {
  event.stopPropagation()
  emit('remove-file', file.filePath)
}

// 点击遮罩关闭
function handleOverlayClick(event: MouseEvent) {
  if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
    emit('close')
  }
}

// 删除整个文件夹
async function handleDeleteFolder() {
  const confirmDelete = await dialog.confirmDanger(
    t('virtualFolder.deleteConfirm', { name: props.folder.name }),
    { title: t('virtualFolder.deleteTitle') }
  )
  if (confirmDelete) {
    fileStore.deleteVirtualFolder(props.folder.id)
    emit('close')
  }
}

// ==================== 右键菜单功能 ====================

function adjustContextMenuPosition() {
  if (!contextMenuRef.value) return
  const rect = contextMenuRef.value.getBoundingClientRect()
  const position = computeMenuPosition({
    x: contextMenuPosition.value.x,
    y: contextMenuPosition.value.y,
    menuWidth: rect.width,
    menuHeight: rect.height,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
  })
  contextMenuPosition.value = { x: position.left, y: position.top }
}

function adjustBgMenuPosition() {
  if (!bgMenuRef.value) return
  const rect = bgMenuRef.value.getBoundingClientRect()
  const position = computeMenuPosition({
    x: bgMenuPosition.value.x,
    y: bgMenuPosition.value.y,
    menuWidth: rect.width,
    menuHeight: rect.height,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
  })
  bgMenuPosition.value = { x: position.left, y: position.top }
}

function handleFileContextMenu(file: FileItem, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  closeBgMenu()
  contextMenuFile.value = file
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true

  nextTick(adjustContextMenuPosition)
}

function handleGridContextMenu(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('.file-item')) return

  event.preventDefault()
  event.stopPropagation()

  closeContextMenu()
  bgMenuPosition.value = { x: event.clientX, y: event.clientY }
  bgMenuVisible.value = true

  nextTick(adjustBgMenuPosition)
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuFile.value = null
}

function closeBgMenu() {
  bgMenuVisible.value = false
}

// 右键菜单事件处理
function handleMenuOpen() {
  if (!contextMenuFile.value) return
  emit('open-file', contextMenuFile.value)
  closeContextMenu()
}

function handleMenuShowInExplorer() {
  if (!contextMenuFile.value) return
  fileStore.showInExplorer(contextMenuFile.value.filePath)
  closeContextMenu()
}

function handleMenuRemoveFromFolder() {
  if (!contextMenuFile.value) return
  emit('remove-file', contextMenuFile.value.filePath)
  closeContextMenu()
}

async function handleMenuDelete() {
  if (!contextMenuFile.value) return
  const file = contextMenuFile.value
  const confirmDelete = await dialog.confirmDanger(
    t('context.deleteFileConfirm', { name: file.fileName }),
    { title: t('context.deleteFileTitle') }
  )
  if (!confirmDelete) {
    closeContextMenu()
    return
  }

  try {
    await fileStore.deleteFile(file.filePath, true)
    // 文件删除后也从虚拟分组移除
    emit('remove-file', file.filePath)
  } catch (error) {
    await dialog.error(t('context.deleteFailed', { error }))
  }
  closeContextMenu()
}

function handleMenuToggleFavorite() {
  if (!contextMenuFile.value) return
  fileStore.toggleFavorite(contextMenuFile.value.filePath)
  closeContextMenu()
}

async function handleMenuProperties() {
  if (!contextMenuFile.value) return
  const file = contextMenuFile.value
  try {
    await invoke('show_file_properties', { filePath: file.filePath })
  } catch (error) {
    await dialog.error(t('context.propertiesFailed', { error }))
  }
  closeContextMenu()
}

// 空白处右键菜单事件处理
async function handleBgRefresh() {
  await fileStore.loadFiles(fileStore.currentPath ?? undefined)
  closeBgMenu()
}

function handleBgDeleteFolder() {
  handleDeleteFolder()
  closeBgMenu()
}

// ==================== 拖拽功能 ====================

function handleDragStart(file: FileItem, event: DragEvent) {
  draggedFilePath.value = file.filePath
  isOutsideGrid.value = false

  // 启动悬停检测定时器
  startFolderHoverCheck()

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', file.fileName)
  }
}

function handleDragOver(file: FileItem, event: DragEvent) {
  event.preventDefault()
  if (!draggedFilePath.value || draggedFilePath.value === file.filePath) return

  isOutsideGrid.value = false

  // 检查是否是真实文件夹
  if (file.fType === 'dir') {
    // 检查目标是否改变
    if (dragOverFolderPath.value !== file.filePath) {
      dragOverFolderPath.value = file.filePath
      folderHoverStartTime.value = Date.now()
      isMoveToFolderReady.value = false
    } else {
      // 检查悬停时间
      const now = Date.now()
      const hoverDuration = folderHoverStartTime.value ? now - folderHoverStartTime.value : 0
      if (hoverDuration >= DRAG_THRESHOLDS.REAL_FOLDER_MS) {
        isMoveToFolderReady.value = true
      }
    }
    dragOverFilePath.value = file.filePath
  } else {
    // 普通文件：重置文件夹悬停状态
    dragOverFolderPath.value = null
    folderHoverStartTime.value = null
    isMoveToFolderReady.value = false
    dragOverFilePath.value = file.filePath
  }

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleDragLeave(event: DragEvent) {
  // 检查是否真的离开了当前元素
  const relatedTarget = event.relatedTarget as HTMLElement | null
  if (relatedTarget && (event.currentTarget as HTMLElement).contains(relatedTarget)) {
    return
  }
  dragOverFilePath.value = null
}

async function handleDrop(targetFile: FileItem, event: DragEvent) {
  event.preventDefault()

  if (!draggedFilePath.value || draggedFilePath.value === targetFile.filePath) {
    resetDragState()
    return
  }

  const sourcePath = draggedFilePath.value

  // 检查是否拖到真实文件夹上且悬停时间足够
  if (targetFile.fType === 'dir' && isMoveToFolderReady.value) {
    try {
      // 调用后端移动文件
      await invoke<string>('move_file', {
        sourcePath,
        targetDir: targetFile.filePath,
      })

      // 从虚拟分组中移除该文件
      fileStore.removeFromVirtualFolder(props.folder.id, sourcePath)

      // 重新加载文件列表
      await fileStore.loadFiles(fileStore.currentPath ?? undefined)
    } catch (error) {
      console.error('移动文件失败：', error)
      await dialog.error(t('error.moveFile', { error }))
    }
    resetDragState()
    return
  }

  // 普通排序（注意：不支持在虚拟分组内创建嵌套虚拟分组）
  fileStore.reorderVirtualFolderMembers(props.folder.id, sourcePath, targetFile.filePath)
  resetDragState()
}

function handleDragEnd() {
  // 检查是否拖到了网格外部
  if (draggedFilePath.value && isOutsideGrid.value) {
    // 拖出文件夹 = 移除文件
    emit('remove-file', draggedFilePath.value)
  }

  resetDragState()
}

// 监听网格区域的拖拽离开
function handleGridDragLeave(event: DragEvent) {
  const gridEl = gridRef.value
  if (!gridEl) return

  const rect = gridEl.getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY

  // 检查鼠标是否真的离开了网格区域
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    isOutsideGrid.value = true
  }
}

function handleGridDragOver(event: DragEvent) {
  event.preventDefault()
  isOutsideGrid.value = false
}

function resetDragState() {
  draggedFilePath.value = null
  dragOverFilePath.value = null
  isOutsideGrid.value = false
  dragOverFolderPath.value = null
  folderHoverStartTime.value = null
  isMoveToFolderReady.value = false
  stopFolderHoverCheck()
}

function isDragging(file: FileItem): boolean {
  return draggedFilePath.value === file.filePath
}

function isDragOver(file: FileItem): boolean {
  return dragOverFilePath.value === file.filePath && draggedFilePath.value !== file.filePath
}

// 检查是否是真实文件夹目标且准备好移动
function isFolderMoveTarget(file: FileItem): boolean {
  return file.fType === 'dir' &&
         dragOverFolderPath.value === file.filePath &&
         isMoveToFolderReady.value
}

// 检查是否正在悬停真实文件夹（但还没到阈值）
function isFolderHovering(file: FileItem): boolean {
  return file.fType === 'dir' &&
         dragOverFolderPath.value === file.filePath &&
         !isMoveToFolderReady.value
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content">
        <!-- 头部 -->
        <div class="modal-header">
          <div class="folder-title">
            <span v-if="!isEditingName" class="folder-name" @click="startEditName">
              {{ folder.name }}
              <span class="edit-hint">{{ t('virtualFolder.clickEdit') }}</span>
            </span>
            <input
              v-else
              ref="nameInputRef"
              v-model="editingName"
              class="name-input"
              @blur="saveName"
              @keydown="handleNameKeydown"
            />
          </div>
          <div class="header-actions">
            <button class="delete-btn" @click="handleDeleteFolder" :title="t('virtualFolder.delete')">
              <img :src="iconDelete" class="btn-icon" alt="" />
            </button>
            <button class="close-btn" @click="$emit('close')">
              ✕
            </button>
          </div>
        </div>

        <!-- 文件网格 -->
        <div
          ref="gridRef"
          class="files-grid"
          @dragleave="handleGridDragLeave"
          @dragover="handleGridDragOver"
          @contextmenu="handleGridContextMenu"
        >
          <div
            v-for="file in memberFiles"
            :key="file.filePath"
            :class="[
              'file-item',
              {
                dragging: isDragging(file),
                'drag-over': isDragOver(file),
                'folder-move-ready': isFolderMoveTarget(file),
                'folder-hovering': isFolderHovering(file)
              }
            ]"
            draggable="true"
            @click="handleFileClick(file)"
            @contextmenu="handleFileContextMenu(file, $event)"
            @dragstart="handleDragStart(file, $event)"
            @dragover="handleDragOver(file, $event)"
            @dragleave="handleDragLeave"
            @drop="handleDrop(file, $event)"
            @dragend="handleDragEnd"
          >
            <button
              class="remove-btn"
              @click="handleRemoveFile(file, $event)"
              :title="t('virtualFolder.removeFromFolder')"
            >
              ✕
            </button>

            <div class="file-icon">
              <img
                draggable="false"
                :src="getFileIcon(file)"
                :alt="file.fileName"
                @error="handleIconError"
              />
            </div>

            <div class="file-info">
              <div class="file-name" :title="file.fileName">{{ getDisplayName(file.fileName) }}</div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="memberFiles.length === 0" class="empty-state">
            <img :src="iconEmpty" class="empty-icon" alt="" />
            <p>{{ t('virtualFolder.empty') }}</p>
            <p class="hint">{{ t('virtualFolder.dragHere') }}</p>
          </div>
        </div>

        <!-- 拖出提示 -->
        <div v-if="draggedFilePath && isOutsideGrid" class="drag-out-hint">
          {{ t('virtualFolder.releaseRemove') }}
        </div>

        <!-- 移动到文件夹提示 -->
        <div v-if="draggedFilePath && isMoveToFolderReady" class="folder-move-hint">
          {{ t('virtualFolder.releaseMove') }}
        </div>

        <!-- 底部信息 -->
        <div class="modal-footer">
          <span class="file-count">{{ t('virtualFolder.itemCount', { count: memberFiles.length }) }}</span>
          <span v-if="draggedFilePath && dragOverFolderPath && !isMoveToFolderReady" class="drag-hint">
            {{ t('virtualFolder.keepHoverMove') }}
          </span>
          <span v-else-if="draggedFilePath" class="drag-hint">{{ t('virtualFolder.dragOutRemove') }}</span>
        </div>

        <Teleport to="body">
        <!-- 文件右键菜单 -->
        <div
          v-if="contextMenuVisible && contextMenuFile"
          ref="contextMenuRef"
          class="context-menu"
          :style="{ left: `${contextMenuPosition.x}px`, top: `${contextMenuPosition.y}px` }"
          @click.stop
          @contextmenu.stop.prevent
        >
          <button class="menu-item" @click="handleMenuOpen">
            <img :src="iconOpenFolder" class="menu-icon" alt="" />
            <span>{{ t('common.open') }}</span>
          </button>

          <button class="menu-item" @click="handleMenuShowInExplorer">
            <img :src="iconLocation" class="menu-icon" alt="" />
            <span>{{ t('context.showInExplorer') }}</span>
          </button>

          <div class="menu-divider"></div>

          <button class="menu-item" @click="handleMenuRemoveFromFolder">
            <img :src="iconExport" class="menu-icon" alt="" />
            <span>{{ t('virtualFolder.removeFromFolder') }}</span>
          </button>

          <button class="menu-item" @click="handleMenuToggleFavorite">
            <span class="menu-icon-text">{{ contextMenuFile.isFavorite ? '⭐' : '☆' }}</span>
            <span>{{ contextMenuFile.isFavorite ? t('context.removeFavorite') : t('context.addFavorite') }}</span>
          </button>

          <div class="menu-divider"></div>

          <button class="menu-item danger" @click="handleMenuDelete">
            <img :src="iconDelete" class="menu-icon" alt="" />
            <span>{{ t('context.moveToRecycleBin') }}</span>
          </button>

          <div class="menu-divider"></div>

          <button class="menu-item" @click="handleMenuProperties">
            <img :src="iconInfo" class="menu-icon" alt="" />
            <span>{{ t('common.properties') }}</span>
          </button>
        </div>

        <!-- 空白处右键菜单 -->
        <div
          v-if="bgMenuVisible"
          ref="bgMenuRef"
          class="context-menu"
          :style="{ left: `${bgMenuPosition.x}px`, top: `${bgMenuPosition.y}px` }"
          @click.stop
          @contextmenu.stop.prevent
        >
          <button class="menu-item" @click="handleBgRefresh">
            <img :src="iconRefresh" class="menu-icon" alt="" />
            <span>{{ t('common.refresh') }}</span>
          </button>

          <div class="menu-divider"></div>

          <button class="menu-item" @click="startEditName(); closeBgMenu()">
            <img :src="iconPencil" class="menu-icon" alt="" />
            <span>{{ t('virtualFolder.rename') }}</span>
          </button>

          <button class="menu-item danger" @click="handleBgDeleteFolder">
            <img :src="iconDelete" class="menu-icon" alt="" />
            <span>{{ t('virtualFolder.delete') }}</span>
          </button>
        </div>
        </Teleport>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-overlay-bg);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 2rem;
  animation: fadeIn 0.2s var(--ease-out-quad);
}

.modal-content {
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  
  /* 强毛玻璃容器 */
  background: var(--bg-primary);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  animation: slideIn 0.3s var(--ease-out-quad);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: rgba(var(--bg-base-rgb), 0.1);
}

.folder-title {
  flex: 1;
  min-width: 0;
}

.folder-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: color 0.2s;
}

.folder-name:hover {
  color: var(--primary-color);
}

.edit-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: normal;
  opacity: 0;
  transform: translateX(-5px);
  transition: all 0.2s;
}

.folder-name:hover .edit-hint {
  opacity: 1;
  transform: translateX(0);
}

.name-input {
  width: 100%;
  max-width: 240px;
  padding: 0.25rem 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--primary-color);
  border-radius: var(--radius-sm);
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.2);
}

.header-actions {
  display: flex;
  gap: 0.25rem;
}

.delete-btn,
.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
}

.delete-btn {
  color: var(--text-tertiary);
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger-color);
}

.close-btn {
  color: var(--text-secondary);
}

.close-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

/* Files Grid */
.files-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
  overflow-y: auto;
  min-height: 240px;
  align-content: start;
}

/* File Item - Matches Main Grid Style */
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
  transition: all 0.2s var(--ease-out-quad);
}

.file-item:hover {
  background: var(--bg-secondary);
  border-color: var(--glass-border);
  box-shadow: var(--shadow-sm);
  transform: translateY(-2px);
}

.file-item.dragging {
  opacity: 0.4;
  transform: scale(0.95);
  filter: grayscale(0.5);
}

.file-item.drag-over {
  background: rgba(var(--primary-color-rgb), 0.08);
  border: 1px dashed var(--primary-color);
  transform: scale(1.05);
}

.file-item.folder-hovering {
  border: 1px dashed var(--warning-color);
  background: rgba(245, 158, 11, 0.05);
}

.file-item.folder-move-ready {
  border: 2px solid var(--success-color);
  background: rgba(34, 197, 94, 0.1);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
}

/* Remove Button */
.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--danger-color);
  color: white;
  border: none;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s;
  z-index: 2;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.file-item:hover .remove-btn {
  opacity: 1;
  transform: scale(1);
}

.remove-btn:hover {
  transform: scale(1.15);
  background: #dc2626;
}

.file-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.file-item:hover .file-icon {
  transform: scale(1.1);
}

.file-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.file-info {
  width: 100%;
  text-align: center;
}

.file-name {
  font-size: 0.813rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  transition: color 0.2s;
}

.file-item:hover .file-name {
  color: var(--text-primary);
}

/* Empty State */
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: var(--text-tertiary);
}

.empty-state p {
  margin: 0.25rem 0;
  font-size: 1rem;
  font-weight: 500;
}

.empty-state .hint {
  font-size: 0.875rem;
  opacity: 0.7;
  font-weight: 400;
}

/* Hints */
.drag-out-hint,
.folder-move-hint {
  position: absolute;
  bottom: 4.5rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.5rem 1rem;
  border-radius: 99px;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  box-shadow: var(--shadow-lg);
  pointer-events: none;
  z-index: 10;
  animation: fadeIn 0.2s ease-out;
}

.drag-out-hint {
  background: var(--danger-color);
}

.folder-move-hint {
  background: var(--success-color);
}

/* Footer */
.modal-footer {
  padding: 0.75rem 1.5rem;
  border-top: 1px solid var(--border-color);
  background: rgba(var(--bg-base-rgb), 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-count {
  font-size: 0.813rem;
  color: var(--text-primary);
  font-weight: 500;
}

.drag-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Context Menu Reuse */
.context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 180px;
  background: rgba(var(--bg-base-rgb), 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xl);
  padding: 0.375rem;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
}

.menu-item:hover {
  background: var(--primary-color);
  color: #fff;
}

.menu-item.danger:hover {
  background: var(--danger-color);
}

.menu-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.menu-icon-text {
  width: 16px;
  text-align: center;
  font-size: 1rem;
}

.btn-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.empty-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
  margin-bottom: 0.5rem;
}

.menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 0.25rem 0.5rem;
  opacity: 0.5;
}
</style>
