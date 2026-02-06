use std::path::PathBuf;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;

use super::file_watcher::FileWatcher;

/// 活跃 Watcher 包装器：同一时间只持有一个 FileWatcher。
/// 切换视图时停止旧 watcher、创建新 watcher。
pub struct ActiveWatcher {
    current: RwLock<Option<Arc<FileWatcher>>>,
    app_handle: AppHandle,
    debounce_ms: u64,
}

impl ActiveWatcher {
    /// 创建空包装器
    pub fn new(app_handle: AppHandle, debounce_ms: u64) -> Self {
        Self {
            current: RwLock::new(None),
            app_handle,
            debounce_ms,
        }
    }

    /// 切换到新的监控路径：停止旧 watcher，创建并启动新 watcher
    pub async fn switch_to(&self, paths: Vec<PathBuf>, path_id: Option<String>) {
        // 停止旧 watcher
        let old = self.current.write().await.take();
        if let Some(old) = old {
            old.disable();
        }

        if paths.is_empty() {
            return;
        }

        // 创建并启动新 watcher
        let new_watcher = Arc::new(FileWatcher::new(
            self.app_handle.clone(),
            paths,
            self.debounce_ms,
            path_id,
        ));

        let watcher_clone = new_watcher.clone();
        tokio::spawn(async move {
            watcher_clone.start_monitoring().await;
        });

        *self.current.write().await = Some(new_watcher);
    }

    /// 停止当前 watcher，不启动新的
    #[allow(dead_code)]
    pub async fn stop(&self) {
        let old = self.current.write().await.take();
        if let Some(old) = old {
            old.disable();
        }
    }
}
