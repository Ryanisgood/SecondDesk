import { reactive } from 'vue'
import { t } from '../i18n'

export type DialogType = 'confirm' | 'alert' | 'info' | 'error' | 'success'

export interface DialogOptions {
  type?: DialogType
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  dangerous?: boolean
}

interface DialogState {
  visible: boolean
  type: DialogType
  title: string
  message: string
  confirmText: string
  cancelText: string
  showCancel: boolean
  dangerous: boolean
  resolve: ((value: boolean) => void) | null
}

const dialogState = reactive<DialogState>({
  visible: false,
  type: 'confirm',
  title: '',
  message: '',
  confirmText: t('common.confirm'),
  cancelText: t('common.cancel'),
  showCancel: true,
  dangerous: false,
  resolve: null
})

// 显示对话框
function showDialog(options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    dialogState.visible = true
    dialogState.type = options.type ?? 'confirm'
    dialogState.title = options.title ?? getDefaultTitle(options.type ?? 'confirm')
    dialogState.message = options.message
    dialogState.confirmText = options.confirmText ?? t('common.confirm')
    dialogState.cancelText = options.cancelText ?? t('common.cancel')
    dialogState.showCancel = options.showCancel ?? (options.type === 'confirm')
    dialogState.dangerous = options.dangerous ?? false
    dialogState.resolve = resolve
  })
}

function getDefaultTitle(type: DialogType): string {
  switch (type) {
    case 'confirm': return t('dialog.default.confirm')
    case 'alert': return t('dialog.default.alert')
    case 'info': return t('dialog.default.info')
    case 'error': return t('dialog.default.error')
    case 'success': return t('dialog.default.success')
    default: return t('dialog.default.alert')
  }
}

// 关闭对话框
function closeDialog(result: boolean) {
  dialogState.visible = false
  if (dialogState.resolve) {
    dialogState.resolve(result)
    dialogState.resolve = null
  }
}

// 便捷方法
export function useDialog() {
  return {
    state: dialogState,
    closeDialog,

    // 确认对话框
    confirm: (message: string, options?: Partial<Omit<DialogOptions, 'message' | 'type'>>) =>
      showDialog({ ...options, message, type: 'confirm', showCancel: true }),

    // 危险确认对话框（红色按钮）
    confirmDanger: (message: string, options?: Partial<Omit<DialogOptions, 'message' | 'type'>>) =>
      showDialog({ ...options, message, type: 'confirm', showCancel: true, dangerous: true }),

    // 提示对话框（只有确定按钮）
    alert: (message: string, options?: Partial<Omit<DialogOptions, 'message' | 'type'>>) =>
      showDialog({ ...options, message, type: 'alert', showCancel: false }),

    // 信息对话框
    info: (message: string, options?: Partial<Omit<DialogOptions, 'message' | 'type'>>) =>
      showDialog({ ...options, message, type: 'info', showCancel: false }),

    // 错误对话框
    error: (message: string, options?: Partial<Omit<DialogOptions, 'message' | 'type'>>) =>
      showDialog({ ...options, message, type: 'error', showCancel: false, title: options?.title ?? t('dialog.default.error') }),

    // 成功对话框
    success: (message: string, options?: Partial<Omit<DialogOptions, 'message' | 'type'>>) =>
      showDialog({ ...options, message, type: 'success', showCancel: false, title: options?.title ?? t('dialog.default.success') }),
  }
}
