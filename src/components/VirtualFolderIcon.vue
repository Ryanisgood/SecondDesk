<script setup lang="ts">
import { computed } from 'vue'
import { type VirtualFolder, type FileItem, useFileStore } from '../stores/files'
import { getFileIcon } from '../utils/iconMapper'

interface Props {
  folder: VirtualFolder
  isDragging?: boolean
  isDragOver?: boolean
  isSelected?: boolean
  isBatchMode?: boolean
  iconSize?: 'small' | 'medium' | 'large'
  viewMode?: 'grid' | 'list'
}

const props = withDefaults(defineProps<Props>(), {
  isDragging: false,
  isDragOver: false,
  isSelected: false,
  isBatchMode: false,
  iconSize: 'medium',
  viewMode: 'grid'
})

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'contextmenu', event: MouseEvent): void
  (e: 'dragstart', event: DragEvent): void
  (e: 'dragenter', event: DragEvent): void
  (e: 'dragover', event: DragEvent): void
  (e: 'dragend'): void
  (e: 'pointerdown', event: PointerEvent): void
  (e: 'pointermove', event: PointerEvent): void
  (e: 'pointerup', event: PointerEvent): void
  (e: 'toggle-favorite'): void
}>()

const fileStore = useFileStore()

// 获取成员文件的图标
const memberFiles = computed<FileItem[]>(() => {
  return fileStore.getVirtualFolderMembers(props.folder.id)
})

// 决定使用 2x2 还是 3x3 网格
const gridClass = computed(() => {
  return memberFiles.value.length > 4 ? 'grid-3x3' : 'grid-2x2'
})

// 预览成员（最多 4 或 9 个）
const previewMembers = computed(() => {
  const maxItems = gridClass.value === 'grid-3x3' ? 9 : 4
  return memberFiles.value.slice(0, maxItems)
})

// 空位数量
const emptySlots = computed(() => {
  const maxItems = gridClass.value === 'grid-3x3' ? 9 : 4
  return Math.max(0, maxItems - previewMembers.value.length)
})

// 列表模式预览（最多 4 个）
const listPreviewMembers = computed(() => {
  return memberFiles.value.slice(0, 4)
})

// 列表模式空位数量
const listEmptySlots = computed(() => {
  return Math.max(0, 4 - listPreviewMembers.value.length)
})

function handleClick() {
  emit('click')
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  emit('contextmenu', event)
}

function handleDragStart(event: DragEvent) {
  emit('dragstart', event)
}

function handleDragEnter(event: DragEvent) {
  emit('dragenter', event)
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  emit('dragover', event)
}

function handleDragEnd() {
  emit('dragend')
}

function handleToggleFavorite(event: MouseEvent) {
  event.stopPropagation()
  emit('toggle-favorite')
}

// 处理图标加载失败
function handleIconError(e: Event) {
  const img = e.target as HTMLImageElement
  import('../assets/file_icos/unkonw.png').then(module => {
    img.src = module.default
  })
}
</script>

<template>
  <div
    :class="[
      'virtual-folder-icon',
      `size-${iconSize}`,
      viewMode,
      { dragging: isDragging, 'drag-over': isDragOver, selected: isSelected }
    ]"
    :draggable="!isBatchMode"
    @click="handleClick"
    @contextmenu="handleContextMenu"
    @dragstart="handleDragStart"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragend="handleDragEnd"
    @pointerdown="$emit('pointerdown', $event)"
    @pointermove="$emit('pointermove', $event)"
    @pointerup="$emit('pointerup', $event)"
  >
    <!-- 批量选择模式：复选框 -->
    <div
      v-if="isBatchMode"
      class="select-checkbox"
      :class="{ checked: isSelected }"
    >
      {{ isSelected ? '&#9745;' : '&#9744;' }}
    </div>
    <!-- 预览网格 (grid 模式 - 大尺寸) -->
    <div v-if="viewMode === 'grid'" :class="['folder-preview-grid', gridClass]">
      <div
        v-for="member in previewMembers"
        :key="member.filePath"
        class="preview-item"
      >
        <img
          draggable="false"
          :src="getFileIcon(member)"
          :alt="member.fileName"
          @error="handleIconError"
        />
      </div>
      <!-- 空位 -->
      <div
        v-for="i in emptySlots"
        :key="'empty-' + i"
        class="preview-item empty"
      />
    </div>

    <!-- 列表模式 - 小型 2x2 预览网格 -->
    <div v-else class="folder-preview-mini">
      <div
        v-for="member in listPreviewMembers"
        :key="member.filePath"
        class="mini-preview-item"
      >
        <img
          draggable="false"
          :src="getFileIcon(member)"
          :alt="member.fileName"
          @error="handleIconError"
        />
      </div>
      <!-- 空位 -->
      <div
        v-for="i in listEmptySlots"
        :key="'empty-' + i"
        class="mini-preview-item empty"
      />
    </div>

    <!-- 文件夹名称和收藏按钮 -->
    <div class="folder-info">
      <div class="folder-name" :title="folder.name">{{ folder.name }}</div>
      <div v-if="viewMode === 'grid'" class="member-count">{{ folder.memberPaths.length }} 个项目</div>
      <!-- 列表模式：收藏按钮在 folder-info 内部 -->
      <button
        v-if="viewMode === 'list' && !isBatchMode"
        class="favorite-btn"
        :class="{ active: folder.isFavorite }"
        @click="handleToggleFavorite"
        :title="folder.isFavorite ? '取消收藏' : '收藏'"
      >
        {{ folder.isFavorite ? '⭐' : '☆' }}
      </button>
    </div>

    <!-- Grid 模式：收藏按钮绝对定位 -->
    <button
      v-if="viewMode === 'grid' && !isBatchMode"
      class="favorite-btn"
      :class="{ active: folder.isFavorite }"
      @click="handleToggleFavorite"
      :title="folder.isFavorite ? '取消收藏' : '收藏'"
    >
      {{ folder.isFavorite ? '⭐' : '☆' }}
    </button>
  </div>
