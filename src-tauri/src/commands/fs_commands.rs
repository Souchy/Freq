use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Serialize, specta::Type)]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
}

#[derive(Serialize, specta::Type)]
pub struct DirectoryListing {
    pub path: String,
    pub parent: Option<String>,
    pub directories: Vec<DirectoryEntry>,
}

#[derive(Serialize, specta::Type)]
pub struct FolderLocation {
    pub label: String,
    pub path: String,
    pub is_drive: bool,
}

#[specta::specta]
#[tauri::command]
pub fn list_directories(path: String) -> Result<DirectoryListing, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("Not a folder: {path}"));
    }

    let mut directories: Vec<DirectoryEntry> = fs::read_dir(&root)
        .map_err(|error| error.to_string())?
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .filter(|entry| !is_hidden(entry))
        .map(|entry| DirectoryEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: entry.path().to_string_lossy().into_owned(),
        })
        .collect();
    directories.sort_by_key(|entry| entry.name.to_lowercase());

    Ok(DirectoryListing {
        path: root.to_string_lossy().into_owned(),
        parent: root.parent().map(|parent| parent.to_string_lossy().into_owned()),
        directories,
    })
}

#[specta::specta]
#[tauri::command]
pub fn get_folder_locations(app: tauri::AppHandle) -> Vec<FolderLocation> {
    let paths = app.path();
    let mut locations: Vec<FolderLocation> = [
        ("Music", paths.audio_dir()),
        ("Downloads", paths.download_dir()),
        ("Desktop", paths.desktop_dir()),
        ("Documents", paths.document_dir()),
        ("Home", paths.home_dir()),
    ]
    .into_iter()
    .filter_map(|(label, dir)| {
        let dir = dir.ok().filter(|dir| dir.is_dir())?;
        Some(FolderLocation {
            label: label.to_string(),
            path: dir.to_string_lossy().into_owned(),
            is_drive: false,
        })
    })
    .collect();

    #[cfg(windows)]
    for letter in b'C'..=b'Z' {
        let drive = format!("{}:\\", letter as char);
        if Path::new(&drive).is_dir() {
            locations.push(FolderLocation {
                label: format!("{}:", letter as char),
                path: drive,
                is_drive: true,
            });
        }
    }

    locations
}

#[specta::specta]
#[tauri::command]
pub fn get_default_download_dir(app: tauri::AppHandle) -> Result<String, String> {
    let paths = app.path();
    let base = paths
        .audio_dir()
        .or_else(|_| paths.download_dir())
        .or_else(|_| paths.home_dir())
        .map_err(|error| error.to_string())?;
    Ok(base.join("Freq").to_string_lossy().into_owned())
}

#[specta::specta]
#[tauri::command]
pub fn create_directory(parent: String, name: String) -> Result<String, String> {
    let name = name.trim();
    let invalid = name.is_empty()
        || name == "."
        || name == ".."
        || name.ends_with('.')
        || name
            .chars()
            .any(|c| c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'));
    if invalid {
        return Err(format!("\"{name}\" isn't a valid folder name."));
    }

    let parent = Path::new(&parent);
    if !parent.is_dir() {
        return Err("The parent folder no longer exists.".into());
    }
    let target = parent.join(name);
    fs::create_dir(&target).map_err(|error| match error.kind() {
        std::io::ErrorKind::AlreadyExists => format!("A folder named \"{name}\" already exists."),
        _ => error.to_string(),
    })?;
    Ok(target.to_string_lossy().into_owned())
}

/// Shows the file selected in the system file manager, reusing an open window on that folder.
#[specta::specta]
#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err("That file no longer exists.".into());
    }
    tauri_plugin_opener::reveal_item_in_dir(target).map_err(|error| error.to_string())
}

#[cfg(windows)]
fn is_hidden(entry: &fs::DirEntry) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    const FILE_ATTRIBUTE_SYSTEM: u32 = 0x4;
    entry.file_name().to_string_lossy().starts_with('.')
        || entry
            .metadata()
            .is_ok_and(|meta| meta.file_attributes() & (FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM) != 0)
}

#[cfg(not(windows))]
fn is_hidden(entry: &fs::DirEntry) -> bool {
    entry.file_name().to_string_lossy().starts_with('.')
}
