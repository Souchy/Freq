import { audioService } from './audio';

export type RepeatMode = 'off' | 'all' | 'one';

const REPEAT_ORDER: RepeatMode[] = ['off', 'all', 'one'];
const POLL_INTERVAL_MS = 250;
const SESSION_KEY = 'freq.player-session.v2';
// Pressing previous after this many seconds restarts the track instead.
const PREVIOUS_RESTART_THRESHOLD_S = 3;

type QueueItem = { path: string; name: string };
type PlayerSession = { queue: QueueItem[]; currentIndex: number; repeatMode: RepeatMode };
export type QueueState = { items: QueueItem[]; currentIndex: number };

type TrackMetadataDetail = {
  title: string;
  artist: string | null;
  album: string | null;
  duration_seconds: number | null;
};

class PlayerController {
  private queue: QueueItem[] = [];
  private currentIndex = 0;
  private position = 0;
  private isPlaying = false;
  private hasTrack = false;
  private currentPath: string | null = null;
  private repeatMode: RepeatMode = 'off';
  private volume = 1;
  private metadata: TrackMetadataDetail | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  // Incremented on every load/stop so stale status responses are ignored.
  private trackToken = 0;

  constructor() {
    // listen for UI events
    document.addEventListener('controls:play', () => this.play());
    document.addEventListener('controls:pause', () => this.pause());
    document.addEventListener('controls:resume', () => this.resume());
    document.addEventListener('controls:next', () => this.next());
    document.addEventListener('controls:prev', () => this.prev());
    document.addEventListener('controls:repeat', () => this.cycleRepeat());
    document.addEventListener('queue:add', (e: Event) => this.enqueue((e as CustomEvent).detail));
    document.addEventListener('queue:replace', (e: Event) => this.replaceQueue((e as CustomEvent).detail));
    document.addEventListener('queue:clear', () => void this.clearQueue());
    document.addEventListener('queue:play-from', (e: Event) => {
      const { items, path } = (e as CustomEvent<{ items: QueueItem[]; path: string }>).detail;
      this.playFrom(path, items);
    });
    document.addEventListener('queue:remove', (e: Event) => this.removeFromQueue((e as CustomEvent<number>).detail));
    document.addEventListener('queue:jump', (e: Event) => this.jumpTo((e as CustomEvent<number>).detail));
    document.addEventListener('seek', (e: Event) => this.seek((e as CustomEvent).detail));
    document.addEventListener('controls:volume', (e: Event) => this.setVolume((e as CustomEvent<number>).detail));
    document.addEventListener('player:sync', () => this.emitAll());

    void this.restore(this.readSession());
  }

  // The backend outlives webview reloads, so adopt whatever it is still playing.
  private async restore(saved: PlayerSession | null) {
    const status = await audioService.getPlaybackStatus().catch(() => null);
    if (!status) return;
    this.volume = status.volume;
    if (saved) this.repeatMode = saved.repeatMode;
    if (status.path && !this.hasTrack) {
      const name = status.path.split(/[\\/]/).pop() ?? status.path;
      if (saved?.queue[saved.currentIndex]?.path === status.path) {
        this.queue = saved.queue;
        this.currentIndex = saved.currentIndex;
      } else {
        this.queue = [{ path: status.path, name }];
        this.currentIndex = 0;
      }
      this.hasTrack = true;
      this.currentPath = status.path;
      this.isPlaying = !status.is_paused;
      const token = this.trackToken;
      this.emitAll();
      // Polling also advances the queue if the track finished during the reload.
      this.startPolling();
      await this.loadMetadata(this.queue[this.currentIndex], token);
    } else {
      if (saved && !this.hasTrack && this.queue.length === 0) {
        this.queue = saved.queue;
        this.currentIndex = saved.currentIndex;
      }
      this.emitAll();
    }
  }

