use crate::config::{DrawerConfig, DrawerState};
use crate::core::edge_detector::EdgeDetector;
use crate::core::hotkey::HotkeyManager;
use auto_launch::AutoLaunch;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{command, AppHandle, Manager, State};

/// 设置窗口可调整状态
#[command]
pub async fn set_window_adjustable(app: AppHandle, adjustable: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Failed to get main window")?;

    if adjustable {
        // 启用窗口调整：移除置顶、允许交互
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window
            .set_ignore_cursor_events(false)
            .map_err(|e| e.to_string())?;
    } else {
        // 禁用窗口调整：恢复置顶
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 设置抽屉状态
#[command]
pub async fn set_drawer_state(
    app: AppHandle,
    state: DrawerState,
    config: DrawerConfig,
) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;

    match state {
        DrawerState::Hidden => {
            window.hide().map_err(|e| e.to_string())?;
        }
        DrawerState::Open => {
            show_full_window(&window, &config).await?;
        }
    }

    Ok(())
}

/// 显示完全展开窗口
async fn show_full_window(
    window: &tauri::WebviewWindow,
    _config: &DrawerConfig,
) -> Result<(), String> {
    // 取消最小化状态(如果窗口被最小化了)
    if let Ok(true) = window.is_minimized() {
        window.unminimize().map_err(|e| e.to_string())?;
    }

    window.show().map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;

    Ok(())
}

/// 保存抽屉配置
#[command]
pub async fn save_drawer_config(
    app: AppHandle,
    config: DrawerConfig,
    edge_detector: State<'_, Arc<EdgeDetector>>,
    hotkey_manager: State<'_, HotkeyManager>,
) -> Result<(), String> {
    let config_path = get_config_path(&app)?;
    config.save(&config_path)?;

    // 运行态热更新（边缘检测/快捷键等依赖后端注册的功能）
    edge_detector.update_config(config.clone()).await;
    hotkey_manager.apply(&app, &config.hotkey)?;

    Ok(())
}

/// 加载抽屉配置
#[command]
pub async fn load_drawer_config(app: AppHandle) -> Result<DrawerConfig, String> {
    let config_path = get_config_path(&app)?;
    DrawerConfig::load(&config_path)
}

/// 获取配置文件路径
fn get_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("config");

    // 确保配置目录存在
    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    Ok(config_dir.join("drawer-config.json"))
}

/// 选择文件夹对话框
#[command]
pub async fn select_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::ptr::null_mut;
        use windows::Win32::System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
            COINIT_APARTMENTTHREADED,
        };
        use windows::Win32::UI::Shell::{
            FileOpenDialog, IFileDialog, IShellItem, FOS_PICKFOLDERS, SIGDN_FILESYSPATH,
        };

        // 在独立线程中执行 COM 操作
        let result = std::thread::spawn(|| {
            unsafe {
                // 初始化 COM
                let hr = CoInitializeEx(Some(null_mut()), COINIT_APARTMENTTHREADED);
                if hr.is_err() {
                    return Err("COM 初始化失败".to_string());
                }

                let result = (|| {
                    // 创建文件对话框
                    let dialog: IFileDialog =
                        CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER)
                            .map_err(|e| format!("创建对话框失败: {}", e))?;

                    // 设置为文件夹选择模式
                    dialog
                        .SetOptions(FOS_PICKFOLDERS)
                        .map_err(|e| format!("设置选项失败: {}", e))?;

                    // 显示对话框
                    match dialog.Show(None) {
                        Ok(_) => {}
                        Err(_) => return Ok(None), // 用户取消
                    }

                    // 获取选择的结果
                    let result: IShellItem = dialog
                        .GetResult()
                        .map_err(|e| format!("获取结果失败: {}", e))?;

                    // 获取文件路径
                    let path = result
                        .GetDisplayName(SIGDN_FILESYSPATH)
                        .map_err(|e| format!("获取路径失败: {}", e))?;

                    let path_str = path
                        .to_string()
                        .map_err(|e| format!("路径转换失败: {}", e))?;

                    Ok(Some(path_str))
                })();

                CoUninitialize();
                result
            }
        })
        .join()
        .map_err(|_| "线程执行失败".to_string())??;

        Ok(result)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("只支持 Windows 平台".to_string())
    }
}

