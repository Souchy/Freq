import { IDialogService } from '@aurelia/dialog';
import { resolve } from 'aurelia';
import { audioService } from '../../core/audio';
import { pickFolder } from '../../core/download-location';
import { isInFolder, playlistService } from '../../core/playlist';
import { getDownloadSettings, saveDownloadSettings } from '../../core/settings';
import { applyTheme, getTheme, Theme } from '../../core/theme';

export class SettingsPage {
  private readonly dialogs = resolve(IDialogService);

  public downloadDir: string | null = null;
  public askEveryTime = false;
  public theme: Theme = getTheme();
  public trackCount = playlistService.all.length;
  public folders: Array<{ path: string; label: string; count: number }> = [];
  public looseCount = 0;
  public isScanning = false;
  public rescanningPath: string | null = null;
  public libraryMessage = '';

  private readonly handleThemeChange = (event: Event) => {
    this.theme = (event as CustomEvent<Theme>).detail;
  };

  private readonly handleLibraryChange = () => this.refreshLibrary();

  attached() {
    const settings = getDownloadSettings();
    this.downloadDir = settings.downloadDir;
    this.askEveryTime = settings.askEveryTime;
    this.refreshLibrary();
    document.addEventListener('theme:change', this.handleThemeChange);
    playlistService.addEventListener('change', this.handleLibraryChange);
  }

  detaching() {
    document.removeEventListener('theme:change', this.handleThemeChange);
    playlistService.removeEventListener('change', this.handleLibraryChange);
  }

  public async changeDownloadDir() {
    const result = await pickFolder(this.dialogs, {
      kicker: 'SAVE LOCATION',
      title: 'Choose where downloads are saved',
      initialPath: this.downloadDir,
      confirmLabel: 'Use this folder',
    });
    if (!result) return;
    this.downloadDir = result.path;
    this.persistDownloads();
  }

  public resetDownloadDir() {
    this.downloadDir = null;
    this.persistDownloads();
  }

  public setAskEveryTime(event: Event) {
    this.askEveryTime = (event.target as HTMLInputElement).checked;
    this.persistDownloads();
  }

  public setTheme(theme: Theme) {
    applyTheme(theme);
  }

  public async scanFolder() {
    if (this.isScanning) return;
    const result = await pickFolder(this.dialogs, {
      kicker: 'LIBRARY',
      title: 'Add a music folder',
      message: 'Freq scans this folder and everything inside it for audio files.',
      confirmLabel: 'Scan this folder',
    });
    if (!result) return;

    this.isScanning = true;
    this.libraryMessage = '';
    try {
      const paths = await audioService.scanFolder(result.path);
      const label = result.path.split(/[\\/]/).filter(Boolean).pop() || result.path;
      playlistService.addSource(
        { path: result.path, label },
        paths.map(path => ({ path, name: path.split(/[\\/]/).pop() || path })),
      );
      this.libraryMessage = paths.length
        ? `Added ${paths.length} ${paths.length === 1 ? 'track' : 'tracks'}.`
        : 'No supported audio files found in that folder.';
    } catch (error) {
      this.libraryMessage = `Could not scan that folder: ${String(error)}`;
    } finally {
      this.isScanning = false;
    }
  }

  public async rescanFolder(folder: { path: string; label: string }) {
    if (this.rescanningPath) return;
    this.rescanningPath = folder.path;
    this.libraryMessage = '';
    try {
      const paths = await audioService.scanFolder(folder.path);
      const { added, removed } = playlistService.rescanSource(
        folder.path,
        paths.map(path => ({ path, name: path.split(/[\\/]/).pop() || path })),
      );
      this.libraryMessage = added || removed
        ? `${folder.label}: ${added} added, ${removed} removed.`
        : `${folder.label} is up to date.`;
    } catch (error) {
      this.libraryMessage = `Could not rescan ${folder.label}: ${String(error)}`;
    } finally {
      this.rescanningPath = null;
    }
  }

  public removeFolder(path: string) {
    playlistService.removeSource(path);
  }

  public removeLooseTracks() {
    playlistService.removeUnsourced();
  }

  private refreshLibrary() {
    const tracks = playlistService.all;
    const sources = playlistService.allSources;
    this.trackCount = tracks.length;
    this.folders = sources.map(source => ({
      ...source,
      count: tracks.filter(track => isInFolder(track.path, source.path)).length,
    }));
    this.looseCount = tracks.filter(track => !sources.some(source => isInFolder(track.path, source.path))).length;
  }

  private persistDownloads() {
    saveDownloadSettings({ downloadDir: this.downloadDir, askEveryTime: this.askEveryTime });
  }
}
