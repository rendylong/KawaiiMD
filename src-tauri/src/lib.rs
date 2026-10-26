mod commands;
mod watcher;

use std::sync::Mutex;

// 冷启动时 RunEvent::Opened 先于前端事件监听器注册到达，暂存最近一次待打开路径。
static PENDING_OPEN: Mutex<Option<String>> = Mutex::new(None);

fn set_pending_open(path: String) {
    if let Ok(mut guard) = PENDING_OPEN.lock() {
        *guard = Some(path);
    }
}

#[tauri::command]
fn take_pending_open_file() -> Option<String> {
    PENDING_OPEN.lock().ok().and_then(|mut g| g.take())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = argv.iter().nth(1) {
                set_pending_open(path.clone());
                let _ = tauri::Emitter::emit(app, "open-file", serde_json::json!({ "path": path }));
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_text_file,
            commands::write_text_file,
            commands::list_dir,
            commands::grant_asset_scope,
            watcher::watch_paths,
            take_pending_open_file
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // macOS Finder 双击文档经 Apple Event（odoc）送达，不写 argv；
    // Tauri 将其转为 RunEvent::Opened。
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Opened { urls } = event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    let path = path.to_string_lossy().into_owned();
                    set_pending_open(path.clone());
                    let _ = tauri::Emitter::emit(app_handle, "open-file", serde_json::json!({ "path": path }));
                }
            }
        }
    });
}
