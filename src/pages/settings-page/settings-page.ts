import { audioService } from '../../core/audio';
import { playlistService } from '../../core/playlist';

export class SettingsPage {
  public folderPath: string = '';
  public results: string[] = [];

  async scan() {
    if (!this.folderPath) return;
    try {
      const res = await audioService.scanFolder(this.folderPath);
      this.results = res;
      // turn into playlist items
      const items = res.map((p) => ({ path: p, name: p.split(/[\\/]/).pop() || p }));
      playlistService.add(items);
    } catch (err) {
      console.error('scan error', err);
    }
  }
}
