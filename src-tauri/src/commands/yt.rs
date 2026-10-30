use std::{path::PathBuf, process::Command};

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, State};
use tokio::io::AsyncBufReadExt;
use yt_dlp::{
    extractor::{ExtractorBase, ExtractorConfig, VideoExtractor, Youtube},
    model::playlist::PlaylistEntry,
    Downloader, VideoSelection,
};

#[derive(Serialize, Deserialize, Clone, Debug, Default, specta::Type)]
pub struct DlOptions {
    output_dir: String,
    audio_quality: u32, // AudioQuality,
    audio_codec: u32,   // AudioCodecPreference,
    /// When set, progress is emitted as `download:progress` events carrying this id.
    download_id: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct DownloadProgress {
    pub id: String,
    /// "downloading" or "converting".
    pub stage: String,
    pub percent: Option<f64>,
    pub speed_bps: Option<f64>,
    pub eta_seconds: Option<f64>,
}

const PROGRESS_EVENT: &str = "download:progress";
const PROGRESS_PREFIX: &str = "FREQPROG ";
const FILE_PREFIX: &str = "FREQFILE ";

#[derive(Serialize, Deserialize, Clone, Debug, Default, specta::Type)]
pub struct SearchResultVideo {
    pub id: String,
    pub title: String,
    pub url: String,
    pub duration: Option<f32>, // Optional, depending on availability
    pub thumbnail_url: Option<String>,
    /// The uploader/channel name.
    pub uploader: Option<String>,
    /// The channel ID.
    pub channel_id: Option<String>,
    // pub channel_title: Option<String>,
}

#[specta::specta]
#[tauri::command]
pub async fn yt_search(
    search: String,
    start: u32,
    end: u32,
    downloader: State<'_, Downloader>,
) -> Result<Vec<SearchResultVideo>, String> {
    let downloader: &Downloader = downloader.inner();
    let youtube = system_trusted_youtube_extractor(downloader);
    let results = youtube
        .search(&search, end as usize)
        .await
        .map_err(|e| e.to_string())?;

    // youtube.fetch_playlist_paginated("playlist_id", start, end - start);

    // Map the internal results to your custom frontend-friendly struct
    let frontend_results: Vec<SearchResultVideo> = results
        .get_entries_in_range(start as usize, end as usize)
        // .entries
        .into_iter()
        .map(|item: &PlaylistEntry| {
            // Note: Depending on the yt-dlp crate version, properties might be accessible
            // directly or via getter methods (e.g., item.id or item.id()). Adjust accordingly.
            SearchResultVideo {
                id: item.id.clone(),
                title: item.title.clone(),
                url: item.url.clone(), //format!("https://youtube.com{}", item.id),
                duration: item.duration.map(|e| e as f32),
                thumbnail_url: item.thumbnail.clone(),
                channel_id: item.channel_id.clone(),
                uploader: item.uploader.clone(),
            }
        })
        .collect();

    Ok(frontend_results)
}

#[specta::specta]
#[tauri::command]
pub async fn get_video_recommendations(
    url: String,
    downloader: State<'_, Downloader>,
) -> Result<Vec<SearchResultVideo>, String> {
    let downloader: &Downloader = downloader.inner();

    let youtube = system_trusted_youtube_extractor(downloader);
    let playlist = youtube
        .fetch_playlist(&url)
        .await
        .map_err(|e| e.to_string())?;

    //     let vid = youtube.fetch_video_metadata(&url)
    //         .await
    //         .map_err(|e| e.to_string())?;
    // vid.pl
    // // 1. Fetch the full video metadata
    // let video_info = downloader
    //     .fetch_video_infos(url)
    //     .await
    //     .map_err(|e| e.to_string())?;

    // // 2. Access the related/recommended videos list from the metadata payload.
    // // Note: If `.related_videos` gives a compiler error, check your IDE autocomplete
    // // for `.recommendations` or `.entries` if the payload structure wrapped it.
    // let related = video_info
    //     .related_videos
    //     .ok_or_else(|| "No recommendations found for this video".to_string())?;

    // 3. Map the recommended videos to your frontend-friendly struct
    let frontend_results: Vec<SearchResultVideo> = playlist
        .entries
        .into_iter()
        .map(|item: PlaylistEntry| SearchResultVideo {
            id: item.id.clone(),
            title: item.title.clone(),
            url: item.url,
            duration: item.duration.map(|e| e as f32),
            thumbnail_url: item.thumbnail,
            channel_id: item.channel_id,
            uploader: item.uploader,
        })
        .collect();

    Ok(frontend_results)
}

fn system_trusted_youtube_extractor(downloader: &Downloader) -> Youtube {
    let mut extractor = Youtube::new(downloader.libraries().youtube.clone());
    extractor.with_arg("--compat-options=no-certifi".to_string());
    extractor
}

#[specta::specta]
#[tauri::command]
pub async fn dl_yt(
    url: String,
    opts: DlOptions,
    downloader: State<'_, Downloader>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    priv_dl(url, opts, downloader.inner(), &app).await
}

/*
my previous function using the library (slightly modified for safe-title etc)
pub async fn priv_dl(
    url: String,
    opts: DlOptions,
    downloader: &Downloader,
    app: &tauri::AppHandle,
) -> Result<String, String> {
    println!("Dl infos for video at url: {}", url);

    let video = downloader
        .fetch_video_infos(url)
        .await
        .map_err(|e| e.to_string())?;

    let output_dir = if opts.output_dir.trim().is_empty() {
        app.path()
            .download_dir()
            .or_else(|_| app.path().app_local_data_dir())
            .map_err(|error| error.to_string())?
    } else {
        PathBuf::from(opts.output_dir)
    };
    std::fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;

    let safe_title: String = video
        .title
        .chars()
        .map(|character| {
            if matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            ) {
                '_'
            } else {
                character
            }
        })
        .collect();
    let safe_title = safe_title.trim();
    let filename = if safe_title.is_empty() {
        "youtube-audio.mp3".to_string()
    } else {
        format!("{safe_title}.mp3")
    };
    let output_path = output_dir.join(filename);

    println!("Dl to path: {}", output_path.display());

    let path = downloader
        .download_audio_stream_with_quality_to_path(
            &video,
            output_path,
            AudioQuality::Best,
            AudioCodecPreference::MP3,
        )
        .await
        .map_err(|e| e.to_string())?;

    // let format = video
    //     .best_audio_format()
    //     .ok_or("No audio format".to_string())?;

    // let path = downloader
    //     .download_format(format, format!("{}.mp3", video.title))
    //     .await
    //     .map_err(|e| e.to_string())?;

    // let path = downloader
    //     .download_audio_stream(&video, format!("{}.mp3", video.title))
    //     .await
    //     .map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}*/

pub async fn priv_dl(
    url: String,
    opts: DlOptions,
    downloader: &Downloader,
    app: &tauri::AppHandle,
) -> Result<String, String> {
    println!("Downloading audio for url: {}", url);

    let output_dir = if opts.output_dir.trim().is_empty() {
        app.path()
            .download_dir()
            .or_else(|_| app.path().app_local_data_dir())
            .map_err(|error| error.to_string())?
    } else {
        PathBuf::from(opts.output_dir)
    };
    std::fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;

    update_ytdlp_once(downloader).await;

    // The yt-dlp executable handles YouTube's client fallbacks and signed stream URLs, which the
    // crate's own HTTP downloader gets rejected on (403s from googlevideo).
    // Some streams trip ffmpeg during post-processing, so fall back to simpler outputs.
    let mut first_error = None;
    for mode in [
        AudioOutput::Mp3WithTags,
        AudioOutput::Mp3,
        AudioOutput::NativeM4a,
    ] {
        match run_ytdlp(
            downloader,
            app,
            opts.download_id.as_deref(),
            &url,
            &output_dir,
            mode,
        )
        .await
        {
            Ok(path) => return Ok(path),
            Err(failure) => {
                let retryable = failure.is_postprocessing;
                first_error.get_or_insert(failure.message);
                if !retryable {
                    break;
                }
            }
        }
    }
    Err(first_error.unwrap_or_else(|| "Download failed.".into()))
}

/// YouTube regularly breaks older yt-dlp releases (403s, broken streams), so self-update the
/// bundled binary before the first download of each session. Failures are non-fatal.
async fn update_ytdlp_once(downloader: &Downloader) {
    static UPDATED: tokio::sync::OnceCell<()> = tokio::sync::OnceCell::const_new();
    UPDATED
        .get_or_init(|| async {
            let mut command = tokio::process::Command::new(&downloader.libraries().youtube);
            command
                .args(["--update-to", "stable"])
                .stdin(std::process::Stdio::null())
                .kill_on_drop(true);
            #[cfg(windows)]
            {
                const CREATE_NO_WINDOW: u32 = 0x0800_0000;
                command.creation_flags(CREATE_NO_WINDOW);
            }
            match command.output().await {
                Ok(output) => println!(
                    "yt-dlp update: {}",
                    String::from_utf8_lossy(&output.stdout).trim()
                ),
                Err(error) => eprintln!("Could not update yt-dlp: {error}"),
            }
        })
        .await;
}

#[derive(Clone, Copy, Debug)]
enum AudioOutput {
    Mp3WithTags,
    Mp3,
    /// Skips conversion entirely and keeps YouTube's AAC stream.
    NativeM4a,
}

struct YtDlpFailure {
    message: String,
    is_postprocessing: bool,
}

async fn run_ytdlp(
    downloader: &Downloader,
    app: &tauri::AppHandle,
    download_id: Option<&str>,
    url: &str,
    output_dir: &std::path::Path,
    mode: AudioOutput,
) -> Result<String, YtDlpFailure> {
    let libraries = downloader.libraries();
    let mut command = tokio::process::Command::new(&libraries.youtube);
    command
        .args(["--compat-options", "no-certifi"])
        .arg("--no-playlist");
    match mode {
        AudioOutput::Mp3WithTags => {
            command
                .args([
                    "--extract-audio",
                    "--audio-format",
                    "mp3",
                    "--audio-quality",
                    "0",
                ])
                .args([
                    "--embed-metadata",
                    "--no-embed-chapters",
                    "--no-embed-info-json",
                ])
                // Long video descriptions can push ffmpeg's command line past Windows' length limit.
                .args(["--parse-metadata", ":(?P<meta_description>)"])
                .args(["--parse-metadata", ":(?P<meta_synopsis>)"]);
        }
        AudioOutput::Mp3 => {
            command
                .args([
                    "--extract-audio",
                    "--audio-format",
                    "mp3",
                    "--audio-quality",
                    "0",
                ])
                .arg("--force-overwrites");
        }
        AudioOutput::NativeM4a => {
            command
                .args(["--format", "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]"])
                .arg("--force-overwrites");
        }
    }
    command
        .arg("--windows-filenames")
        .args(["--encoding", "utf-8"])
        .args(["--progress", "--newline"])
        .arg("--progress-template")
        .arg(format!(
            "download:{PROGRESS_PREFIX}%(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(progress.eta)s"
        ))
        .arg("--no-update")
        // Verbose makes yt-dlp include ffmpeg's stderr when a conversion fails.
        .arg("--verbose")
        .arg("--ffmpeg-location")
        .arg(&libraries.ffmpeg)
        .arg("--output")
        .arg(output_dir.join("%(title)s.%(ext)s"))
        .arg("--print")
        .arg(format!("after_move:{FILE_PREFIX}%(filepath)s"))
        .arg("--")
        .arg(url)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let start_failure = |error: std::io::Error| YtDlpFailure {
        message: format!("Could not start yt-dlp: {error}"),
        is_postprocessing: false,
    };
    let mut child = command.spawn().map_err(start_failure)?;
    let mut stdout =
        tokio::io::BufReader::new(child.stdout.take().expect("piped stdout")).split(b'\n');
    let mut stderr =
        tokio::io::BufReader::new(child.stderr.take().expect("piped stderr")).split(b'\n');

    let emit =
        |stage: &str, percent: Option<f64>, speed_bps: Option<f64>, eta_seconds: Option<f64>| {
            if let Some(id) = download_id {
                let payload = DownloadProgress {
                    id: id.to_string(),
                    stage: stage.to_string(),
                    percent,
                    speed_bps,
                    eta_seconds,
                };
                let _ = app.emit(PROGRESS_EVENT, payload);
            }
        };

    let mut saved_path: Option<String> = None;
    let mut log = String::new();
    let (mut stdout_done, mut stderr_done) = (false, false);
    while !(stdout_done && stderr_done) {
        let (from_stdout, segment) = tokio::select! {
            segment = stdout.next_segment(), if !stdout_done => (true, segment),
            segment = stderr.next_segment(), if !stderr_done => (false, segment),
        };
        let bytes = match segment {
            Ok(Some(bytes)) => bytes,
            _ => {
                if from_stdout {
                    stdout_done = true
                } else {
                    stderr_done = true
                }
                continue;
            }
        };
        let line = String::from_utf8_lossy(&bytes);
        let line = line.trim();
        if let Some(rest) = line.strip_prefix(FILE_PREFIX) {
            saved_path = Some(rest.trim().to_string());
        } else if let Some(rest) = line.strip_prefix(PROGRESS_PREFIX) {
            let fields: Vec<Option<f64>> = rest
                .split_whitespace()
                .map(|field| field.parse().ok())
                .collect();
            let field = |index: usize| fields.get(index).copied().flatten();
            let total = field(1).or(field(2));
            let percent = match (field(0), total) {
                (Some(done), Some(total)) if total > 0.0 => Some((done / total * 100.0).min(100.0)),
                _ => None,
            };
            emit("downloading", percent, field(3), field(4));
        } else {
            if line.starts_with("[ExtractAudio]")
                || line.starts_with("[Metadata]")
                || line.starts_with("[Fixup")
            {
                emit("converting", None, None, None);
            }
            log.push_str(line);
            log.push('\n');
        }
    }

    let status = child.wait().await.map_err(start_failure)?;
    if !status.success() {
        eprintln!("yt-dlp ({mode:?}) failed for {url}:\n{log}");
        return Err(YtDlpFailure {
            message: describe_ytdlp_failure(&log),
            is_postprocessing: log.contains("Postprocessing") || log.contains("Conversion failed"),
        });
    }

    saved_path.ok_or_else(|| YtDlpFailure {
        message: "yt-dlp finished but didn't report the saved file.".into(),
        is_postprocessing: false,
    })
}

/// Picks the most useful line out of yt-dlp's stderr, including ffmpeg's actual reason when a
/// post-processing step only reports "Conversion failed!".
fn describe_ytdlp_failure(stderr: &str) -> String {
    let lines: Vec<&str> = stderr
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();
    let error_index = lines.iter().rposition(|line| line.starts_with("ERROR"));
    let summary = error_index
        .map(|index| lines[index])
        .or_else(|| lines.last().copied())
        .unwrap_or("yt-dlp exited with an error")
        .trim_start_matches("ERROR:")
        .trim();

    let ffmpeg_reason = error_index.and_then(|index| {
        lines[..index]
            .iter()
            .rev()
            .filter(|line| !line.starts_with("[debug]") && !line.contains("Conversion failed"))
            .find(|line| {
                line.contains("rror") || line.contains("denied") || line.contains("Invalid")
            })
    });

    match ffmpeg_reason {
        Some(reason) if summary.contains("Postprocessing") => format!("{summary} ({reason})"),
        _ => summary.to_string(),
    }
}

#[specta::specta]
#[tauri::command]
pub async fn download_music(url: &str) -> Result<(), String> {
    let status = Command::new("yt-dlp")
        .arg("-x") // Extract audio
        .arg("--audio-format") // Specify format
        .arg("mp3") // Convert to MP3
        .arg("--audio-quality") // Specify quality
        .arg("0") // Best quality (0)
        .arg("--output") // Save format template
        .arg("%(title)s.%(ext)s") // Name file after the video title
        .arg(url) // Target URL
        .status()
        .map_err(|e| e.to_string())?; // Execute and wait

    if status.success() {
        println!("Audio downloaded successfully!");
        Ok(())
    } else {
        Err("yt-dlp failed to download audio".to_string())
    }
}
