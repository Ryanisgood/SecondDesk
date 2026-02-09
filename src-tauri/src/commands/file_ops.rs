use crate::core::{file_scanner::FileScanner, FileItem};
#[cfg(target_os = "windows")]
use crate::utils::known_folders;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

/// 路径验证辅助函数 - 确保路径有效且安全
fn validate_path(path: &Path) -> Result<PathBuf, String> {
    // 验证路径存在
    if !path.exists() {
        return Err("路径不存在".to_string());
    }

    // 检查父目录遍历攻击
    for component in path.components() {
        if matches!(component, Component::ParentDir) {
            return Err("不允许父目录访问".to_string());
        }
    }

    // 返回规范化路径用于实际操作
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("路径解析失败: {}", e))?;

    Ok(canonical)
}

/// 路径验证辅助函数 - 允许目标不存在（用于回收站恢复等场景）
fn validate_path_allow_missing(path: &Path) -> Result<PathBuf, String> {
    // 检查父目录遍历攻击
    for component in path.components() {
        if matches!(component, Component::ParentDir) {
            return Err("不允许父目录访问".to_string());
        }
    }

    // 获取绝对路径
    let absolute_path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|_| "无法获取当前目录")?
            .join(path)
    };

    Ok(absolute_path)
}

/// 全局文件扫描器
pub struct FileScannerState {
    scanner: Arc<FileScanner>,
}

impl FileScannerState {
    pub fn new() -> Result<Self, String> {
        let scanner = FileScanner::new().map_err(|e| format!("无法初始化文件扫描器: {}", e))?;
        Ok(Self {
            scanner: Arc::new(scanner),
        })
    }
}

/// 获取文件列表
#[tauri::command]
pub async fn get_file_info(
    path: Option<String>,
    state: tauri::State<'_, FileScannerState>,
) -> Result<Vec<FileItem>, String> {
    state
        .scanner
        .scan_directory(path.as_deref())
        .await
        .map_err(|e| format!("扫描目录失败: {}", e))
        .map(|mut items| {
            // 设置索引
            for (index, item) in items.iter_mut().enumerate() {
                item.index = index;
            }
            items
        })
}

/// 异步提取图标
#[tauri::command]
pub async fn extract_file_icons(
    file_paths: Vec<String>,
    state: tauri::State<'_, FileScannerState>,
) -> Result<Vec<(String, String)>, String> {
    state
        .scanner
        .extract_icons(file_paths)
        .await
        .map_err(|e| format!("提取图标失败: {}", e))
}

/// 打开文件
#[tauri::command]
pub async fn open_file(file_path: String) -> Result<(), String> {
    use std::path::Path;

    // 使用统一的路径验证（桌面范围限制）
    let path = Path::new(&file_path);
    let canonical = validate_path(path)?;

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        const CREATE_NO_WINDOW: u32 = 0x08000000;

        Command::new("cmd")
            .creation_flags(CREATE_NO_WINDOW)
            .arg("/C")
            .arg("start")
            .arg("")
            .arg(&canonical)
            .spawn()
            .map_err(|e| format!("打开文件失败: {}", e))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("只支持 Windows 平台".to_string())
    }
}

/// 打开 URL（使用默认浏览器）
#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    // 验证 URL 格式（基本检查）
    if !url.starts_with("http://") && !url.starts_with("https://") && !url.starts_with("ftp://") {
        return Err("无效的 URL 格式".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        const CREATE_NO_WINDOW: u32 = 0x08000000;

        Command::new("cmd")
            .creation_flags(CREATE_NO_WINDOW)
            .arg("/C")
            .arg("start")
            .arg("")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("打开 URL 失败: {}", e))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("只支持 Windows 平台".to_string())
    }
}

