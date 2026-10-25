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

fn latex_engine_names() -> Vec<&'static str> {
    ["pdflatex", "xelatex", "lualatex"]
        .into_iter()
        .filter(|candidate| {
            Command::new(candidate)
                .arg("--version")
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
        })
        .collect()
}

fn tool_available(tool: &str) -> bool {
    Command::new(tool)
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn cache_dir() -> PathBuf {
    if let Some(path) = std::env::var_os("XDG_CACHE_HOME") {
        return PathBuf::from(path);
    }
    if let Some(home) = std::env::var_os("HOME") {
        return PathBuf::from(home).join(".cache");
    }
    std::env::temp_dir()
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

fn run_tool(
    program: &str,
    arguments: &[String],
    directory: &std::path::Path,
    environment: &[(&str, String)],
    log: &mut String,
    label: &str,
) -> Result<(), String> {
    let output = Command::new(program)
        .current_dir(directory)
        .envs(
            environment
                .iter()
                .map(|(key, value)| (*key, value.as_str())),
        )
        .args(arguments)
        .output()
        .map_err(|error| format!("Could not run {program}: {error}"))?;
    log.push_str(&format!("--- {label} ---\n"));
    log.push_str(&String::from_utf8_lossy(&output.stdout));
    log.push_str(&String::from_utf8_lossy(&output.stderr));
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "{program} exited with status {}.\n\n{}",
            output.status,
            tail(log, 6000)
        ))
    }
}

/// Compile a LaTeX document into an in-app preview PDF. The compiler runs in
/// the document folder so relative includes, images and bibliography resolve;
/// shell escape is disabled. Output goes to the app cache under $HOME so the
/// PDF can be read by the preview and survives long enough to be opened.
#[tauri::command]
fn compile_latex(path: String, engine: Option<String>) -> Result<LatexBuild, String> {
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
    let engines = latex_engine_names();
    if engines.is_empty() {
        return Err(
            "No LaTeX compiler found. Install TeX Live (pdflatex, xelatex, or lualatex) and try again."
                .to_string(),
        );
    }
    let compiler = engine
        .filter(|candidate| engines.contains(&candidate.as_str()))
        .unwrap_or_else(|| engines[0].to_string());
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
    let output_dir = cache_dir()
        .join("housemd")
        .join("latex")
        .join(format!("{}-{stamp}-{stem}", std::process::id()));
    std::fs::create_dir_all(&output_dir)
        .map_err(|error| format!("Could not create the LaTeX output folder: {error}"))?;

    let engine_args = || {
        vec![
            "-interaction=nonstopmode".to_string(),
            "-halt-on-error".to_string(),
            "-no-shell-escape".to_string(),
            "-output-directory".to_string(),
            output_dir.to_string_lossy().into_owned(),
            file_name.to_string_lossy().into_owned(),
        ]
    };
    let mut log = String::new();

    run_tool(&compiler, &engine_args(), parent, &[], &mut log, "pass 1")?;

    // Bibliography and index passes. BibTeX/Biber only run when the first pass
    // produced the corresponding auxiliary files.
    let aux = output_dir.join(format!("{stem}.aux"));
    let bcf = output_dir.join(format!("{stem}.bcf"));
    let idx = output_dir.join(format!("{stem}.idx"));
    let bib_paths = format!(
        "{}{}",
        parent.display(),
        if cfg!(windows) { ";" } else { ":" }
    );
    let bib_environment = [("BIBINPUTS", bib_paths)];
    if bcf.is_file() {
        if !tool_available("biber") {
            return Err(
                "This document uses biblatex/Biber, but biber is not installed.\n\nInstall biber and try again."
                    .to_string(),
            );
        }
        run_tool(
            "biber",
            &[stem.to_string()],
            &output_dir,
            &bib_environment,
            &mut log,
            "biber",
        )?;
    } else if aux.is_file() {
        let aux_text = std::fs::read_to_string(&aux).unwrap_or_default();
        if aux_text.contains("\\bibdata") || aux_text.contains("\\citation") {
            if !tool_available("bibtex") {
                return Err(
                    "This document uses BibTeX, but bibtex is not installed.\n\nInstall TeX Live with BibTeX and try again."
                        .to_string(),
                );
            }
            run_tool(
                "bibtex",
                &[format!("{stem}.aux")],
                &output_dir,
                &bib_environment,
                &mut log,
                "bibtex",
            )?;
        }
    }
    if idx.is_file() && tool_available("makeindex") {
        run_tool(
            "makeindex",
            &[format!("{stem}.idx")],
            &output_dir,
            &[],
            &mut log,
            "makeindex",
        )?;
    }

    run_tool(&compiler, &engine_args(), parent, &[], &mut log, "pass 2")?;
    run_tool(&compiler, &engine_args(), parent, &[], &mut log, "pass 3")?;

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
        compiler,
    })
}

#[tauri::command]
fn latex_compiler() -> Option<String> {
    latex_engine_names().first().map(|name| name.to_string())
}

#[tauri::command]
fn latex_engines() -> Vec<String> {
    latex_engine_names()
        .into_iter()
        .map(str::to_string)
        .collect()
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
            compile_latex,
            latex_engines
        ])
        .run(tauri::generate_context!())
        .expect("error while running HouseMD");
}
