import { playlistService } from '../../core/playlist';

export class Library {
  public items: { path: string; name: string }[] = [];
  public filter: string = '';

  attached() {
    this.items = playlistService.all;
    playlistService.addEventListener('change', (e: Event) => {
      this.items = (e as CustomEvent).detail;
    });
  }

  onFilter() {}

  filterTrack(item: any, idx: number, arr: any[]) {
    if (!this.filter) return true;
    return item.name.toLowerCase().includes(this.filter.toLowerCase());
  }

  addToQueue(item: any) {
    document.dispatchEvent(new CustomEvent('queue:add', { detail: item }));
  }
}
