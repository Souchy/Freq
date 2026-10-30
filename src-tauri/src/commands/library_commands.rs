use serde::Serialize;
use std::fs;
use std::path::Path;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::{MetadataOptions, MetadataRevision, StandardTagKey};
use symphonia::core::probe::Hint;

const SUPPORTED_AUDIO_EXTENSIONS: [&str; 5] = ["mp3", "wav", "flac", "m4a", "ogg"];

#[specta::specta]
#[tauri::command]
pub fn scan_folder(path: String) -> Result<Vec<String>, String> {
    scan_audio_directory(Path::new(&path)).map_err(|error| error.to_string())
}

fn scan_audio_directory(root: &Path) -> std::io::Result<Vec<String>> {
    if !root.is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Not a readable music folder: {}", root.display()),
        ));
    }

    let mut pending = vec![root.to_path_buf()];
    let mut files = Vec::new();

    while let Some(directory) = pending.pop() {
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(error) if directory == root => return Err(error),
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_symlink() {
                continue;
            }

            let path = entry.path();
            if file_type.is_dir() {
                pending.push(path);
                continue;
            }

            let supported = path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| {
                    SUPPORTED_AUDIO_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str())
                });
            if supported {
                files.push(path.to_string_lossy().into_owned());
            }
        }
    }

    files.sort_by_key(|path| path.to_lowercase());
    Ok(files)
}

#[derive(Serialize, Default, specta::Type)]
pub struct TrackMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<String>,
    pub track_number: Option<String>,
    pub duration_seconds: Option<f64>,
}

#[specta::specta]
#[tauri::command]
pub fn get_metadata(path: String) -> Result<TrackMetadata, String> {
    let file_title = Path::new(&path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(str::to_string);

    let mut metadata = read_tags(Path::new(&path)).unwrap_or_default();
    if metadata.title.is_none() {
        metadata.title = file_title;
    }
    Ok(metadata)
}

fn read_tags(path: &Path) -> Option<TrackMetadata> {
    let mut probed = probe(path)?;
    let mut result = TrackMetadata::default();

    let mut apply_tags = |revision: &MetadataRevision| {
        for tag in revision.tags() {
            let value = tag.value.to_string().trim().to_string();
            if value.is_empty() {
                continue;
            }
            let slot = match tag.std_key {
                Some(StandardTagKey::TrackTitle) => &mut result.title,
                Some(StandardTagKey::Artist) => &mut result.artist,
                Some(StandardTagKey::Album) => &mut result.album,
                Some(StandardTagKey::AlbumArtist) => &mut result.album_artist,
                Some(StandardTagKey::Genre) => &mut result.genre,
                Some(StandardTagKey::Date | StandardTagKey::ReleaseDate | StandardTagKey::OriginalDate) => {
                    &mut result.year
                }
                Some(StandardTagKey::TrackNumber) => &mut result.track_number,
                _ => continue,
            };
            slot.get_or_insert(value);
        }
    };
    if let Some(revision) = probed.format.metadata().current() {
        apply_tags(revision);
    }
    if let Some(revision) = probed.metadata.get().as_ref().and_then(|m| m.current()) {
        apply_tags(revision);
    }

    if let Some(track) = probed.format.default_track() {
        let params = &track.codec_params;
        if let (Some(time_base), Some(frames)) = (params.time_base, params.n_frames) {
            let time = time_base.calc_time(frames);
            result.duration_seconds = Some(time.seconds as f64 + time.frac);
        }
    }

    Some(result)
}

#[derive(Serialize, specta::Type)]
pub struct FileInfo {
    pub size_bytes: f64,
    /// Last modification time in milliseconds since the Unix epoch.
    pub modified_ms: Option<f64>,
    pub codec: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub bits_per_sample: Option<u32>,
    /// Average bitrate derived from file size and duration.
    pub bitrate_kbps: Option<f64>,
}

#[specta::specta]
#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileInfo, String> {
    let file_path = Path::new(&path);
    let meta = fs::metadata(file_path).map_err(|error| error.to_string())?;
    let size_bytes = meta.len() as f64;
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as f64);

    let mut info = FileInfo {
        size_bytes,
        modified_ms,
        codec: None,
        sample_rate: None,
        channels: None,
        bits_per_sample: None,
        bitrate_kbps: None,
    };

    if let Some(probed) = probe(file_path) {
        if let Some(track) = probed.format.default_track() {
            let params = &track.codec_params;
            info.codec = symphonia::default::get_codecs()
                .get_codec(params.codec)
                .map(|codec| codec.short_name.to_uppercase());
            info.sample_rate = params.sample_rate;
            info.channels = params.channels.map(|channels| channels.count() as u32);
            info.bits_per_sample = params.bits_per_sample;
            if let (Some(time_base), Some(frames)) = (params.time_base, params.n_frames) {
                let time = time_base.calc_time(frames);
                let seconds = time.seconds as f64 + time.frac;
                if seconds > 0.0 {
                    info.bitrate_kbps = Some(size_bytes * 8.0 / seconds / 1000.0);
                }
            }
        }
    }

    Ok(info)
}

fn probe(path: &Path) -> Option<symphonia::core::probe::ProbeResult> {
    let file = fs::File::open(path).ok()?;
    let stream = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(extension) = path.extension().and_then(|extension| extension.to_str()) {
        hint.with_extension(extension);
    }
    symphonia::default::get_probe()
        .format(&hint, stream, &FormatOptions::default(), &MetadataOptions::default())
        .ok()
}

#[cfg(test)]
mod tests {
    use super::scan_audio_directory;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let id = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock should be after Unix epoch")
                .as_nanos();
            let path = std::env::temp_dir().join(format!("freq-library-scan-{id}"));
            fs::create_dir_all(&path).expect("test directory should be created");
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn scans_supported_audio_recursively_and_sorts_paths() {
        let directory = TestDirectory::new();
        fs::create_dir_all(directory.0.join("album")).unwrap();
        fs::write(directory.0.join("z-last.MP3"), []).unwrap();
        fs::write(directory.0.join("notes.txt"), []).unwrap();
        fs::write(directory.0.join("album/a-first.flac"), []).unwrap();

        let paths = scan_audio_directory(&directory.0).unwrap();
        let names: Vec<_> = paths
            .iter()
            .map(|path| {
                Path::new(path)
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();

        assert_eq!(names, ["a-first.flac", "z-last.MP3"]);
    }

    #[test]
    fn rejects_a_file_as_a_scan_root() {
        let directory = TestDirectory::new();
        let file = directory.0.join("track.mp3");
        fs::write(&file, []).unwrap();

        assert!(scan_audio_directory(&file).is_err());
    }
}
