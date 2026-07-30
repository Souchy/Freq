use std::{path::PathBuf, process::Command, str::FromStr};

use serde::{Deserialize, Serialize};
use tauri::State;
use yt_dlp::{
    extractor::{ExtractorBase, VideoExtractor},
    model::{playlist::PlaylistEntry, AudioCodecPreference, AudioQuality},
    Downloader, VideoSelection,
};

#[derive(Serialize, Deserialize, Clone, Debug, Default, specta::Type)]
pub struct DlOptions {
    output_dir: String,
    audio_quality: u32, // AudioQuality,
    audio_codec: u32,   // AudioCodecPreference,
}

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
    let youtube = downloader.youtube_extractor();
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

    let youtube = downloader.youtube_extractor();
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

#[specta::specta]
#[tauri::command]
pub async fn dl_yt(
    url: String,
    opts: DlOptions,
    downloader: State<'_, Downloader>,
) -> Result<String, String> {
    priv_dl(url, opts, downloader.inner()).await
}

pub async fn priv_dl(
    url: String,
    opts: DlOptions,
    downloader: &Downloader,
) -> Result<String, String> {
    println!("Dl infos for video at url: {}", url);

    let video = downloader
        .fetch_video_infos(url)
        .await
        .map_err(|e| e.to_string())?;

    let path_str = format!("{}/{}.mp3", opts.output_dir, video.title);

    // log::info!("");
    println!("Dl to path: {}", path_str);

    let path = downloader
        .download_audio_stream_with_quality_to_path(
            &video,
            PathBuf::from(path_str),
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
