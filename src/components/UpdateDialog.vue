<script setup lang="ts">
import { computed } from 'vue'
import { useUpdaterStore } from '../stores/updater'
import { useI18n } from '../i18n'

const updaterStore = useUpdaterStore()
const { t } = useI18n()

const progressText = computed(() => {
  if (updaterStore.downloading) {
    return t('update.downloading', { progress: updaterStore.downloadProgress })
  }
  return t('update.updateNow')
})

const handleUpdate = () => {
  updaterStore.downloadAndInstall()
}

const handleLater = () => {
  updaterStore.remindLater()
}

const handleClose = () => {
  updaterStore.closeUpdateDialog()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="updaterStore.showDialog"
        class="update-dialog-overlay"
        @click.self="handleClose"
      >
        <div class="update-dialog-container">
          <!-- 头部 -->
          <div class="dialog-header">
            <div class="header-content">
              <svg class="header-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
              <div class="header-text">
                <h3 class="dialog-title">{{ t('update.newVersionFound') }}</h3>
                <p class="version-info">{{ updaterStore.updateInfo?.version || 'Unknown' }}</p>
              </div>
            </div>
            <button class="close-btn" @click="handleClose" :disabled="updaterStore.downloading">×</button>
          </div>

          <!-- 更新内容 -->
          <div class="dialog-body">
            <div class="update-notes">
              <h4 class="notes-title">{{ t('update.notesTitle') }}</h4>
              <div class="notes-content">{{ updaterStore.updateInfo?.body || t('update.noNotes') }}</div>
            </div>
          </div>

          <!-- 错误信息 -->
          <div v-if="updaterStore.errorMessage" class="error-container">
            <div class="error-message">
              ⚠️ {{ updaterStore.errorMessage }}
            </div>
          </div>

          <!-- 下载进度条 -->
          <div v-if="updaterStore.downloading" class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${updaterStore.downloadProgress}%` }"></div>
            </div>
            <span class="progress-text">{{ updaterStore.downloadProgress }}%</span>
          </div>

          <!-- 底部按钮 -->
          <div class="dialog-footer">
            <button class="dialog-btn secondary-btn" @click="handleLater" :disabled="updaterStore.downloading">
              {{ t('update.remindLater') }}
            </button>
            <button class="dialog-btn primary-btn" @click="handleUpdate" :disabled="updaterStore.downloading">
              {{ progressText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.update-dialog-container {
  width: 100%;
  max-width: 480px;
  background: var(--bg-primary);
  backdrop-filter: blur(30px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05));
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  padding: 6px;
  background: rgba(59, 130, 246, 0.15);
  border-radius: var(--radius-md);
  color: var(--primary-color);
}

.dialog-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.version-info {
  margin: 0.125rem 0 0;
  font-size: 0.875rem;
  color: var(--primary-color);
  font-weight: 600;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.5rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.close-btn:hover:not(:disabled) {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.dialog-body {
  padding: 1.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.notes-title {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.notes-content {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.error-container {
  padding: 0 1.5rem 1rem;
}

.error-message {
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  color: #ef4444;
  font-size: 0.875rem;
  line-height: 1.5;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1.5rem 1rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: rgba(var(--primary-color-rgb), 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.813rem;
  font-weight: 600;
  color: var(--primary-color);
  min-width: 3rem;
  text-align: right;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
}

.dialog-btn {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-btn {
  background: rgba(var(--bg-base-rgb), 0.1);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.secondary-btn:hover:not(:disabled) {
  background: rgba(var(--bg-base-rgb), 0.2);
}

.primary-btn {
  background: var(--primary-color);
  color: white;
}

.primary-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}

.dialog-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.25s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
