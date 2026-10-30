import { isTauri } from '@tauri-apps/api/core';
import { appLocalDataDir } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { BaseDirectory, copyFile, mkdir } from '@tauri-apps/plugin-fs';
import { audioService } from './audio';
import type { PlaylistItem } from './playlist';

const androidLibraryDirectory = 'music-library';

export type LibraryImportResult = {
  items: PlaylistItem[];
  sourceLabel: string;
  /** The scanned folder; null for imports that aren't tied to one (Android file picks). */
  sourcePath: string | null;
};

export type DesktopFolderSelector = () => Promise<string | null>;

export function isAndroidApp(): boolean {
  return /android/i.test(navigator.userAgent);
}

export async function addMusicSource(
  selectDesktopFolder?: DesktopFolderSelector,
): Promise<LibraryImportResult | null> {
  if (!isTauri()) {
    throw new Error('Local music import is available in the desktop or Android app.');
  }

  if (isAndroidApp()) return importAndroidAudioFiles();
  if (!selectDesktopFolder) throw new Error('A desktop folder picker is required.');
  return scanDesktopFolder(selectDesktopFolder);
}

async function scanDesktopFolder(selectFolder: DesktopFolderSelector): Promise<LibraryImportResult | null> {
  const selected = await selectFolder();
  if (!selected) return null;

  const paths = await audioService.scanFolder(selected);

  return {
    items: paths.map(path => ({ path, name: path.split(/[\\/]/).pop() || path })),
    sourceLabel: selected.split(/[\\/]/).filter(Boolean).pop() || selected,
    sourcePath: selected,
  };
}

async function importAndroidAudioFiles(): Promise<LibraryImportResult | null> {
  const selected = await open({
    multiple: true,
    directory: false,
    pickerMode: 'document',
    filters: [{ name: 'Audio files', extensions: ['audio/*'] }],
  });
  if (!selected) return null;

  const uris = Array.isArray(selected) ? selected : [selected];
  const appDataDirectory = await appLocalDataDir();
  await mkdir(androidLibraryDirectory, {
    baseDir: BaseDirectory.AppLocalData,
    recursive: true,
  });

  const items: PlaylistItem[] = [];
  for (const [index, uri] of uris.entries()) {
    const sourceName = nameFromContentUri(uri, index);
    const extension = audioExtension(sourceName);
    const destinationName = `${hashUri(uri)}${extension}`;
    await copyFile(uri, `${androidLibraryDirectory}/${destinationName}`, {
      toPathBaseDir: BaseDirectory.AppLocalData,
    });

    items.push({
      path: `${appDataDirectory}/${androidLibraryDirectory}/${destinationName}`,
      name: sourceName,
    });
  }

  return { items, sourceLabel: 'this device', sourcePath: null };
}

function nameFromContentUri(uri: string, index: number): string {
  try {
    const segments = decodeURIComponent(new URL(uri).pathname).split('/').filter(Boolean);
    const leaf = segments.at(-1)?.split(':').pop() ?? '';
    if (/\.(mp3|wav|flac|m4a|ogg)$/i.test(leaf)) return leaf;
  } catch {
    // Use a stable label when the provider returns an opaque URI.
  }

  return `Imported track ${index + 1}`;
}

function audioExtension(name: string): string {
  return /\.(mp3|wav|flac|m4a|ogg)$/i.exec(name)?.[0].toLowerCase() ?? '.audio';
}

function hashUri(uri: string): string {
  let hash = 2166136261;
  for (let index = 0; index < uri.length; index += 1) {
    hash ^= uri.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
