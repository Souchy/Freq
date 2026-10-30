use anyhow::Result;
use serde::Serialize;

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
    AUDIO_MANAGER
        .seek(position_seconds)
        .map_err(|e| format!("Failed to seek: {e}"))
}

#[specta::specta]
#[tauri::command]
pub fn get_position() -> Result<f64, String> {
    Ok(AUDIO_MANAGER.position())
}

#[specta::specta]
#[tauri::command]
pub fn get_duration() -> Result<f64, String> {
    Ok(AUDIO_MANAGER.duration().unwrap_or(0.0))
}

#[derive(Serialize, specta::Type)]
pub struct PlaybackStatus {
    pub path: Option<String>,
    pub volume: f32,
    pub position_seconds: f64,
    pub duration_seconds: Option<f64>,
    pub is_paused: bool,
    pub is_finished: bool,
}

#[specta::specta]
#[tauri::command]
pub fn get_playback_status() -> Result<PlaybackStatus, String> {
    let snapshot = AUDIO_MANAGER.snapshot();
    Ok(PlaybackStatus {
        path: snapshot.path,
        volume: snapshot.volume,
        position_seconds: snapshot.position_seconds,
        duration_seconds: snapshot.duration_seconds,
        is_paused: snapshot.is_paused,
        is_finished: snapshot.is_finished,
    })
}
