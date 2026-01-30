# SecondDesk 项目开发规范

> 版本: 1.0.0 | 更新日期: 2025-12-30

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [目录结构规范](#3-目录结构规范)
4. [命名约定](#4-命名约定)
5. [前端开发规范](#5-前端开发规范)
6. [后端开发规范](#6-后端开发规范)
7. [样式规范](#7-样式规范)
8. [状态管理规范](#8-状态管理规范)
9. [类型定义规范](#9-类型定义规范)
10. [Git 提交规范](#10-git-提交规范)
11. [性能优化实践](#11-性能优化实践)
12. [安全规范](#12-安全规范)

---

## 1. 项目概述

### 1.1 项目定位

SecondDesk 是一个基于 **Tauri 2.0 + Vue 3 + Rust** 的跨平台桌面文件管理工具，采用抽屉式交互范式，支持边缘触发、全局快捷键、虚拟分组等特性。

### 1.2 核心特性

| 特性 | 描述 |
|------|------|
| 抽屉式 UI | 边缘触发快速唤出，不占用屏幕空间 |
| 虚拟分组 | 逻辑组织文件，无需实际移动 |
| 实时监控 | 文件系统变化自动更新 |
| 智能拖拽 | 根据悬停时间自动判断操作意图 |
| 主题系统 | 玻璃态效果、深浅模式、多色彩主题 |

### 1.3 目标平台

- **主要**: Windows 11/10
- **次要**: macOS, Linux (部分功能受限)

---

## 2. 技术栈

### 2.1 前端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.5.x | UI 框架 (Composition API) |
| TypeScript | 5.7.x | 类型安全 |
| Vite | 6.x | 构建工具 |
| Pinia | 2.3.x | 状态管理 |
| @tauri-apps/api | 2.3.x | Tauri 前端 API |
| @vueuse/core | 11.x | 组合式工具库 |

### 2.2 后端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| Rust | 1.75+ | 后端语言 |
| Tauri | 2.3.x | 桌面框架 |
| Tokio | 1.x | 异步运行时 |
| Rayon | 1.10 | 数据并行 |
| DashMap | 6.0 | 并发哈希表 |
| Notify | 7.x | 文件监控 |

### 2.3 开发工具

| 工具 | 用途 |
|------|------|
| pnpm / bun | 包管理器 |
| VS Code | 推荐编辑器 |
| rust-analyzer | Rust LSP |
| Volar | Vue LSP |

---

## 3. 目录结构规范

```
SecondDesk/
├── src/                          # 前端源代码
│   ├── components/               # Vue 组件
│   │   ├── App.vue              # 根组件
│   │   ├── FileGrid.vue         # 文件网格视图
│   │   ├── SettingsPanel.vue    # 设置面板
│   │   └── ...
│   ├── stores/                   # Pinia 状态管理
│   │   ├── files.ts             # 文件/虚拟分组状态
│   │   └── drawer.ts            # 窗口/抽屉状态
│   ├── composables/              # 组合式函数
│   │   ├── useDialog.ts         # 对话框
│   │   └── useDragDrop.ts       # 拖拽系统
│   ├── types/                    # TypeScript 类型定义
│   │   └── drag.ts              # 拖拽相关类型
│   ├── utils/                    # 工具函数
│   │   ├── iconMapper.ts        # 图标映射
│   │   └── theme.ts             # 主题工具
│   ├── config/                   # 配置文件
│   │   ├── themes.ts            # 主题预设
│   │   └── dragConfig.ts        # 拖拽配置
│   ├── styles/                   # 全局样式
│   │   └── index.css            # CSS 变量定义
│   ├── assets/                   # 静态资源
│   └── main.ts                   # 应用入口
│
├── src-tauri/                    # Rust 后端代码
│   ├── src/
│   │   ├── main.rs              # 应用入口
│   │   ├── lib.rs               # 库入口
│   │   ├── commands/            # Tauri 命令 (IPC)
│   │   │   ├── mod.rs
│   │   │   ├── file_ops.rs      # 文件操作
│   │   │   └── window_control.rs # 窗口控制
│   │   ├── core/                # 核心逻辑
│   │   │   ├── mod.rs
│   │   │   ├── file_scanner.rs  # 文件扫描
│   │   │   ├── file_watcher.rs  # 文件监控
│   │   │   ├── edge_detector.rs # 边缘检测
│   │   │   ├── hotkey.rs        # 快捷键
│   │   │   ├── tray.rs          # 系统托盘
│   │   │   └── types.rs         # 类型定义
│   │   ├── utils/               # 工具函数
│   │   │   ├── mod.rs
│   │   │   ├── icon_extractor.rs # 图标提取
│   │   │   └── known_folders.rs  # 系统路径
│   │   └── config/              # 配置管理
│   │       ├── mod.rs
│   │       └── drawer_config.rs
│   ├── Cargo.toml               # Rust 依赖
│   ├── tauri.conf.json          # Tauri 配置
│   └── icons/                   # 应用图标
│
├── public/                       # 静态资源
│   └── file_icos/               # 文件类型图标
│
├── package.json                  # 前端配置
├── tsconfig.json                 # TypeScript 配置
├── vite.config.ts                # Vite 配置
└── index.html                    # HTML 入口
```

### 3.1 目录职责说明

| 目录 | 职责 | 注意事项 |
|------|------|----------|
| `src/components/` | UI 组件 | 单一职责，避免超过 500 行 |
| `src/stores/` | 全局状态 | 按功能领域分离 |
| `src/composables/` | 可复用逻辑 | 必须以 `use` 开头 |
| `src/types/` | 类型定义 | 只放共享类型 |
| `src/utils/` | 纯函数工具 | 无副作用 |
| `src/config/` | 静态配置 | 只读常量 |
| `src-tauri/commands/` | IPC 接口 | 一个命令一个函数 |
| `src-tauri/core/` | 核心业务 | 系统集成逻辑 |
| `src-tauri/utils/` | 底层工具 | 平台相关代码 |

---

## 4. 命名约定

### 4.1 文件命名

| 类型 | 规则 | 示例 |
|------|------|------|
| Vue 组件 | PascalCase | `FileGrid.vue`, `SettingsPanel.vue` |
| TypeScript 文件 | camelCase | `iconMapper.ts`, `useDialog.ts` |
| Rust 文件 | snake_case | `file_ops.rs`, `edge_detector.rs` |
| 样式文件 | kebab-case | `index.css` |
| 配置文件 | kebab-case | `tauri.conf.json` |

### 4.2 代码命名

#### TypeScript / Vue

```typescript
// 组件名 - PascalCase
export default defineComponent({ name: 'FileGrid' })

// 组合式函数 - use 前缀 + camelCase
export function useDialog() { }
export function useDragDrop() { }

// Store - use 前缀 + 名词 + Store
export const useFileStore = defineStore('files', () => { })
export const useDrawerStore = defineStore('drawer', () => { })

// 接口/类型 - PascalCase
interface FileItem { }
type DisplayItem = { }

// 常量 - SCREAMING_SNAKE_CASE
const MAX_BATCH_SIZE = 10
const DEFAULT_DEBOUNCE_MS = 500

// 变量/函数 - camelCase
const currentPath = ref<string | null>(null)
function loadFiles(path: string) { }

// 私有变量 - _ 前缀
const _internalCache = new Map()

// 事件处理器 - handle/on 前缀
function handleClick() { }
function onFileChange() { }

// 布尔变量 - is/has/can/should 前缀
const isLoading = ref(false)
const hasError = ref(false)
const canEdit = computed(() => { })
```

#### Rust

```rust
// 模块 - snake_case
mod file_scanner;
mod edge_detector;

// 结构体 - PascalCase
pub struct FileItem { }
pub struct DrawerConfig { }

// 枚举 - PascalCase，变体也是 PascalCase
pub enum DrawerState {
    Hidden,
    Open,
}

// 函数 - snake_case
pub fn get_file_info() { }
pub async fn extract_file_icons() { }

// 常量 - SCREAMING_SNAKE_CASE
const MAX_RETRY_COUNT: u32 = 3;
const DEFAULT_TIMEOUT_MS: u64 = 5000;

// Tauri 命令 - snake_case
#[tauri::command]
async fn get_file_info() -> Result<Vec<FileItem>, String> { }
```

### 4.3 CSS 命名 (BEM 变体)

```css
/* 块 */
.file-grid { }
.settings-panel { }

/* 元素 */
.file-grid__item { }
.file-grid__icon { }

/* 修饰符 */
.file-grid--list-view { }
.file-grid__item--selected { }

/* 状态类 */
.is-active { }
.is-loading { }
.is-disabled { }

/* 工具类 */
.text-center { }
.mt-4 { }
```

---

## 5. 前端开发规范

### 5.1 Vue 组件规范

#### 组件结构顺序

```vue
<script setup lang="ts">
// 1. 类型导入
import type { FileItem, DisplayItem } from '@/types'

// 2. 依赖导入
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useFileStore } from '@/stores/files'

// 3. 子组件导入
import FileIcon from './FileIcon.vue'

// 4. Props 定义
const props = defineProps<{
  items: DisplayItem[]
  viewMode: 'grid' | 'list'
}>()

// 5. Emits 定义
const emit = defineEmits<{
  select: [item: DisplayItem]
  contextmenu: [event: MouseEvent, item: DisplayItem]
}>()

// 6. Store 使用
const fileStore = useFileStore()
const { currentPath, isLoading } = storeToRefs(fileStore)

// 7. 响应式状态
const selectedIndex = ref(-1)
const isHovering = ref(false)

// 8. 计算属性
const displayCount = computed(() => props.items.length)

// 9. 方法定义
function handleItemClick(item: DisplayItem) {
  emit('select', item)
}

// 10. 监听器
watch(() => props.items, (newItems) => {
  selectedIndex.value = -1
})

// 11. 生命周期
onMounted(() => {
  // 初始化逻辑
})

onUnmounted(() => {
  // 清理逻辑
})
</script>

<template>
  <div class="file-grid" :class="{ 'file-grid--list': viewMode === 'list' }">
    <div
      v-for="(item, index) in items"
      :key="item.type === 'file' ? item.data.filePath : item.data.id"
      class="file-grid__item"
      :class="{ 'is-selected': index === selectedIndex }"
      @click="handleItemClick(item)"
    >
      <FileIcon :item="item" />
    </div>
  </div>
</template>

<style scoped>
.file-grid {
  display: grid;
  gap: var(--spacing-md);
}

.file-grid--list {
  display: flex;
  flex-direction: column;
}

.file-grid__item {
  /* ... */
}

.file-grid__item.is-selected {
  /* ... */
}
</style>
```

#### 组件设计原则

1. **单一职责**: 每个组件只做一件事
2. **Props 向下**: 数据通过 props 传递给子组件
3. **Events 向上**: 子组件通过 emit 通知父组件
4. **避免过深嵌套**: 组件层级不超过 4 层
5. **合理拆分**: 超过 300 行考虑拆分

#### 禁止事项

```typescript
// ❌ 禁止直接修改 props
props.items.push(newItem)

// ❌ 禁止在模板中使用复杂表达式
<div v-if="items.filter(i => i.type === 'file').length > 0">

// ❌ 禁止在 setup 外使用 Composition API
function badExample() {
  const state = ref(0) // 错误：不在 setup 上下文中
}

// ❌ 禁止使用 Options API
export default {
  data() { return {} },  // 不要使用
  methods: {}            // 不要使用
}
```

### 5.2 Composables 规范

```typescript
// composables/useDialog.ts
import { ref, readonly } from 'vue'

// 状态定义在函数外部实现单例
const dialogState = ref({
  visible: false,
  title: '',
  message: '',
  type: 'info' as 'info' | 'success' | 'error' | 'confirm'
})

export function useDialog() {
  // 只读状态防止外部直接修改
  const state = readonly(dialogState)

  // 内部方法
  function showDialog(options: DialogOptions) {
    dialogState.value = { ...options, visible: true }
  }

  function closeDialog() {
    dialogState.value.visible = false
  }

  // 公开 API
  async function confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      showDialog({
        type: 'confirm',
        message,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })
  }

  async function alert(message: string): Promise<void> {
    return new Promise((resolve) => {
      showDialog({
        type: 'info',
        message,
        onConfirm: () => resolve()
      })
    })
  }

  // 返回对象
  return {
    state,
    confirm,
    alert,
    closeDialog
  }
}
```

#### Composables 设计原则

1. **以 `use` 开头命名**
2. **返回响应式数据和方法**
3. **处理生命周期清理**
4. **避免副作用，或在 onUnmounted 中清理**

### 5.3 Tauri API 调用规范

```typescript
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

// 定义后端返回类型
interface FileItem {
  fileName: string
  filePath: string
  // ...
}

// 封装 invoke 调用
async function getFileInfo(path?: string): Promise<FileItem[]> {
  try {
    return await invoke<FileItem[]>('get_file_info', { path })
  } catch (error) {
    console.error('获取文件信息失败:', error)
    throw new Error(`获取文件失败: ${error}`)
  }
}

// 事件监听 (记得清理)
let unlisten: UnlistenFn | null = null

onMounted(async () => {
  unlisten = await listen('files:changed', (event) => {
    console.log('文件变化:', event.payload)
    refreshFiles()
  })
})

onUnmounted(() => {
  unlisten?.()
})
```

---

## 6. 后端开发规范

### 6.1 Tauri 命令规范

```rust
// commands/file_ops.rs
use tauri::command;
use serde::{Deserialize, Serialize};

// 返回类型定义
#[derive(Serialize, Deserialize)]
pub struct FileItem {
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub ico: String,
    pub f_type: String,
}

// 命令函数
#[command]
pub async fn get_file_info(path: Option<String>) -> Result<Vec<FileItem>, String> {
    // 1. 参数验证
    let target_path = match path {
        Some(p) => validate_path(&p)?,
        None => get_desktop_path()?,
    };

    // 2. 业务逻辑
    let files = scan_directory(&target_path)
        .await
        .map_err(|e| format!("扫描目录失败: {}", e))?;

    // 3. 返回结果
    Ok(files)
}

// 路径验证 (安全)
fn validate_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);

    // 防止路径遍历攻击
    if path.components().any(|c| c == Component::ParentDir) {
        return Err("不允许使用 .. 路径".to_string());
    }

    if !path.exists() {
        return Err("路径不存在".to_string());
    }

    Ok(path)
}
```

#### 命令设计原则

1. **始终返回 `Result<T, String>`**
2. **参数验证在前，业务逻辑在后**
3. **错误信息要有意义，便于调试**
4. **异步命令使用 `async fn`**
5. **复杂逻辑抽取到 core 模块**

### 6.2 错误处理规范

```rust
// 定义自定义错误类型
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("路径无效: {0}")]
    InvalidPath(String),

    #[error("文件不存在: {0}")]
    FileNotFound(String),

    #[error("权限不足: {0}")]
    PermissionDenied(String),
}

// 转换为 Tauri 可序列化的错误
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}

// 在命令中使用
#[command]
pub async fn open_file(file_path: String) -> Result<(), String> {
    let path = validate_path(&file_path)?;

    opener::open(&path)
        .map_err(|e| AppError::Io(e.into()))?;

    Ok(())
}
```

### 6.3 并发处理规范

```rust
use std::sync::Arc;
use tokio::sync::Mutex;
use dashmap::DashMap;
use rayon::prelude::*;

// 使用 DashMap 进行并发读写
static ICON_CACHE: Lazy<DashMap<String, String>> = Lazy::new(DashMap::new);

// 使用 Rayon 进行并行处理
pub fn scan_directory_parallel(path: &Path) -> Result<Vec<FileItem>, Error> {
    let entries: Vec<_> = fs::read_dir(path)?
        .filter_map(|e| e.ok())
        .collect();

    // 并行处理每个文件
    let items: Vec<FileItem> = entries
        .par_iter()
        .filter_map(|entry| process_entry(entry).ok())
        .collect();

    Ok(items)
}

// 使用 Tokio 进行异步操作
pub async fn watch_directory(path: PathBuf, tx: mpsc::Sender<Event>) {
    let (watcher_tx, mut watcher_rx) = mpsc::channel(100);

    // 启动文件监控
    let mut watcher = notify::recommended_watcher(move |res| {
        if let Ok(event) = res {
            let _ = watcher_tx.blocking_send(event);
        }
    })?;

    watcher.watch(&path, RecursiveMode::NonRecursive)?;

    // 处理事件
    while let Some(event) = watcher_rx.recv().await {
        let _ = tx.send(event).await;
    }
}
```

### 6.4 Windows 平台代码规范

```rust
// 使用 cfg 属性进行平台条件编译
#[cfg(target_os = "windows")]
mod windows {
    use windows::Win32::UI::Shell::*;
    use windows::Win32::Foundation::*;

    pub fn get_known_folder(folder_id: GUID) -> Result<PathBuf, Error> {
        unsafe {
            let path = SHGetKnownFolderPath(&folder_id, KF_FLAG_DEFAULT, None)?;
            let path_str = path.to_string()?;
            CoTaskMemFree(Some(path.as_ptr() as _));
            Ok(PathBuf::from(path_str))
        }
    }
}

// 非 Windows 平台的 fallback
#[cfg(not(target_os = "windows"))]
mod windows {
    pub fn get_known_folder(_: ()) -> Result<PathBuf, Error> {
        Err(Error::UnsupportedPlatform)
    }
}

// 公开统一接口
pub use self::windows::*;
```

---

## 7. 样式规范

### 7.1 CSS 变量系统

```css
/* styles/index.css */
:root {
  /* ===== 颜色 ===== */
  --primary-color: #3B82F6;
  --primary-hover: #2563EB;
  --bg-primary: rgba(255, 255, 255, 0.85);
  --bg-secondary: rgba(255, 255, 255, 0.6);
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --border-color: rgba(0, 0, 0, 0.1);

  /* ===== 间距 ===== */
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */

  /* ===== 圆角 ===== */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* ===== 阴影 ===== */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.15);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.2);

  /* ===== 动效 ===== */
  --duration-fast: 0.15s;
  --duration-normal: 0.25s;
  --duration-slow: 0.35s;
  --ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* ===== 玻璃态 ===== */
  --blur-amount: 24px;
  --saturation-amount: 140%;
}

/* 深色模式 */
[data-theme="dark"] {
  --bg-primary: rgba(30, 41, 59, 0.9);
  --bg-secondary: rgba(30, 41, 59, 0.7);
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border-color: rgba(255, 255, 255, 0.1);
}
```

### 7.2 组件样式规范

```vue
<style scoped>
/* 1. 布局 */
.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* 2. 盒模型 */
.card {
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  border-radius: var(--radius-md);
}

/* 3. 背景/边框 */
.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
}

/* 4. 文字 */
.title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* 5. 玻璃态效果 */
.glass {
  background: var(--bg-primary);
  backdrop-filter: blur(var(--blur-amount)) saturate(var(--saturation-amount));
  -webkit-backdrop-filter: blur(var(--blur-amount)) saturate(var(--saturation-amount));
}

/* 6. 过渡动画 */
.btn {
  transition: all var(--duration-fast) var(--ease-out);
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

/* 7. 状态样式 */
.item.is-active {
  background: var(--primary-color);
  color: white;
}

.item.is-disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
```

### 7.3 禁止事项

```css
/* ❌ 禁止使用硬编码颜色 */
.bad { color: #333; }

/* ✅ 使用 CSS 变量 */
.good { color: var(--text-primary); }

/* ❌ 禁止使用 !important (除非覆盖第三方库) */
.bad { display: none !important; }

/* ❌ 禁止使用 ID 选择器 */
#header { }

/* ❌ 禁止使用标签选择器 (除了 reset) */
div { }

/* ❌ 禁止过深嵌套 (最多 3 层) */
.a .b .c .d .e { }
```

---

## 8. 状态管理规范

### 8.1 Store 结构规范

```typescript
// stores/files.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useFileStore = defineStore('files', () => {
  // ========== 状态定义 ==========
  const files = ref<FileItem[]>([])
  const currentPath = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ========== 计算属性 ==========
  const fileCount = computed(() => files.value.length)

  const sortedFiles = computed(() => {
    return [...files.value].sort((a, b) =>
      a.fileName.localeCompare(b.fileName)
    )
  })

  // ========== 私有方法 ==========
  function _resetState() {
    files.value = []
    error.value = null
  }

  // ========== 公开方法 ==========
  async function loadFiles(path?: string) {
    isLoading.value = true
    error.value = null

    try {
      const result = await invoke<FileItem[]>('get_file_info', { path })
      files.value = result
      currentPath.value = path ?? null
    } catch (e) {
      error.value = String(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function addFile(file: FileItem) {
    files.value.push(file)
  }

  function removeFile(filePath: string) {
    const index = files.value.findIndex(f => f.filePath === filePath)
    if (index !== -1) {
      files.value.splice(index, 1)
    }
  }

  // ========== 返回 ==========
  return {
    // 状态
    files,
    currentPath,
    isLoading,
    error,

    // 计算属性
    fileCount,
    sortedFiles,

    // 方法
    loadFiles,
    addFile,
    removeFile,
  }
})
```

### 8.2 Store 使用规范

```typescript
// 在组件中使用
import { storeToRefs } from 'pinia'
import { useFileStore } from '@/stores/files'

const fileStore = useFileStore()

// ✅ 使用 storeToRefs 解构响应式状态
const { files, isLoading, error } = storeToRefs(fileStore)

// ✅ 方法直接解构
const { loadFiles, addFile } = fileStore

// ❌ 不要直接解构状态 (会失去响应性)
const { files } = fileStore  // 错误！
```

### 8.3 状态持久化

```typescript
// 需要持久化的状态使用 localStorage
function saveToStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  const stored = localStorage.getItem(key)
  return stored ? JSON.parse(stored) : defaultValue
}

// 在 Store 中使用
export const useSettingsStore = defineStore('settings', () => {
  const theme = ref(loadFromStorage('theme', 'light'))

  watch(theme, (newTheme) => {
    saveToStorage('theme', newTheme)
  })

  return { theme }
})
```

---

## 9. 类型定义规范

### 9.1 类型文件组织

```typescript
// types/file.ts - 文件相关类型
export interface FileItem {
  fileName: string
  fileType: string
  file: string
  filePath: string
  ico: string
  index: number
  fType: FileCategory
  isFavorite: boolean
  sysApp: boolean
}

export type FileCategory =
  | 'dir'
  | 'exe'
  | 'word'
  | 'excel'
  | 'ppt'
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | 'text'
  | 'other'

// types/virtualFolder.ts - 虚拟分组类型
export interface VirtualFolder {
  id: string
  name: string
  icon: string
  memberPaths: string[]
  createdAt: number
  isFavorite: boolean
}

// types/display.ts - 显示相关类型
export type DisplayItem =
  | { type: 'file'; data: FileItem }
  | { type: 'virtualFolder'; data: VirtualFolder }

// types/index.ts - 统一导出
export * from './file'
export * from './virtualFolder'
export * from './display'
```

### 9.2 类型定义原则

```typescript
// ✅ 优先使用 interface 定义对象类型
interface User {
  id: string
  name: string
}

// ✅ 使用 type 定义联合类型、交叉类型
type Status = 'pending' | 'success' | 'error'
type UserWithRole = User & { role: string }

// ✅ 使用 readonly 保护不可变数据
interface Config {
  readonly apiUrl: string
  readonly timeout: number
}

// ✅ 使用泛型提高复用性
interface ApiResponse<T> {
  data: T
  error: string | null
  status: number
}

// ✅ 为函数参数和返回值添加类型
function processFile(file: FileItem): DisplayItem {
  return { type: 'file', data: file }
}

// ❌ 避免使用 any
function bad(data: any) { }

// ✅ 使用 unknown 代替 any，强制类型检查
function good(data: unknown) {
  if (typeof data === 'string') {
    // 现在 data 是 string 类型
  }
}
```

---

## 10. Git 提交规范

### 10.1 提交信息格式

```
<类型>(<范围>): <简短描述>

<详细描述>

<关联信息>
```

### 10.2 类型定义

| 类型 | 说明 | 示例 |
|------|------|------|
| feat | 新功能 | feat(虚拟分组): 添加拖拽合并功能 |
| fix | Bug 修复 | fix(文件列表): 修复图标加载失败问题 |
| perf | 性能优化 | perf(扫描): 使用并行处理提升扫描速度 |
| refactor | 重构 | refactor(store): 拆分 files store |
| style | 样式调整 | style(主题): 调整深色模式配色 |
| docs | 文档更新 | docs: 更新开发规范 |
| test | 测试相关 | test(file_ops): 添加单元测试 |
| chore | 构建/工具 | chore: 升级 Vite 到 6.0 |

### 10.3 提交示例

```bash
# 功能提交
feat(虚拟分组): 支持拖拽文件创建虚拟分组

- 实现拖拽检测逻辑
- 添加合并预览动画
- 支持多选文件合并

Closes #42

# Bug 修复
fix(边缘触发): 修复全屏游戏时误触发问题

添加全屏应用检测，在游戏等全屏应用中禁用边缘触发

Fixes #38

# 性能优化
perf(图标提取): 批量提取优化

- 使用 DashMap 缓存已提取的图标
- 批量大小从 5 调整为 10
- 添加防抖处理
```

### 10.4 分支命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能 | feature/功能名 | feature/virtual-folder |
| 修复 | fix/问题描述 | fix/icon-loading |
| 优化 | perf/优化点 | perf/file-scan |
| 重构 | refactor/模块名 | refactor/drag-system |

---

## 11. 性能优化实践

### 11.1 前端性能

#### 列表渲染优化

```vue
<template>
  <!-- ✅ 使用唯一且稳定的 key -->
  <div v-for="item in items" :key="item.id">
    {{ item.name }}
  </div>

  <!-- ❌ 避免使用 index 作为 key -->
  <div v-for="(item, index) in items" :key="index">
    {{ item.name }}
  </div>
</template>

<script setup>
// ✅ 大列表使用虚拟滚动
import { useVirtualList } from '@vueuse/core'

const { list, containerProps, wrapperProps } = useVirtualList(items, {
  itemHeight: 40,
})
</script>
```

#### 计算属性缓存

```typescript
// ✅ 使用 computed 缓存计算结果
const filteredFiles = computed(() => {
  return files.value.filter(f => f.fType === currentCategory.value)
})

// ❌ 避免在模板中直接调用过滤方法
// <div v-for="file in files.filter(f => f.fType === category)">
```

#### 防抖和节流

```typescript
import { useDebounceFn, useThrottleFn } from '@vueuse/core'

// 搜索输入防抖
const debouncedSearch = useDebounceFn((query: string) => {
  performSearch(query)
}, 300)

// 滚动事件节流
const throttledScroll = useThrottleFn((event: Event) => {
  handleScroll(event)
}, 100)
```

### 11.2 后端性能

#### 并行处理

```rust
use rayon::prelude::*;

// ✅ 使用 Rayon 并行处理
fn process_files(files: Vec<PathBuf>) -> Vec<FileItem> {
    files.par_iter()
        .filter_map(|path| process_file(path).ok())
        .collect()
}

// ✅ 批量处理减少 IPC 调用
#[command]
async fn extract_file_icons(paths: Vec<String>) -> Result<Vec<(String, String)>, String> {
    // 一次调用处理多个文件
}
```

#### 缓存策略

```rust
use dashmap::DashMap;
use once_cell::sync::Lazy;

// 全局图标缓存
static ICON_CACHE: Lazy<DashMap<String, String>> = Lazy::new(DashMap::new);

pub fn get_icon(path: &str) -> Option<String> {
    // 先查缓存
    if let Some(icon) = ICON_CACHE.get(path) {
        return Some(icon.clone());
    }

    // 提取图标
    let icon = extract_icon(path)?;

    // 存入缓存
    ICON_CACHE.insert(path.to_string(), icon.clone());

    Some(icon)
}
```

#### 异步 I/O

```rust
use tokio::fs;

// ✅ 使用异步文件操作
async fn read_file_async(path: &Path) -> Result<String, Error> {
    fs::read_to_string(path).await
}

// ✅ 并发执行多个异步操作
async fn process_multiple(paths: Vec<PathBuf>) -> Vec<Result<String, Error>> {
    let futures: Vec<_> = paths.iter()
        .map(|p| read_file_async(p))
        .collect();

    futures::future::join_all(futures).await
}
```

### 11.3 内存管理

```typescript
// ✅ 及时清理事件监听器
let unlisten: UnlistenFn | null = null

onMounted(async () => {
  unlisten = await listen('event', handler)
})

onUnmounted(() => {
  unlisten?.()
  unlisten = null
})

// ✅ 大数据使用 shallowRef
import { shallowRef } from 'vue'

const largeList = shallowRef<FileItem[]>([])

// 更新时替换整个数组
largeList.value = newList
```

---

## 12. 安全规范

### 12.1 路径安全

```rust
use std::path::{Component, Path, PathBuf};

// ✅ 验证路径防止目录遍历
fn validate_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);

    // 检查 .. 组件
    for component in path.components() {
        if matches!(component, Component::ParentDir) {
            return Err("路径包含非法字符".to_string());
        }
    }

    // 规范化路径
    let canonical = path.canonicalize()
        .map_err(|e| format!("路径无效: {}", e))?;

    // 检查是否在允许的目录内
    let allowed_dirs = get_allowed_directories();
    if !allowed_dirs.iter().any(|dir| canonical.starts_with(dir)) {
        return Err("访问被拒绝".to_string());
    }

    Ok(canonical)
}
```

### 12.2 输入验证

```typescript
// ✅ 验证文件名
function validateFileName(name: string): boolean {
  // 禁止的字符
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
  if (invalidChars.test(name)) {
    return false
  }

  // 禁止的名称
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1']
  if (reservedNames.includes(name.toUpperCase())) {
    return false
  }

  // 长度限制
  if (name.length === 0 || name.length > 255) {
    return false
  }

  return true
}
```

### 12.3 权限控制

```json
// src-tauri/capabilities/main.json
{
  "permissions": [
    "core:default",
    "shell:allow-open",
    {
      "identifier": "fs:allow-read",
      "allow": [
        { "path": "$DESKTOP/**" },
        { "path": "$DOCUMENT/**" }
      ]
    }
  ]
}
```

---

## 附录

### A. 常用命令

```bash
# 开发
pnpm dev           # 启动前端开发服务器
pnpm tauri:dev     # 启动 Tauri 开发模式

# 构建
pnpm build         # 构建前端
pnpm tauri:build   # 构建生产版本

# 类型检查
pnpm vue-tsc --noEmit

# Rust 检查
cd src-tauri && cargo check
cd src-tauri && cargo clippy
```

### B. VS Code 推荐扩展

```json
{
  "recommendations": [
    "Vue.volar",
    "rust-lang.rust-analyzer",
    "tauri-apps.tauri-vscode",
    "bradlc.vscode-tailwindcss",
    "dbaeumer.vscode-eslint"
  ]
}
```

### C. 参考资源

- [Vue 3 文档](https://vuejs.org/)
- [Tauri 2.0 文档](https://v2.tauri.app/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [Rust 官方文档](https://doc.rust-lang.org/)

---

> 本规范由项目架构分析自动生成，如有问题请提交 Issue。
