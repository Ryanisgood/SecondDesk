<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import appLogoUrl from '../assets/app-logo.png'
import { useI18n } from '../i18n'

const appWindow = getCurrentWindow()
const isMaximized = ref(false)
const { t } = useI18n()

onMounted(async () => {
  // 检查初始最大化状态
  isMaximized.value = await appWindow.isMaximized()

  // 监听最大化状态变化
  appWindow.onResized(async () => {
    isMaximized.value = await appWindow.isMaximized()
  })
})

async function minimizeWindow() {
  await appWindow.minimize()
}

async function toggleMaximize() {
  await appWindow.toggleMaximize()
}

async function closeWindow() {
  await appWindow.close()
}
</script>

<template>
  <div class="titlebar" data-tauri-drag-region>
    <div class="titlebar-title" data-tauri-drag-region>
      <img :src="appLogoUrl" class="app-icon" alt="" />
      <span class="app-name">Second Desk</span>
    </div>

    <div class="titlebar-controls">
      <button class="titlebar-btn minimize" @click="minimizeWindow" :title="t('titlebar.minimize')">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M0 6h12" stroke="currentColor" stroke-width="1" />
        </svg>
      </button>

      <button class="titlebar-btn maximize" @click="toggleMaximize" :title="isMaximized ? t('titlebar.restore') : t('titlebar.maximize')">
        <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1" />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="0" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1" />
          <rect x="0" y="2" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1" />
        </svg>
      </button>

      <button class="titlebar-btn close" @click="closeWindow" :title="t('titlebar.close')">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M0 0l12 12M12 0L0 12" stroke="currentColor" stroke-width="1" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  background: var(--bg-secondary);
  backdrop-filter: blur(calc(var(--blur-amount) / 2));
  border-bottom: 1px solid var(--border-color);
  user-select: none;
  flex-shrink: 0;
}

.titlebar-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 1rem;
  flex: 1;
  cursor: default;
}

.app-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.app-name {
  font-size: 0.813rem;
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: 0.01em;
}

.titlebar-controls {
  display: flex;
  height: 100%;
}

.titlebar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.titlebar-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.titlebar-btn.close:hover {
  background: var(--danger-color);
  color: white;
}

.titlebar-btn svg {
  opacity: 0.75;
  transition: opacity 0.2s;
}

.titlebar-btn:hover svg {
  opacity: 1;
}
</style>
