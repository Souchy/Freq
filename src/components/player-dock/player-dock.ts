import { audioService } from '../../core/audio';

export class PlayerDock {
  public isExpanded = false;
  public isPlaying = false;
  public title: string | null = null;
  public artist: string | null = null;
  public duration = 0;
  public position = 0;
  public volume = 1;

  private readonly handleMetadata = (event: Event) => {
    const metadata = (event as CustomEvent).detail;
    if (!metadata) return;
    this.title = metadata.title ?? this.title;
    this.artist = metadata.artist ?? this.artist;
    this.duration = metadata.duration_seconds ?? this.duration;
    this.position = 0;
  };

  private readonly handlePosition = (event: Event) => {
    this.position = (event as CustomEvent<number>).detail;
  };

  private readonly handlePlayerState = (event: Event) => {
    this.isPlaying = !!(event as CustomEvent<{ isPlaying: boolean }>).detail.isPlaying;
  };

  private readonly handleOutsideClick = (event: MouseEvent) => {
    const target = event.target;
    if (this.isExpanded && !(target instanceof Element && target.closest('.player-dock'))) {
      this.isExpanded = false;
    }
  };

  attached() {
    document.addEventListener('click', this.handleOutsideClick);
    document.addEventListener('player:metadata', this.handleMetadata);
    document.addEventListener('player:position', this.handlePosition);
    document.addEventListener('player:state', this.handlePlayerState);
  }

  detaching() {
    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('player:metadata', this.handleMetadata);
    document.removeEventListener('player:position', this.handlePosition);
    document.removeEventListener('player:state', this.handlePlayerState);
  }

  public toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  public onDockClick(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('button, input, label')) return;
    event.stopPropagation();
    this.toggleExpanded();
  }

  public onDockKeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    this.toggleExpanded();
  }

  public togglePlay() {
    const command = this.isPlaying ? 'controls:pause' : 'controls:resume';
    document.dispatchEvent(new CustomEvent(command));
  }

  public previous() {
    document.dispatchEvent(new CustomEvent('controls:prev'));
  }

  public next() {
    document.dispatchEvent(new CustomEvent('controls:next'));
  }

  public async onSeek(event: Event) {
    const input = event.target as HTMLInputElement;
    this.position = Number(input.value);
    await audioService.seek(this.position).catch(() => undefined);
  }

  public async onVolumeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.volume = Number(input.value);
    await audioService.setVolume(this.volume).catch(() => undefined);
  }

  public formatTime(seconds: number) {
    if (!seconds || Number.isNaN(seconds)) return '0:00';
    const wholeSeconds = Math.floor(seconds);
    const minutes = Math.floor(wholeSeconds / 60);
    const remainder = String(wholeSeconds % 60).padStart(2, '0');
    return `${minutes}:${remainder}`;
  }
}