/// 解析快捷方式目标路径
#[cfg(target_os = "windows")]
fn resolve_shortcut_target(lnk_path: &Path) -> Option<PathBuf> {
    use lnk::ShellLink;

    // 尝试读取快捷方式
    if let Ok(shell_link) = ShellLink::open(lnk_path) {
        // 获取链接目标的相对路径或绝对路径
        if let Some(link_info) = shell_link.link_info() {
            if let Some(local_base_path) = link_info.local_base_path() {
                let target = PathBuf::from(local_base_path);
                if target.exists() {
                    return Some(target);
                }
            }
        }

        // 如果上面没找到，尝试从 relative_path 解析
        if let Some(relative_path) = shell_link.relative_path() {
            // 相对路径是相对于快捷方式位置
            if let Some(parent) = lnk_path.parent() {
                let target = parent.join(relative_path);
                if target.exists() {
                    if let Ok(canonical) = target.canonicalize() {
                        return Some(canonical);
                    }
                }
            }
        }
    }

    None
}

/// 在资源管理器中显示文件
#[tauri::command]
pub async fn show_file(file_path: String) -> Result<(), String> {
    use std::path::Path;

    // 使用统一的路径验证（桌面范围限制）
    let path = Path::new(&file_path);
    let canonical = validate_path(path)?;

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        // 检查是否是快捷方式，如果是则解析目标路径
        let target_path = if canonical.extension().and_then(|e| e.to_str()) == Some("lnk") {
            resolve_shortcut_target(&canonical).unwrap_or(canonical)
        } else {
            canonical
        };

        Command::new("explorer")
            .arg("/select,")
            .arg(&target_path)
            .spawn()
            .map_err(|e| format!("显示文件失败: {}", e))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("只支持 Windows 平台".to_string())
    }
}

/// 重命名文件
#[tauri::command]
pub async fn rename_file(old_path: String, new_name: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    // 1. 验证新文件名（禁止路径分隔符）
    if new_name.contains(['/', '\\', '\0']) {
        return Err("文件名包含非法字符".to_string());
    }

    // 2. 验证新文件名非空
    if new_name.trim().is_empty() {
        return Err("文件名不能为空".to_string());
    }

    // 3. 验证并规范化旧路径
    let old = Path::new(&old_path);
    let old_canonical = validate_path(old)?;

    // 4. 构造新路径
    let parent = old_canonical.parent().ok_or("无法获取父目录")?;
    let new = parent.join(&new_name);

    // 5. 检查目标文件是否已存在
    if new.exists() {
        return Err("目标文件已存在".to_string());
    }

    // 6. 执行重命名
    fs::rename(old_canonical, new).map_err(|e| format!("重命名失败: {}", e))
}

/// 删除文件
#[tauri::command]
pub async fn remove_file(file_path: String, use_recycle_bin: bool) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    // 1. 验证并规范化路径
    let path = Path::new(&file_path);
    let canonical = validate_path(path)?;

    if use_recycle_bin {
        // 使用 trash crate 移到回收站
        trash::delete(&canonical).map_err(|e| format!("移到回收站失败: {}", e))
    } else {
        // 2. 获取文件元数据
        let metadata = fs::metadata(&canonical).map_err(|e| format!("获取文件信息失败: {}", e))?;

        // 3. 根据类型删除
        if metadata.is_dir() {
            // 警告：危险操作，建议要求二次确认
            fs::remove_dir_all(&canonical).map_err(|e| format!("删除目录失败: {}", e))
        } else {
            fs::remove_file(&canonical).map_err(|e| format!("删除文件失败: {}", e))
        }
    }
}

/// 获取桌面路径
#[tauri::command]
pub async fn get_desktop_path() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let desktop = known_folders::user_desktop_path()?;
        Ok(desktop.to_string_lossy().to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("只支持 Windows 平台".to_string())
    }
}

/// 获取已知文件夹路径（如下载、文档等）
#[tauri::command]
pub async fn get_known_folder(folder: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let path = known_folders::get_known_folder(&folder)?;
        Ok(path.to_string_lossy().to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = folder;
        Err("只支持 Windows 平台".to_string())
    }
}

