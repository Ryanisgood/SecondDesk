<script setup lang="ts">
import { computed } from 'vue'
import { useDialog, type DialogType } from '../composables/useDialog'
import { getIconPath } from '../utils/iconHelper'

const { state, closeDialog } = useDialog()

// 图标路径映射
const iconPathMap: Record<DialogType, string> = {
  confirm: getIconPath('faq'),
  alert: getIconPath('message'),
  info: getIconPath('info'),
  error: getIconPath('close'),
  success: getIconPath('check')
}

const iconPath = computed(() => iconPathMap[state.type])

function handleConfirm() {
  closeDialog(true)
}

function handleCancel() {
  closeDialog(false)
}

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    handleCancel()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="state.visible" class="dialog-overlay" @click="handleOverlayClick">
        <Transition name="dialog-scale" appear>
          <div class="dialog-container">
            <div class="dialog-header">
              <img :src="iconPath" class="dialog-icon" alt="" />
              <h3 class="dialog-title">{{ state.title }}</h3>
            </div>

            <div class="dialog-body">
              <p class="dialog-message">{{ state.message }}</p>
            </div>

            <div class="dialog-footer">
              <button
                v-if="state.showCancel"
                class="dialog-btn cancel-btn"
                @click="handleCancel"
              >
                {{ state.cancelText }}
              </button>
              <button
                :class="['dialog-btn', 'confirm-btn', { danger: state.dangerous }]"
                @click="handleConfirm"
              >
                {{ state.confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.dialog-container {
  width: 100%;
  max-width: 380px;
  background: var(--bg-primary);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  background: rgba(var(--bg-base-rgb), 0.2);
}

.dialog-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.dialog-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.dialog-body {
  padding: 1.25rem;
}

.dialog-message {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid var(--border-color);
  background: rgba(var(--bg-base-rgb), 0.1);
}

.dialog-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.813rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: rgba(var(--bg-base-rgb), 0.1);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.cancel-btn:hover {
  background: rgba(var(--bg-base-rgb), 0.2);
  color: var(--text-primary);
}

.confirm-btn {
  background: var(--primary);
  color: white;
}

.confirm-btn:hover {
  filter: brightness(1.1);
}

.confirm-btn.danger {
  background: #ef4444;
}

.confirm-btn.danger:hover {
  background: #dc2626;
}

/* Transitions */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-scale-leave-active {
  transition: all 0.15s ease-in;
}

.dialog-scale-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
