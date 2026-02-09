use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio::time::{timeout, Instant};

/// 文件变化事件载荷
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeEvent {
    /// 变化类型: "create" | "modify" | "remove" | "rename" | "change"
    pub change_type: String,
    /// 受影响的文件路径
    pub paths: Vec<String>,
    /// 来源路径标识（用于多文件夹监控时区分来源）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_path_id: Option<String>,
}

/// 文件系统监控器
pub struct FileWatcher {
    enabled: Arc<AtomicBool>,
    app_handle: AppHandle,
    initial_paths: Vec<PathBuf>,
    debounce_ms: u64,
    /// 路径标识（用于多文件夹监控时区分来源）
    path_id: Option<String>,
}

impl FileWatcher {
    /// 创建新的文件监控器
    pub fn new(
        app_handle: AppHandle,
        watch_paths: Vec<PathBuf>,
        debounce_ms: u64,
        path_id: Option<String>,
    ) -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(true)),
            app_handle,
            initial_paths: watch_paths,
            debounce_ms,
            path_id,
        }
    }

    /// 启用文件监控
    #[allow(dead_code)]
    pub fn enable(&self) {
        self.enabled.store(true, Ordering::Relaxed);
    }

    /// 禁用文件监控
    #[allow(dead_code)]
    pub fn disable(&self) {
        self.enabled.store(false, Ordering::Relaxed);
    }

    /// 启动文件监控
    pub async fn start_monitoring(self: Arc<Self>) {
        let (tx, mut rx) = mpsc::channel::<Event>(100);
        let enabled = self.enabled.clone();
        let watch_paths = self.initial_paths.clone();
        let debounce_ms = self.debounce_ms;
        let tx_clone = tx.clone();

        // 在独立线程中运行文件监控器
        std::thread::spawn(move || {
            // 创建 watcher
            let tx_for_watcher = tx_clone.clone();
            let mut watcher = match RecommendedWatcher::new(
                move |res: Result<Event, notify::Error>| {
                    if let Ok(event) = res {
                        let _ = tx_for_watcher.blocking_send(event);
                    }
                },
                Config::default().with_poll_interval(Duration::from_millis(debounce_ms)),
            ) {
                Ok(w) => w,
                Err(e) => {
                    eprintln!("创建文件监控器失败: {}", e);
                    return;
                }
            };

            // 监控所有路径
            for path in &watch_paths {
                if path.exists() {
                    match watcher.watch(path, RecursiveMode::NonRecursive) {
                        Ok(_) => {}
                        Err(e) => eprintln!("监控路径失败 {:?}: {}", path, e),
                    }
                } else {
                    eprintln!("监控路径不存在: {:?}", path);
                }
            }

            // 保持线程存活
            loop {
                std::thread::sleep(Duration::from_secs(1));
                if !enabled.load(Ordering::Relaxed) {
                    break;
                }
            }
        });

        // 立即 drop tx，防止内存泄漏
        drop(tx);

        // 真正防抖：收集一段时间内的事件后只发一次，避免事件风暴占用运行时导致边缘检测等任务延迟
        let debounce_duration = Duration::from_millis(self.debounce_ms);

        // 处理事件并发送到前端
        while let Some(first_event) = rx.recv().await {
            if !self.enabled.load(Ordering::Relaxed) {
                continue;
            }

            let start = Instant::now();
            let mut paths: HashSet<String> = HashSet::new();
            let mut change_type = "change";

            let mut push_event = |event: &Event| {
                for p in &event.paths {
                    paths.insert(p.to_string_lossy().to_string());
                }

                change_type = match event.kind {
                    notify::EventKind::Create(_) => "create",
                    notify::EventKind::Modify(_) => "modify",
                    notify::EventKind::Remove(_) => "remove",
                    _ => change_type,
                };
            };

            push_event(&first_event);

            loop {
                let elapsed = start.elapsed();
                if elapsed >= debounce_duration {
                    break;
                }

                let remaining = debounce_duration - elapsed;
                match timeout(remaining, rx.recv()).await {
                    Ok(Some(next_event)) => {
                        if !self.enabled.load(Ordering::Relaxed) {
                            break;
                        }
                        push_event(&next_event);
                    }
                    _ => break, // 超时或通道关闭
                }
            }

            if paths.is_empty() {
                continue;
            }

            let mut path_strings: Vec<String> = paths.into_iter().collect();
            path_strings.sort();

            let file_event = FileChangeEvent {
                change_type: change_type.to_string(),
                paths: path_strings,
                source_path_id: self.path_id.clone(),
            };

            if let Err(e) = self.app_handle.emit("files:changed", file_event) {
                eprintln!("发送文件变化事件失败: {}", e);
            }

            tokio::task::yield_now().await;
        }
    }
}
