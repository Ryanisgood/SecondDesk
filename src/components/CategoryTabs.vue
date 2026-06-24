<script setup lang="ts">
import { computed, ref } from 'vue'
import { DRAG_DATA_TYPES } from '../config/dragConfig'
import {
  useFileStore,
  type CustomCategoryRule,
  type DesktopCategory,
  type FileTypeOption,
  PRESET_CATEGORIES,
  getFileTypeIconUrl,
} from '../stores/files'
import { useDialog } from '../composables/useDialog'
import { useI18n } from '../i18n'

const emit = defineEmits<{
  (e: 'auto-hide-suspend'): void
  (e: 'auto-hide-resume'): void
}>()

const fileStore = useFileStore()
const dialog = useDialog()
const { t } = useI18n()

const categories = computed<DesktopCategory[]>(() => fileStore.categories)
const activeCategoryId = computed(() => fileStore.activeCategoryId)
const fileTypeOptions = computed<FileTypeOption[]>(() => fileStore.fileTypeOptions)
const allFiles = computed(() => fileStore.files)

const fileTypeIconMap = computed(() => new Map(fileTypeOptions.value.map(opt => [opt.fType, opt.icon] as const)))

// 判断是否为 emoji（包含非 ASCII 字符或特定 emoji 范围）
function isEmoji(str: string): boolean {
  return /[\u{1F300}-\u{1FAD6}]|[\u2600-\u26FF]/u.test(str)
}

// 获取文件类型图标 URL
function getFileIconUrl(fType: string): string {
  const icon = fileTypeIconMap.value.get(fType) ?? 'box'
  return getFileTypeIconUrl(icon)
}

const showModal = ref(false)
const editingCategoryId = ref<string | null>(null)
const categoryName = ref('')
const selectedFilePaths = ref<string[]>([])
const fileSearch = ref('')
const fileTypeFilter = ref<string>('') // 文件类型筛选
const formError = ref('')
const dragOverCategoryId = ref<string | null>(null) // 拖拽悬停的分类 ID（文件拖拽到分类）
const draggedCategoryId = ref<string | null>(null) // 正在拖拽的分类 ID（分类拖拽排序）
const dropTargetCategoryId = ref<string | null>(null) // 拖拽目标分类 ID（分类拖拽排序）

// 文件选择弹窗相关
const showFilePicker = ref(false)
const tempSelectedPaths = ref<string[]>([])

// 预设分类折叠
const presetCollapsed = ref(false)

let autoHideSuspended = false

function suspendAutoHide() {
  if (autoHideSuspended) return
  autoHideSuspended = true
  emit('auto-hide-suspend')
}

function resumeAutoHide() {
  if (!autoHideSuspended) return
  autoHideSuspended = false
  emit('auto-hide-resume')
}

const selectableFiles = computed(() => {
  let result = allFiles.value

  // 按文件类型筛选
  if (fileTypeFilter.value) {
    result = result.filter(f => f.fType === fileTypeFilter.value)
  }

  // 按文件名搜索
  const q = fileSearch.value.trim().toLowerCase()
  if (q) {
    result = result.filter(f => f.fileName.toLowerCase().includes(q))
  }

  return result
})

function selectCategory(id: string) {
  fileStore.setActiveCategory(id)
}

function openCreateModal() {
  editingCategoryId.value = null
  categoryName.value = ''
  selectedFilePaths.value = []
  fileSearch.value = ''
  fileTypeFilter.value = ''
  formError.value = ''
  showModal.value = true
  suspendAutoHide()
}

// 从外部调用，预设选中的文件
function openCreateModalWithFiles(filePaths: string[]) {
  editingCategoryId.value = null
  categoryName.value = ''
  selectedFilePaths.value = [...filePaths]
  fileSearch.value = ''
  fileTypeFilter.value = ''
  formError.value = ''
  showModal.value = true
  suspendAutoHide()
}

// 暴露给父组件
defineExpose({
  openCreateModalWithFiles
})

function openEditModal(cat: DesktopCategory) {
  if (cat.kind !== 'custom') return

  editingCategoryId.value = cat.id
  categoryName.value = cat.name
  selectedFilePaths.value = Array.isArray(cat.filePaths) ? [...cat.filePaths] : []
  fileSearch.value = ''
  fileTypeFilter.value = ''
  formError.value = ''
  showModal.value = true
  suspendAutoHide()
}

function closeModal() {
  showModal.value = false
  resumeAutoHide()
}

