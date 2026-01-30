use std::path::PathBuf;

#[cfg(target_os = "windows")]
fn sh_get_known_folder_path(folder_id: &windows::core::GUID) -> Result<PathBuf, String> {
    use std::ffi::c_void;
    use windows::Win32::System::Com::CoTaskMemFree;
    use windows::Win32::UI::Shell::{SHGetKnownFolderPath, KF_FLAG_DEFAULT};

    let raw = unsafe {
        SHGetKnownFolderPath(folder_id, KF_FLAG_DEFAULT, None)
            .map_err(|e| format!("SHGetKnownFolderPath failed: {}", e))?
    };

    let s = unsafe { raw.to_string() }.map_err(|e| format!("Invalid known folder path: {}", e))?;
    unsafe {
        CoTaskMemFree(Some(raw.0 as *const c_void));
    }
    Ok(PathBuf::from(s))
}

pub fn user_desktop_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::Shell::FOLDERID_Desktop;
        if let Ok(p) = sh_get_known_folder_path(&FOLDERID_Desktop) {
            return Ok(p);
        }

        let home =
            std::env::var("USERPROFILE").map_err(|_| "Unable to get USERPROFILE".to_string())?;
        Ok(PathBuf::from(home).join("Desktop"))
    }

    #[cfg(not(target_os = "windows"))]
    Err("Windows only".to_string())
}

pub fn public_desktop_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::Shell::FOLDERID_PublicDesktop;
        if let Ok(p) = sh_get_known_folder_path(&FOLDERID_PublicDesktop) {
            return Ok(p);
        }

        let public = std::env::var("PUBLIC").map_err(|_| "Unable to get PUBLIC".to_string())?;
        Ok(PathBuf::from(public).join("Desktop"))
    }

    #[cfg(not(target_os = "windows"))]
    Err("Windows only".to_string())
}

#[allow(dead_code)]
pub fn desktop_roots() -> Vec<PathBuf> {
    let mut roots = Vec::<PathBuf>::new();

    if let Ok(p) = user_desktop_path() {
        roots.push(p);
    }
    if let Ok(p) = public_desktop_path() {
        if !roots.iter().any(|r| r == &p) {
            roots.push(p);
        }
    }

    roots
}

/// 获取通用的已知文件夹路径
/// 支持的文件夹名称：
/// - Desktop: 桌面
/// - Downloads: 下载
/// - Documents: 文档
/// - Pictures: 图片
/// - Music: 音乐
/// - Videos: 视频
/// - UserProfile: 用户主文件夹
#[allow(dead_code)]
pub fn get_known_folder(folder_name: &str) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::Shell::{
            FOLDERID_Desktop, FOLDERID_Downloads, FOLDERID_Documents,
            FOLDERID_Pictures, FOLDERID_Music, FOLDERID_Videos, FOLDERID_Profile,
        };

        let folder_id = match folder_name {
            "Desktop" => &FOLDERID_Desktop,
            "Downloads" => &FOLDERID_Downloads,
            "Documents" => &FOLDERID_Documents,
            "Pictures" => &FOLDERID_Pictures,
            "Music" => &FOLDERID_Music,
            "Videos" => &FOLDERID_Videos,
            "UserProfile" => &FOLDERID_Profile,
            _ => return Err(format!("不支持的文件夹名称: {}", folder_name)),
        };

        sh_get_known_folder_path(folder_id)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = folder_name;
        Err("只支持 Windows 平台".to_string())
    }
}
