use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

#[cfg(target_os = "windows")]
use getfileicon::prelude::*;

#[cfg(target_os = "windows")]
use image::{imageops::FilterType, DynamicImage, ImageReader, Rgba, RgbaImage};

/// 应用数据目录的全局存储
static APP_DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

/// 设置应用数据目录（由 main.rs 在启动时调用）
pub fn set_app_data_dir(path: PathBuf) {
    let _ = APP_DATA_DIR.set(path);
}

/// 获取应用数据目录
fn get_app_data_dir() -> PathBuf {
    APP_DATA_DIR.get().cloned().unwrap_or_else(|| {
        // 这种情况不应该发生，但作为保险
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(std::env::temp_dir)
    })
}

/// 获取日志文件路径
fn get_log_file_path() -> PathBuf {
    let log_dir = get_app_data_dir().join("logs");
    let _ = fs::create_dir_all(&log_dir);
    log_dir.join("icon_errors.log")
}

/// 写入错误日志
fn log_error(context: &str, file_path: &str, error: &str) {
    let log_path = get_log_file_path();

    // 获取当前时间
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| {
            let secs = d.as_secs();
            // 转换为北京时间 (UTC+8)
            let beijing_secs = secs + 8 * 3600;
            let days = beijing_secs / 86400;
            let day_secs = beijing_secs % 86400;
            let hours = day_secs / 3600;
            let minutes = (day_secs % 3600) / 60;
            let seconds = day_secs % 60;

            // 简单的日期计算（从 1970-01-01 开始）
            let mut year = 1970;
            let mut remaining_days = days;
            loop {
                let days_in_year = if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 {
                    366
                } else {
                    365
                };
                if remaining_days < days_in_year {
                    break;
                }
                remaining_days -= days_in_year;
                year += 1;
            }
            let is_leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
            let days_in_months: [u64; 12] = if is_leap {
                [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
            } else {
                [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
            };
            let mut month = 1;
            for &days_in_month in &days_in_months {
                if remaining_days < days_in_month {
                    break;
                }
                remaining_days -= days_in_month;
                month += 1;
            }
            let day = remaining_days + 1;

            format!(
                "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
                year, month, day, hours, minutes, seconds
            )
        })
        .unwrap_or_else(|_| "unknown".to_string());

    let log_entry = format!(
        "[{}] [{}] 文件: {} | 错误: {}\n",
        timestamp, context, file_path, error
    );

    // 追加写入日志文件
    if let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let _ = file.write_all(log_entry.as_bytes());
    }
}

/// 获取图标缓存目录
fn get_icon_cache_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let cache_dir = get_app_data_dir().join("icon_cache");

    // 确保目录存在
    if !cache_dir.exists() {
        if let Err(e) = fs::create_dir_all(&cache_dir) {
            log_error(
                "缓存目录创建失败",
                cache_dir.to_string_lossy().as_ref(),
                &e.to_string(),
            );
            return Err(e.into());
        }
    }

    Ok(cache_dir)
}