function saveCategory() {
  formError.value = ''

  const name = categoryName.value.trim()
  if (!name) {
    formError.value = t('category.errorNameRequired')
    return
  }

  if (selectedFilePaths.value.length === 0) {
    formError.value = t('category.errorSelectFile')
    return
  }

  const rule: CustomCategoryRule = { mode: 'manual', filePaths: selectedFilePaths.value }

  const ok = editingCategoryId.value
    ? fileStore.updateCustomCategory(editingCategoryId.value, name, rule)
    : fileStore.createCustomCategory(name, rule)

  if (!ok) {
    formError.value = t('category.errorSaveFailed')
    return
  }

  showModal.value = false
  resumeAutoHide()
}

// 文件选择弹窗方法
function openFilePicker() {
  tempSelectedPaths.value = [...selectedFilePaths.value]
  fileSearch.value = ''
  fileTypeFilter.value = ''
  showFilePicker.value = true
}

function confirmFilePicker() {
  selectedFilePaths.value = [...tempSelectedPaths.value]
  showFilePicker.value = false
}

function cancelFilePicker() {
  showFilePicker.value = false
}

function selectAllTemp() {
  const paths = selectableFiles.value.map(f => f.filePath)
  tempSelectedPaths.value = [...new Set([...tempSelectedPaths.value, ...paths])]
}

function clearTempSelection() {
  tempSelectedPaths.value = []
}

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath
}

async function deleteCategory(cat: DesktopCategory, event: MouseEvent) {
  event.stopPropagation()
  if (cat.kind !== 'custom') return

  const ok = await dialog.confirmDanger(t('category.deleteConfirm', { name: cat.name }), { title: t('category.deleteTitle') })
  if (!ok) return

  fileStore.deleteCustomCategory(cat.id)
}

function handleCategoryContextMenu(cat: DesktopCategory, event: MouseEvent) {
  if (cat.kind !== 'custom') return
  event.preventDefault()
  openEditModal(cat)
}

