import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { commands_fs_commands } from '../generated/specta/commands/fs_commands';
import { commands_yt } from '../generated/specta/commands/yt';
import { toastService } from './toast';

// Mirrors `DownloadProgress` in src-tauri/src/commands/yt.rs (emitted as an event, so not exported by specta).
type DownloadProgress = {
  id: string;
  stage: 'downloading' | 'converting';
  percent: number | null;
  speed_bps: number | null;
  eta_seconds: number | null;
};

export type DownloadStatus = 'starting' | 'downloading' | 'converting' | 'done' | 'error';

export type DownloadJob = {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  outputDir: string;
  status: DownloadStatus;
  percent: number | null;
  speedBps: number | null;
  etaSeconds: number | null;
  path: string | null;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
};

export type DownloadRequest = {
  url: string;
  title: string;
  thumbnail?: string | null;
};

const HISTORY_KEY = 'freq.download-history.v1';
const HISTORY_LIMIT = 50;

function readHistory(): DownloadJob[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((job): job is DownloadJob =>
      !!job && typeof job.id === 'string' && (job.status === 'done' || job.status === 'error')
    );
  } catch {
    return [];
  }
}

class DownloadsService extends EventTarget {
  private jobs: DownloadJob[] = readHistory();

  constructor() {
    super();
    if (isTauri()) {
      void listen<DownloadProgress>('download:progress', event => this.applyProgress(event.payload));
    }
  }

  get all() {
    return this.jobs.slice();
  }

  get activeCount() {
    return this.jobs.filter(job => isActive(job.status)).length;
  }

  async start(request: DownloadRequest, outputDir: string): Promise<DownloadJob> {
    const job: DownloadJob = {
      id: crypto.randomUUID(),
      url: request.url,
      title: request.title,
      thumbnail: request.thumbnail ?? null,
      outputDir,
      status: 'starting',
      percent: null,
      speedBps: null,
      etaSeconds: null,
      path: null,
      error: null,
      startedAt: Date.now(),
      finishedAt: null,
    };
    this.jobs = [job, ...this.jobs];
    this.changed();
    await this.run(job);
    return job;
  }

  async retry(id: string) {
    const job = this.jobs.find(candidate => candidate.id === id);
    if (!job || isActive(job.status)) return;
    this.patch(job, { status: 'starting', percent: null, error: null, path: null, startedAt: Date.now(), finishedAt: null });
    await this.run(job);
  }

  remove(id: string) {
    this.jobs = this.jobs.filter(job => job.id !== id || isActive(job.status));
    this.changed();
  }

  clearFinished() {
    this.jobs = this.jobs.filter(job => isActive(job.status));
    this.changed();
  }

  async reveal(path: string) {
    const result = await commands_fs_commands.revealInFolder(path);
    if (result.status === 'error') {
      toastService.show({ kind: 'error', title: 'Could not open the folder', message: result.error });
    }
  }

  play(job: DownloadJob) {
    if (!job.path) return;
    const name = job.path.split(/[\\/]/).pop() ?? job.title;
    document.dispatchEvent(new CustomEvent('queue:play-from', { detail: { items: [{ path: job.path, name }], path: job.path } }));
  }

  private async run(job: DownloadJob) {
    try {
      const result = await commands_yt.dlYt(job.url, {
        output_dir: job.outputDir,
        audio_codec: 0,
        audio_quality: 0,
        download_id: job.id,
      });
      if (result.status === 'error') throw new Error(result.error);
      this.patch(job, { status: 'done', path: result.data, percent: 100, finishedAt: Date.now() });
      this.notifyDone(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.patch(job, { status: 'error', error: message, finishedAt: Date.now() });
      toastService.show({
        kind: 'error',
        title: 'Download failed',
        message: `${job.title}: ${message}`,
        actions: [{ label: 'Retry', run: () => void this.retry(job.id) }],
      }, 9000);
    }
  }

  private notifyDone(job: DownloadJob) {
    toastService.show({
      kind: 'success',
      title: 'Download finished',
      message: job.title,
      actions: [
        { label: 'Play', run: () => this.play(job) },
        { label: 'Show in folder', run: () => job.path && void this.reveal(job.path) },
      ],
    });
  }

  private applyProgress(progress: DownloadProgress) {
    const job = this.jobs.find(candidate => candidate.id === progress.id);
    if (!job || job.status === 'done' || job.status === 'error') return;
    const finishedDownloading = progress.stage === 'downloading' && progress.percent !== null && progress.percent >= 100;
    this.patch(job, {
      status: progress.stage === 'converting' || finishedDownloading ? 'converting' : 'downloading',
      percent: progress.percent ?? job.percent,
      speedBps: progress.speed_bps,
      etaSeconds: progress.eta_seconds,
    });
  }

  private patch(job: DownloadJob, changes: Partial<DownloadJob>) {
    Object.assign(job, changes);
    this.changed();
  }

  private changed() {
    try {
      const history = this.jobs.filter(job => !isActive(job.status)).slice(0, HISTORY_LIMIT);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Storage can be unavailable; history just won't persist.
    }
    this.dispatchEvent(new CustomEvent('change', { detail: this.all }));
  }
}

function isActive(status: DownloadStatus) {
  return status === 'starting' || status === 'downloading' || status === 'converting';
}

export const downloadsService = new DownloadsService();