/// 从回收站撤销删除（恢复到原位置）
#[tauri::command]
pub async fn restore_from_trash(file_path: String) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        return Err("只支持 Windows 平台".to_string());
    }

    use trash::os_limited::{list, restore_all};

    let target = validate_path_allow_missing(Path::new(&file_path))?;

    let all_items = list().map_err(|e| format!("读取回收站失败: {}", e))?;

    // 尝试多种匹配方式，因为路径格式可能不同
    let mut matches: Vec<trash::TrashItem> = all_items
        .into_iter()
        .filter(|item| {
            let original = item.original_path();
            // 精确匹配
            if original == target {
                return true;
            }
            // 忽略大小写匹配（Windows 文件系统不区分大小写）
            if let (Some(orig_str), Some(target_str)) = (original.to_str(), target.to_str()) {
                if orig_str.eq_ignore_ascii_case(target_str) {
                    return true;
                }
            }
            // 规范化后匹配
            if let (Ok(a), Ok(b)) = (original.canonicalize(), target.canonicalize()) {
                if a == b {
                    return true;
                }
            }
            false
        })
        .collect();

    if matches.is_empty() {
        return Err(format!(
            "回收站中未找到可恢复的项目\n目标路径: {}",
            target.display()
        ));
    }

    // 同一路径可能被多次删除，选择最近一次
    matches.sort_by_key(|item| item.time_deleted);
    let item = matches.pop().ok_or("回收站中未找到可恢复的项目")?;

    restore_all([item]).map_err(|e| format!("恢复失败: {}", e))
}

/// 新建文件
#[tauri::command]
pub async fn new_file(parent_path: String, file_name: String, is_dir: bool) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    // 1. 验证文件名
    if file_name.contains(['/', '\\', '\0']) {
        return Err("文件名包含非法字符".to_string());
    }

    if file_name.trim().is_empty() {
        return Err("文件名不能为空".to_string());
    }

    // 2. 验证父路径
    let parent = Path::new(&parent_path);
    let parent_canonical = validate_path(parent)?;

    // 3. 确保父路径是目录
    if !parent_canonical.is_dir() {
        return Err("父路径不是目录".to_string());
    }

    // 4. 构造新文件路径
    let new_path = parent_canonical.join(&file_name);

    // 5. 检查是否已存在
    if new_path.exists() {
        return Err("文件已存在".to_string());
    }

    // 6. 创建文件或目录
    if is_dir {
        fs::create_dir(&new_path).map_err(|e| format!("创建文件夹失败: {}", e))
    } else {
        fs::File::create(&new_path)
            .map(|_| ())
            .map_err(|e| format!("创建文件失败: {}", e))
    }
}

/// 移动文件到另一个目录
#[tauri::command]
pub async fn move_file(source_path: String, target_dir: String) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    // 1. 验证源路径
    let source = Path::new(&source_path);
    let source_canonical = validate_path(source)?;

    // 2. 验证目标目录
    let target = Path::new(&target_dir);
    let target_canonical = validate_path(target)?;

    if !target_canonical.is_dir() {
        return Err("目标必须是文件夹".to_string());
    }

    // 3. 构造新路径
    let file_name = source_canonical.file_name().ok_or("无法获取文件名")?;
    let new_path = target_canonical.join(file_name);

    // 4. 检查是否移动到自身
    if source_canonical == new_path {
        return Err("源和目标相同".to_string());
    }

    // 5. 检查是否尝试移动到自己的子目录
    if source_canonical.is_dir() && new_path.starts_with(&source_canonical) {
        return Err("不能将文件夹移动到自身内部".to_string());
    }

    // 6. 检查目标是否已存在
    if new_path.exists() {
        return Err("目标位置已存在同名文件".to_string());
    }

    // 7. 执行移动
    fs::rename(&source_canonical, &new_path).map_err(|e| format!("移动失败: {}", e))?;

    Ok(new_path.to_string_lossy().to_string())
}

