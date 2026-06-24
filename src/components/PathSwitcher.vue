<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useWatchPathsStore } from '../stores/watchPaths'
import { useI18n } from '../i18n'

const emit = defineEmits<{
  (e: 'path-changed', pathId: string): void
  (e: 'open-settings'): void
}>()

const watchPathsStore = useWatchPathsStore()
const { t } = useI18n()
const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

function toggle() {
  isOpen.value = !isOpen.value
}

function selectView(pathId: string) {
  isOpen.value = false
  emit('path-changed', pathId)
}

function openSettings() {
  isOpen.value = false
  emit('open-settings')
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div class="path-switcher" ref="dropdownRef">
    <button class="switcher-btn no-drag" @click="toggle" :title="watchPathsStore.activeViewLabel">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="switcher-label">{{ watchPathsStore.activeViewLabel }}</span>
      <svg class="chevron" :class="{ open: isOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-menu">
        <!-- 所有路径条目（桌面 + 自定义，统一列表） -->
        <button
          v-for="wp in watchPathsStore.watchPaths"
          :key="wp.id"
          class="dropdown-item"
          :class="{ active: watchPathsStore.activeViewId === wp.id, disabled: !wp.enabled }"
          @click="wp.enabled && selectView(wp.id)"
          :title="wp.path"
        >
          <span class="item-icon">{{ wp.builtin ? '🖥️' : '📁' }}</span>
          <span class="item-label">{{ watchPathsStore.getEntryLabel(wp) }}</span>
          <svg v-if="watchPathsStore.activeViewId === wp.id" class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>

        <!-- 分隔线 + 所有文件夹（启用路径 > 1 时显示） -->
        <template v-if="watchPathsStore.enabledPaths.length > 1">
          <div class="dropdown-divider"></div>
          <button
            class="dropdown-item"
            :class="{ active: watchPathsStore.isAllView }"
            @click="selectView(watchPathsStore.ALL_VIEW_ID)"
          >
            <span class="item-icon">🌐</span>
            <span class="item-label">{{ t('path.allFolders') }}</span>
            <svg v-if="watchPathsStore.isAllView" class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </template>

        <!-- 分隔线 -->
        <div class="dropdown-divider"></div>

        <!-- 管理路径 -->
        <button class="dropdown-item manage-item" @click="openSettings">
          <span class="item-icon">⚙️</span>
          <span class="item-label">{{ t('path.managePaths') }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.path-switcher {
  position: relative;
}

.switcher-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8125rem;
  transition: all 0.2s var(--ease-out-quad);
  max-width: 180px;
}

.switcher-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.switcher-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.chevron.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 200px;
  max-width: 280px;
  background: var(--bg-primary);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 0.375rem;
  z-index: 1000;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.8125rem;
  transition: background 0.15s;
  text-align: left;
}

.dropdown-item:hover {
  background: var(--hover-bg);
}

.dropdown-item.active {
  color: var(--primary-color);
}

.dropdown-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.item-icon {
  flex-shrink: 0;
  font-size: 0.875rem;
}

.item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check-icon {
  flex-shrink: 0;
  color: var(--primary-color);
}

.dropdown-divider {
  height: 1px;
  margin: 0.25rem 0.5rem;
  background: var(--border-color);
}

.manage-item {
  color: var(--text-secondary);
}

/* 动画 */
.dropdown-enter-active {
  transition: all 0.15s ease-out;
}
.dropdown-leave-active {
  transition: all 0.1s ease-in;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
