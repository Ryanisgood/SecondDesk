<script setup lang="ts">
import { computed } from 'vue'
import { useBatchSelectStore } from '../stores/batchSelect'
import { useFileStore } from '../stores/files'

const batchStore = useBatchSelectStore()
const fileStore = useFileStore()

const emit = defineEmits<{
  (e: 'open-target-picker'): void
  (e: 'create-category'): void
}>()

// 全选当前显示的所有项目
function handleSelectAll() {
  const allIds = fileStore.displayItems.map(item =>
    item.type === 'file' ? item.data.filePath : item.data.id
  )
  batchStore.selectAll(allIds)
}

// 打开目标选择器
function handleMoveTo() {
  batchStore.openTargetPicker()
  emit('open-target-picker')
}

// 创建虚拟分组
function handleCreateVirtualFolder() {
  batchStore.createVirtualFolderWithSelected()
}

// 取消
function handleCancel() {
  batchStore.exitBatchSelect()
}

// 判断当前是否是自定义 manual 分类
const isCustomManualCategory = computed(() => {
  return fileStore.getActiveCustomCategory() !== null
})

// 从分类移除（支持虚拟分组：把虚拟分组的成员文件也移除）
function handleRemoveFromCategory() {
  const category = fileStore.getActiveCustomCategory()
  if (!category) return

  const selectedIds = batchStore.selectedIdsArray

  // 收集所有要移除的文件路径
  const allPaths: string[] = []

  for (const id of selectedIds) {
    if (id.startsWith('vf_')) {
      // 虚拟分组：把其成员文件从分类移除
      const members = fileStore.getVirtualFolderMembers(id)
      allPaths.push(...members.map(m => m.filePath))
    } else {
      // 普通文件
      allPaths.push(id)
    }
  }

  if (allPaths.length === 0) return

  // 去重
  const uniquePaths = Array.from(new Set(allPaths))
  fileStore.removeFilesFromCategory(category.id, uniquePaths)
  batchStore.exitBatchSelect()
}

// 判断是否可以显示"合并分组"按钮
const canMoveToVirtualFolder = computed(() => {
  const selectedIds = batchStore.selectedIdsArray  // 使用数组而不是 Set
  if (selectedIds.length === 0) return false

  // 如果选中了任意一个虚拟分组，隐藏按钮（虚拟分组不能放入虚拟分组）
  const hasVirtualFolder = selectedIds.some(id => id.startsWith('vf_'))
  if (hasVirtualFolder) return false

  // 如果所有选中的文件都已经在虚拟分组中，隐藏按钮
  const allInVirtualFolder = selectedIds.every(id => {
    return fileStore.findVirtualFolderByFilePath(id) !== undefined
  })
  if (allInVirtualFolder) return false

  return true
})
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="batchStore.isActive" class="batch-action-bar">
        <div class="selection-info">
          <span class="count">已选择 {{ batchStore.selectedCount }} 项</span>
        </div>

        <div class="actions">
          <button class="action-btn" @click="handleSelectAll" title="全选">
            <span class="icon">&#9745;</span>
            <span class="label">全选</span>
          </button>

          <button class="action-btn primary" @click="handleMoveTo" title="移动到...">
            <span class="icon">&#128203;</span>
            <span class="label">移动到...</span>
          </button>

          <button class="action-btn" @click="$emit('create-category')" title="创建分类">
            <span class="icon">&#127991;</span>
            <span class="label">创建分类</span>
          </button>

          <!-- 从分类移除（仅在自定义 manual 分类中显示） -->
          <button
            v-if="isCustomManualCategory"
            class="action-btn warning"
            @click="handleRemoveFromCategory"
            title="从当前分类移除"
          >
            <span class="icon">&#10006;</span>
            <span class="label">从分类移除</span>
          </button>

          <!-- 合并分组（隐藏条件：选中虚拟分组或文件已在虚拟分组中） -->
          <button
            v-if="canMoveToVirtualFolder"
            class="action-btn"
            @click="handleCreateVirtualFolder"
            :disabled="batchStore.selectedCount < 2"
            title="创建虚拟分组（需要至少2个项目）"
          >
            <span class="icon">&#128193;</span>
            <span class="label">合并分组</span>
          </button>

          <button class="action-btn cancel" @click="handleCancel" title="取消">
            <span class="icon">&#10005;</span>
            <span class="label">取消</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.batch-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;

  /* 毛玻璃效果 */
  background: rgba(var(--bg-base-rgb), 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);

  border-top: 1px solid var(--glass-border);
  box-shadow:
    0 -4px 20px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  z-index: 1000;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.count {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary-color);
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.813rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s var(--ease-out-quad);
  user-select: none;
}

.action-btn:hover {
  background: var(--hover-bg);
  border-color: var(--primary-color);
}

.action-btn.primary {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: var(--text-on-primary);
}

.action-btn.primary:hover {
  filter: brightness(1.1);
}

.action-btn.cancel:hover {
  background: var(--danger-color);
  border-color: var(--danger-color);
  color: white;
}

.action-btn.warning {
  border-color: var(--warning-color);
  color: var(--warning-color);
}

.action-btn.warning:hover {
  background: var(--warning-color);
  border-color: var(--warning-color);
  color: white;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn:disabled:hover {
  background: transparent;
  border-color: var(--border-color);
}

.icon {
  font-size: 1rem;
  line-height: 1;
}

.label {
  white-space: nowrap;
}

/* 动画 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s var(--ease-out-quad);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
