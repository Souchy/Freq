import { PlaylistItem } from '../../core/playlist';
import type { QueueState } from '../../core/player-controller';

export class Queue {
  public items: PlaylistItem[] = [];
  public currentIndex = 0;
  public isPlaying = false;
  public currentPath: string | null = null;
  public listEl?: HTMLUListElement;
  // Pixel offset of the current track along the scrollbar, or null when not scrollable.
  public markerTop: number | null = null;
  private resizeObserver?: ResizeObserver;
  private markerFrame = 0;

  private readonly handleQueue = (event: Event) => {
    const state = (event as CustomEvent<QueueState>).detail;
    this.items = state.items;
    this.currentIndex = state.currentIndex;
    this.scheduleMarkerUpdate();
  };

  private readonly handleState = (event: Event) => {
    const state = (event as CustomEvent<{ isPlaying: boolean; currentPath: string | null }>).detail;
    this.isPlaying = !!state.isPlaying;
    this.currentPath = state.currentPath;
    this.scheduleMarkerUpdate();
  };

  attached() {
    document.addEventListener('player:queue', this.handleQueue);
    document.addEventListener('player:state', this.handleState);
    if (this.listEl && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleMarkerUpdate());
      this.resizeObserver.observe(this.listEl);
    }
    document.dispatchEvent(new CustomEvent('player:sync'));
  }

  detaching() {
    document.removeEventListener('player:queue', this.handleQueue);
    document.removeEventListener('player:state', this.handleState);
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.markerFrame);
  }

  remove(index: number) {
    document.dispatchEvent(new CustomEvent('queue:remove', { detail: index }));
  }

  play(index: number) {
    if (index === this.currentIndex && this.currentPath) {
      document.dispatchEvent(new CustomEvent(this.isPlaying ? 'controls:pause' : 'controls:resume'));
      return;
    }
    document.dispatchEvent(new CustomEvent('queue:jump', { detail: index }));
  }

  formatIndex(index: number) {
    return String(index + 1).padStart(2, '0');
  }

  private scheduleMarkerUpdate() {
    cancelAnimationFrame(this.markerFrame);
    // Wait a frame so the repeat has rendered the latest rows.
    this.markerFrame = requestAnimationFrame(() => this.updateMarker());
  }

  private updateMarker() {
    const list = this.listEl;
    const row = list?.children[this.currentIndex] as HTMLElement | undefined;
    if (!list || !row || !this.currentPath || list.scrollHeight <= list.clientHeight) {
      this.markerTop = null;
      return;
    }
    const rowCenter = row.offsetTop + row.offsetHeight / 2;
    this.markerTop = list.offsetTop + (rowCenter / list.scrollHeight) * list.clientHeight;
  }
}
