export type DownloadSettings = {
  downloadDir: string | null;
  askEveryTime: boolean;
};

const STORAGE_KEY = 'freq.download-settings.v1';

export function getDownloadSettings(): DownloadSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<DownloadSettings> | null;
    return {
      downloadDir: typeof parsed?.downloadDir === 'string' && parsed.downloadDir ? parsed.downloadDir : null,
      askEveryTime: parsed?.askEveryTime === true,
    };
  } catch {
    return { downloadDir: null, askEveryTime: false };
  }
}

export function saveDownloadSettings(settings: DownloadSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable; settings just won't persist.
  }
}
