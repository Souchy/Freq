export type PlaylistItem = { path: string; name: string };

class PlaylistService extends EventTarget {
  private items: PlaylistItem[] = [];

  get all() {
    return this.items.slice();
  }

  set(items: PlaylistItem[]) {
    this.items = items.slice();
    this.dispatchEvent(new CustomEvent('change', { detail: this.items }));
  }

  add(items: PlaylistItem[]) {
    this.items.push(...items);
    this.dispatchEvent(new CustomEvent('change', { detail: this.items }));
  }

  clear() {
    this.items = [];
    this.dispatchEvent(new CustomEvent('change', { detail: this.items }));
  }
}

export const playlistService = new PlaylistService();

export default playlistService;
