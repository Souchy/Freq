import { bindable } from 'aurelia';
import { audioService } from '../../core/audio';

export class SongItem {
  @bindable public item: any;
  @bindable public play: ((path: string) => void) | null = null;
  public metadata: any = null;

  async attached() {
    try {
      this.metadata = await audioService.getMetadata(this.item.path);
    } catch {
      this.metadata = null;
    }
  }

  get title() {
    return this.metadata?.title || this.item.name;
  }

  get subtitle() {
    const artist = this.metadata?.artist;
    const album = this.metadata?.album;
    return [artist, album].filter(Boolean).join(' — ');
  }

  playDelegate() {
    if (this.play) this.play(this.item.path);
  }
}
