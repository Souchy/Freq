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

#[specta::specta]
#[tauri::command]
pub fn set_volume(volume: f32) -> Result<(), String> {
    AUDIO_MANAGER
        .set_volume(volume)
        .map_err(|e| format!("Failed to set volume: {e}"))
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
