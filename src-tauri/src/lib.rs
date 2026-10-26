mod commands;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_text_file,
            commands::write_text_file,
            commands::list_dir,
            commands::grant_asset_scope,
            watcher::watch_paths
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
