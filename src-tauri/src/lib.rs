use std::path::PathBuf;

use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;

fn document_path(argument: &str) -> Option<String> {
    let path = PathBuf::from(argument);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase);
    if path.is_file()
        && matches!(
            extension.as_deref(),
            Some("md" | "markdown" | "mdown" | "txt")
        )
    {
        let absolute = std::path::absolute(&path).unwrap_or(path);
        Some(absolute.to_string_lossy().into_owned())
    } else {
        None
    }
}

fn document_argument(arguments: impl IntoIterator<Item = String>) -> Option<String> {
    arguments
        .into_iter()
        .find_map(|argument| document_path(&argument))
}

/// The file passed on the command line when the app was launched. Desktop
/// entries call `housemd %F`, and a terminal launch can pass a path directly.
#[tauri::command]
fn launch_file() -> Option<String> {
    document_argument(std::env::args().skip(1))
}

/// Allow the document's folder for file access and preview assets. The open
/// dialog only grants access to the chosen file, and dropped files grant none.
#[tauri::command]
fn allow_document_dir(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_directory(&path, true)
        .map_err(|error| error.to_string())?;
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // This must be the first plugin so a second launch hands its file to
        // the existing window instead of opening another copy of the app.
        .plugin(tauri_plugin_single_instance::init(
            |app, arguments, _directory| {
                let Some(window) = app.get_webview_window("main") else {
                    return;
                };
                let _ = window.set_focus();
                if let Some(path) = document_argument(arguments.into_iter().skip(1)) {
                    let _ = window.emit("open-file", path);
                }
            },
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![allow_document_dir, launch_file])
        .run(tauri::generate_context!())
        .expect("error while running HouseMD");
}
