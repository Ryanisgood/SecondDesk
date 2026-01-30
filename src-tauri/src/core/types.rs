use serde::{Deserialize, Serialize};

/// 文件项数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    /// 文件名（显示用）
    pub file_name: String,
    /// 文件类型（扩展名或 "文件夹"）
    pub file_type: String,
    /// 原始文件名
    pub file: String,
    /// 完整路径
    pub file_path: String,
    /// 图标路径或 Base64 数据
    pub ico: String,
    /// 索引
    pub index: usize,
    /// 文件类型标识
    pub f_type: String,
    /// 是否收藏
    #[serde(rename = "isFavorite")]
    pub is_favorite: bool,
    /// 是否系统应用
    #[serde(rename = "sysApp")]
    pub sys_app: bool,
}

/// 应用配置
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    /// 主题：light, dark, zzz
    pub theme: String,
    /// 视图模式：block, list
    pub view: String,
    /// 是否全屏
    pub full_screen: bool,
    /// 窗口宽度
    pub width: u32,
    /// 窗口高度
    pub height: u32,
    /// 触发方式：1-4
    pub cf_type: String,
    /// 自定义快捷键
    pub cf_hotkey: String,
    /// 呼出位置：1-4
    pub out_pos: String,
    /// 是否使用背景图
    pub use_bg: bool,
    /// 磨砂效果开关
    pub blur_bg: bool,
    /// 磨砂强度（0-255）
    pub blur_effect: u8,
    /// 开机自启
    pub auto_start: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "light".to_string(),
            view: "block".to_string(),
            full_screen: false,
            width: 1000,
            height: 600,
            cf_type: "1".to_string(),
            cf_hotkey: "".to_string(),
            out_pos: "1".to_string(),
            use_bg: false,
            blur_bg: true,
            blur_effect: 30,
            auto_start: false,
        }
    }
}