/// 选择背景图片对话框（复制到缓存目录）
#[command]
pub async fn select_background_image(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::fs;
        use std::ptr::null_mut;
        use windows::core::PCWSTR;
        use windows::Win32::System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
            COINIT_APARTMENTTHREADED,
        };
        use windows::Win32::UI::Shell::Common::COMDLG_FILTERSPEC;
        use windows::Win32::UI::Shell::{
            FileOpenDialog, IFileDialog, IShellItem, SIGDN_FILESYSPATH,
        };

        // 隐藏窗口以便选择图片
        let window = app.get_webview_window("main");
        if let Some(ref w) = window {
            let _ = w.hide();
        }

        // 在独立线程中执行 COM 操作
        let result = std::thread::spawn(|| {
            unsafe {
                // 初始化 COM
                let hr = CoInitializeEx(Some(null_mut()), COINIT_APARTMENTTHREADED);
                if hr.is_err() {
                    return Err("COM 初始化失败".to_string());
                }

                let result = (|| {
                    // 创建文件对话框
                    let dialog: IFileDialog =
                        CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER)
                            .map_err(|e| format!("创建对话框失败: {}", e))?;

                    // 设置文件过滤器
                    let filter_name: Vec<u16> = "图片文件\0".encode_utf16().collect();
                    let filter_spec: Vec<u16> = "*.png;*.jpg;*.jpeg;*.webp;*.gif;*.bmp\0"
                        .encode_utf16()
                        .collect();

                    let filters = [COMDLG_FILTERSPEC {
                        pszName: PCWSTR(filter_name.as_ptr()),
                        pszSpec: PCWSTR(filter_spec.as_ptr()),
                    }];

                    dialog
                        .SetFileTypes(&filters)
                        .map_err(|e| format!("设置文件类型失败: {}", e))?;

                    // 设置对话框标题
                    let title: Vec<u16> = "选择背景图片\0".encode_utf16().collect();
                    dialog
                        .SetTitle(PCWSTR(title.as_ptr()))
                        .map_err(|e| format!("设置标题失败: {}", e))?;

                    // 显示对话框
                    match dialog.Show(None) {
                        Ok(_) => {}
                        Err(_) => return Ok(None), // 用户取消
                    }

                    // 获取选择的结果
                    let result: IShellItem = dialog
                        .GetResult()
                        .map_err(|e| format!("获取结果失败: {}", e))?;

                    // 获取文件路径
                    let path = result
                        .GetDisplayName(SIGDN_FILESYSPATH)
                        .map_err(|e| format!("获取路径失败: {}", e))?;

                    let path_str = path
                        .to_string()
                        .map_err(|e| format!("路径转换失败: {}", e))?;

                    Ok(Some(path_str))
                })();

                CoUninitialize();
                result
            }
        })
        .join()
        .map_err(|_| "线程执行失败".to_string())??;

        // 重新显示窗口
        if let Some(ref w) = window {
            let _ = w.show();
            let _ = w.set_focus();
        }

        // 如果选择了文件，复制到缓存目录
        if let Some(ref source_path) = result {
            let source = std::path::Path::new(source_path);

            // 获取缓存目录（使用应用数据目录）
            let cache_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("获取应用目录失败: {}", e))?
                .join("background");

            // 确保目录存在
            fs::create_dir_all(&cache_dir).map_err(|e| format!("创建缓存目录失败: {}", e))?;

            // 获取文件扩展名
            let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");

            // 目标文件名：background.ext
            let dest_path = cache_dir.join(format!("background.{}", ext));

            // 复制文件
            fs::copy(source, &dest_path).map_err(|e| format!("复制图片失败: {}", e))?;

            return Ok(Some(dest_path.to_string_lossy().to_string()));
        }

        Ok(result)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("只支持 Windows 平台".to_string())
    }
}

/// 获取 AutoLaunch 实例
fn get_auto_launch() -> Result<AutoLaunch, String> {
    let app_name = "SecondDesk";
    let app_path = std::env::current_exe().map_err(|e| format!("获取应用路径失败: {}", e))?;

    Ok(AutoLaunch::new(
        app_name,
        app_path.to_str().ok_or("路径转换失败")?,
        &[] as &[&str], // 无启动参数
    ))
}

/// 设置开机自启动
#[command]
pub async fn set_auto_start(enabled: bool) -> Result<(), String> {
    let auto_launch = get_auto_launch()?;

    if enabled {
        // 启用开机自启
        if !auto_launch.is_enabled().unwrap_or(false) {
            auto_launch
                .enable()
                .map_err(|e| format!("启用开机自启失败: {}", e))?;
        }
    } else {
        // 禁用开机自启
        if auto_launch.is_enabled().unwrap_or(false) {
            auto_launch
                .disable()
                .map_err(|e| format!("禁用开机自启失败: {}", e))?;
        }
    }

    Ok(())
}

/// 获取开机自启动状态
#[command]
pub async fn get_auto_start() -> Result<bool, String> {
    let auto_launch = get_auto_launch()?;
    auto_launch
        .is_enabled()
        .map_err(|e| format!("获取开机自启状态失败: {}", e))
}
