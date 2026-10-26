use std::fs;
use std::path::Path;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
}

fn err_desc(e: &std::io::Error) -> &'static str {
    match e.kind() {
        std::io::ErrorKind::NotFound => "不存在",
        std::io::ErrorKind::PermissionDenied => "无权限",
        std::io::ErrorKind::InvalidData => "非 UTF-8",
        _ => "IO 错误",
    }
}

pub fn read_text_impl(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("读取失败({}): {}", err_desc(&e), path.display()))
}

pub fn write_text_impl(path: &Path, contents: &str) -> Result<(), String> {
    fs::write(path, contents).map_err(|e| format!("写入失败({}): {}", err_desc(&e), path.display()))
}

pub fn list_dir_impl(path: &Path) -> Result<Vec<DirEntry>, String> {
    let entries = fs::read_dir(path).map_err(|e| format!("列出失败({}): {}", err_desc(&e), path.display()))?;
    let mut out = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("列出失败({}): {}", err_desc(&e), path.display()))?;
        out.push(DirEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            is_dir: entry.file_type().map(|t| t.is_dir()).unwrap_or(false),
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    read_text_impl(Path::new(&path))
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    write_text_impl(Path::new(&path), &contents)
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    list_dir_impl(Path::new(&path))
}

#[tauri::command]
pub fn grant_asset_scope(app: tauri::AppHandle, dir: String) -> Result<(), String> {
    use tauri::Manager;
    app.asset_protocol_scope()
        .allow_directory(&dir, true)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_text_happy_path() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("a.md");
        fs::write(&f, "# 你好\n").unwrap();
        assert_eq!(read_text_impl(&f).unwrap(), "# 你好\n");
    }

    #[test]
    fn read_text_invalid_utf8_error_contains_path() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("bad.md");
        fs::write(&f, [0xFF, 0xFE, 0x00, 0x41]).unwrap();
        let err = read_text_impl(&f).unwrap_err();
        assert!(err.contains("非 UTF-8"), "err: {err}");
        assert!(err.contains(f.to_str().unwrap()), "err: {err}");
    }

    #[test]
    fn read_text_missing_error_contains_path() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("none.md");
        let err = read_text_impl(&f).unwrap_err();
        assert!(err.contains("不存在"), "err: {err}");
        assert!(err.contains(f.to_str().unwrap()), "err: {err}");
    }

    #[test]
    fn write_text_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("w.md");
        write_text_impl(&f, "abc 中文").unwrap();
        assert_eq!(fs::read_to_string(&f).unwrap(), "abc 中文");
    }

    #[test]
    fn list_dir_returns_entries_with_dir_flag() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "x").unwrap();
        fs::write(dir.path().join("b.txt"), "x").unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();
        let mut entries = list_dir_impl(dir.path()).unwrap();
        entries.sort_by(|a, b| a.name.cmp(&b.name));
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].name, "a.md");
        assert!(!entries[0].is_dir);
        assert_eq!(entries[2].name, "sub");
        assert!(entries[2].is_dir);
    }
}
