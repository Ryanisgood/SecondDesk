// 核心业务逻辑模块

pub mod active_watcher;
pub mod edge_detector;
pub mod file_scanner;
pub mod file_watcher;
pub mod hotkey;
pub mod tray;
pub mod types;

pub use active_watcher::ActiveWatcher;
pub use types::FileItem;
