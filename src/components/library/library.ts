import { playlistService, PlaylistItem } from '../../core/playlist';
import { addMusicSource, isAndroidApp } from '../../core/library-import';
import { audioService } from '../../core/audio';
import type { FileInfo, TrackMetadata } from '../../generated/specta/types';

type DetailRow = { label: string; value: string };

export class Library {
  public items: PlaylistItem[] = playlistService.all;
  public filter = '';
  public isScanning = false;
  public message = '';
  public isAndroid = isAndroidApp();
  public detailsPath: string | null = null;
  public detailRows: DetailRow[] = [];
  public detailsError = '';
  public isLoadingDetails = false;
  public currentPath: string | null = null;
  public isPlaying = false;

  private readonly handlePlayerState = (event: Event) => {
    const state = (event as CustomEvent<{ isPlaying: boolean; currentPath: string | null }>).detail;
    this.isPlaying = !!state.isPlaying;
    this.currentPath = state.currentPath;
  };

  public get filteredItems(): PlaylistItem[] {
    const query = this.filter.trim().toLocaleLowerCase();
    if (!query) return this.items;

    return this.items.filter(item =>
      item.name.toLocaleLowerCase().includes(query) || item.path.toLocaleLowerCase().includes(query)
    );
  }

  attached() {
    this.items = playlistService.all;
    playlistService.addEventListener('change', (e: Event) => {
      this.items = (e as CustomEvent).detail;
    });
    document.addEventListener('player:state', this.handlePlayerState);
    document.dispatchEvent(new CustomEvent('player:sync'));
  }

  detaching() {
    document.removeEventListener('player:state', this.handlePlayerState);
  }

  public formatIndex(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  public async addMusic() {
    if (this.isScanning) return;

    this.isScanning = true;
    this.message = '';
    try {
      const source = await addMusicSource();
      if (!source) return;

      if (source.sourcePath) {
        playlistService.addSource({ path: source.sourcePath, label: source.sourceLabel }, source.items);
      } else {
        playlistService.add(source.items);
      }
      this.filter = '';
      if (!source.items.length) {
        this.message = 'No supported audio files found in that folder.';
      } else {
        this.message = `Added ${source.items.length} ${source.items.length === 1 ? 'track' : 'tracks'} from ${source.sourceLabel}.`;
      }
    } catch (error) {
      this.message = `Could not add music: ${String(error)}`;
    } finally {
      this.isScanning = false;
    }
  }

  public toggleDetails(item: PlaylistItem) {
    this.detailsPath = this.detailsPath === item.path ? null : item.path;
    if (this.detailsPath) void this.loadDetails(item.path);
  }

  private async loadDetails(path: string) {
    this.detailRows = [];
    this.detailsError = '';
    this.isLoadingDetails = true;
    const [info, metadata] = await Promise.all([
      audioService.getFileInfo(path).catch((error: unknown) => {
        this.detailsError = `Could not read this file: ${String(error)}`;
        return null;
      }),
      audioService.getMetadata(path).catch(() => null),
    ]);
    if (this.detailsPath !== path) return;
    this.detailRows = buildDetailRows(info, metadata);
    this.isLoadingDetails = false;
  }

  public playFrom(index: number) {
    const tracks = this.filteredItems;
    if (tracks[index]?.path === this.currentPath) {
      document.dispatchEvent(new CustomEvent(this.isPlaying ? 'controls:pause' : 'controls:resume'));
      return;
    }
    const ordered = [...tracks.slice(index), ...tracks.slice(0, index)];
    document.dispatchEvent(new CustomEvent('queue:play-from', { detail: { items: ordered, path: tracks[index].path } }));
  }

  public addToQueue(item: PlaylistItem) {
    document.dispatchEvent(new CustomEvent('queue:add', { detail: item }));
  }
}

function buildDetailRows(info: FileInfo | null, metadata: TrackMetadata | null): DetailRow[] {
  const rows: Array<[string, string | null | undefined]> = [
    ['Title', metadata?.title],
    ['Artist', metadata?.artist],
    ['Album', metadata?.album],
    ['Album artist', metadata?.album_artist],
    ['Genre', metadata?.genre],
    ['Year', metadata?.year],
    ['Track', metadata?.track_number],
    ['Duration', metadata?.duration_seconds != null ? formatDuration(metadata.duration_seconds) : null],
    ['Quality', info ? formatQuality(info) : null],
    ['Size', info ? formatBytes(info.size_bytes) : null],
    ['Modified', info?.modified_ms != null ? new Date(info.modified_ms).toLocaleString() : null],
  ];
  return rows.filter((row): row is [string, string] => !!row[1]).map(([label, value]) => ({ label, value }));
}

function formatQuality(info: FileInfo): string | null {
  const parts = [
    info.codec,
    info.bitrate_kbps != null ? `${Math.round(info.bitrate_kbps)} kbps` : null,
    info.sample_rate != null ? `${(info.sample_rate / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kHz` : null,
    info.bits_per_sample != null ? `${info.bits_per_sample}-bit` : null,
    info.channels === 1 ? 'mono' : info.channels === 2 ? 'stereo' : info.channels != null ? `${info.channels} ch` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[unit]}`;
}

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
