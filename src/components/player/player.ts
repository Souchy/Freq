import { audioService } from '../../core/audio';
import { playlistService, PlaylistItem } from '../../core/playlist';

type PlaylistItem = { path: string; name: string };

export class Player {
  public playlist: PlaylistItem[] = [];
  public currentPath: string | null = null;
  public currentTitle: string = '';
  public volume: number = 1.0;

  attached() {
    audioService.addEventListener('state', (e: Event) => {
      // react to state changes if needed
      const s = (e as CustomEvent).detail;
      // optionally update UI
    });
    playlistService.addEventListener('change', (e: Event) => {
      this.playlist = (e as CustomEvent).detail;
    });
    this.playlist = playlistService.all;
  }

  onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      // @ts-ignore
      const p = (f as any).path ?? f.name;
      this.playlist.push({ path: p, name: f.name });
    }
  }

  async onFolderSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      // Add all files from the selected folder
      const items: PlaylistItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        // @ts-ignore
        const p = (f as any).path ?? f.name;
        // filter by common audio extensions
        const name = f.name.toLowerCase();
        if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.flac') || name.endsWith('.m4a') || name.endsWith('.ogg')) {
          items.push({ path: p, name: f.name });
        }
      }
      playlistService.add(items);
    }
  }

  async selectTrack(t: PlaylistItem) {
    this.currentPath = t.path;
    this.currentTitle = t.name;
    try {
      await audioService.loadAndPlay(t.path);
    } catch (err) {
      console.error('play error', err);
    }
  }

  async playSelected() {
    if (!this.currentPath && this.playlist.length > 0) {
      const t = this.playlist[0];
      await this.selectTrack(t);
      return;
    }
    if (!this.currentPath) return;
    try {
      await audioService.loadAndPlay(this.currentPath);
    } catch (err) {
      console.error('play error', err);
    }
  }

  async pause() {
    try {
      await audioService.pause();
    } catch (err) {
      console.error('pause error', err);
    }
  }

  async resume() {
    try {
      await audioService.resume();
    } catch (err) {
      console.error('resume error', err);
    }
  }

  async stop() {
    try {
      await audioService.stop();
      this.currentTitle = '';
      this.currentPath = null;
    } catch (err) {
      console.error('stop error', err);
    }
  }

  async onVolumeChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const v = parseFloat(input.value);
    this.volume = v;
    try {
      await audioService.setVolume(v);
    } catch (err) {
      console.error('set volume error', err);
    }
  }
}
