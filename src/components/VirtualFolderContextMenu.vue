<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import type { VirtualFolder } from '../stores/files'
import { computeMenuPosition } from '../utils/menuPosition'
import { getIconPath } from '../utils/iconHelper'
import { useI18n } from '../i18n'

// 图标路径
const iconOpenFolder = getIconPath('open-folder')
const iconPencil = getIconPath('pencil')
const iconDelete = getIconPath('delete')

interface Props {
  folder: VirtualFolder | null
  x: number
  y: number
}

const props = defineProps<Props>()
const { t } = useI18n()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open', folder: VirtualFolder): void
  (e: 'rename', folder: VirtualFolder): void
  (e: 'delete', folder: VirtualFolder): void
  (e: 'toggle-favorite', folder: VirtualFolder): void
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
  // 延迟添加监听器，避免立即触发
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
  () => [props.folder, props.x, props.y] as const,
  () => {
    if (!props.folder) return
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

function handleMenuClick(action: string) {
  if (!props.folder) return

  switch (action) {
    case 'open':
      emit('open', props.folder)
      break
    case 'rename':
      emit('rename', props.folder)
      break
    case 'delete':
      emit('delete', props.folder)
      break
    case 'toggle-favorite':
      emit('toggle-favorite', props.folder)
      break
  }

  emit('close')
}
</script>

<template>
  <div
    v-if="folder"
    ref="menuRef"
    class="context-menu"
    :style="{ left: `${left}px`, top: `${top}px` }"
    @click.stop
    @contextmenu.stop.prevent
  >
    <button class="menu-item" @click="handleMenuClick('open')">
      <img :src="iconOpenFolder" class="menu-icon" alt="" />
      <span>{{ t('virtualFolder.open') }}</span>
    </button>

    <div class="menu-divider"></div>

    <button class="menu-item" @click="handleMenuClick('toggle-favorite')">
      <span class="menu-icon-text">{{ folder.isFavorite ? '⭐' : '☆' }}</span>
      <span>{{ folder.isFavorite ? t('context.removeFavorite') : t('context.addFavorite') }}</span>
    </button>

    <div class="menu-divider"></div>

    <button class="menu-item" @click="handleMenuClick('rename')">
      <img :src="iconPencil" class="menu-icon" alt="" />
      <span>{{ t('common.rename') }}</span>
    </button>

    <button class="menu-item danger" @click="handleMenuClick('delete')">
      <img :src="iconDelete" class="menu-icon" alt="" />
      <span>{{ t('virtualFolder.delete') }}</span>
    </button>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 220px;
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

/* 危险操作 Hover */
.menu-item.danger:hover {
  background: var(--danger-color);
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.25);
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
  margin: 0.375rem 0.75rem; /* 左右留白 */
  opacity: 0.5;
}
</style>
