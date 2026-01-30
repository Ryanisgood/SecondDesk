// 核心业务逻辑模块

pub mod edge_detector;
pub mod file_scanner;
pub mod file_watcher;
pub mod hotkey;
pub mod tray;
pub mod types;

pub use file_watcher::FileWatcher;
pub use types::FileItem;
