use std::path::PathBuf;
use std::sync::Arc;
use tauri::{command, AppHandle, Manager, State};

use crate::config::{DrawerConfig, WatchPathEntry, MAX_CUSTOM_WATCH_PATHS};
use crate::core::ActiveWatcher;

/// 获取配置文件路径（复用 window_control 的逻辑）
fn get_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("config");

    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    Ok(config_dir.join("drawer-config.json"))
}

/// 获取所有监控路径
#[command]
pub async fn get_watch_paths(app: AppHandle) -> Result<Vec<WatchPathEntry>, String> {
    let config_path = get_config_path(&app)?;
    let config = DrawerConfig::load(&config_path)?;
    Ok(config.file_watcher.watch_paths)
}

/// 添加监控路径
#[command]
pub async fn add_watch_path(
    app: AppHandle,
    path: String,
    label: Option<String>,
) -> Result<WatchPathEntry, String> {
    // 验证路径存在且为目录
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("路径不存在: {}", path));
    }
    if !p.is_dir() {
        return Err(format!("路径不是目录: {}", path));
    }

    let config_path = get_config_path(&app)?;
    let mut config = DrawerConfig::load(&config_path)?;

    // 检查自定义路径数量上限（不含桌面等内置路径）
    let custom_count = config.file_watcher.watch_paths.iter().filter(|wp| !wp.builtin).count();
    if custom_count >= MAX_CUSTOM_WATCH_PATHS {
        return Err(format!("最多只能添加 {} 个自定义文件夹", MAX_CUSTOM_WATCH_PATHS));
    }

    // 检查重复
    if config.file_watcher.watch_paths.iter().any(|wp| wp.path == path) {
        return Err(format!("路径已存在: {}", path));
    }

    let entry = WatchPathEntry {
        id: format!(
            "wp_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        ),
        path,
        enabled: true,
        label,
        builtin: false,
    };

    config.file_watcher.watch_paths.push(entry.clone());
    config.save(&config_path)?;

    Ok(entry)
}

/// 删除监控路径
#[command]
pub async fn remove_watch_path(app: AppHandle, path_id: String) -> Result<(), String> {
    let config_path = get_config_path(&app)?;
    let mut config = DrawerConfig::load(&config_path)?;

    // 内置路径不可删除
    if config.file_watcher.watch_paths.iter().any(|wp| wp.id == path_id && wp.builtin) {
        return Err("内置路径不可删除".to_string());
    }

    let before = config.file_watcher.watch_paths.len();
    config.file_watcher.watch_paths.retain(|wp| wp.id != path_id);

    if config.file_watcher.watch_paths.len() == before {
        return Err(format!("未找到路径: {}", path_id));
    }

    config.save(&config_path)?;
    Ok(())
}

/// 设置监控路径启用/禁用
#[command]
pub async fn set_watch_path_enabled(
    app: AppHandle,
    path_id: String,
    enabled: bool,
) -> Result<(), String> {
    let config_path = get_config_path(&app)?;
    let mut config = DrawerConfig::load(&config_path)?;

    // 禁用时检查：至少保留一个启用的路径
    if !enabled {
        let enabled_count = config.file_watcher.watch_paths.iter()
            .filter(|wp| wp.enabled && wp.id != path_id)
            .count();
        if enabled_count == 0 {
            return Err("至少需要保留一个启用的文件夹".to_string());
        }
    }

    let entry = config
        .file_watcher
        .watch_paths
        .iter_mut()
        .find(|wp| wp.id == path_id)
        .ok_or_else(|| format!("未找到路径: {}", path_id))?;

    entry.enabled = enabled;
    config.save(&config_path)?;
    Ok(())
}

/// 切换后端 watcher（前端切换视图时调用）
#[command]
pub async fn switch_watcher(
    paths: Vec<String>,
    path_id: Option<String>,
    active_watcher: State<'_, Arc<ActiveWatcher>>,
) -> Result<(), String> {
    let watch_paths: Vec<PathBuf> = paths
        .into_iter()
        .map(PathBuf::from)
        .filter(|p| p.exists())
        .collect();

    active_watcher.switch_to(watch_paths, path_id).await;
    Ok(())
}
