import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(),
  open: vi.fn(),
  appLocalDataDir: vi.fn(),
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  scanFolder: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri }));
vi.mock('@tauri-apps/api/path', () => ({ appLocalDataDir: mocks.appLocalDataDir }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppLocalData: 'appLocalData' },
  copyFile: mocks.copyFile,
  mkdir: mocks.mkdir,
}));
vi.mock('../src/core/audio', () => ({
  audioService: { scanFolder: mocks.scanFolder },
}));

import { addMusicSource } from '../src/core/library-import';

const originalUserAgent = navigator.userAgent;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isTauri.mockReturnValue(true);
  mocks.appLocalDataDir.mockResolvedValue('/app/data');
  mocks.mkdir.mockResolvedValue(undefined);
  mocks.copyFile.mockResolvedValue(undefined);
});

afterEach(() => {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent });
});

describe('local music import', () => {
  it('scans a selected folder on desktop', async () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Desktop WebView' });
    mocks.open.mockResolvedValue('C:/Music');
    mocks.scanFolder.mockResolvedValue(['C:/Music/song.flac']);

    const result = await addMusicSource();

    expect(mocks.scanFolder).toHaveBeenCalledWith('C:/Music');
    expect(result).toEqual({
      items: [{ path: 'C:/Music/song.flac', name: 'song.flac' }],
      sourceLabel: 'Music',
    });
    expect(mocks.copyFile).not.toHaveBeenCalled();
  });

  it('copies Android content URIs into app-local storage', async () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Android WebView' });
    mocks.open.mockResolvedValue([
      'content://media/document/primary%3AMusic%2Ftrack.mp3',
      'content://media/external/audio/media/42',
    ]);

    const result = await addMusicSource();

    expect(mocks.mkdir).toHaveBeenCalledWith('music-library', {
      baseDir: 'appLocalData',
      recursive: true,
    });
    expect(mocks.copyFile).toHaveBeenCalledTimes(2);
    expect(result?.items).toHaveLength(2);
    expect(result?.items[0]).toMatchObject({
      name: 'track.mp3',
      path: expect.stringMatching(/^\/app\/data\/music-library\/.*\.mp3$/),
    });
    expect(result?.items[1].name).toBe('Imported track 2');
    expect(result?.items[1].path).toMatch(/^\/app\/data\/music-library\/.*\.audio$/);
  });

  it('does nothing when the picker is cancelled', async () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Android WebView' });
    mocks.open.mockResolvedValue(null);

    await expect(addMusicSource()).resolves.toBeNull();
    expect(mocks.copyFile).not.toHaveBeenCalled();
  });

  it('rejects imports outside the native app', async () => {
    mocks.isTauri.mockReturnValue(false);

    await expect(addMusicSource()).rejects.toThrow('available in the desktop or Android app');
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
