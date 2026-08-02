import { bindable } from 'aurelia';

export class Controls {
  @bindable isPlaying: boolean = false;

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
  attached() {
    document.addEventListener('player:state', (e: Event) => {
      const s = (e as CustomEvent).detail;
      this.isPlaying = !!s.isPlaying;
    });
  }
}
