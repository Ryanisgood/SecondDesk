import { ref, onUnmounted } from 'vue'
import { BATCH_SELECT_CONFIG } from '../config/batchSelectConfig'

export interface LongPressOptions {
  delay?: number           // 长按延迟 ms
  moveThreshold?: number   // 移动阈值 px
  onLongPress: (id: string) => void
}

export function useLongPress(options: LongPressOptions) {
  const delay = options.delay ?? BATCH_SELECT_CONFIG.LONG_PRESS_DELAY_MS
  const moveThreshold = options.moveThreshold ?? BATCH_SELECT_CONFIG.MOVE_THRESHOLD_PX

  const isLongPressing = ref(false)
  let timer: number | null = null
  let startPos: { x: number; y: number } | null = null
  let currentId: string | null = null

  function handlePointerDown(id: string, event: PointerEvent) {
    // 只响应主按钮（左键）
    if (event.button !== 0) return

    currentId = id
    startPos = { x: event.clientX, y: event.clientY }
    isLongPressing.value = false

    timer = window.setTimeout(() => {
      if (currentId) {
        isLongPressing.value = true
        options.onLongPress(currentId)
      }
    }, delay)
  }

  function handlePointerMove(event: PointerEvent) {
    if (!startPos || !timer) return

    const dx = event.clientX - startPos.x
    const dy = event.clientY - startPos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // 移动超过阈值，取消长按
    if (distance > moveThreshold) {
      cancelLongPress()
    }
  }

  function handlePointerUp() {
    cancelLongPress()
  }

  function cancelLongPress() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    startPos = null
    currentId = null
  }

  // 重置长按状态（外部调用）
  function resetLongPressState() {
    isLongPressing.value = false
  }

  onUnmounted(() => {
    cancelLongPress()
  })

  return {
    isLongPressing,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    cancelLongPress,
    resetLongPressState,
  }
}