  private readSession(): PlayerSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<PlayerSession>;
      const queue = Array.isArray(parsed.queue)
        ? parsed.queue.filter((item): item is QueueItem => typeof item?.path === 'string' && typeof item?.name === 'string')
        : [];
      const repeatMode = REPEAT_ORDER.includes(parsed.repeatMode as RepeatMode) ? parsed.repeatMode as RepeatMode : 'off';
      const index = Number(parsed.currentIndex);
      const currentIndex = Number.isInteger(index) && index >= 0 && index <= queue.length ? index : 0;
      return { queue, currentIndex, repeatMode };
    } catch {
      return null;
    }
  }

  private saveSession() {
    try {
      const session: PlayerSession = { queue: this.queue, currentIndex: this.currentIndex, repeatMode: this.repeatMode };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // Storage can be unavailable; the queue just won't survive a reload.
    }
  }

  private emitAll() {
    this.emitQueue();
    this.emitState();
    this.emitVolume();
    document.dispatchEvent(new CustomEvent('player:repeat', { detail: this.repeatMode }));
    if (this.hasTrack && this.metadata) {
      document.dispatchEvent(new CustomEvent('player:metadata', { detail: this.metadata }));
    } else if (!this.hasTrack) {
      document.dispatchEvent(new CustomEvent('player:stopped'));
    }
  }

  private async setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, Math.round(volume * 100) / 100));
    this.emitVolume();
    await audioService.setVolume(this.volume).catch(() => undefined);
  }

  private emitVolume() {
    document.dispatchEvent(new CustomEvent('player:volume', { detail: this.volume }));
  }

  private async loadMetadata(item: { path: string; name: string }, token: number) {
    const metadata = await audioService.getMetadata(item.path).catch(() => null);
    if (token !== this.trackToken) return;
    this.metadata = {
      title: metadata?.title ?? item.name.replace(/\.[^.]+$/, ''),
      artist: metadata?.artist ?? null,
      album: metadata?.album ?? null,
      duration_seconds: metadata?.duration_seconds ?? null,
    };
    document.dispatchEvent(new CustomEvent('player:metadata', { detail: this.metadata }));
  }

  enqueue(item: QueueItem) {
    this.queue.push(item);
    if (!this.hasTrack) {
      // After the queue ran out the index sits past the end; point it at the new track.
      this.currentIndex = Math.min(this.currentIndex, this.queue.length - 1);
      this.emitQueue();
      void this.play();
      return;
    }
    this.emitQueue();
  }

  removeFromQueue(index: number) {
    if (index < 0 || index >= this.queue.length) return;
    if (this.hasTrack && index === this.currentIndex) return;
    this.queue.splice(index, 1);
    if (index < this.currentIndex) this.currentIndex--;
    this.emitQueue();
  }

  async clearQueue() {
    if (this.queue.length === 0 && !this.hasTrack) return;
    this.queue = [];
    this.currentIndex = 0;
    this.emitQueue();
    if (this.hasTrack) await this.stop();
  }

  replaceQueue(items: QueueItem[]) {
    this.queue = [...items];
    this.currentIndex = 0;
    this.emitQueue();
    void this.play();
  }

  playFrom(path: string, fallbackItems: QueueItem[]) {
    const index = this.queue.findIndex(item => item.path === path);
    if (index < 0) {
      this.replaceQueue(fallbackItems);
      return;
    }
    this.jumpTo(index);
  }

  jumpTo(index: number) {
    if (index < 0 || index >= this.queue.length) return;
    this.currentIndex = index;
    this.emitQueue();
    void this.play();
  }

  emitQueue() {
    const detail: QueueState = { items: this.queue, currentIndex: this.currentIndex };
    document.dispatchEvent(new CustomEvent('player:queue', { detail }));
    this.saveSession();
  }

  async play() {
    const item = this.queue[this.currentIndex];
    if (!item) {
      await this.stop();
      return;
    }
    const token = ++this.trackToken;
    try {
      await audioService.loadAndPlay(item.path);
      if (token !== this.trackToken) return;
      this.hasTrack = true;
      this.currentPath = item.path;
      this.isPlaying = true;
      this.emitState();
      this.position = 0;
      this.emitPosition(0);
      this.startPolling();
      await this.loadMetadata(item, token);
    } catch (err) {
      console.error('play failed', err);
    }
  }

  async pause() {
    await audioService.pause().catch(() => null);
    this.isPlaying = false;
    this.emitState();
  }

  async resume() {
    if (!this.hasTrack) {
      if (this.currentIndex >= this.queue.length) this.currentIndex = 0;
      this.emitQueue();
      await this.play();
      return;
    }
    await audioService.resume().catch(() => null);
    this.isPlaying = true;
    this.emitState();
  }

  async stop() {
    this.trackToken++;
    this.stopPolling();
    await audioService.stop().catch(() => null);
    this.hasTrack = false;
    this.currentPath = null;
    this.isPlaying = false;
    this.metadata = null;
    this.emitState();
    document.dispatchEvent(new CustomEvent('player:stopped'));
  }

  async next() {
    if (this.currentIndex + 1 < this.queue.length) {
      this.currentIndex++;
    } else if (this.repeatMode === 'all' && this.queue.length > 0) {
      this.currentIndex = 0;
    } else {
      this.currentIndex = this.queue.length;
      this.emitQueue();
      await this.stop();
      return;
    }
    this.emitQueue();
    await this.play();
  }

  private async handleTrackEnd() {
    if (this.repeatMode === 'one') {
      await this.play();
    } else {
      await this.next();
    }
  }

  private startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  private stopPolling() {
    if (!this.pollTimer) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async poll() {
    if (this.isPolling || !this.hasTrack) return;
    this.isPolling = true;
    const token = this.trackToken;
    try {
      const status = await audioService.getPlaybackStatus();
      if (token !== this.trackToken) return;
      if (status.duration_seconds != null) {
        document.dispatchEvent(new CustomEvent('player:duration', { detail: status.duration_seconds }));
      }
      this.position = status.position_seconds;
      this.emitPosition(status.position_seconds);
      if (status.is_finished) await this.handleTrackEnd();
    } catch (err) {
      console.warn('playback status unavailable', err);
    } finally {
      this.isPolling = false;
    }
  }

  private cycleRepeat() {
    const index = REPEAT_ORDER.indexOf(this.repeatMode);
    this.repeatMode = REPEAT_ORDER[(index + 1) % REPEAT_ORDER.length];
    this.saveSession();
    document.dispatchEvent(new CustomEvent('player:repeat', { detail: this.repeatMode }));
  }

  private emitPosition(position: number) {
    document.dispatchEvent(new CustomEvent('player:position', { detail: position }));
  }

  async prev() {
    if (this.queue.length === 0) return;
    const canGoBack = this.currentIndex > 0 || this.repeatMode === 'all';
    if (this.position <= PREVIOUS_RESTART_THRESHOLD_S && canGoBack) {
      this.currentIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.queue.length - 1;
    }
    this.currentIndex = Math.min(this.currentIndex, this.queue.length - 1);
    this.emitQueue();
    await this.play();
  }

  async seek(position: number) {
    if (!this.hasTrack) return;
    await audioService.seek(position).catch((e) => console.warn('seek not available', e));
    this.position = position;
    this.emitPosition(position);
  }

  emitState() {
    document.dispatchEvent(new CustomEvent('player:state', {
      detail: { isPlaying: this.isPlaying, currentPath: this.currentPath },
    }));
  }
}

export const playerController = new PlayerController();
