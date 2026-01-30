use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Runtime,
};

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // 创建托盘菜单
    let toggle_i = MenuItem::with_id(app, "toggle", "显示/隐藏", true, None::<&str>)?;
    let settings_i = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&toggle_i, &settings_i, &quit_i])?;

    // 创建托盘图标
    let tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false) // 左键不显示菜单
        .icon(app.default_window_icon().unwrap().clone())
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => {
                let _ = app.emit("drawer:toggle", ());
            }
            "settings" => {
                let _ = app.emit("drawer:open", ());
                let _ = app.emit("open-settings", ());
            }
            "quit" => {
                std::process::exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = app.emit("drawer:toggle", ());
            }
        })
        .build(app)?;

    // 保持托盘图标常驻（避免函数返回后被 drop）
    std::mem::forget(tray);

    Ok(())
}
