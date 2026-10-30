use serde::Serialize;
use std::fs;
use std::path::Path;

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
    let name = Path::new(&path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(str::to_string);

    Ok(TrackMetadata {
        title: name,
        artist: None,
        album: None,
        duration_seconds: None,
    })
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
