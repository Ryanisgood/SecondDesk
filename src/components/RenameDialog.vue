<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { FileItem } from '../stores/files'
import { useI18n } from '../i18n'

interface Props {
  file: FileItem | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', newName: string): void
}>()

const newName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const errorMessage = ref('')
const { t } = useI18n()

watch(() => props.file, (file) => {
  if (file) {
    newName.value = file.fileName
    errorMessage.value = ''
    nextTick(() => {
      if (inputRef.value) {
        // 选中文件名（不包括扩展名）
        const lastDotIndex = file.fileName.lastIndexOf('.')
        if (lastDotIndex > 0) {
          inputRef.value.setSelectionRange(0, lastDotIndex)
        } else {
          inputRef.value.select()
        }
        inputRef.value.focus()
      }
    })
  }
}, { immediate: true })

function handleConfirm() {
  const trimmedName = newName.value.trim()

  if (!trimmedName) {
    errorMessage.value = t('rename.fileNameRequired')
    return
  }

  if (trimmedName === props.file?.fileName) {
    emit('close')
    return
  }

  // 检查文件名是否包含非法字符
  const invalidChars = /[<>:"/\\|?*]/
  if (invalidChars.test(trimmedName)) {
    errorMessage.value = t('rename.invalidChars')
    return
  }

  emit('confirm', trimmedName)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    handleConfirm()
  } else if (event.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <div v-if="file" class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3 class="modal-title">{{ t('rename.title') }}</h3>

      <div class="form-row">
        <label class="label">{{ t('rename.newFileName') }}</label>
        <input
          ref="inputRef"
          v-model="newName"
          class="input"
          type="text"
          @keydown="handleKeydown"
        />
      </div>

      <div v-if="errorMessage" class="error">{{ errorMessage }}</div>

      <div class="modal-actions">
        <button class="btn" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button class="btn primary" @click="handleConfirm">{{ t('common.confirm') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-overlay-bg);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
  animation: fadeIn 0.2s var(--ease-out-quad);
}

.modal {
  width: 100%;
  max-width: 400px;
  
  background: var(--bg-primary);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  animation: slideUpFade 0.3s var(--ease-out-quad);
}

.modal-title {
  margin: 0 0 1rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-left: 0.25rem;
}

.input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: rgba(var(--bg-base-rgb), 0.3);
  color: var(--text-primary);
  outline: none;
  font-size: 0.95rem;
  transition: all 0.2s;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.03);
}

.input:focus {
  background: var(--bg-primary);
  border-color: var(--primary-color);
  box-shadow: var(--focus-glow);
}

.error {
  color: var(--danger-color);
  font-size: 0.813rem;
  margin: 0.25rem 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.btn:hover {
  background: var(--hover-bg);
  border-color: var(--text-tertiary);
}

.btn.primary {
  background: var(--primary-color);
  border-color: transparent;
  color: var(--text-on-primary);
  box-shadow: 0 2px 4px rgba(var(--primary-color-rgb), 0.2);
}

.btn.primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(var(--primary-color-rgb), 0.3);
}

.btn.primary:active {
  transform: translateY(0);
}
</style>
