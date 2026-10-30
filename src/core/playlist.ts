export type PlaylistItem = { path: string; name: string };
export type LibrarySource = { path: string; label: string };

const storageKey = 'freq.local-library.v1';
const sourcesKey = 'freq.library-sources.v1';

function readStoredSources(): LibrarySource[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(sourcesKey) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((source): source is LibrarySource =>
      !!source && typeof source.path === 'string' && typeof source.label === 'string'
    );
  } catch {
    return [];
  }
}

function normalizeFolder(path: string): string {
  return path.replace(/[\\/]+$/, '').replace(/\//g, '\\').toLocaleLowerCase();
}

export function isInFolder(itemPath: string, folder: string): boolean {
  return normalizeFolder(itemPath).startsWith(`${normalizeFolder(folder)}\\`);
}

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
  private sources: LibrarySource[] = readStoredSources();

  private persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.items));
      localStorage.setItem(sourcesKey, JSON.stringify(this.sources));
    } catch (error) {
      console.warn('Could not persist the local library', error);
    }
  }

  get all() {
    return this.items.slice();
  }

  get allSources() {
    return this.sources.slice();
  }

  addSource(source: LibrarySource, items: PlaylistItem[]) {
    const key = normalizeFolder(source.path);
    if (!this.sources.some(existing => normalizeFolder(existing.path) === key)) {
      this.sources = [...this.sources, source];
    }
    this.add(items);
  }

  /** Forgets a folder and its tracks, keeping tracks that another remembered folder still covers. */
  removeSource(path: string) {
    const key = normalizeFolder(path);
    this.sources = this.sources.filter(source => normalizeFolder(source.path) !== key);
    this.items = this.items.filter(item =>
      !isInFolder(item.path, path) || this.sources.some(source => isInFolder(item.path, source.path))
    );
    this.persist();
    this.dispatchEvent(new CustomEvent('change', { detail: this.items }));
  }

  /** Swaps a folder's tracks for a fresh scan of it; returns how many tracks were added and removed. */
  rescanSource(path: string, items: PlaylistItem[]) {
    const fresh = new Set(items.map(item => item.path));
    const known = new Set(this.items.map(item => item.path));
    const before = this.items.length;
    this.items = this.items.filter(item => !isInFolder(item.path, path) || fresh.has(item.path));
    const removed = before - this.items.length;
    const added = items.filter(item => !known.has(item.path)).length;
    this.add(items);
    return { added, removed };
  }

  /** Removes tracks that don't belong to any remembered folder. */
  removeUnsourced() {
    this.items = this.items.filter(item => this.sources.some(source => isInFolder(item.path, source.path)));
    this.persist();
    this.dispatchEvent(new CustomEvent('change', { detail: this.items }));
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
    this.sources = [];
    this.persist();
    this.dispatchEvent(new CustomEvent('change', { detail: this.items }));
  }
}

export const playlistService = new PlaylistService();

export default playlistService;
