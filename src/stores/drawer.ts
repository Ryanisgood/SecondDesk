import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export enum DrawerState {
  Hidden = 'hidden',
  Open = 'open'
}

export enum DrawerSide {
  Left = 'left',
  Right = 'right',
  Top = 'top',
  Bottom = 'bottom'
}

export type MouseButton = 'left' | 'right'

export interface DrawerConfig {
  edgeTrigger: {
    enabled: boolean
    side: DrawerSide
    delayMs: number
    peekSize: number
    triggerWidth: number
  }
  hotkey: {
    enabled: boolean
    keys: string
  }
  gesture: {
    enabled: boolean
    button: MouseButton
    threshold: number
  }
  animation: {
    duration: number
    easing: string
  }
  behavior: {
    hideOnMouseLeave: boolean
    hideOnFocusLost: boolean
    hideOnOpen: boolean
    disableInFullscreen: boolean
  }
  fileWatcher: {
    enabled: boolean
    customPath: string | null
    debounceMs: number
  }
}

export const useDrawerStore = defineStore('drawer', () => {
  const state = ref<DrawerState>(DrawerState.Hidden)
  const config = ref<DrawerConfig>({
    edgeTrigger: {
      enabled: true,
      side: DrawerSide.Right,
      delayMs: 300,
      peekSize: 100,
      triggerWidth: 2
    },
    hotkey: {
      enabled: true,
      keys: 'Alt+Space'
    },
    gesture: {
      enabled: false,
      button: 'right',
      threshold: 30
    },
    animation: {
      duration: 250,
      easing: 'ease-out'
    },
    behavior: {
      hideOnMouseLeave: false,
      hideOnFocusLost: true,
      hideOnOpen: true,
      disableInFullscreen: true
    },
    fileWatcher: {
      enabled: true,
      customPath: null,
      debounceMs: 500
    }
  })

  const isVisible = computed(() => state.value === DrawerState.Open)
  const isOpen = computed(() => state.value === DrawerState.Open)

  async function setState(newState: DrawerState) {
    state.value = newState
    try {
      await invoke('set_drawer_state', { state: newState, config: config.value })
    } catch (error) {
      console.error('Failed to set drawer state:', error)
    }
  }

  async function toggle() {
    if (state.value === DrawerState.Hidden) {
      await setState(DrawerState.Open)
    } else {
      await setState(DrawerState.Hidden)
    }
  }

  async function loadConfig() {
    try {
      const loaded = await invoke<DrawerConfig>('load_drawer_config')
      config.value = loaded
    } catch (error) {
      console.error('Failed to load drawer config:', error)
      // 使用默认配置
    }
  }

  async function saveConfig() {
    try {
      await invoke('save_drawer_config', { config: config.value })
    } catch (error) {
      console.error('Failed to save drawer config:', error)
      throw error
    }
  }

  return {
    state,
    config,
    isVisible,
    isOpen,
    setState,
    toggle,
    loadConfig,
    saveConfig
  }
})
