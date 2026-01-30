use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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
    /// 自定义监控路径，None 表示使用桌面
    #[serde(default)]
    pub custom_path: Option<String>,
    #[serde(default = "default_debounce_ms")]
    pub debounce_ms: u64,
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
    /// 加载配置文件
    pub fn load(config_path: &PathBuf) -> Result<Self, String> {
        if !config_path.exists() {
            return Ok(Self::default());
        }

        let json = std::fs::read_to_string(config_path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;

        serde_json::from_str(&json).map_err(|e| format!("Failed to parse config file: {}", e))
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
