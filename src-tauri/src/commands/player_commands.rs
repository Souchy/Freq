use anyhow::Result;

use crate::services::audio::AUDIO_MANAGER;
use std::fs;
use std::path::Path;
use serde::Serialize;

#[specta::specta]
#[tauri::command]
pub fn load_and_play_file(path: String) -> Result<(), String> {
    println!("Received command to load and play file: {}", path);
    AUDIO_MANAGER
        .load_and_play_file(&path)
        .map_err(|e| format!("Failed to play file: {e}"))
}

#[specta::specta]
#[tauri::command]
pub fn pause() -> Result<(), String> {
    AUDIO_MANAGER
        .pause()
        .map_err(|e| format!("Failed to pause: {e}"))
}

#[specta::specta]
#[tauri::command]
pub fn resume() -> Result<(), String> {
    AUDIO_MANAGER
        .resume()
        .map_err(|e| format!("Failed to resume: {e}"))
}

#[specta::specta]
#[tauri::command]
pub fn stop() -> Result<(), String> {
    AUDIO_MANAGER
        .stop()
        .map_err(|e| format!("Failed to stop: {e}"))
}

#[specta::specta]
#[tauri::command]
pub fn set_volume(volume: f32) -> Result<(), String> {
    AUDIO_MANAGER
        .set_volume(volume)
        .map_err(|e| format!("Failed to set volume: {e}"))
}

#[specta::specta]
#[tauri::command]
pub fn scan_folder(path: String) -> Result<Vec<String>, String> {
    fn visit_dir(path: &Path, out: &mut Vec<String>) -> std::io::Result<()> {
        for entry in fs::read_dir(path)? {
            let e = entry?;
            let p = e.path();
            if p.is_dir() {
                visit_dir(&p, out)?;
            } else if p.is_file() {
                if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
                    match ext.to_lowercase().as_str() {
                        "mp3" | "wav" | "flac" | "m4a" | "ogg" => {
                            out.push(p.to_string_lossy().into_owned());
                        }
                        _ => {}
                    }
                }
            }
        }
        Ok(())
    }

    let start = Path::new(&path);
    if !start.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    let mut results = Vec::new();
    visit_dir(start, &mut results).map_err(|e| format!("Failed to scan folder: {}", e))?;
    Ok(results)
}

// #[specta::specta]
#[derive(Serialize, specta::Type)]
pub struct TrackMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_seconds: Option<f64>,
}

#[specta::specta]
#[tauri::command]
pub fn get_metadata(path: String) -> Result<TrackMetadata, String> {
    // Placeholder: try to extract minimal metadata using symphonia or return filename
    let name = Path::new(&path)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string());

    Ok(TrackMetadata {
        title: name,
        artist: None,
        album: None,
        duration_seconds: None,
    })
}

#[specta::specta]
#[tauri::command]
pub fn seek(position_seconds: f64) -> Result<(), String> {
    // TODO: implement proper seeking using symphonia/rodio playback pipelines
    Err("seek not implemented yet".into())
}

#[specta::specta]
#[tauri::command]
pub fn get_position() -> Result<f64, String> {
    // TODO: return current playback position
    Ok(0.0)
}

#[specta::specta]
#[tauri::command]
pub fn get_duration() -> Result<f64, String> {
    // TODO: return current track duration
    Ok(0.0)
}
