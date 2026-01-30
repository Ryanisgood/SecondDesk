<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSearchStore } from '../stores/search'
import { useFileStore } from '../stores/files'
import SearchSuggestions from './SearchSuggestions.vue'

// Props
interface Props {
  placeholder?: string
}

const _props = withDefaults(defineProps<Props>(), {
  placeholder: '搜索文件、命令、网址...',
})
void _props // Keep props reactive for template usage

// Emits
const emit = defineEmits<{
  focus: []
  blur: []
  search: [query: string]
}>()

// Stores
const searchStore = useSearchStore()
const fileStore = useFileStore()

// Refs
const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

// State
const localQuery = ref('')
const isComposing = ref(false)

// Computed
const currentMode = computed(() => searchStore.mode)

const modeIcon = computed(() => {
  switch (currentMode.value) {
    case 'command':
      return '⚡'  // 命令模式
    case 'navigate':
      return '🌐'  // 导航模式
    case 'search':
    default:
      return '🔍'  // 搜索模式
  }
})

const modeColor = computed(() => {
  switch (currentMode.value) {
    case 'command':
      return '#3b82f6'  // 蓝色
    case 'navigate':
      return '#10b981'  // 绿色
    case 'search':
    default:
      return 'var(--text-tertiary)'  // 默认
  }
})

// Methods
function handleInput(e: Event): void {
  if (isComposing.value) return

  const target = e.target as HTMLInputElement
  localQuery.value = target.value

  // 更新 store
  searchStore.setQuery(target.value)

  // 触发文件搜索（兼容旧逻辑）
  // 注意：当输入为空或处于搜索模式时，都需要更新文件搜索
  if (searchStore.mode === 'search' || searchStore.mode === 'auto' || target.value === '') {
    fileStore.searchFiles(target.value)
    emit('search', target.value)
  }
}

function handleKeyDown(e: KeyboardEvent): void {
  if (isComposing.value) return

  switch (e.key) {
    case 'Enter':
      e.preventDefault()
      handleEnter()
      break

    case 'Escape':
      e.preventDefault()
      handleEscape()
      break

    case 'ArrowDown':
      e.preventDefault()
      searchStore.navigateSuggestions('down')
      break

    case 'ArrowUp':
      e.preventDefault()
      searchStore.navigateSuggestions('up')
      break

    case 'Tab':
      if (searchStore.showSuggestions && searchStore.suggestions.length > 0) {
        e.preventDefault()
        // Tab 键选择当前高亮的建议
        if (searchStore.selectedSuggestion) {
          localQuery.value = searchStore.selectedSuggestion.title
          searchStore.setQuery(searchStore.selectedSuggestion.title)
        }
      }
      break
  }
}

async function handleEnter(): Promise<void> {
  try {
    await searchStore.execute()
    localQuery.value = ''
    blur()
  } catch (error) {
    console.error('执行操作失败:', error)
  }
}

function handleEscape(): void {
  if (searchStore.showSuggestions) {
    searchStore.hideSuggestions()
  } else {
    clear()
  }
}

function handleFocus(): void {
  searchStore.displaySuggestions()
  emit('focus')
}

function handleBlur(): void {
  // 延迟隐藏，让点击建议项有时间触发
  setTimeout(() => {
    searchStore.hideSuggestions()
    emit('blur')
  }, 200)
}

function handleCompositionStart(): void {
  isComposing.value = true
}

function handleCompositionEnd(): void {
  isComposing.value = false
  // 触发一次输入处理
  if (inputRef.value) {
    handleInput({ target: inputRef.value } as unknown as Event)
  }
}

function clear(): void {
  localQuery.value = ''
  searchStore.clear()
  fileStore.searchFiles('')
  emit('search', '')
}

function focus(): void {
  inputRef.value?.focus()
}

function blur(): void {
  inputRef.value?.blur()
}

// 点击外部关闭建议菜单
function handleClickOutside(e: MouseEvent): void {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    searchStore.hideSuggestions()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// 监听 store 的查询变化（用于外部修改）
watch(() => searchStore.query, (newQuery) => {
  if (newQuery !== localQuery.value) {
    localQuery.value = newQuery
  }
})

// 暴露方法给父组件
defineExpose({
  focus,
  blur,
  clear,
})
</script>

<template>
  <div ref="containerRef" class="smart-search-box-container">
    <div class="smart-search-box" :class="{ focused: searchStore.showSuggestions }">
      <!-- 模式图标 -->
      <div class="search-icon" :style="{ color: modeColor }">
        {{ modeIcon }}
      </div>

      <!-- 输入框 -->
      <input
        ref="inputRef"
        v-model="localQuery"
        type="text"
        :placeholder="placeholder"
        class="search-input"
        @input="handleInput"
        @keydown="handleKeyDown"
        @focus="handleFocus"
        @blur="handleBlur"
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"
      />

      <!-- 清空按钮 -->
      <button
        v-if="localQuery"
        class="clear-btn"
        @click.stop="clear"
        title="清空"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- 建议菜单 -->
    <Transition name="suggestions-fade">
      <SearchSuggestions
        v-if="searchStore.showSuggestions && searchStore.suggestions.length > 0"
        @select="handleEnter"
      />
    </Transition>
  </div>
</template>

<style scoped>
.smart-search-box-container {
  position: relative;
  width: 100%;
}

.smart-search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: rgba(var(--bg-base-rgb), 0.3);
  border: 1px solid var(--border-color);
  border-radius: 99px;
  min-width: 320px;
  transition: all 0.2s var(--ease-out-quad);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03);
}

.smart-search-box:hover {
  background: rgba(var(--bg-base-rgb), 0.5);
  border-color: var(--text-tertiary);
}

.smart-search-box.focused {
  background: var(--bg-primary);
  border-color: var(--primary-color);
  box-shadow: var(--focus-glow), var(--shadow-md);
  transform: translateY(-1px);
}

.search-icon {
  font-size: 1rem;
  transition: color 0.2s;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  outline: none;
  width: 100%;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
  flex-shrink: 0;
  padding: 0;
}

.clear-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

/* 建议菜单过渡动画 */
.suggestions-fade-enter-active,
.suggestions-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.suggestions-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.suggestions-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
