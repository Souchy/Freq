import { IDialogService } from '@aurelia/dialog';
import { FolderPickerDialog, FolderPickerModel, FolderPickerResult } from '../components/folder-picker/folder-picker-dialog';
import { getDownloadSettings, saveDownloadSettings } from './settings';

export async function pickFolder(dialogs: IDialogService, model: FolderPickerModel): Promise<FolderPickerResult | null> {
  const { dialog } = await dialogs.open({
    component: () => FolderPickerDialog,
    model,
    options: { modal: true },
  });
  const closed = await dialog.closed;
  return closed.status === 'ok' ? closed.value as FolderPickerResult : null;
}

/** Returns the folder to save downloads into, asking the user when needed; null if they cancel. */
export async function resolveDownloadDir(dialogs: IDialogService): Promise<string | null> {
  const settings = getDownloadSettings();
  if (settings.downloadDir && !settings.askEveryTime) return settings.downloadDir;

  const isFirstTime = !settings.downloadDir;
  const result = await pickFolder(dialogs, {
    kicker: 'SAVE LOCATION',
    title: isFirstTime ? 'Where should Freq save your music?' : 'Save this download to…',
    message: isFirstTime ? 'You can change this anytime in Settings.' : undefined,
    initialPath: settings.downloadDir,
    confirmLabel: 'Save here',
    showAskToggle: true,
    askEveryTime: settings.askEveryTime,
  });
  if (!result) return null;

  saveDownloadSettings({ downloadDir: result.path, askEveryTime: result.askEveryTime });
  return result.path;
}
