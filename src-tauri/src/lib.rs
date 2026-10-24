use std::path::PathBuf;
use std::process::Command;

use serde::Serialize;
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
            Some("md" | "markdown" | "mdown" | "txt" | "tex" | "latex" | "bib" | "sty" | "cls")
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

fn latex_compiler_name() -> Option<&'static str> {
    ["pdflatex", "xelatex", "lualatex"]
        .into_iter()
        .find(|candidate| {
            Command::new(candidate)
                .arg("--version")
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
        })
}

fn tail(text: &str, limit: usize) -> String {
    let mut chars: Vec<char> = text.chars().rev().take(limit).collect();
    chars.reverse();
    chars.into_iter().collect()
}

#[derive(Serialize)]
struct LatexBuild {
    pdf: String,
    log: String,
    compiler: String,
}

/// Compile a `.tex`/`.latex` document into a temporary PDF. The compiler runs
/// in the document's folder so relative includes and images resolve, with
/// shell escape disabled. The PDF is returned for opening in the system viewer.
#[tauri::command]
fn compile_latex(path: String) -> Result<LatexBuild, String> {
    let source = PathBuf::from(&path);
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if !matches!(extension.as_str(), "tex" | "latex") {
        return Err("This file is not a LaTeX document.".to_string());
    }
    if !source.is_file() {
        return Err("The LaTeX document could not be found.".to_string());
    }
    let compiler = latex_compiler_name().ok_or_else(|| {
        "No LaTeX compiler found. Install TeX Live (pdflatex, xelatex, or lualatex) and try again."
            .to_string()
    })?;
    let parent = source
        .parent()
        .ok_or_else(|| "Could not resolve the document folder.".to_string())?;
    let file_name = source
        .file_name()
        .ok_or_else(|| "Could not resolve the document name.".to_string())?;
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("document");
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let output_dir = std::env::temp_dir()
        .join("housemd-latex")
        .join(format!("{}-{stamp}-{stem}", std::process::id()));
    std::fs::create_dir_all(&output_dir)
        .map_err(|error| format!("Could not create the LaTeX output folder: {error}"))?;

    let mut log = String::new();
    for pass in 1..=2 {
        let output = Command::new(compiler)
            .current_dir(parent)
            .arg("-interaction=nonstopmode")
            .arg("-halt-on-error")
            .arg("-no-shell-escape")
            .arg("-output-directory")
            .arg(&output_dir)
            .arg(file_name)
            .output()
            .map_err(|error| format!("Could not run {compiler}: {error}"))?;
        log.push_str(&format!("--- pass {pass} ---\n"));
        log.push_str(&String::from_utf8_lossy(&output.stdout));
        log.push_str(&String::from_utf8_lossy(&output.stderr));
        if !output.status.success() {
            return Err(format!(
                "{compiler} exited with status {}.\n\n{}",
                output.status,
                tail(&log, 6000)
            ));
        }
    }

    let pdf = output_dir.join(stem).with_extension("pdf");
    if !pdf.is_file() {
        return Err(format!(
            "The compiler did not produce a PDF.\n\n{}",
            tail(&log, 6000)
        ));
    }
    Ok(LatexBuild {
        pdf: pdf.to_string_lossy().into_owned(),
        log: tail(&log, 6000),
        compiler: compiler.to_string(),
    })
}

#[tauri::command]
fn latex_compiler() -> Option<String> {
    latex_compiler_name().map(str::to_string)
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
        .invoke_handler(tauri::generate_handler![
            allow_document_dir,
            launch_file,
            latex_compiler,
            compile_latex
        ])
        .run(tauri::generate_context!())
        .expect("error while running HouseMD");
}
