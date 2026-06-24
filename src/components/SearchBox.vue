<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, useAttrs } from 'vue'
import { useSearchStore } from '../stores/search'
import { useFileStore } from '../stores/files'
import SearchSuggestions from './SearchSuggestions.vue'
import { useI18n } from '../i18n'

// Props
interface Props {
  placeholder?: string
}

const _props = withDefaults(defineProps<Props>(), {
  placeholder: '',
})
void _props // Keep props reactive for template usage

// 获取传递的属性（如 class）
const attrs = useAttrs()

// Emits
const emit = defineEmits<{
  focus: []
  blur: []
  search: [query: string]
}>()

// Stores
const searchStore = useSearchStore()
const fileStore = useFileStore()
const { t } = useI18n()

// Refs
const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

// State
const localQuery = ref('')
const isComposing = ref(false)
const errorMessage = ref('')
let errorTimer: number | null = null

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
    // 注意：不在这里清空 localQuery
    // 如果是 command/navigate 模式，searchStore.execute() 会调用 clear()
    // 然后 watch 会自动同步 localQuery = ''
    // 如果是 search 模式，保持 localQuery 不变，方便用户继续操作
  } catch (error) {
    console.error('执行操作失败:', error)
    // 显示错误提示
    const errorMsg = error instanceof Error ? error.message : t('search.executeFailed')
    showError(errorMsg)
  }
}

function showError(message: string): void {
  errorMessage.value = message

  // 3秒后自动消失
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = window.setTimeout(() => {
    errorMessage.value = ''
  }, 3000)
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
  <div ref="containerRef" class="smart-search-box-container" :class="attrs.class">
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
        :title="t('search.clear')"
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

    <!-- 错误提示 - 使用 Teleport 传送到 body -->
    <Teleport to="body">
      <Transition name="error-fade">
        <div v-if="errorMessage" class="error-toast-searchbox" @click="errorMessage = ''">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{{ errorMessage }}</span>
          <span class="error-close">✕</span>
        </div>
      </Transition>
    </Teleport>
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

/* 错误提示样式 */
.error-toast-searchbox {
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
  z-index: 10000;
  max-width: 400px;
}

.error-toast-searchbox .error-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.error-toast-searchbox .error-text {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
}

.error-toast-searchbox .error-close {
  font-size: 16px;
  opacity: 0.8;
  flex-shrink: 0;
}

.error-toast-searchbox .error-close:hover {
  opacity: 1;
}

/* 错误提示过渡动画 */
.error-fade-enter-active {
  animation: errorSlideIn 0.3s ease;
}

.error-fade-leave-active {
  animation: errorSlideOut 0.3s ease;
}

@keyframes errorSlideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes errorSlideOut {
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
