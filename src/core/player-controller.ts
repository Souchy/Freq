import { audioService } from './audio';
import { playlistService } from './playlist';

class PlayerController {
  private queue: Array<{ path: string; name: string }> = [];
  private isPlaying = false;

  constructor() {
    // listen for UI events
    document.addEventListener('controls:play', () => this.play());
    document.addEventListener('controls:pause', () => this.pause());
    document.addEventListener('controls:next', () => this.next());
    document.addEventListener('controls:prev', () => this.prev());
    document.addEventListener('queue:add', (e: Event) => this.enqueue((e as CustomEvent).detail));
    document.addEventListener('seek', (e: Event) => this.seek((e as CustomEvent).detail));

    // sync playlist service
    playlistService.addEventListener('change', (e: Event) => { /* no-op for now */ });
  }

  enqueue(item: { path: string; name: string }) {
    this.queue.push(item);
    this.emitQueue();
    if (!this.isPlaying) this.play();
  }

  emitQueue() {
    document.dispatchEvent(new CustomEvent('player:queue', { detail: this.queue }));
  }

  async play() {
    if (this.queue.length === 0) return;
    const item = this.queue[0];
    try {
      await audioService.loadAndPlay(item.path);
      this.isPlaying = true;
      this.emitState();
      // emit metadata
      const md = await audioService.getMetadata(item.path).catch(() => null);
      document.dispatchEvent(new CustomEvent('player:metadata', { detail: md }));
      // TODO: monitor position and emit 'player:position' periodically
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
    await audioService.resume().catch(() => null);
    this.isPlaying = true;
    this.emitState();
  }

  async stop() {
    await audioService.stop().catch(() => null);
    this.isPlaying = false;
    this.emitState();
  }

  async next() {
    this.queue.shift();
    this.emitQueue();
    await this.play();
  }

  async prev() {
    // basic prev: restart current
    if (this.queue.length > 0) {
      await this.play();
    }
  }

  async seek(position: number) {
    await audioService.seek(position).catch((e) => console.warn('seek not available', e));
  }

  emitState() {
    document.dispatchEvent(new CustomEvent('player:state', { detail: { isPlaying: this.isPlaying } }));
  }
}

export const playerController = new PlayerController();
