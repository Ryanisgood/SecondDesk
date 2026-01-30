<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBatchSelectStore } from '../stores/batchSelect'
import { useFileStore, type DesktopCategory } from '../stores/files'

const batchStore = useBatchSelectStore()
const fileStore = useFileStore()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create-category'): void
}>()

const activeTab = ref<'categories' | 'virtualFolders'>('categories')

// 只显示 custom 类型的分类（可以添加文件的）
const customCategories = computed(() =>
  fileStore.categories.filter(c => c.kind === 'custom')
)

// 当前 displayItems 中的虚拟分组
const visibleVirtualFolders = computed(() =>
  fileStore.displayItems
    .filter(item => item.type === 'virtualFolder')
    .map(item => item.data)
)

function handleSelectCategory(category: DesktopCategory) {
  const success = batchStore.moveToCategory(category.id)
  if (success) {
    emit('close')
  }
}

function handleSelectVirtualFolder(folderId: string) {
  const success = batchStore.moveToVirtualFolder(folderId)
  if (success) {
    emit('close')
  }
}

function handleCreateCategory() {
  emit('create-category')
}

function handleCreateVirtualFolder() {
  const success = batchStore.createVirtualFolderWithSelected()
  if (success) {
    emit('close')
  }
}

function handleClose() {
  batchStore.closeTargetPicker()
  emit('close')
}

function handleOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="batchStore.targetPickerVisible" class="picker-overlay" @click="handleOverlayClick">
        <div class="picker-modal" @click.stop>
          <div class="picker-header">
            <h3>移动到...</h3>
            <button class="close-btn" @click="handleClose">&#10005;</button>
          </div>

          <div class="picker-tabs">
            <button
              :class="['tab', { active: activeTab === 'categories' }]"
              @click="activeTab = 'categories'"
            >
              &#127991; 分类
            </button>
            <button
              :class="['tab', { active: activeTab === 'virtualFolders' }]"
              @click="activeTab = 'virtualFolders'"
            >
              &#128193; 虚拟分组
            </button>
          </div>

          <div class="picker-content">
            <!-- 分类列表 -->
            <div v-if="activeTab === 'categories'" class="target-list">
              <div v-if="customCategories.length === 0" class="empty-hint">
                暂无自定义分类
              </div>
              <div
                v-for="cat in customCategories"
                :key="cat.id"
                class="target-item"
                @click="handleSelectCategory(cat)"
              >
                <span class="target-icon">{{ cat.icon }}</span>
                <span class="target-name">{{ cat.name }}</span>
                <span class="target-count">{{ cat.count ?? 0 }} 项</span>
              </div>

              <button class="create-btn" @click="handleCreateCategory">
                <span class="create-icon">&#43;</span>
                <span>创建新分类</span>
              </button>
            </div>

            <!-- 虚拟分组列表 -->
            <div v-if="activeTab === 'virtualFolders'" class="target-list">
              <div v-if="visibleVirtualFolders.length === 0" class="empty-hint">
                当前分类下暂无虚拟分组
              </div>
              <div
                v-for="folder in visibleVirtualFolders"
                :key="folder.id"
                class="target-item"
                @click="handleSelectVirtualFolder(folder.id)"
              >
                <span class="target-icon">{{ folder.icon || '&#128193;' }}</span>
                <span class="target-name">{{ folder.name }}</span>
                <span class="target-count">{{ folder.memberPaths.length }} 项</span>
              </div>

              <button
                class="create-btn"
                @click="handleCreateVirtualFolder"
                :disabled="batchStore.selectedCount < 2"
              >
                <span class="create-icon">&#43;</span>
                <span>创建新文件夹</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.picker-modal {
  width: 100%;
  max-width: 400px;
  max-height: 70vh;

  /* 毛玻璃效果 */
  background: rgba(var(--bg-base-rgb), 0.9);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);

  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow:
    0 24px 48px rgba(0, 0, 0, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.1);

  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.picker-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.picker-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}

.tab {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.tab:hover {
  background: var(--hover-bg);
}

.tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.picker-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.target-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.empty-hint {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 0.875rem;
}

.target-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
}

.target-item:hover {
  background: var(--hover-bg);
}

.target-icon {
  font-size: 1.25rem;
  width: 1.5rem;
  text-align: center;
}

.target-name {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.target-count {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
  margin-top: 0.5rem;
}

.create-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.05);
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-btn:disabled:hover {
  border-color: var(--border-color);
  color: var(--text-secondary);
  background: transparent;
}

.create-icon {
  font-size: 1.125rem;
  font-weight: 300;
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s var(--ease-out-quad);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .picker-modal,
.fade-leave-active .picker-modal {
  transition: all 0.2s var(--ease-out-quad);
}

.fade-enter-from .picker-modal,
.fade-leave-to .picker-modal {
  transform: scale(0.95);
}
</style>
