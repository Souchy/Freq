import { playlistService, PlaylistItem } from '../../core/playlist';
import { addMusicSource, isAndroidApp } from '../../core/library-import';

export class Library {
  public items: PlaylistItem[] = playlistService.all;
  public filter = '';
  public isScanning = false;
  public message = '';
  public isAndroid = isAndroidApp();

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

      const uniqueTracks = new Map(playlistService.all.map(item => [item.path, item]));
      for (const item of source.items) uniqueTracks.set(item.path, item);
      const tracks = [...uniqueTracks.values()];
      playlistService.set(tracks);
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

  public addToQueue(item: PlaylistItem) {
    document.dispatchEvent(new CustomEvent('queue:add', { detail: item }));
  }
}