/// 计算文件路径的哈希值
fn hash_path(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// 检查文件类型是否有预设图标
fn has_preset_icon(extension: &str) -> bool {
    matches!(
        extension,
        "exe"
            | "msi"
            | "bat"
            | "txt"
            | "md"
            | "log"
            | "doc"
            | "docx"
            | "xls"
            | "xlsx"
            | "ppt"
            | "pptx"
            | "pdf"
            | "html"
            | "htm"
            | "css"
            | "js"
            | "ts"
            | "json"
            | "xml"
            | "jpg"
            | "jpeg"
            | "png"
            | "gif"
            | "bmp"
            | "webp"
            | "svg"
            | "ico"
            | "mp3"
            | "wav"
            | "flac"
            | "m4a"
            | "aac"
            | "ogg"
            | "mp4"
            | "mkv"
            | "avi"
            | "mov"
            | "wmv"
            | "flv"
            | "zip"
            | "rar"
            | "7z"
            | "tar"
            | "gz"
            | "py"
            | "rb"
            | "sh"
            | "ps1"
    )
}

/// 判断像素是否透明
#[cfg(target_os = "windows")]
fn is_pixel_transparent(pixel: &Rgba<u8>, threshold: u8) -> bool {
    // 检查 alpha 通道
    if pixel[3] < threshold {
        return true;
    }

    // 对于半透明像素(alpha < 200),检查颜色是否接近背景色(白色/灰色/黑色)
    if pixel[3] < 200 {
        let r = pixel[0] as f32;
        let g = pixel[1] as f32;
        let b = pixel[2] as f32;
        let a = pixel[3] as f32 / 255.0;

        // 计算颜色的饱和度(彩色程度)
        let max_rgb = r.max(g).max(b);
        let min_rgb = r.min(g).min(b);
        let saturation = if max_rgb > 0.0 {
            (max_rgb - min_rgb) / max_rgb
        } else {
            0.0
        };

        // 如果是低饱和度(接近灰色)且半透明,认为是背景
        if saturation < 0.1 && a < 0.8 {
            return true;
        }
    }

    false
}

/// 查找图像中实际内容的边界矩形
#[cfg(target_os = "windows")]
fn find_content_bounds(img: &RgbaImage, alpha_threshold: u8) -> Option<(u32, u32, u32, u32)> {
    let (width, height) = img.dimensions();

    // 从上往下扫描，找到第一行有内容的行
    let top = (0..height).find(|&y| {
        (0..width).any(|x| !is_pixel_transparent(img.get_pixel(x, y), alpha_threshold))
    })?;

    // 从下往上扫描，找到最后一行有内容的行
    let bottom = (0..height).rev().find(|&y| {
        (0..width).any(|x| !is_pixel_transparent(img.get_pixel(x, y), alpha_threshold))
    })?;

    // 从左往右扫描，找到第一列有内容的列
    let left = (0..width).find(|&x| {
        (0..height).any(|y| !is_pixel_transparent(img.get_pixel(x, y), alpha_threshold))
    })?;

    // 从右往左扫描，找到最后一列有内容的列
    let right = (0..width).rev().find(|&x| {
        (0..height).any(|y| !is_pixel_transparent(img.get_pixel(x, y), alpha_threshold))
    })?;

    Some((left, top, right, bottom))
}

/// 自动裁剪图像的透明边框
#[cfg(target_os = "windows")]
fn crop_transparent_borders(img: DynamicImage) -> DynamicImage {
    const ALPHA_THRESHOLD: u8 = 50; // alpha < 50 视为透明(提高阈值以忽略半透明阴影)
    const MIN_CONTENT_SIZE: u32 = 16; // 最小内容尺寸
    const PADDING: u32 = 4; // 在内容周围保留的像素数(增加padding)

    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    // 查找内容边界
    let bounds = match find_content_bounds(&rgba, ALPHA_THRESHOLD) {
        Some(b) => b,
        None => return img, // 完全透明，返回原图
    };

    let (left, top, right, bottom) = bounds;

    // 计算内容尺寸
    let content_width = right.saturating_sub(left) + 1;
    let content_height = bottom.saturating_sub(top) + 1;

    // 如果内容太小，返回原图（避免过度裁剪）
    if content_width < MIN_CONTENT_SIZE || content_height < MIN_CONTENT_SIZE {
        return img;
    }

    // 添加 padding（限制在图像边界内）
    let crop_left = left.saturating_sub(PADDING);
    let crop_top = top.saturating_sub(PADDING);
    let crop_width = (content_width + PADDING * 2).min(width - crop_left);
    let crop_height = (content_height + PADDING * 2).min(height - crop_top);

    // 执行裁剪
    img.crop_imm(crop_left, crop_top, crop_width, crop_height)
}

/// 缩放并保存图标（确保至少 128x128）
#[cfg(target_os = "windows")]
fn resize_and_save_icon(
    temp_path: &Path,
    final_path: &Path,
    min_size: u32,
) -> Result<(), Box<dyn std::error::Error>> {
    // 1. 加载临时 PNG 文件
    let mut img = ImageReader::open(temp_path)?.decode()?;

    // 2. 自动裁剪透明边框
    img = crop_transparent_borders(img);

    let (width, height) = (img.width(), img.height());

    // 3. 确定目标尺寸（统一为 192x192 以保证质量）
    const TARGET_SIZE: u32 = 192;
    let target_size = width.max(height).max(min_size).max(TARGET_SIZE);

    // 4. 调整为正方形尺寸
    let final_img = img.resize(target_size, target_size, FilterType::Lanczos3);

    // 5. 保存到最终路径
    final_img.save(final_path)?;

    // 6. 删除临时文件
    let _ = std::fs::remove_file(temp_path);

    Ok(())
}

/// 使用 Windows Shell API 提取 .url 文件图标
#[cfg(target_os = "windows")]
fn extract_url_icon_via_shell(
    file_path: &Path,
    hash: &str,
    extension: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
    use windows::Win32::UI::WindowsAndMessaging::DestroyIcon;

    // 转换路径为宽字符
    let wide_path: Vec<u16> = file_path
        .to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    let mut shfi = SHFILEINFOW::default();

    // 使用 SHGetFileInfo 获取文件图标
    let result = unsafe {
        SHGetFileInfoW(
            PCWSTR(wide_path.as_ptr()),
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut shfi),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        )
    };

    if result == 0 || shfi.hIcon.is_invalid() {
        log_error(
            "URL图标-SHGetFileInfo失败",
            &file_path.to_string_lossy(),
            "result=0 或 hIcon 无效",
        );
        return Err("无法获取图标".into());
    }

    // 获取缓存目录
    let cache_dir = get_icon_cache_dir()?;
    let icon_file = cache_dir.join(format!("{}_{}.png", extension, hash));

    // 清理图标句柄
    unsafe {
        let _ = DestroyIcon(shfi.hIcon);
    }

    // 解析 .url 文件获取实际图标路径
    if let Some(icon_path) = parse_url_file_icon(file_path) {
        if icon_path.exists() {
            // 使用 getfileicon 从实际图标文件提取
            let icon_path_str = icon_path.to_string_lossy().to_string();
            match Image::try_new_from_file_recommended(&icon_path_str) {
                Ok(image) => {
                    // 先保存到临时文件（原始尺寸）
                    let temp_file = icon_file.with_extension("tmp.png");
                    match image.save_as_png(
                        image.width,
                        image.height,
                        temp_file.to_string_lossy().as_ref(),
                    ) {
                        Ok(_) => {
                            // 缩放并保存到最终路径
                            match resize_and_save_icon(&temp_file, &icon_file, 128) {
                                Ok(_) => {
                                    return Ok(icon_file.to_string_lossy().to_string());
                                }
                                Err(e) => {
                                    log_error(
                                        "URL图标-缩放保存失败",
                                        &file_path.to_string_lossy(),
                                        &e.to_string(),
                                    );
                                }
                            }
                        }
                        Err(e) => {
                            log_error(
                                "URL图标-PNG保存失败",
                                &file_path.to_string_lossy(),
                                &format!("{:?}", e),
                            );
                        }
                    }
                }
                Err(e) => {
                    log_error(
                        "URL图标-getfileicon提取失败",
                        &icon_path_str,
                        &format!("{:?}", e),
                    );
                }
            }
        }
    }

    Err("无法提取图标".into())
}

