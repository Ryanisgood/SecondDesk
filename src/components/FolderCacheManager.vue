<script setup lang="ts">
import { computed } from 'vue'
import { useFileStore, type FolderCacheInfo } from '../stores/files'
import { useDialog } from '../composables/useDialog'
import { getIconPath } from '../utils/iconHelper'

// 图标路径
const iconOpenFolder = getIconPath('open-folder')
const iconEmpty = getIconPath('empty')
const iconList = getIconPath('list')

const emit = defineEmits<{
  (e: 'close'): void
}>()

const fileStore = useFileStore()
const dialog = useDialog()

const cachedFolders = computed<FolderCacheInfo[]>(() => {
  return fileStore.getCachedFoldersList()
})

async function handleClearFolderCache(pathKey: string, displayName: string) {
  const confirmed = await dialog.confirmDanger(
    `确定要清除「${displayName}」的缓存数据吗？\n这将删除该文件夹的虚拟分组、排序设置等数据。`,
    { title: '清除缓存' }
  )
  if (confirmed) {
    fileStore.clearFolderCache(pathKey)
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="cache-manager-panel">
      <div class="panel-header">
        <h3 class="panel-title"><img :src="iconOpenFolder" class="title-icon" alt="" /> 文件夹缓存管理</h3>
        <button class="close-btn" @click="handleClose">✕</button>
      </div>

      <div class="panel-content">
        <p class="panel-description">
          管理各个监控文件夹的缓存数据，包括虚拟分组、图标排序、排序模式等。
        </p>

        <div v-if="cachedFolders.length === 0" class="empty-state">
          <img :src="iconEmpty" class="empty-icon" alt="" />
          <div class="empty-text">暂无缓存数据</div>
        </div>

        <div v-else class="folder-list">
          <div
            v-for="folder in cachedFolders"
            :key="folder.pathKey"
            class="folder-item"
          >
            <div class="folder-info">
              <div class="folder-path">{{ folder.displayName }}</div>
              <div class="folder-stats">
                <span v-if="folder.hasVirtualFolders" class="stat-tag">
                  <img :src="iconOpenFolder" class="stat-icon" alt="" /> {{ folder.virtualFolderCount }} 个虚拟分组
                </span>
                <span v-if="folder.hasFavorites" class="stat-tag">
                  ⭐ {{ folder.favoritesCount }} 个收藏
                </span>
                <span v-if="folder.hasIconOrder" class="stat-tag">
                  <img :src="iconList" class="stat-icon" alt="" /> 图标排序
                </span>
                <span v-if="folder.hasSortMode" class="stat-tag">
                  🔤 排序模式
                </span>
              </div>
            </div>
            <button
              class="clear-btn"
              @click="handleClearFolderCache(folder.pathKey, folder.displayName)"
              title="清除此文件夹的缓存"
            >
              清除
            </button>
          </div>
        </div>
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
  z-index: 2100;
  padding: 1.5rem;
  animation: fadeIn 0.2s var(--ease-out-quad);
}

.cache-manager-panel {
  width: 100%;
  max-width: 480px;
  max-height: 70vh;

  background: var(--bg-primary);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);

  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);

  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUpFade 0.3s var(--ease-out-quad);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  background: rgba(var(--bg-base-rgb), 0.2);
}

.panel-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(var(--bg-base-rgb), 0.1);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.813rem;
}

.close-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
  transform: rotate(90deg);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}

.panel-description {
  margin: 0 0 1rem;
  font-size: 0.813rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-tertiary);
}

.empty-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
  margin-bottom: 0.5rem;
}

.title-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  vertical-align: middle;
}

.stat-icon {
  width: 12px;
  height: 12px;
  object-fit: contain;
  vertical-align: middle;
}

.empty-text {
  font-size: 0.875rem;
}

.folder-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.folder-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-radius: var(--radius-lg);
  background: rgba(var(--bg-base-rgb), 0.03);
  border: 1px solid var(--border-color);
  transition: background 0.2s;
}

.folder-item:hover {
  background: rgba(var(--bg-base-rgb), 0.06);
  border-color: rgba(var(--text-primary), 0.1);
}

.folder-info {
  flex: 1;
  min-width: 0;
  padding-right: 0.75rem;
}

.folder-path {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.375rem;
}

.folder-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.stat-tag {
  font-size: 0.688rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  background: rgba(var(--primary-rgb), 0.1);
  color: var(--primary);
}

.folder-item .clear-btn {
  width: auto;
  height: auto;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-md);
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  font-size: 0.75rem;
  font-weight: 500;
  transform: none;
}

.folder-item .clear-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  transform: none;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUpFade {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
