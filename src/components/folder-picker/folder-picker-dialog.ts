import { IDialogController } from '@aurelia/dialog';
import { resolve } from 'aurelia';
import { commands_fs_commands } from '../../generated/specta/commands/fs_commands';
import type { DirectoryEntry, FolderLocation } from '../../generated/specta/types';

export type FolderPickerModel = {
  title: string;
  message?: string;
  kicker?: string;
  initialPath?: string | null;
  confirmLabel?: string;
  showAskToggle?: boolean;
  askEveryTime?: boolean;
};

export type FolderPickerResult = {
  path: string;
  askEveryTime: boolean;
};

type Crumb = { label: string; path: string };

export class FolderPickerDialog {
  private readonly controller = resolve(IDialogController);

  public title = '';
  public message = '';
  public kicker = 'CHOOSE A FOLDER';
  public confirmLabel = 'Select folder';
  public showAskToggle = false;
  public askEveryTime = false;

  public currentPath = '';
  public parentPath: string | null = null;
  public directories: DirectoryEntry[] = [];
  public locations: FolderLocation[] = [];
  public isLoading = false;
  public error = '';

  public isCreating = false;
  public newFolderName = '';
  public newFolderInput?: HTMLInputElement;

  public isEditingPath = false;
  public pathDraft = '';
  public pathInput?: HTMLInputElement;

  public get places() {
    return this.locations.filter(location => !location.is_drive);
  }

  public get drives() {
    return this.locations.filter(location => location.is_drive);
  }

  public get crumbs(): Crumb[] {
    const path = this.currentPath;
    const separator = path.includes('\\') ? '\\' : '/';
    const crumbs: Crumb[] = path.startsWith('/') ? [{ label: '/', path: '/' }] : [];
    let accumulated = path.startsWith('/') ? '/' : '';
    path.split(/[\\/]/).filter(Boolean).forEach((part, index) => {
      if (index === 0 && /^[A-Za-z]:$/.test(part)) {
        accumulated = part + separator;
      } else {
        accumulated = accumulated.endsWith(separator) || !accumulated ? accumulated + part : accumulated + separator + part;
      }
      crumbs.push({ label: part, path: accumulated });
    });
    return crumbs;
  }

  public async activate(model: FolderPickerModel) {
    this.title = model.title;
    this.message = model.message ?? '';
    this.kicker = model.kicker ?? this.kicker;
    this.confirmLabel = model.confirmLabel ?? this.confirmLabel;
    this.showAskToggle = model.showAskToggle ?? false;
    this.askEveryTime = model.askEveryTime ?? false;

    const [locations, fallback] = await Promise.all([
      commands_fs_commands.getFolderLocations().catch(() => [] as FolderLocation[]),
      model.initialPath ? Promise.resolve(null) : commands_fs_commands.getDefaultDownloadDir().catch(() => null),
    ]);
    this.locations = locations;
    const defaultDir = fallback?.status === 'ok' ? fallback.data : null;
    await this.openNearest(model.initialPath || defaultDir || locations[0]?.path || '');
  }

  public async open(path: string, reportErrors = true): Promise<boolean> {
    if (!path) return false;
    this.isLoading = true;
    try {
      const result = await commands_fs_commands.listDirectories(path);
      if (result.status === 'error') {
        if (reportErrors) this.error = result.error;
        return false;
      }
      this.currentPath = result.data.path;
      this.parentPath = result.data.parent;
      this.directories = result.data.directories;
      this.error = '';
      this.isCreating = false;
      return true;
    } catch (error) {
      if (reportErrors) this.error = String(error);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  public startPathEdit() {
    this.pathDraft = this.currentPath;
    this.isEditingPath = true;
    requestAnimationFrame(() => {
      this.pathInput?.focus();
      this.pathInput?.select();
    });
  }

  public onCrumbsClick(event: MouseEvent) {
    // Only the empty space around the crumbs switches to typing, like a file explorer.
    if (event.target === event.currentTarget) this.startPathEdit();
  }

  public cancelPathEdit() {
    this.isEditingPath = false;
  }

  public async submitPath(event: Event) {
    event.preventDefault();
    const path = this.pathDraft.trim().replace(/^"(.*)"$/, '$1');
    if (!path) return;
    if (await this.open(path)) this.isEditingPath = false;
  }

  public onPathKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return true;
    event.preventDefault();
    event.stopPropagation();
    this.cancelPathEdit();
    return false;
  }

  public startCreate() {
    this.isCreating = true;
    this.newFolderName = '';
    requestAnimationFrame(() => this.newFolderInput?.focus());
  }

  public cancelCreate() {
    this.isCreating = false;
    this.newFolderName = '';
  }

  public onNewFolderKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return true;
    // Keep the native dialog from treating Escape as "close".
    event.preventDefault();
    event.stopPropagation();
    this.cancelCreate();
    return false;
  }

  public async createFolder(event: Event) {
    event.preventDefault();
    const result = await commands_fs_commands.createDirectory(this.currentPath, this.newFolderName);
    if (result.status === 'error') {
      this.error = result.error;
      return;
    }
    await this.open(result.data);
  }

  public confirm() {
    if (!this.currentPath) return;
    const result: FolderPickerResult = { path: this.currentPath, askEveryTime: this.askEveryTime };
    void this.controller.ok(result);
  }

  public cancel() {
    void this.controller.cancel();
  }

  // Walk up from a folder that may not exist yet (e.g. a default) to the closest one that does.
  private async openNearest(path: string) {
    let candidate: string | null = path;
    while (candidate) {
      if (await this.open(candidate, false)) return;
      candidate = parentOf(candidate);
    }
    if (this.locations[0]) await this.open(this.locations[0].path);
  }
}

function parentOf(path: string): string | null {
  const trimmed = path.replace(/[\\/]+$/, '');
  const index = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  if (index < 0) return null;
  const parent = trimmed.slice(0, index);
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}\\`;
  return parent || '/';
}
