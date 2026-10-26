mod commands;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = argv.iter().nth(1) {
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
            watcher::watch_paths
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // macOS Finder 双击文档经 Apple Event（odoc）送达，不写 argv；
    // Tauri 将其转为 RunEvent::Opened。
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Opened { urls } = event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    let _ = tauri::Emitter::emit(
                        app_handle,
                        "open-file",
                        serde_json::json!({ "path": path.to_string_lossy() }),
                    );
                }
            }
        }
    });
}
