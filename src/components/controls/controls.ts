import { bindable } from 'aurelia';
import { audioService } from '../../core/audio';

export class Controls {
  @bindable isPlaying: boolean = false;
  public volume = 1;

  togglePlay() {
    if (this.isPlaying) {
      document.dispatchEvent(new CustomEvent('controls:pause'));
      this.isPlaying = false;
    } else {
      document.dispatchEvent(new CustomEvent('controls:play'));
      this.isPlaying = true;
    }
  }

  prev() { document.dispatchEvent(new CustomEvent('controls:prev')); }
  next() { document.dispatchEvent(new CustomEvent('controls:next')); }

  async onVolumeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.volume = Number(input.value);
    try {
      await audioService.setVolume(this.volume);
    } catch (error) {
      console.error('Volume change failed', error);
    }
  }

  attached() {
    document.addEventListener('player:state', (e: Event) => {
      const s = (e as CustomEvent).detail;
      this.isPlaying = !!s.isPlaying;
    });
  }
}
