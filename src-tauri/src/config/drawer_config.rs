use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 监控路径条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchPathEntry {
    /// 唯一标识，桌面为 "__desktop__"，自定义为 "wp_" + timestamp
    pub id: String,
    /// 文件系统路径
    pub path: String,
    /// 是否启用
    pub enabled: bool,
    /// 显示名称（None 则用文件夹名）
    pub label: Option<String>,
    /// 是否内置路径（桌面），内置路径不可删除
    #[serde(default)]
    pub builtin: bool,
}

/// 最大自定义监控文件夹数量（不含桌面）
pub const MAX_CUSTOM_WATCH_PATHS: usize = 3;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawerConfig {
    pub edge_trigger: EdgeTriggerConfig,
    pub hotkey: HotkeyConfig,
    pub gesture: GestureConfig,
    pub animation: AnimationConfig,
    pub behavior: BehaviorConfig,
    #[serde(default)]
    pub file_watcher: FileWatcherConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EdgeTriggerConfig {
    pub enabled: bool,
    pub side: DrawerSide,
    pub delay_ms: u64,
    pub peek_size: u32,
    pub trigger_width: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DrawerSide {
    Left,
    Right,
    Top,
    Bottom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyConfig {
    pub enabled: bool,
    pub keys: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GestureConfig {
    pub enabled: bool,
    pub button: MouseButton,
    pub threshold: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MouseButton {
    Left,
    Right,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimationConfig {
    pub duration: u32,
    pub easing: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorConfig {
    #[serde(default)]
    pub hide_on_mouse_leave: bool,
    #[serde(default = "default_true")]
    pub hide_on_focus_lost: bool,
    #[serde(default = "default_true")]
    pub hide_on_open: bool,
    #[serde(default = "default_true")]
    pub disable_in_fullscreen: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileWatcherConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 旧字段：自定义监控路径（仅反序列化兼容，不再序列化）
    #[serde(default, skip_serializing)]
    pub custom_path: Option<String>,
    #[serde(default = "default_debounce_ms")]
    pub debounce_ms: u64,
    /// 多文件夹监控路径列表
    #[serde(default)]
    pub watch_paths: Vec<WatchPathEntry>,
}

fn default_debounce_ms() -> u64 {
    500
}

impl Default for FileWatcherConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            custom_path: None,
            debounce_ms: 500,
            watch_paths: vec![],
        }
    }
}

fn default_true() -> bool {
    true
}

impl Default for DrawerConfig {
    fn default() -> Self {
        Self {
            edge_trigger: EdgeTriggerConfig {
                enabled: true,
                side: DrawerSide::Right,
                delay_ms: 300,
                peek_size: 100,
                trigger_width: 2,
            },
            hotkey: HotkeyConfig {
                enabled: true,
                keys: "Alt+Space".to_string(),
            },
            gesture: GestureConfig {
                enabled: false,
                button: MouseButton::Right,
                threshold: 30,
            },
            animation: AnimationConfig {
                duration: 250,
                easing: "ease-out".to_string(),
            },
            behavior: BehaviorConfig {
                hide_on_mouse_leave: false,
                hide_on_focus_lost: true,
                hide_on_open: true,
                disable_in_fullscreen: true,
            },
            file_watcher: FileWatcherConfig::default(),
        }
    }
}

impl DrawerConfig {
    /// 加载配置文件（含旧 custom_path → watch_paths 迁移 + 桌面条目保障）
    pub fn load(config_path: &PathBuf) -> Result<Self, String> {
        if !config_path.exists() {
            let mut config = Self::default();
            // 新安装：自动添加桌面内置条目
            Self::ensure_desktop_entry(&mut config);
            let _ = config.save(config_path);
            return Ok(config);
        }

        let json = std::fs::read_to_string(config_path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        let mut config: Self = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse config file: {}", e))?;

        let mut changed = false;

        // 迁移：将旧 custom_path 转换为 watch_paths 条目
        if let Some(ref custom_path) = config.file_watcher.custom_path {
            if !config
                .file_watcher
                .watch_paths
                .iter()
                .any(|wp| wp.path == *custom_path)
            {
                let entry = WatchPathEntry {
                    id: format!(
                        "wp_{}",
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis()
                    ),
                    path: custom_path.clone(),
                    enabled: true,
                    label: None,
                    builtin: false,
                };
                config.file_watcher.watch_paths.push(entry);
            }
            config.file_watcher.custom_path = None;
            changed = true;
        }

        // 保障：确保桌面内置条目始终存在
        if Self::ensure_desktop_entry(&mut config) {
            changed = true;
        }

        if changed {
            let _ = config.save(config_path);
        }

        Ok(config)
    }

    /// 确保配置中包含桌面内置条目，返回是否有变更
    fn ensure_desktop_entry(config: &mut Self) -> bool {
        let has_desktop = config.file_watcher.watch_paths.iter().any(|wp| wp.builtin);
        if has_desktop {
            return false;
        }

        // 获取桌面路径
        let desktop_path = {
            #[cfg(target_os = "windows")]
            {
                crate::utils::known_folders::user_desktop_path().unwrap_or_default()
            }
            #[cfg(not(target_os = "windows"))]
            {
                std::path::PathBuf::new()
            }
        };

        let entry = WatchPathEntry {
            id: "__desktop__".to_string(),
            path: desktop_path.to_string_lossy().to_string(),
            enabled: true,
            label: None,
            builtin: true,
        };

        // 插入到列表最前面
        config.file_watcher.watch_paths.insert(0, entry);
        true
    }

    /// 保存配置文件
    pub fn save(&self, config_path: &PathBuf) -> Result<(), String> {
        // 确保配置目录存在
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        std::fs::write(config_path, json).map_err(|e| format!("Failed to write config file: {}", e))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DrawerState {
    Hidden,
    Open,
}
