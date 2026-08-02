import { bindable } from 'aurelia';

export class NowPlaying {
  public title: string | null = null;
  public artist: string | null = null;
  public artwork: string | null = null;
  public duration: number = 0;
  public position: number = 0;

  attached() {
    document.addEventListener('player:metadata', (e: Event) => {
      const md = (e as CustomEvent).detail;
      if (md) {
        this.title = md.title ?? this.title;
        this.artist = md.artist ?? this.artist;
        this.duration = md.duration_seconds ?? this.duration;
        // artwork handling left for future
      }
    });

    // position updates
    document.addEventListener('player:position', (e: Event) => {
      const pos = (e as CustomEvent).detail as number;
      this.position = pos;
    });
  }

  formatTime(seconds: number) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  onSeek(e: Event) {
    const input = e.target as HTMLInputElement;
    const v = parseFloat(input.value);
    this.position = v;
    this.dispatchSeek(v);
  }

  dispatchSeek(pos: number) {
    this.dispatchEvent(new CustomEvent('seek', { detail: pos }));
  }

  // allow EventTarget behavior
  dispatchEvent(e: Event) {
    // Aurelia binds event handlers on the component element automatically
    (document as any).dispatchEvent(e);
  }
}
