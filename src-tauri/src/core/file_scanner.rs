use crate::core::types::FileItem;
#[cfg(target_os = "windows")]
use crate::utils::known_folders;
use rayon::prelude::*;
use std::fs;
use std::path::{Path, PathBuf};

/// 文件扫描器
pub struct FileScanner {
    /// 桌面路径
    desktop_path: PathBuf,
    /// 公共桌面路径
    public_desktop_path: Option<PathBuf>,
}

impl FileScanner {
    /// 创建新的文件扫描器
    pub fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let desktop_path = Self::get_desktop_path()?;
        let public_desktop_path = Self::get_public_desktop_path().ok();

        Ok(Self {
            desktop_path,
            public_desktop_path,
        })
    }

    /// 获取用户桌面路径
    fn get_desktop_path() -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
        #[cfg(target_os = "windows")]
        {
            Ok(known_folders::user_desktop_path()?)
        }

        #[cfg(not(target_os = "windows"))]
        {
            Err("只支持 Windows 平台".into())
        }
    }

    /// 获取公共桌面路径
    fn get_public_desktop_path() -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
        #[cfg(target_os = "windows")]
        {
            Ok(known_folders::public_desktop_path()?)
        }

        #[cfg(not(target_os = "windows"))]
        {
            Err("只支持 Windows 平台".into())
        }
    }

    /// 异步扫描目录
    pub async fn scan_directory(
        &self,
        path: Option<&str>,
    ) -> Result<Vec<FileItem>, Box<dyn std::error::Error + Send + Sync>> {
        use std::path::Component;

        let scan_paths: Vec<PathBuf> = if let Some(p) = path {
            let requested = PathBuf::from(p);

            // 1. 检查父目录遍历（安全性）
            for component in requested.components() {
                if matches!(component, Component::ParentDir) {
                    return Err("不允许父目录访问".into());
                }
            }

            // 2. 规范化路径
            let canonical = requested.canonicalize().map_err(|_| "无效路径")?;

            // 3. 验证路径是目录
            if !canonical.is_dir() {
                return Err("路径不是有效目录".into());
            }

            // 4. 去除 \\?\ 前缀（Windows canonicalize 会添加此前缀，
            //    但 Windows Shell API 如 SHGetFileInfo 不支持它，导致图标提取失败）
            #[cfg(target_os = "windows")]
            let canonical = {
                let s = canonical.to_string_lossy();
                if let Some(stripped) = s.strip_prefix("\\\\?\\") {
                    PathBuf::from(stripped)
                } else {
                    canonical
                }
            };

            vec![canonical]
        } else {
            let mut roots = vec![self.desktop_path.clone()];
            if let Some(public) = self.public_desktop_path.as_ref() {
                if !roots.iter().any(|p| p == public) {
                    roots.push(public.clone());
                }
            }
            roots
        };

        // 直接在 spawn_blocking 中构建 Vec，避免 channel 丢数据
        // 快速扫描，不提取图标
        let items = tokio::task::spawn_blocking(move || Self::scan_paths_sync(&scan_paths))
            .await
            .map_err(|e| format!("扫描任务失败: {}", e))??;

        Ok(items)
    }

    /// 异步提取指定文件的图标
    pub async fn extract_icons(
        &self,
        file_paths: Vec<String>,
    ) -> Result<Vec<(String, String)>, Box<dyn std::error::Error + Send + Sync>> {
        use crate::utils::icon_extractor;

        let results = tokio::task::spawn_blocking(move || {
            use rayon::prelude::*;

            // 并行提取图标
            file_paths
                .par_iter()
                .filter_map(|path_str| {
                    let path = PathBuf::from(path_str);

                    #[cfg(target_os = "windows")]
                    {
                        match icon_extractor::extract_and_cache_icon(&path) {
                            Ok(ico) if !ico.is_empty() => Some((path_str.clone(), ico)),
                            _ => None,
                        }
                    }

                    #[cfg(not(target_os = "windows"))]
                    None
                })
                .collect::<Vec<_>>()
        })
        .await
        .map_err(|e| format!("图标提取任务失败: {}", e))?;

        Ok(results)
    }

    /// 同步扫描目录（在阻塞线程中运行）
    fn scan_directory_sync(
        path: &Path,
    ) -> Result<Vec<FileItem>, Box<dyn std::error::Error + Send + Sync>> {
        let entries: Vec<_> = fs::read_dir(path)?
            .filter_map(|e| match e {
                Ok(entry) => Some(entry),
                Err(err) => {
                    eprintln!("⚠️ 读取目录项失败: {:?}", err);
                    None
                }
            })
            .collect();

        // 使用 rayon 并行处理，直接返回 Vec（快速扫描，不提取图标）
        let items: Vec<FileItem> = entries
            .par_iter()
            .filter_map(|entry| {
                let path = entry.path();

                // 跳过 desktop.ini 等系统隐藏文件
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    let lower = name.to_lowercase();
                    if lower == "desktop.ini" {
                        return None;
                    }
                }

                match Self::process_entry(path.clone(), false) {
                    Ok(item) => Some(item),
                    Err(err) => {
                        eprintln!("⚠️ 处理文件失败: {} - 错误: {:?}", path.display(), err);
                        None
                    }
                }
            })
            .collect();

        Ok(items)
    }

    /// 扫描多个允许的根路径（桌面视图合并用户/公共桌面）
    fn scan_paths_sync(
        paths: &[PathBuf],
    ) -> Result<Vec<FileItem>, Box<dyn std::error::Error + Send + Sync>> {
        use std::collections::HashSet;

        let mut all: Vec<FileItem> = Vec::new();
        for p in paths {
            if !p.exists() {
                continue;
            }
            match Self::scan_directory_sync(p) {
                Ok(mut items) => all.append(&mut items),
                Err(err) => {
                    eprintln!("⚠️ 扫描目录失败: {} - 错误: {:?}", p.display(), err);
                }
            }
        }

        let mut seen = HashSet::<String>::new();
        all.retain(|item| seen.insert(item.file_path.clone()));

        all.sort_by(|a, b| {
            let an = a.file_name.to_lowercase();
            let bn = b.file_name.to_lowercase();
            an.cmp(&bn).then_with(|| a.file_path.cmp(&b.file_path))
        });

        Ok(all)
    }

    /// 处理单个文件/目录项
    fn process_entry(
        path: PathBuf,
        extract_icon: bool,
    ) -> Result<FileItem, Box<dyn std::error::Error + Send + Sync>> {
        let metadata = fs::metadata(&path)?;
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("未知")
            .to_string();

        let (file_type, f_type) = if metadata.is_dir() {
            ("文件夹".to_string(), "dir".to_string())
        } else {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            let f_type = Self::classify_file_type(&ext);
            (ext, f_type)
        };

        // 提取系统图标（仅在需要时提取）
        let ico = if extract_icon {
            #[cfg(target_os = "windows")]
            {
                use crate::utils::icon_extractor;
                icon_extractor::extract_and_cache_icon(&path).unwrap_or_default()
            }
            #[cfg(not(target_os = "windows"))]
            {
                String::new()
            }
        } else {
            String::new()
        };

        Ok(FileItem {
            file_name: file_name.clone(),
            file_type,
            file: file_name,
            file_path: path.to_string_lossy().to_string(),
            ico,      // 使用提取的图标
            index: 0, // 索引稍后设置
            f_type,
            is_favorite: false,
            sys_app: false,
        })
    }

    /// 分类文件类型
    fn classify_file_type(ext: &str) -> String {
        match ext {
            "exe" | "msi" => "exe",
            "lnk" => "shortcut",
            "url" | "website" | "appref-ms" => "shortcut",
            "txt" | "md" | "log" => "text",
            "doc" | "docx" => "word",
            "xls" | "xlsx" | "csv" => "excel",
            "ppt" | "pptx" => "powerpoint",
            "pdf" => "pdf",
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" => "image",
            "mp4" | "mkv" | "avi" | "mov" | "wmv" => "video",
            "mp3" | "wav" | "flac" | "m4a" | "aac" => "audio",
            "zip" | "rar" | "7z" | "tar" | "gz" => "archive",
            "py" | "js" | "ts" | "rs" | "go" | "java" | "c" | "cpp" | "h" => "code",
            "html" | "css" | "vue" | "jsx" | "tsx" => "web",
            "json" | "xml" | "yaml" | "toml" | "ini" => "config",
            _ => "file",
        }
        .to_string()
    }
}

impl Default for FileScanner {
    fn default() -> Self {
        Self::new().unwrap_or_else(|e| {
            eprintln!("错误：无法创建文件扫描器: {}", e);
            panic!("无法创建文件扫描器");
        })
    }
}
