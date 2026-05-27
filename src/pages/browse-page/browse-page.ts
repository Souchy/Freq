import { playlistService } from '../../core/playlist';
import { audioService } from '../../core/audio';

export class BrowsePage {
  public items = playlistService.all;
  public search = '';
  public group = 'none';

  constructor() {
    playlistService.addEventListener('change', (e: any) => {
      this.items = e.detail;
    });
  }

  async scanFolder() {
    const path = prompt('Folder path to scan:');
    if (!path) return;
    try {
      const scanned = await audioService.scanFolder(path);
      if (Array.isArray(scanned)) {
        playlistService.set(scanned as any);
      }
    } catch (err: any) {
      console.error('Scan failed', err);
      alert('Scan failed: ' + (err?.message || err));
    }
  }

  async play(path: string) {
    try {
      await audioService.loadAndPlay(path);
    } catch (err: any) {
      console.error('Play failed', err);
    }
  }
}
