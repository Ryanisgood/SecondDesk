use crate::config::{DrawerConfig, DrawerSide};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::{sleep, Duration};

#[cfg(target_os = "windows")]
use windows::Win32::{
    Foundation::{POINT, RECT},
    Graphics::Gdi::{GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    UI::WindowsAndMessaging::{
        GetClassNameW, GetCursorPos, GetDesktopWindow, GetForegroundWindow, GetShellWindow,
        GetWindowLongW, GetWindowRect, GWL_STYLE, WS_CAPTION, WS_THICKFRAME,
    },
};

pub struct EdgeDetector {
    enabled: Arc<AtomicBool>,
    config: Arc<tokio::sync::RwLock<DrawerConfig>>,
    app_handle: AppHandle,
}

impl EdgeDetector {
    pub fn new(app_handle: AppHandle, config: DrawerConfig) -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(config.edge_trigger.enabled)),
            config: Arc::new(tokio::sync::RwLock::new(config)),
            app_handle,
        }
    }

    /// 启用边缘检测
    #[allow(dead_code)]
    pub fn enable(&self) {
        self.enabled.store(true, Ordering::Relaxed);
    }

    /// 禁用边缘检测
    #[allow(dead_code)]
    pub fn disable(&self) {
        self.enabled.store(false, Ordering::Relaxed);
    }

    /// 更新配置
    pub async fn update_config(&self, config: DrawerConfig) {
        let mut cfg = self.config.write().await;
        *cfg = config.clone();
        self.enabled
            .store(config.edge_trigger.enabled, Ordering::Relaxed);
    }

    /// 开始监控边缘
    pub async fn start_monitoring(self: Arc<Self>) {
        loop {
            // 如果未启用，等待后继续
            if !self.enabled.load(Ordering::Relaxed) {
                sleep(Duration::from_millis(100)).await;
                continue;
            }

            // 检查窗口是否已显示
            if let Some(window) = self.app_handle.get_webview_window("main") {
                if let Ok(visible) = window.is_visible() {
                    if visible {
                        // 窗口显示时暂停边缘检测
                        sleep(Duration::from_millis(100)).await;
                        continue;
                    }
                }
            }

            // 检查是否在全屏应用中（可配置）
            let disable_in_fullscreen = {
                let config = self.config.read().await;
                config.behavior.disable_in_fullscreen
            };

            if disable_in_fullscreen && self.is_fullscreen_app() {
                sleep(Duration::from_millis(100)).await;
                continue;
            }

            // 获取鼠标位置
            if let Some(pos) = self.get_cursor_position() {
                let config = self.config.read().await;

                // 检查是否在边缘
                if self.is_at_edge(pos, &config) {
                    let delay_ms = config.edge_trigger.delay_ms;
                    drop(config); // 释放读锁

                    // 等待延迟时间
                    sleep(Duration::from_millis(delay_ms)).await;

                    // 再次检查是否仍在边缘
                    if let Some(pos2) = self.get_cursor_position() {
                        let config = self.config.read().await;
                        if self.is_at_edge(pos2, &config) {
                            // 触发 OPEN 状态：优先后端直接显示窗口，避免前端 event loop 忙时边缘触发“失效”
                            if let Some(window) = self.app_handle.get_webview_window("main") {
                                if let Ok(true) = window.is_minimized() {
                                    let _ = window.unminimize();
                                }
                                let _ = window.show();
                                let _ = window.set_always_on_top(true);
                                let _ = window.set_focus();
                            }

                            // 同步通知前端更新状态/处理保护期等逻辑
                            let _ = self.app_handle.emit("drawer:open", ());
                        }
                    }
                }
            }

            // 20 FPS 检测频率
            sleep(Duration::from_millis(50)).await;
        }
    }

    /// 获取鼠标位置
    #[cfg(target_os = "windows")]
    fn get_cursor_position(&self) -> Option<POINT> {
        unsafe {
            let mut point = POINT::default();
            if GetCursorPos(&mut point).is_ok() {
                Some(point)
            } else {
                None
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn get_cursor_position(&self) -> Option<(i32, i32)> {
        None
    }

    /// 判断是否在边缘（只有中间 60% 区域触发）
    #[cfg(target_os = "windows")]
    fn is_at_edge(&self, pos: POINT, config: &DrawerConfig) -> bool {
        unsafe {
            // 获取鼠标所在显示器
            let monitor = MonitorFromPoint(pos, MONITOR_DEFAULTTONEAREST);

            let mut monitor_info = MONITORINFO {
                cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                ..Default::default()
            };

            if !GetMonitorInfoW(monitor, &mut monitor_info).as_bool() {
                return false;
            }

            let rect = monitor_info.rcMonitor;
            let trigger_width = config.edge_trigger.trigger_width as i32;

            // 计算屏幕尺寸
            let screen_width = rect.right - rect.left;
            let screen_height = rect.bottom - rect.top;

            // 计算中间 60% 的触发区域（两端各留 20%）
            let margin_ratio = 0.2;

            match config.edge_trigger.side {
                DrawerSide::Right | DrawerSide::Left => {
                    // 左右边缘：检查 y 坐标是否在中间 60% 区域
                    let margin = (screen_height as f64 * margin_ratio) as i32;
                    let y_min = rect.top + margin;
                    let y_max = rect.bottom - margin;

                    if pos.y < y_min || pos.y > y_max {
                        return false;
                    }

                    match config.edge_trigger.side {
                        DrawerSide::Right => pos.x >= rect.right - trigger_width,
                        DrawerSide::Left => pos.x <= rect.left + trigger_width,
                        _ => false,
                    }
                }
                DrawerSide::Top | DrawerSide::Bottom => {
                    // 上下边缘：检查 x 坐标是否在中间 60% 区域
                    let margin = (screen_width as f64 * margin_ratio) as i32;
                    let x_min = rect.left + margin;
                    let x_max = rect.right - margin;

                    if pos.x < x_min || pos.x > x_max {
                        return false;
                    }

                    match config.edge_trigger.side {
                        DrawerSide::Top => pos.y <= rect.top + trigger_width,
                        DrawerSide::Bottom => pos.y >= rect.bottom - trigger_width,
                        _ => false,
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn is_at_edge(&self, _pos: (i32, i32), _config: &DrawerConfig) -> bool {
        false
    }

    /// 检测是否有全屏应用
    #[cfg(target_os = "windows")]
    fn is_fullscreen_app(&self) -> bool {
        unsafe {
            // 获取前台窗口
            let foreground = GetForegroundWindow();
            if foreground.0.is_null() {
                return false;
            }

            // 桌面/壳窗口不应被当作“全屏应用”，否则在桌面操作（例如拖入新文件）时会导致边缘触发被禁用
            if foreground == GetShellWindow() || foreground == GetDesktopWindow() {
                return false;
            }

            // 通过窗口类名过滤常见的桌面相关窗口
            let mut class_buf = [0u16; 256];
            let class_len = GetClassNameW(foreground, &mut class_buf) as usize;
            if class_len > 0 {
                let class_name = String::from_utf16_lossy(&class_buf[..class_len]);
                let is_desktop_class = matches!(
                    class_name.as_str(),
                    "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
                );
                if is_desktop_class {
                    return false;
                }
            }

            // 获取窗口矩形
            let mut window_rect = RECT::default();
            if GetWindowRect(foreground, &mut window_rect).is_err() {
                return false;
            }

            // 避免把"最大化普通窗口 + 自动隐藏任务栏"等场景误判为全屏
            let style = GetWindowLongW(foreground, GWL_STYLE) as u32;
            let has_window_chrome = (style & WS_CAPTION.0) != 0 || (style & WS_THICKFRAME.0) != 0;
            if has_window_chrome {
                return false;
            }

            // 获取窗口所在显示器的完整屏幕区域（不是工作区）
            let monitor = MonitorFromPoint(
                POINT {
                    x: window_rect.left,
                    y: window_rect.top,
                },
                MONITOR_DEFAULTTONEAREST,
            );

            let mut monitor_info = MONITORINFO {
                cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                ..Default::default()
            };

            if !GetMonitorInfoW(monitor, &mut monitor_info).as_bool() {
                return false;
            }

            // 使用显示器的完整区域（rcMonitor），而不是工作区（rcWork）
            let screen_rect = monitor_info.rcMonitor;

            // 判断是否真正全屏：窗口覆盖整个屏幕（包括任务栏区域）
            // 最大化窗口不会覆盖任务栏，所以不会被判定为全屏
            window_rect.left <= screen_rect.left
                && window_rect.top <= screen_rect.top
                && window_rect.right >= screen_rect.right
                && window_rect.bottom >= screen_rect.bottom
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn is_fullscreen_app(&self) -> bool {
        false
    }
}
