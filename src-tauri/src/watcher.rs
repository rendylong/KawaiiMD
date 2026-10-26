use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use notify_debouncer_mini::notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult};
use serde::Serialize;
use tauri::Emitter;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FsChange {
    pub path: String,
    pub kind: String,
    pub mtime: u128,
}

fn mtime_of(path: &std::path::Path) -> u128 {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

// notify-debouncer-mini 0.7 仅发 Any/AnyContinuous；以路径存在性区分 remove/modify，
// create 归并为 modify（自写回环由前端 mtime 比对抑制）。
pub fn start_watcher<F>(paths: Vec<PathBuf>, on_event: F) -> Result<(), String>
where
    F: Fn(String, String, u128) + Send + 'static,
{
    let mut debouncer = new_debouncer(Duration::from_millis(200), move |res: DebounceEventResult| {
        let Ok(events) = res else { return };
        for ev in events {
            let kind = if ev.path.exists() { "modify" } else { "remove" };
            on_event(
                ev.path.to_string_lossy().into_owned(),
                kind.to_string(),
                mtime_of(&ev.path),
            );
        }
    })
    .map_err(|e| e.to_string())?;

    for p in &paths {
        debouncer
            .watcher()
            .watch(p, RecursiveMode::NonRecursive)
            .map_err(|e| e.to_string())?;
    }
    std::mem::forget(debouncer);
    Ok(())
}

static WATCHED: Mutex<Option<HashSet<PathBuf>>> = Mutex::new(None);

#[tauri::command]
pub fn watch_paths(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    let fresh: Vec<PathBuf> = {
        let mut guard = WATCHED.lock().map_err(|e| e.to_string())?;
        let watched = guard.get_or_insert_with(HashSet::new);
        let fresh: Vec<PathBuf> = paths
            .iter()
            .map(PathBuf::from)
            .filter(|p| !watched.contains(p))
            .collect();
        for p in &fresh {
            watched.insert(p.clone());
        }
        fresh
    };
    if fresh.is_empty() {
        return Ok(());
    }
    let emitter = app.clone();
    start_watcher(fresh, move |path, kind, mtime| {
        let _ = emitter.emit("fs-change", FsChange { path, kind, mtime });
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn watcher_emits_modify_and_remove_with_mtime() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("t.md");
        std::fs::write(&file, "a").unwrap();

        let (tx, rx) = mpsc::channel::<FsChange>();
        let tx = Mutex::new(tx);
        start_watcher(vec![dir.path().to_path_buf()], move |path, kind, mtime| {
            tx.lock().unwrap().send(FsChange { path, kind, mtime }).unwrap();
        })
        .unwrap();

        std::thread::sleep(Duration::from_millis(300));
        std::fs::write(&file, "b").unwrap();
        let ev = rx.recv_timeout(Duration::from_secs(2)).expect("modify event");
        assert_eq!(ev.kind, "modify");
        assert!(ev.path.ends_with("t.md"), "path: {}", ev.path);
        assert!(ev.mtime > 0);

        std::thread::sleep(Duration::from_millis(300));
        std::fs::remove_file(&file).unwrap();
        let ev2 = rx.recv_timeout(Duration::from_secs(2)).expect("remove event");
        assert_eq!(ev2.kind, "remove");
    }
}
