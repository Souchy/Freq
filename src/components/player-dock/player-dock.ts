import type { RepeatMode } from '../../core/player-controller';

const WHEEL_VOLUME_STEP = 0.05;

export class PlayerDock {
  public isExpanded = false;
  public isPlaying = false;
  public title: string | null = null;
  public artist: string | null = null;
  public duration = 0;
  public position = 0;
  public volume = 1;
  public repeatMode: RepeatMode = 'off';
  public showVolumeFlash = false;
  private volumeFlashTimer?: ReturnType<typeof setTimeout>;
  private isScrubbing = false;

  private readonly handleMetadata = (event: Event) => {
    const metadata = (event as CustomEvent).detail;
    if (!metadata) return;
    this.title = metadata.title ?? this.title;
    this.artist = metadata.artist ?? null;
    this.duration = metadata.duration_seconds ?? 0;
    this.position = 0;
  };

  private readonly handlePosition = (event: Event) => {
    if (this.isScrubbing) return;
    this.position = (event as CustomEvent<number>).detail;
  };

  private readonly handleDuration = (event: Event) => {
    this.duration = (event as CustomEvent<number>).detail;
  };

  private readonly handleStopped = () => {
    this.title = null;
    this.artist = null;
    this.duration = 0;
    this.position = 0;
  };

  private readonly handleRepeat = (event: Event) => {
    this.repeatMode = (event as CustomEvent<RepeatMode>).detail;
  };

  private readonly handleVolume = (event: Event) => {
    this.volume = (event as CustomEvent<number>).detail;
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
    document.addEventListener('player:duration', this.handleDuration);
    document.addEventListener('player:stopped', this.handleStopped);
    document.addEventListener('player:repeat', this.handleRepeat);
    document.addEventListener('player:volume', this.handleVolume);
    document.addEventListener('player:state', this.handlePlayerState);
    document.dispatchEvent(new CustomEvent('player:sync'));
  }

  detaching() {
    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('player:metadata', this.handleMetadata);
    document.removeEventListener('player:position', this.handlePosition);
    document.removeEventListener('player:duration', this.handleDuration);
    document.removeEventListener('player:stopped', this.handleStopped);
    document.removeEventListener('player:repeat', this.handleRepeat);
    document.removeEventListener('player:volume', this.handleVolume);
    document.removeEventListener('player:state', this.handlePlayerState);
    clearTimeout(this.volumeFlashTimer);
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

  public cycleRepeat() {
    document.dispatchEvent(new CustomEvent('controls:repeat'));
  }

  public get repeatLabel() {
    if (this.repeatMode === 'one') return 'Repeat current track';
    if (this.repeatMode === 'all') return 'Repeat queue';
    return 'Repeat off';
  }

  public onScrub(event: Event) {
    this.isScrubbing = true;
    this.position = Number((event.target as HTMLInputElement).value);
  }

  public onSeek(event: Event) {
    this.position = Number((event.target as HTMLInputElement).value);
    this.isScrubbing = false;
    document.dispatchEvent(new CustomEvent('seek', { detail: this.position }));
  }

  public onVolumeChange(event: Event) {
    this.volume = Number((event.target as HTMLInputElement).value);
    document.dispatchEvent(new CustomEvent('controls:volume', { detail: this.volume }));
  }

  public onWheel(event: WheelEvent) {
    if (event.deltaY === 0) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    const volume = Math.min(1, Math.max(0, this.volume + direction * WHEEL_VOLUME_STEP));
    if (volume === this.volume) return;
    this.volume = volume;
    document.dispatchEvent(new CustomEvent('controls:volume', { detail: volume }));
    this.showVolumeFlash = true;
    clearTimeout(this.volumeFlashTimer);
    this.volumeFlashTimer = setTimeout(() => this.showVolumeFlash = false, 900);
  }

  public get volumePercent() {
    return Math.round(this.volume * 100);
  }

  public formatTime(seconds: number) {
    if (!seconds || Number.isNaN(seconds)) return '0:00';
    const wholeSeconds = Math.floor(seconds);
    const minutes = Math.floor(wholeSeconds / 60);
    const remainder = String(wholeSeconds % 60).padStart(2, '0');
    return `${minutes}:${remainder}`;
  }
}