/// 从 .url 文件中读取图标路径
#[cfg(target_os = "windows")]
fn parse_url_file_icon(file_path: &Path) -> Option<PathBuf> {
    // 读取 .url 文件内容（INI 格式）
    let content = fs::read_to_string(file_path).ok()?;

    // 查找 IconFile= 行
    for line in content.lines() {
        let line = line.trim();
        if line.to_lowercase().starts_with("iconfile=") {
            let icon_path = line.split('=').nth(1)?.trim();

            // 处理环境变量
            let expanded_path = expand_env_vars(icon_path);

            let path_buf = PathBuf::from(&expanded_path);

            // 如果路径存在，返回
            if path_buf.exists() {
                return Some(path_buf);
            }
        }
    }

    None
}

/// 获取缓存的环境变量（首次调用时初始化）
#[cfg(target_os = "windows")]
fn get_cached_env_vars() -> &'static Vec<(String, String)> {
    static ENV_VARS: OnceLock<Vec<(String, String)>> = OnceLock::new();
    ENV_VARS.get_or_init(|| {
        use std::env;
        vec![
            (
                "%ProgramFiles(x86)%".to_string(),
                env::var("ProgramFiles(x86)")
                    .unwrap_or_else(|_| "C:\\Program Files (x86)".to_string()),
            ),
            (
                "%ProgramFiles%".to_string(),
                env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string()),
            ),
            (
                "%USERPROFILE%".to_string(),
                env::var("USERPROFILE").unwrap_or_default(),
            ),
            (
                "%APPDATA%".to_string(),
                env::var("APPDATA").unwrap_or_default(),
            ),
            (
                "%LOCALAPPDATA%".to_string(),
                env::var("LOCALAPPDATA").unwrap_or_default(),
            ),
            (
                "%SystemRoot%".to_string(),
                env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string()),
            ),
            (
                "%windir%".to_string(),
                env::var("windir").unwrap_or_else(|_| "C:\\Windows".to_string()),
            ),
        ]
    })
}

