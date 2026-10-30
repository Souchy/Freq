export type PlaylistItem = { path: string; name: string };

const storageKey = 'freq.local-library.v1';

function readStoredItems(): PlaylistItem[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];

    const items: unknown = JSON.parse(stored);
    if (!Array.isArray(items)) return [];

    return items.filter((item): item is PlaylistItem =>
      !!item && typeof item.path === 'string' && typeof item.name === 'string'
    );
  } catch {
    return [];
  }
}

class PlaylistService extends EventTarget {
  private items: PlaylistItem[] = readStoredItems();

  private persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.items));
    } catch (error) {
      console.warn('Could not persist the local library', error);
    }
  }

  get all() {
    return this.items.slice();
  }

  set(items: PlaylistItem[]) {
    this.items = items.slice();
    this.persist();
    this.dispatchEvent(new CustomEvent('change', { detail: this.items }));
  }

  add(items: PlaylistItem[]) {
    const byPath = new Map(this.items.map(item => [item.path, item]));
    for (const item of items) byPath.set(item.path, item);
    this.items = [...byPath.values()];
    this.persist();
    this.dispatchEvent(new CustomEvent('change', { detail: this.items }));
  }

  clear() {
    this.items = [];
    this.persist();
    this.dispatchEvent(new CustomEvent('change', { detail: this.items }));
  }
}

export const playlistService = new PlaylistService();

export default playlistService;