function handleCategoryDragOver(cat: DesktopCategory, event: DragEvent) {
  // 只有自定义分类才允许拖拽
  if (cat.kind !== 'custom') {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  dragOverCategoryId.value = cat.id

  if (event.dataTransfer) {
    // 使用 'move' 而不是 'copy'，因为 FileGrid 中设置的 effectAllowed 是 'move'
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleCategoryDragLeave(cat: DesktopCategory, event: DragEvent) {
  void event
  // 由于子元素都设置了 pointer-events: none，所以可以简化逻辑
  if (dragOverCategoryId.value === cat.id) {
    dragOverCategoryId.value = null
  }
}

function handleCategoryDrop(cat: DesktopCategory, event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  dragOverCategoryId.value = null

  // 只有自定义分类才允许添加文件
  if (cat.kind !== 'custom') return

  // 检查是否是虚拟分组拖拽
  const virtualFolderId = event.dataTransfer?.getData(DRAG_DATA_TYPES.VIRTUAL_FOLDER_ID)
  if (virtualFolderId) {
    // 虚拟分组：把其成员文件添加到分类
    const members = fileStore.getVirtualFolderMembers(virtualFolderId)
    if (members.length > 0) {
      const filePaths = members.map(m => m.filePath)
      fileStore.addFilesToCategory(cat.id, filePaths)
    }
    return
  }

  // 普通文件拖拽
  const filePath = event.dataTransfer?.getData(DRAG_DATA_TYPES.FILE_PATH) ||
    event.dataTransfer?.getData('text/plain')
  if (!filePath) return

  fileStore.addFilesToCategory(cat.id, [filePath])
}

// 分类拖拽排序功能
function handleCategoryDragStart(cat: DesktopCategory, event: DragEvent) {
  // "全部"分类不允许拖拽
  if (cat.id === 'all') {
    event.preventDefault()
    return
  }

  draggedCategoryId.value = cat.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('category-id', cat.id)
  }
}

function handleCategoryDragEnd() {
  draggedCategoryId.value = null
  dropTargetCategoryId.value = null
}

function handleCategoryDragOverForReorder(cat: DesktopCategory, event: DragEvent) {
  // 检查是否是分类拖拽（而不是文件拖拽）
  const categoryId = event.dataTransfer?.types.includes('category-id')
  if (!categoryId || !draggedCategoryId.value) return

  // "全部"分类不能作为放置目标
  if (cat.id === 'all') return

  event.preventDefault()
  event.stopPropagation()
  dropTargetCategoryId.value = cat.id

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleCategoryDropForReorder(cat: DesktopCategory, event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()

  const draggedId = draggedCategoryId.value
  const targetId = cat.id

  if (!draggedId || draggedId === targetId || targetId === 'all') {
    draggedCategoryId.value = null
    dropTargetCategoryId.value = null
    return
  }

  // 获取当前分类顺序
  const currentOrder = categories.value.map(c => c.id)
  const draggedIndex = currentOrder.indexOf(draggedId)
  const targetIndex = currentOrder.indexOf(targetId)

  if (draggedIndex === -1 || targetIndex === -1) return

  // 重新排序
  const newOrder = [...currentOrder]
  newOrder.splice(draggedIndex, 1)
  newOrder.splice(targetIndex, 0, draggedId)

  // 保存新顺序
  fileStore.reorderCategories(newOrder)

  draggedCategoryId.value = null
  dropTargetCategoryId.value = null
}
</script>

<template>
  <div class="category-tabs-wrapper">
    <div class="category-tabs">
      <div
        v-for="cat in categories"
        :key="cat.id"
        class="chrome-tab"
        :class="{
          active: activeCategoryId === cat.id,
          'drag-over': dragOverCategoryId === cat.id && cat.kind === 'custom',
          'dragging': draggedCategoryId === cat.id,
          'drop-target': dropTargetCategoryId === cat.id
        }"
        :draggable="cat.id !== 'all'"
        @click="selectCategory(cat.id)"
        @contextmenu="handleCategoryContextMenu(cat, $event)"
        @dragstart="handleCategoryDragStart(cat, $event)"
        @dragend="handleCategoryDragEnd"
        @dragover="(e) => { handleCategoryDragOver(cat, e); handleCategoryDragOverForReorder(cat, e) }"
        @dragleave="handleCategoryDragLeave(cat, $event)"
        @drop="(e) => { handleCategoryDrop(cat, e); handleCategoryDropForReorder(cat, e) }"
      >
        <!-- 标签主体内容 -->
        <div class="tab-content">
          <span v-if="isEmoji(cat.icon)" class="icon">{{ cat.icon }}</span>
          <img v-else :src="getFileTypeIconUrl(cat.icon)" class="icon-img" alt="" />
          <span class="name">{{ cat.name }}</span>
          <span v-if="typeof cat.count === 'number'" class="count">{{ cat.count }}</span>
          <button
            v-if="cat.kind === 'custom'"
            class="delete-btn"
            :title="t('category.deleteTitle')"
            @click="deleteCategory(cat, $event)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="chrome-tab add-btn" @click="openCreateModal">
        <div class="tab-content">
          <span class="icon">＋</span>
          <span class="name">{{ t('category.new') }}</span>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal modal-compact">
        <h3 class="modal-title">{{ editingCategoryId ? t('category.edit') : t('category.new') }}</h3>

        <!-- 预设分类选择（可折叠） -->
        <div v-if="!editingCategoryId" class="form-row">
          <label class="label preset-label" @click="presetCollapsed = !presetCollapsed">
            <span class="collapse-arrow" :class="{ collapsed: presetCollapsed }">▼</span>
            {{ t('category.presetOptional') }}
          </label>
          <div v-show="!presetCollapsed" class="preset-categories">
            <label
              v-for="preset in PRESET_CATEGORIES"
              :key="preset.id"
              class="preset-option"
            >
              <input
                type="checkbox"
                :checked="fileStore.isPresetCategoryEnabled(preset.id)"
                @change="fileStore.togglePresetCategory(preset.id)"
              />
              <span v-if="isEmoji(preset.icon)" class="preset-icon">{{ preset.icon }}</span>
              <img v-else :src="getFileTypeIconUrl(preset.icon)" class="preset-icon-img" alt="" />
              <span class="preset-name">{{ t(preset.name as any) }}</span>
              <span class="preset-hint">{{ t('category.autoGroup') }}</span>
            </label>
          </div>
        </div>

        <div class="form-row">
          <label class="label">{{ t('category.name') }}</label>
          <input
            v-model="categoryName"
            class="input"
            type="text"
            :placeholder="t('category.namePlaceholder')"
            maxlength="20"
          />
        </div>

        <!-- 文件选择摘要 -->
        <div class="form-row">
          <label class="label">{{ t('category.selectFiles') }}</label>
          <div class="file-selection-summary">
            <span class="selected-count">
              {{ selectedFilePaths.length ? t('common.selectedCount', { count: selectedFilePaths.length }) : t('category.noFilesSelected') }}
            </span>
            <button class="btn primary-outline" @click="openFilePicker">
              {{ selectedFilePaths.length ? t('category.chooseAgain') : t('category.chooseFiles') }}
            </button>
          </div>
          <!-- 已选文件名预览 -->
          <div v-if="selectedFilePaths.length" class="selected-preview">
            <span v-for="path in selectedFilePaths.slice(0, 3)" :key="path" class="preview-tag">
              {{ getFileName(path) }}
            </span>
            <span v-if="selectedFilePaths.length > 3" class="preview-more">
              {{ t('category.moreFiles', { count: selectedFilePaths.length - 3 }) }}
            </span>
          </div>
        </div>

        <div v-if="formError" class="error">{{ formError }}</div>

        <div class="modal-actions">
          <button class="btn" @click="closeModal">{{ t('common.cancel') }}</button>
          <button class="btn primary" @click="saveCategory">{{ editingCategoryId ? t('common.save') : t('common.create') }}</button>
        </div>
      </div>
    </div>

    <!-- 文件选择弹窗 -->
    <Teleport to="body">
      <div v-if="showFilePicker" class="picker-overlay" @click.self="cancelFilePicker">
        <div class="picker-modal">
          <div class="picker-header">
            <h3 class="picker-title">{{ t('category.filePickerTitle') }}</h3>
            <span class="picker-count">{{ t('category.pickerSelected', { count: tempSelectedPaths.length }) }}</span>
          </div>

          <div class="picker-toolbar">
            <select v-model="fileTypeFilter" class="input file-type-select">
              <option value="">{{ t('category.allTypes') }}</option>
              <option v-for="opt in fileTypeOptions" :key="opt.fType" :value="opt.fType">
                {{ isEmoji(opt.icon) ? opt.icon : '' }} {{ opt.name }}
              </option>
            </select>
            <input v-model="fileSearch" class="input file-search" type="text" :placeholder="t('category.filterFiles')" />
            <button class="btn" @click="selectAllTemp">{{ t('category.selectAll') }}</button>
            <button class="btn" @click="clearTempSelection">{{ t('category.clearSelection') }}</button>
          </div>

          <div class="picker-list">
            <label v-for="file in selectableFiles" :key="file.filePath" class="file-option">
              <input v-model="tempSelectedPaths" type="checkbox" :value="file.filePath" />
              <img :src="getFileIconUrl(file.fType)" class="file-icon-img" alt="" />
              <span class="file-name" :title="file.fileName">{{ file.fileName }}</span>
              <span v-if="file.isFavorite" class="favorite-mark">⭐</span>
            </label>
          </div>

          <div class="picker-actions">
            <button class="btn" @click="cancelFilePicker">{{ t('common.cancel') }}</button>
            <button class="btn primary" @click="confirmFilePicker">
              {{ t('category.confirmWithCount', { count: tempSelectedPaths.length }) }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ==================== Chrome 风格标签页 ==================== */
.category-tabs-wrapper {
  position: relative;
  z-index: 5;
}

.category-tabs {
  display: flex;
  align-items: flex-end;
  gap: 0;
  padding: 0.5rem 1rem 0;
  overflow-x: auto;
  scrollbar-width: thin;
  position: relative;
}

/* Chrome 标签基础样式 */
.chrome-tab {
  position: relative;
  display: flex;
  align-items: stretch;
  min-width: fit-content;
  height: 36px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out-quad);
  z-index: 1;
  /* 标签间距通过 margin 控制 */
  margin-right: -8px;
}

.chrome-tab:hover {
  z-index: 2;
}

.chrome-tab.active {
  z-index: 10;
}

/* 标签主体内容区 */
.tab-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0 1rem;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  white-space: nowrap;
  transition: all 0.2s var(--ease-out-quad);
  /* Chrome 风格圆角 - 只有顶部圆角 */
  border-radius: 10px 10px 0 0;
  /* 预留曲线空间 */
  margin: 0 6px;
}

/* ==================== 未选中标签 - 加深的半透明背景 ==================== */
.chrome-tab:not(.active) .tab-content {
  background: rgba(0, 0, 0, 0.08);
  color: var(--text-secondary);
}

.chrome-tab:not(.active):hover .tab-content {
  background: rgba(0, 0, 0, 0.12);
  color: var(--text-primary);
}

/* ==================== 选中标签 - 透明背景与整体融合 ==================== */
.chrome-tab.active .tab-content {
  /* 完全透明，与整体背景融为一体 */
  background: transparent;
  color: var(--text-primary);
  font-weight: 500;
  /* 左上右深色边框，底部无边框 */
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-bottom: none;
  /* 顶部圆角与未选中标签一致 */
  border-radius: 10px 10px 0 0;
}

/* ==================== 拖拽状态 ==================== */
.chrome-tab.drag-over .tab-content {
  background: rgba(var(--primary-color-rgb), 0.25);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--text-primary);
  border: 1px solid rgba(var(--primary-color-rgb), 0.4);
  border-bottom: none;
}

