use anyhow::{anyhow, Result};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use rodio::{Decoder, MixerDeviceSink};
use std::fs::File;

pub static AUDIO_MANAGER: Lazy<AudioManager> =
    Lazy::new(|| AudioManager::new().expect("Failed to initialize AudioManager"));

pub struct AudioManagerInner {
    handle: MixerDeviceSink,
    current_player: Option<rodio::Player>,
    next_player: Option<rodio::Player>,
    volume: f32,
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
        player.append(source);
        player.play();
        // apply saved volume
        let vol = inner.volume;
        player.set_volume(vol);
        println!("Started playback");

        inner.current_player = Some(player);

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
        Ok(())
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
