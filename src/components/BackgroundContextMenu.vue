<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import type { SortMode } from '../stores/files'
import { computeMenuPosition } from '../utils/menuPosition'
import { getIconPath } from '../utils/iconHelper'
import { useI18n } from '../i18n'

// 图标路径
const iconRefresh = getIconPath('refresh')
const iconGoogleDocs = getIconPath('google-docs')
const iconOpenFolder = getIconPath('open-folder')
const iconTags = getIconPath('tags')

interface Props {
  x: number
  y: number
  sortMode: SortMode
  canUndoDelete: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'refresh'): void
  (e: 'newFile'): void
  (e: 'newFolder'): void
  (e: 'setSortMode', mode: SortMode): void
  (e: 'undoDelete'): void
}>()

const menuRef = ref<HTMLDivElement | null>(null)
const left = ref(0)
const top = ref(0)

function adjustMenuPosition() {
  if (!menuRef.value) return

  const rect = menuRef.value.getBoundingClientRect()
  const position = computeMenuPosition({
    x: props.x,
    y: props.y,
    menuWidth: rect.width,
    menuHeight: rect.height,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
  })

  left.value = position.left
  top.value = position.top
}

onMounted(() => {
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('contextmenu', handleClickOutside)
  }, 0)

  nextTick(adjustMenuPosition)
  window.addEventListener('resize', adjustMenuPosition)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('contextmenu', handleClickOutside)
  window.removeEventListener('resize', adjustMenuPosition)
})

watch(
  () => [props.x, props.y] as const,
  () => {
    left.value = props.x
    top.value = props.y
    nextTick(adjustMenuPosition)
  },
  { immediate: true }
)

function handleClickOutside(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

function closeAfter(fn: () => void) {
  fn()
  emit('close')
}
</script>

<template>
  <div
    ref="menuRef"
    class="context-menu"
    :style="{ left: `${left}px`, top: `${top}px` }"
    @click.stop
    @contextmenu.stop.prevent
  >
    <button class="menu-item" @click="closeAfter(() => emit('refresh'))">
      <img :src="iconRefresh" class="menu-icon" alt="" />
      <span>{{ t('common.refresh') }}</span>
    </button>

    <div class="menu-divider"></div>

    <button class="menu-item" @click="closeAfter(() => emit('newFile'))">
      <img :src="iconGoogleDocs" class="menu-icon" alt="" />
      <span>{{ t('background.newFile') }}</span>
    </button>

    <button class="menu-item" @click="closeAfter(() => emit('newFolder'))">
      <img :src="iconOpenFolder" class="menu-icon" alt="" />
      <span>{{ t('background.newFolder') }}</span>
    </button>

    <div class="menu-divider"></div>

    <div class="menu-section-title">{{ t('background.sortBy') }}</div>
    <button
      class="menu-item"
      :class="{ active: props.sortMode === 'manual' }"
      @click="closeAfter(() => emit('setSortMode', 'manual'))"
    >
      <span class="menu-icon-text">↕️</span>
      <span>{{ t('background.sortManual') }}</span>
    </button>
    <button
      class="menu-item"
      :class="{ active: props.sortMode === 'nameAsc' }"
      @click="closeAfter(() => emit('setSortMode', 'nameAsc'))"
    >
      <span class="menu-icon-text">🔤</span>
      <span>{{ t('background.sortNameAsc') }}</span>
    </button>
    <button
      class="menu-item"
      :class="{ active: props.sortMode === 'nameDesc' }"
      @click="closeAfter(() => emit('setSortMode', 'nameDesc'))"
    >
      <span class="menu-icon-text">🔡</span>
      <span>{{ t('background.sortNameDesc') }}</span>
    </button>
    <button
      class="menu-item"
      :class="{ active: props.sortMode === 'typeAsc' }"
      @click="closeAfter(() => emit('setSortMode', 'typeAsc'))"
    >
      <img :src="iconTags" class="menu-icon" alt="" />
      <span>{{ t('background.sortType') }}</span>
    </button>

    <div class="menu-divider"></div>

    <button
      class="menu-item"
      :disabled="!props.canUndoDelete"
      @click="closeAfter(() => emit('undoDelete'))"
    >
      <span class="menu-icon-text">↩️</span>
      <span>{{ t('background.undoDelete') }}</span>
    </button>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 200px;
  max-width: 280px;
  
  /* 强毛玻璃背景 */
  background: rgba(var(--bg-base-rgb), 0.75);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  
  /* 物理边框与阴影 */
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: 
    var(--shadow-xl),
    inset 0 0 0 1px rgba(255,255,255,0.1); /* 内发光 */
    
  padding: 0.375rem;
  color: var(--text-primary);
  
  /* 入场动画 */
  transform-origin: top left;
  animation: menuScaleIn 0.15s var(--ease-out-quad);
}

@keyframes menuScaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 400;
  text-align: left;
  cursor: pointer;
  transition: all 0.1s;
  user-select: none;
}

.menu-item:hover {
  background: var(--primary-color);
  color: var(--text-on-primary);
  box-shadow: 0 2px 4px rgba(var(--primary-color-rgb), 0.25);
}

.menu-item.active {
  background: rgba(var(--primary-color-rgb), 0.15);
  color: var(--primary-color);
  font-weight: 500;
}

.menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: transparent !important;
  color: var(--text-secondary) !important;
  box-shadow: none !important;
}

.menu-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  opacity: 0.8;
}

.menu-icon-text {
  font-size: 1rem;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
}

.menu-item:hover .menu-icon,
.menu-item:hover .menu-icon-text {
  opacity: 1;
}

.menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 0.375rem 0.75rem;
  opacity: 0.5;
}

.menu-section-title {
  padding: 0.375rem 0.75rem 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
