use anyhow::Result;

use crate::services::audio::AUDIO_MANAGER;

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
