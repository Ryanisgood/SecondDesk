use std::sync::Mutex;

use tauri::AppHandle;
use tauri::Emitter;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::config::HotkeyConfig;

#[derive(Default)]
pub struct HotkeyManager {
    current_keys: Mutex<Option<String>>,
}

impl HotkeyManager {
    pub fn apply(&self, app: &AppHandle, config: &HotkeyConfig) -> Result<(), String> {
        // Unregister previous shortcut (if any).
        if let Some(prev) = self.current_keys.lock().unwrap().take() {
            match prev.parse::<Shortcut>() {
                Ok(shortcut) => {
                    let _ = app.global_shortcut().unregister(shortcut);
                }
                Err(_) => {
                    let _ = app.global_shortcut().unregister_all();
                }
            }
        }

        if !config.enabled {
            return Ok(());
        }

        let shortcut = config
            .keys
            .parse::<Shortcut>()
            .map_err(|_| format!("无效的快捷键: {}", config.keys))?;

        app.global_shortcut()
            .on_shortcut(shortcut, move |app, _shortcut, event| {
                // 只在按键按下时触发, 避免按下和释放都触发导致窗口闪烁
                if event.state == ShortcutState::Pressed {
                    let _ = app.emit("drawer:toggle", ());
                }
            })
            .map_err(|e| e.to_string())?;

        *self.current_keys.lock().unwrap() = Some(config.keys.clone());
        Ok(())
    }
}