</template>

<style scoped>
.virtual-folder-icon {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0.75rem;
  background: var(--hover-bg);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

/* 收藏按钮 - 统一放在右侧 */
.favorite-btn {
  position: absolute;
  top: 4px;
  right: 4px;
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

.virtual-folder-icon:hover .favorite-btn,
.favorite-btn.active {
  opacity: 1;
  transform: scale(1);
}

.favorite-btn:hover {
  transform: scale(1.15);
  background: #fff;
}

.favorite-btn.active {
  color: #fbbf24;
}

.virtual-folder-icon:hover {
  background: var(--bg-secondary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.virtual-folder-icon.dragging,
.virtual-folder-icon.dragging:hover {
  opacity: 0.6;
  transform: none;
  box-shadow: none;
}

.virtual-folder-icon.drag-over {
  outline: 3px dashed var(--primary-color);
  outline-offset: 2px;
  background: rgba(var(--primary-color-rgb, 59, 130, 246), 0.1);
  transform: scale(1.02);
}

/* 批量选择 - 选中状态 */
.virtual-folder-icon.selected {
  background: rgba(var(--primary-color-rgb), 0.12);
  border: 1px solid var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
}

.virtual-folder-icon.selected:hover {
  background: rgba(var(--primary-color-rgb), 0.18);
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

/* 预览网格容器 */
.folder-preview-grid {
  display: grid;
  gap: 2px;
  padding: 6px;
  background: var(--bg-secondary);
  border-radius: 12px;
  margin-bottom: 0.75rem;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 2x2 网格 */
.folder-preview-grid.grid-2x2 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  width: 64px;
  height: 64px;
}

/* 3x3 网格 */
.folder-preview-grid.grid-3x3 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  width: 64px;
  height: 64px;
}

/* 预览项 */
.preview-item {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hover-bg);
  border-radius: 4px;
  overflow: hidden;
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 1px;
}

.preview-item.empty {
  background: var(--hover-bg);
  opacity: 0.5;
}

/* 文件夹信息 */
.folder-info {
  width: 100%;
  text-align: center;
}

.folder-name {
  font-size: 0.813rem;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  margin-bottom: 0.125rem;
}

.member-count {
  font-size: 0.688rem;
  color: var(--text-secondary);
}

/* 小尺寸 */
.virtual-folder-icon.size-small {
  padding: 0.5rem 0.375rem;
}

.virtual-folder-icon.size-small .folder-preview-grid {
  width: 48px;
  height: 48px;
  margin-bottom: 0.5rem;
  padding: 4px;
  border-radius: 10px;
}

.virtual-folder-icon.size-small .folder-name {
  font-size: 0.75rem;
}

.virtual-folder-icon.size-small .member-count {
  font-size: 0.625rem;
}

/* 大尺寸 */
.virtual-folder-icon.size-large {
  padding: 1.25rem 1rem;
}

.virtual-folder-icon.size-large .folder-preview-grid {
  width: 80px;
  height: 80px;
  margin-bottom: 1rem;
  padding: 8px;
  border-radius: 14px;
}

.virtual-folder-icon.size-large .folder-name {
  font-size: 0.875rem;
}

.virtual-folder-icon.size-large .member-count {
  font-size: 0.75rem;
}

/* ==================== List View ==================== */
.virtual-folder-icon.list {
  flex-direction: row;
  justify-content: flex-start;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  height: 56px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid transparent;
}

.virtual-folder-icon.list:hover {
  background: var(--bg-secondary);
  border-color: var(--glass-border);
  transform: translateY(-2px);
}

/* 列表模式小型 2x2 预览网格 */
.virtual-folder-icon.list .folder-preview-mini {
  width: 32px;
  height: 32px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 1px;
  padding: 2px;
  background: var(--bg-secondary);
  border-radius: 6px;
  flex-shrink: 0;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.virtual-folder-icon.list .mini-preview-item {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hover-bg);
  border-radius: 2px;
  overflow: hidden;
}

.virtual-folder-icon.list .mini-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.virtual-folder-icon.list .mini-preview-item.empty {
  background: var(--hover-bg);
  opacity: 0.5;
}

.virtual-folder-icon.list .folder-info {
  flex: 1;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.virtual-folder-icon.list .folder-name {
  -webkit-line-clamp: 1;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.virtual-folder-icon.list:hover .folder-name {
  color: var(--text-primary);
}

.virtual-folder-icon.list .favorite-btn {
  position: static;
  opacity: 0.5;
  background: transparent;
  box-shadow: none;
  transform: none;
}

.virtual-folder-icon.list .favorite-btn.active {
  opacity: 1;
}
</style>