.chrome-tab.dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.chrome-tab.drop-target {
  transform: translateX(4px);
}

.chrome-tab.drop-target .tab-content::before {
  content: '';
  position: absolute;
  left: -4px;
  top: 4px;
  bottom: 4px;
  width: 3px;
  background: var(--primary-color);
  border-radius: 2px;
}

/* ==================== 标签内元素 ==================== */
.chrome-tab .icon {
  font-size: 1rem;
  pointer-events: none;
}

.chrome-tab .icon-img {
  width: 16px;
  height: 16px;
  object-fit: contain;
  pointer-events: none;
}

.chrome-tab .name {
  pointer-events: none;
}

.count {
  margin-left: 0.25rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.75rem;
  border-radius: 999px;
  background: rgba(var(--primary-color-rgb), 0.15);
  color: var(--text-primary);
  pointer-events: none;
  font-weight: 500;
}

.chrome-tab.active .count {
  background: rgba(var(--primary-color-rgb), 0.2);
}

/* ==================== 新建分类按钮 ==================== */
.add-btn {
  opacity: 0.6;
  margin-left: 8px;
}

.add-btn .tab-content {
  border: 1px dashed var(--border-color);
  border-bottom: none;
  background: transparent;
}

.add-btn:hover {
  opacity: 1;
}

