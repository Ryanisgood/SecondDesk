<script setup lang="ts">
import { useUpdaterStore } from '../stores/updater'

const updaterStore = useUpdaterStore()

const handleClick = () => {
  updaterStore.showUpdateDialog()
}
</script>

<template>
  <Transition name="fade">
    <button
      v-if="updaterStore.showNotification"
      class="update-notification no-drag"
      @click="handleClick"
      title="有可用更新"
    >
      <svg class="update-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
      <span class="update-badge">新版本</span>
    </button>
  </Transition>
</template>

<style scoped>
.update-notification {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: linear-gradient(135deg,
    rgba(59, 130, 246, 0.15),
    rgba(37, 99, 235, 0.15)
  );
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: var(--radius-md);
  color: var(--primary-color);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  animation: pulse 2s ease-in-out infinite;
}

.update-notification:hover {
  background: linear-gradient(135deg,
    rgba(59, 130, 246, 0.25),
    rgba(37, 99, 235, 0.25)
  );
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-1px);
}

.update-icon {
  width: 16px;
  height: 16px;
}

.update-badge {
  white-space: nowrap;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
