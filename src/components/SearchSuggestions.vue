<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSearchStore } from '../stores/search'
import type { Suggestion, SuggestionGroup } from '../types/search'

// Emits
const emit = defineEmits<{
  select: [suggestion: Suggestion]
}>()

// Store
const searchStore = useSearchStore()

// 错误提示状态
const errorMessage = ref('')
let errorTimer: number | null = null

// Computed
const groupedSuggestions = computed<SuggestionGroup[]>(() => {
  const groups: SuggestionGroup[] = []
  const suggestions = searchStore.suggestions

  // 按类型分组
  const commandSuggestions = suggestions.filter(s => s.type === 'command')
  const navigateSuggestions = suggestions.filter(s => s.type === 'navigate')
  const fileSuggestions = suggestions.filter(s => s.type === 'file')
  const historySuggestions = suggestions.filter(s => s.type === 'history')

  if (commandSuggestions.length > 0) {
    groups.push({
      title: '命令',
      items: commandSuggestions,
    })
  }

  if (navigateSuggestions.length > 0) {
    groups.push({
      title: '导航',
      items: navigateSuggestions,
    })
  }

  if (fileSuggestions.length > 0) {
    groups.push({
      title: '文件',
      items: fileSuggestions,
    })
  }

  if (historySuggestions.length > 0) {
    groups.push({
      title: '历史记录',
      items: historySuggestions,
    })
  }

  return groups
})

// Methods
function handleSelectSuggestion(suggestion: Suggestion, index: number): void {
  // 设置选中的建议索引
  searchStore.selectSuggestion(index)

  // 触发 select 事件，让 SearchBox 通过 execute() 来执行
  // 注意：不在这里直接调用 action()，避免重复执行
  emit('select', suggestion)
}

function showError(message: string): void {
  errorMessage.value = message

  // 3秒后自动消失
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = window.setTimeout(() => {
    errorMessage.value = ''
  }, 3000)
}

function isSelected(index: number): boolean {
  return index === searchStore.selectedIndex
}

// 计算全局索引（跨分组）
function getGlobalIndex(groupIndex: number, itemIndex: number): number {
  let globalIndex = 0
  for (let i = 0; i < groupIndex; i++) {
    globalIndex += groupedSuggestions.value[i].items.length
  }
  return globalIndex + itemIndex
}
</script>

<template>
  <!-- 主内容：建议下拉菜单 -->
  <div class="suggestions-dropdown">
    <div
      v-for="(group, groupIndex) in groupedSuggestions"
      :key="group.title"
      class="suggestion-group"
    >
      <!-- 分组标题 -->
      <div class="group-header">{{ group.title }}</div>

      <!-- 建议项列表 -->
      <div
        v-for="(item, itemIndex) in group.items"
        :key="item.id"
        class="suggestion-item"
        :class="{ selected: isSelected(getGlobalIndex(groupIndex, itemIndex)) }"
        @click="handleSelectSuggestion(item, getGlobalIndex(groupIndex, itemIndex))"
        @mouseenter="searchStore.selectSuggestion(getGlobalIndex(groupIndex, itemIndex))"
      >
        <!-- 图标 -->
        <div class="suggestion-icon">
          <img
            v-if="item.icon.startsWith('/')"
            :src="item.icon"
            :alt="item.title"
            class="icon-image"
          />
          <span v-else>{{ item.icon }}</span>
        </div>

        <!-- 内容 -->
        <div class="suggestion-content">
          <div class="suggestion-title">{{ item.title }}</div>
          <div v-if="item.description" class="suggestion-description">
            {{ item.description }}
          </div>
        </div>

        <!-- 快捷键提示 -->
        <div v-if="item.shortcut" class="suggestion-shortcut">
          {{ item.shortcut }}
        </div>
      </div>
    </div>

    <!-- 错误提示 - 使用 Teleport 传送到 body -->
    <Teleport to="body">
      <Transition name="error-fade">
        <div v-if="errorMessage" class="error-toast" @click="errorMessage = ''">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{{ errorMessage }}</span>
          <span class="error-close">✕</span>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.suggestions-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  max-height: 400px;
  overflow-y: auto;
  background: var(--bg-primary);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xl);
  z-index: 1000;
  padding: 0.5rem;
}

.suggestion-group {
  margin-bottom: 0.5rem;
}

.suggestion-group:last-child {
  margin-bottom: 0;
}

.group-header {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 0.75rem 0.25rem;
  user-select: none;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background: var(--hover-bg);
}

.suggestion-item.selected {
  box-shadow: inset 0 0 0 1px var(--primary-color);
}

.suggestion-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-image {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.suggestion-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.suggestion-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-description {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.125rem;
}

.suggestion-shortcut {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  background: rgba(var(--bg-base-rgb), 0.5);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

/* 滚动条样式 */
.suggestions-dropdown::-webkit-scrollbar {
  width: 6px;
}

.suggestions-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.suggestions-dropdown::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 3px;
  opacity: 0.3;
}

.suggestions-dropdown::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* 错误提示样式 */
.error-toast {
  position: fixed;
  top: 60px;
  right: 20px;
  background: #f56c6c;
  color: white;
  padding: 12px 16px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  animation: slideIn 0.3s ease;
  z-index: 10000;
  max-width: 400px;
}

.error-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.error-text {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
}

.error-close {
  font-size: 16px;
  opacity: 0.8;
  flex-shrink: 0;
}

.error-close:hover {
  opacity: 1;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 错误提示过渡动画 */
.error-fade-enter-active {
  animation: slideIn 0.3s ease;
}

.error-fade-leave-active {
  animation: slideOut 0.3s ease;
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
</style>