/// 复制文件到指定目录（用于外部拖入）
#[tauri::command]
pub async fn copy_files_to_path(
    source_paths: Vec<String>,
    target_dir: String,
) -> Result<Vec<String>, String> {
    use std::fs;
    use std::path::Path;

    // 验证目标目录
    let target = Path::new(&target_dir);
    if !target.exists() {
        return Err("目标目录不存在".to_string());
    }
    if !target.is_dir() {
        return Err("目标必须是目录".to_string());
    }

    let mut copied_paths = Vec::new();

    for source_path in source_paths {
        let source = Path::new(&source_path);

        // 检查源文件是否存在
        if !source.exists() {
            eprintln!("源文件不存在: {}", source_path);
            continue;
        }

        // 获取文件名
        let file_name = match source.file_name() {
            Some(name) => name,
            None => {
                eprintln!("无法获取文件名: {}", source_path);
                continue;
            }
        };

        let dest = target.join(file_name);

        // 检查目标是否已存在
        if dest.exists() {
            eprintln!("目标已存在，跳过: {:?}", dest);
            continue;
        }

        // 复制文件或目录
        let result = if source.is_dir() {
            copy_dir_recursive(source, &dest)
        } else {
            fs::copy(source, &dest)
                .map(|_| ())
                .map_err(|e| e.to_string())
        };

        match result {
            Ok(_) => {
                copied_paths.push(dest.to_string_lossy().to_string());
            }
            Err(e) => {
                eprintln!("复制失败 {:?}: {}", source, e);
            }
        }
    }

    Ok(copied_paths)
}

/// 递归复制目录
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    use std::fs;

    fs::create_dir_all(dst).map_err(|e| format!("创建目录失败: {}", e))?;

    for entry in fs::read_dir(src).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let file_type = entry
            .file_type()
            .map_err(|e| format!("获取类型失败: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path).map_err(|e| format!("复制文件失败: {}", e))?;
        }
    }

    Ok(())
}

/// 打开文件属性对话框（Windows 原生）
#[tauri::command]
pub async fn show_file_properties(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::mem::size_of;
        use std::path::Path;
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::Shell::{
            ShellExecuteExW, SEE_MASK_INVOKEIDLIST, SHELLEXECUTEINFOW,
        };
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOW;

        let path = Path::new(&file_path);
        let canonical = validate_path(path)?;

        // 转换路径为宽字符串
        let path_wide: Vec<u16> = canonical
            .to_string_lossy()
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();

        // "properties" verb
        let verb: Vec<u16> = "properties\0".encode_utf16().collect();

        let mut info = SHELLEXECUTEINFOW {
            cbSize: size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_INVOKEIDLIST,
            hwnd: HWND::default(),
            lpVerb: PCWSTR(verb.as_ptr()),
            lpFile: PCWSTR(path_wide.as_ptr()),
            lpParameters: PCWSTR::null(),
            lpDirectory: PCWSTR::null(),
            nShow: SW_SHOW.0,
            ..Default::default()
        };

        let result = unsafe { ShellExecuteExW(&mut info) };

        if result.is_ok() {
            Ok(())
        } else {
            Err("无法打开属性对话框".to_string())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("只支持 Windows 平台".to_string())
    }
}

/// 启动应用程序（支持 PATH 环境变量中的可执行文件）
#[tauri::command]
pub async fn launch_application(app_name: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        const CREATE_NEW_CONSOLE: u32 = 0x00000010;

        // 获取用户主目录作为默认工作目录
        let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());

        Command::new(&app_name)
            .creation_flags(CREATE_NEW_CONSOLE)
            .current_dir(&user_profile) // 设置工作目录为用户主目录
            .spawn()
            .map_err(|e| format!("启动应用程序失败: {}", e))?;

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_name;
        Err("只支持 Windows 平台".to_string())
    }
}

/// 执行 Shell 命令（PowerShell 或 CMD）
#[tauri::command]
pub async fn execute_shell_command(shell: String, command: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        const CREATE_NEW_CONSOLE: u32 = 0x00000010;

        // 获取用户主目录作为默认工作目录
        let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());

        let (program, args) = match shell.as_str() {
            "powershell" | "ps" => {
                // PowerShell: 使用 -NoExit 保持窗口打开，执行命令后不关闭
                ("powershell.exe", vec!["-NoExit", "-Command", &command])
            }
            "cmd" => {
                // CMD: 使用 /K 保持窗口打开，执行命令后不关闭
                ("cmd.exe", vec!["/K", &command])
            }
            _ => {
                return Err(format!("不支持的 Shell 类型: {}", shell));
            }
        };

        Command::new(program)
            .creation_flags(CREATE_NEW_CONSOLE)
            .current_dir(&user_profile) // 设置工作目录为用户主目录
            .args(&args)
            .spawn()
            .map_err(|e| format!("执行 Shell 命令失败: {}", e))?;

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (shell, command);
        Err("只支持 Windows 平台".to_string())
    }
}
