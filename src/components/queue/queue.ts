import { PlaylistItem } from '../../core/playlist';

export class Queue {
  public items: PlaylistItem[] = [];
  public isPlaying = false;

  attached() {
    document.addEventListener('player:queue', (event: Event) => {
      this.items = (event as CustomEvent<PlaylistItem[]>).detail;
    });
    document.addEventListener('player:state', (event: Event) => {
      this.isPlaying = !!(event as CustomEvent<{ isPlaying: boolean }>).detail.isPlaying;
    });
  }

  remove(item: PlaylistItem) {
    document.dispatchEvent(new CustomEvent('queue:remove', { detail: item.path }));
  }
}
