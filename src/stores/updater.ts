import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { t } from '../i18n'

export interface UpdateInfo {
  version: string
  date?: string
  body: string
}

export const useUpdaterStore = defineStore('updater', () => {
  const updateAvailable = ref(false)
  const updateInfo = ref<UpdateInfo | null>(null)
  const downloading = ref(false)
  const downloadProgress = ref(0)
  const showNotification = ref(false)
  const showDialog = ref(false)
  const checkingUpdate = ref(false)
  const errorMessage = ref<string | null>(null)

  // 缓存 update 对象，避免重复请求
  let cachedUpdate: Awaited<ReturnType<typeof check>> = null

  const hasNewVersion = computed(() => updateAvailable.value && updateInfo.value !== null)

  async function checkForUpdates(silent = true): Promise<boolean> {
    if (checkingUpdate.value) return false

    checkingUpdate.value = true
    errorMessage.value = null
    try {
      const update = await check()
      console.log('[更新检查] 检测结果:', update ? `发现新版本 ${update.version}` : '已是最新版本')

      if (update) {
        cachedUpdate = update
        updateAvailable.value = true
        updateInfo.value = {
          version: update.version,
          date: update.date,
          body: update.body || t('updater.noNotes'),
        }

        // 显示通知（非静默模式或满足提醒条件）
        const shouldRemind = shouldShowReminder()
        console.log('[更新检查] silent =', silent, ', shouldRemind =', shouldRemind)
        if (!silent) {
          showNotification.value = true
          console.log('[更新检查] 设置显示通知 (非静默模式)')
        } else if (shouldRemind) {
          showNotification.value = true
          console.log('[更新检查] 设置显示通知 (满足提醒条件)')
        } else {
          console.log('[更新检查] 不显示通知 (提醒时间未到)')
        }
        return true
      }
      return false
    } catch (error) {
      console.error('检查更新失败:', error)
      return false
    } finally {
      checkingUpdate.value = false
    }
  }

  async function downloadAndInstall() {
    if (!updateInfo.value || downloading.value) return

    downloading.value = true
    downloadProgress.value = 0
    errorMessage.value = null

    try {
      // 使用缓存的 update 对象，如果没有则重新获取
      const update = cachedUpdate || await check()
      if (!update) throw new Error(t('updater.noUpdate'))

      let totalSize = 0
      let downloadedSize = 0

      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalSize = event.data.contentLength || 0
          downloadProgress.value = 0
        } else if (event.event === 'Progress') {
          downloadedSize += event.data.chunkLength || 0
          if (totalSize > 0) {
            // 使用真实进度
            downloadProgress.value = Math.min(99, Math.round((downloadedSize / totalSize) * 100))
          } else {
            // 无法获取总大小时使用启发式方法
            downloadProgress.value = Math.min(95, downloadProgress.value + 1)
          }
        } else if (event.event === 'Finished') {
          downloadProgress.value = 100
        }
      })

      await relaunch()
    } catch (error) {
      console.error('更新失败:', error)
      errorMessage.value = error instanceof Error ? error.message : t('updater.installFailed')
      downloading.value = false
      downloadProgress.value = 0
    }
  }

  function showUpdateDialog() {
    console.log('[更新] 打开对话框')
    showDialog.value = true
    // 注释掉：打开对话框时不应该隐藏通知按钮
    // showNotification.value = false
  }

  function closeUpdateDialog() {
    console.log('[更新] 关闭对话框, showNotification 保持为:', showNotification.value)
    showDialog.value = false
    errorMessage.value = null
  }

  function remindLater() {
    showNotification.value = false
    showDialog.value = false
    const remindTime = Date.now() + 24 * 60 * 60 * 1000
    localStorage.setItem('seconddesk_update_remind_time', remindTime.toString())
  }

  function shouldShowReminder(): boolean {
    const remindTimeStr = localStorage.getItem('seconddesk_update_remind_time')
    if (!remindTimeStr) return true
    return Date.now() >= parseInt(remindTimeStr, 10)
  }

  function clearError() {
    errorMessage.value = null
  }

  return {
    updateAvailable,
    updateInfo,
    downloading,
    downloadProgress,
    showNotification,
    showDialog,
    checkingUpdate,
    errorMessage,
    hasNewVersion,
    checkForUpdates,
    downloadAndInstall,
    showUpdateDialog,
    closeUpdateDialog,
    remindLater,
    shouldShowReminder,
    clearError,
  }
})
