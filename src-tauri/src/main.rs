// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tauri::Manager;

mod commands;
mod config;
mod core;
mod utils;

use commands::file_ops::{
    copy_files_to_path, execute_shell_command, extract_file_icons, get_desktop_path, get_file_info,
    get_known_folder, launch_application, move_file, new_file, open_file, open_url, remove_file,
    rename_file, restore_from_trash, show_file, show_file_properties, FileScannerState,
};
use commands::watch_paths::{
    add_watch_path, get_watch_paths, remove_watch_path, set_watch_path_enabled, switch_watcher,
};
use commands::window_control::{
    get_auto_start, load_drawer_config, save_drawer_config, select_background_image, select_folder,
    set_auto_start, set_drawer_state, set_window_adjustable,
};
use config::DrawerConfig;
use core::edge_detector::EdgeDetector;
use core::hotkey::HotkeyManager;
use core::ActiveWatcher;

#[tokio::main]
async fn main() {
    // 初始化文件扫描器状态
    let scanner_state = match FileScannerState::new() {
        Ok(state) => state,
        Err(e) => {
            eprintln!("致命错误：{}", e);
            std::process::exit(1);
        }
    };

    tauri::Builder::default()
        .manage(scanner_state)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // 设置应用数据目录（供 icon_extractor 等模块使用）
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            utils::icon_extractor::set_app_data_dir(app_data_dir.clone());

            // 动态添加应用数据目录到 asset 协议 scope（确保打包后可访问）
            if let Err(e) = app
                .asset_protocol_scope()
                .allow_directory(&app_data_dir, true)
            {
                eprintln!("添加应用数据目录到 asset scope 失败: {}", e);
            }

            // 创建系统托盘
            if let Err(e) = core::tray::create_tray(app.handle()) {
                eprintln!("创建系统托盘失败: {}", e);
            }

            // 加载抽屉配置（统一使用 app_data_dir）
            let config_path = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir")
                .join("config")
                .join("drawer-config.json");

            let config = DrawerConfig::load(&config_path).unwrap_or_default();

            // 注册/管理全局快捷键（后续可热更新）
            let hotkey_manager = HotkeyManager::default();
            if let Err(e) = hotkey_manager.apply(app.handle(), &config.hotkey) {
                eprintln!("注册快捷键失败: {}", e);
            }
            app.manage(hotkey_manager);

            // 启动边缘检测（始终启动线程，内部按 enabled 开关控制，支持热更新）
            let handle = app.handle().clone();
            let edge_detector = Arc::new(EdgeDetector::new(handle, config.clone()));
            app.manage(edge_detector.clone());
            tokio::spawn(async move {
                edge_detector.start_monitoring().await;
            });

            // 创建 ActiveWatcher 并注册到状态管理
            let active_watcher = Arc::new(ActiveWatcher::new(
                app.handle().clone(),
                config.file_watcher.debounce_ms,
            ));
            app.manage(active_watcher.clone());

            // 启动文件监控器：使用配置中第一个启用的路径
            if config.file_watcher.enabled {
                use std::path::PathBuf;

                // 查找第一个启用的路径
                let first_enabled = config.file_watcher.watch_paths.iter().find(|wp| wp.enabled);

                if let Some(entry) = first_enabled {
                    let initial_paths: Vec<PathBuf> = if entry.builtin {
                        // 桌面：扫描用户桌面 + 公共桌面
                        #[cfg(target_os = "windows")]
                        {
                            use crate::utils::known_folders;
                            let mut paths = vec![];
                            if let Ok(desktop) = known_folders::user_desktop_path() {
                                paths.push(desktop);
                            }
                            if let Ok(public_desktop) = known_folders::public_desktop_path() {
                                if !paths.contains(&public_desktop) {
                                    paths.push(public_desktop);
                                }
                            }
                            paths
                        }
                        #[cfg(not(target_os = "windows"))]
                        {
                            vec![]
                        }
                    } else {
                        vec![PathBuf::from(&entry.path)]
                    };

                    if !initial_paths.is_empty() {
                        let aw = active_watcher.clone();
                        let path_id = if entry.builtin { None } else { Some(entry.id.clone()) };
                        tokio::spawn(async move {
                            aw.switch_to(initial_paths, path_id).await;
                        });
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_file_info,
            extract_file_icons,
            open_file,
            open_url,
            launch_application,
            execute_shell_command,
            show_file,
            rename_file,
            remove_file,
            new_file,
            get_desktop_path,
            get_known_folder,
            restore_from_trash,
            move_file,
            copy_files_to_path,
            show_file_properties,
            set_drawer_state,
            save_drawer_config,
            load_drawer_config,
            set_window_adjustable,
            select_folder,
            select_background_image,
            set_auto_start,
            get_auto_start,
            get_watch_paths,
            add_watch_path,
            remove_watch_path,
            set_watch_path_enabled,
            switch_watcher,
        ])
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时出错");
}