.add-btn:hover .tab-content {
  background: rgba(var(--bg-base-rgb), 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-style: solid;
  border-color: var(--glass-border);
}

/* ==================== 删除按钮 ==================== */
.delete-btn {
  margin-left: 0.25rem;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.chrome-tab:hover .delete-btn {
  opacity: 0.5;
}

.delete-btn:hover {
  opacity: 1 !important;
  background: rgba(var(--primary-color-rgb), 0.15);
  color: var(--danger-color);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  padding: 1.5rem;
}

/* 紧凑模态框 */
.modal.modal-compact {
  max-width: 560px;
  max-height: none;
  padding: 1.25rem;
}

.modal-title {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  flex-shrink: 0;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}

/* 预设分类折叠标签 */
.preset-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
  user-select: none;
}

.preset-label:hover {
  color: var(--text-primary);
}

.collapse-arrow {
  font-size: 0.625rem;
  transition: transform 0.2s;
}

.collapse-arrow.collapsed {
  transform: rotate(-90deg);
}

.preset-categories {
  display: flex;
  gap: 0.75rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.preset-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  border: 1px solid transparent;
}

.preset-option:hover {
  background: var(--hover-bg);
  border-color: var(--border-color);
}

.preset-option input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}

.preset-icon {
  font-size: 1rem;
  line-height: 1;
}

.preset-icon-img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.preset-name {
  font-size: 0.813rem;
  font-weight: 500;
  color: var(--text-primary);
}

.preset-hint {
  font-size: 0.688rem;
  color: var(--text-secondary);
  opacity: 0.7;
  margin-left: 0.25rem;
}

.label {
  font-size: 0.813rem;
  color: var(--text-secondary);
}

.input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
}

.input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.15);
}

/* 文件选择摘要区域 */
.file-selection-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.selected-count {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.btn.primary-outline {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: transparent;
}

.btn.primary-outline:hover {
  background: rgba(74, 144, 226, 0.1);
}

.selected-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.375rem;
}

.preview-tag {
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  background: rgba(74, 144, 226, 0.1);
  color: var(--text-primary);
  font-size: 0.75rem;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-more {
  font-size: 0.75rem;
  color: var(--text-secondary);
  padding: 0.125rem 0.25rem;
}

/* 文件选择弹窗 */
.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 2rem;
}

.picker-modal {
  width: 100%;
  max-width: 800px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 1.25rem;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.picker-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.picker-count {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.picker-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  flex-shrink: 0;
  margin-bottom: 0.5rem;
}

.file-type-select {
  flex: 0 0 auto;
  min-width: 140px;
}

.file-search {
  flex: 1;
  min-width: 180px;
}

.picker-list {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.picker-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.file-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
}

.file-option:hover {
  background: var(--hover-bg);
}

.file-option input {
  margin: 0;
}

.file-icon {
  width: 20px;
  text-align: center;
}

.file-icon-img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.favorite-mark {
  font-size: 0.875rem;
  opacity: 0.9;
}

.error {
  color: #e74c3c;
  font-size: 0.813rem;
  margin: 0.5rem 0;
  flex-shrink: 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.btn {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
}

.btn:hover {
  background: var(--hover-bg);
}

.btn.primary {
  border-color: var(--primary-color);
  background: var(--primary-color);
  color: #fff;
}
</style>