/// 展开环境变量
#[cfg(target_os = "windows")]
fn expand_env_vars(path: &str) -> String {
    let mut result = path.to_string();
    for (var, value) in get_cached_env_vars() {
        if !value.is_empty() {
            result = result.replace(var, value);
        }
    }
    result
}

/// 提取并缓存 Windows 系统图标
#[cfg(target_os = "windows")]
pub fn extract_and_cache_icon(file_path: &Path) -> Result<String, Box<dyn std::error::Error>> {
    let path_str = file_path.to_string_lossy().to_string();

    // 获取文件扩展名
    let extension = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // 如果有预设图标，返回空字符串让前端使用预设
    // 但 exe、lnk、url 需要提取真实图标
    if has_preset_icon(&extension) && extension != "lnk" && extension != "url" && extension != "exe"
    {
        return Ok(String::new());
    }

    // 计算路径哈希（用于缓存文件名）
    let hash = hash_path(&path_str);

    // 对于 .url 文件，使用 Windows Shell API 提取图标
    if extension == "url" {
        // 检查磁盘缓存
        let cache_dir = get_icon_cache_dir()?;
        let icon_file = cache_dir.join(format!("{}_{}.png", extension, hash));

        if icon_file.exists() {
            // 返回缓存文件路径
            return Ok(icon_file.to_string_lossy().to_string());
        }

        // 尝试使用 Shell API 提取 .url 文件的图标
        if let Ok(icon_path) = extract_url_icon_via_shell(file_path, &hash, &extension) {
            if !icon_path.is_empty() {
                return Ok(icon_path);
            }
        }
        // 如果失败，返回空字符串使用默认图标
        return Ok(String::new());
    }

    let actual_icon_path = file_path.to_path_buf();

    // 生成缓存文件路径（使用扩展名 + 哈希）
    let cache_dir = get_icon_cache_dir()?;
    let icon_file = cache_dir.join(format!("{}_{}.png", extension, hash));

    // 检查磁盘缓存
    if icon_file.exists() {
        // 返回缓存文件路径
        return Ok(icon_file.to_string_lossy().to_string());
    }

    // 使用 getfileicon 提取图标并保存为 PNG
    let actual_path_str = actual_icon_path.to_string_lossy().to_string();
    match Image::try_new_from_file_recommended(&actual_path_str) {
        Ok(image) => {
            // 先保存到临时文件（原始尺寸）
            let temp_file = icon_file.with_extension("tmp.png");
            if let Err(e) = image.save_as_png(
                image.width,
                image.height,
                temp_file.to_string_lossy().as_ref(),
            ) {
                log_error(
                    "图标提取-PNG保存失败",
                    &actual_path_str,
                    &format!("{:?}", e),
                );
                return Ok(String::new());
            }

            // 缩放并保存到最终路径
            if let Err(e) = resize_and_save_icon(&temp_file, &icon_file, 128) {
                log_error("图标提取-缩放保存失败", &actual_path_str, &e.to_string());
                return Ok(String::new());
            }

            // 返回缓存文件路径
            Ok(icon_file.to_string_lossy().to_string())
        }
        Err(e) => {
            log_error(
                "图标提取-getfileicon失败",
                &actual_path_str,
                &format!("{:?}", e),
            );
            Ok(String::new())
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn extract_and_cache_icon(_file_path: &Path) -> Result<String, Box<dyn std::error::Error>> {
    Ok(String::new())
}

/// 清除磁盘缓存
#[allow(dead_code)]
pub fn clear_disk_cache() -> Result<(), Box<dyn std::error::Error>> {
    let cache_dir = get_icon_cache_dir()?;
    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir)?;
        fs::create_dir_all(&cache_dir)?;
    }
    Ok(())
}
