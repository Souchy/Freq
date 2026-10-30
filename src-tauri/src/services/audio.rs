use anyhow::{anyhow, Result};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use rodio::{Decoder, MixerDeviceSink, Source};
use std::fs::File;
use std::time::Duration;

pub static AUDIO_MANAGER: Lazy<AudioManager> =
    Lazy::new(|| AudioManager::new().expect("Failed to initialize AudioManager"));

pub struct AudioManagerInner {
    handle: MixerDeviceSink,
    current_player: Option<rodio::Player>,
    next_player: Option<rodio::Player>,
    duration: Option<Duration>,
    current_path: Option<String>,
    volume: f32,
}

pub struct PlaybackSnapshot {
    pub path: Option<String>,
    pub volume: f32,
    pub position_seconds: f64,
    pub duration_seconds: Option<f64>,
    pub is_paused: bool,
    pub is_finished: bool,
}

pub struct AudioManager {
    inner: Mutex<AudioManagerInner>,
}

impl AudioManager {
    pub fn new() -> Result<Self> {
        let handle =
            rodio::DeviceSinkBuilder::open_default_sink().expect("open default audio stream");

        let inner = AudioManagerInner {
            handle,
            current_player: None,
            next_player: None,
            duration: None,
            current_path: None,
            volume: 1.0,
        };

        println!("AudioManager initialized successfully");

        Ok(Self {
            inner: Mutex::new(inner),
        })
    }

    pub fn load_and_play_file(&self, path: &str) -> Result<(), String> {
        println!("Loading and playing file: {}", path);
        
        self.stop()?;
        println!("Stopped any existing playback");

        let mut inner = self.inner.lock();
        println!("Acquired lock on AudioManagerInner");

        let player = rodio::Player::connect_new(&inner.handle.mixer());
        println!("Created new audio player");
        // Load a sound from a file, using a path relative to Cargo.toml
        let file = File::open(path).map_err(|e| format!("Failed to open {:?}: {}", path, e))?;
        println!("Opened file successfully");
        let source =
            Decoder::try_from(file).map_err(|e| format!("Failed to decode {:?}: {}", path, e))?;
        println!("Decoded audio file successfully");
        inner.duration = source.total_duration();
        player.append(source);
        player.play();
        // apply saved volume
        let vol = inner.volume;
        player.set_volume(vol);
        println!("Started playback");

        inner.current_player = Some(player);
        inner.current_path = Some(path.to_string());

        Ok(())
    }

    pub fn pause(&self) -> Result<(), String> {
        let inner = self.inner.lock();
        if let Some(ref player) = inner.current_player {
            player.pause();
            Ok(())
        } else {
            Err("No active player to pause".into())
        }
    }

    pub fn resume(&self) -> Result<(), String> {
        let inner = self.inner.lock();
        if let Some(ref player) = inner.current_player {
            player.play();
            Ok(())
        } else {
            Err("No active player to resume".into())
        }
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut inner = self.inner.lock();
        if let Some(ref player) = inner.current_player {
            player.stop();
        }
        inner.current_player = None;
        inner.current_path = None;
        inner.duration = None;
        Ok(())
    }

    pub fn seek(&self, position_seconds: f64) -> Result<(), String> {
        let inner = self.inner.lock();
        let Some(ref player) = inner.current_player else {
            return Err("No active player to seek".into());
        };
        let mut target = Duration::from_secs_f64(position_seconds.max(0.0));
        if let Some(duration) = inner.duration {
            target = target.min(duration);
        }
        player.try_seek(target).map_err(|e| e.to_string())
    }

    pub fn position(&self) -> f64 {
        let inner = self.inner.lock();
        inner
            .current_player
            .as_ref()
            .map_or(0.0, |player| player.get_pos().as_secs_f64())
    }

    pub fn duration(&self) -> Option<f64> {
        self.inner.lock().duration.map(|d| d.as_secs_f64())
    }

    pub fn snapshot(&self) -> PlaybackSnapshot {
        let inner = self.inner.lock();
        let player = inner.current_player.as_ref();
        PlaybackSnapshot {
            path: inner.current_path.clone(),
            volume: inner.volume,
            position_seconds: player.map_or(0.0, |p| p.get_pos().as_secs_f64()),
            duration_seconds: inner.duration.map(|d| d.as_secs_f64()),
            is_paused: player.is_some_and(|p| p.is_paused()),
            is_finished: player.is_some_and(|p| p.empty()),
        }
    }

    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        let mut inner = self.inner.lock();
        inner.volume = volume;
        if let Some(ref player) = inner.current_player {
            player.set_volume(volume);
        }
        Ok(())
    }
}

// Optional: implement a simple wrapper if you want to expose duration, etc.
// For now we rely on rodio::Decoder's own Source implementation.
