import { ILogger, resolve } from "aurelia";
import { IDialogService } from "@aurelia/dialog";
import { resolveDownloadDir } from "../../core/download-location";
import { DownloadJob, downloadsService } from "../../core/downloads";
import { commands_yt } from "../../generated/specta/commands/yt";
import { SearchResultVideo } from "../../generated/specta/types";
import "./DownloadPage.scss";

export class DownloadPage {
	private readonly logger = resolve(ILogger).scopeTo("DownloadPage");
	private readonly dialogs = resolve(IDialogService);

	public activeTab: "search" | "downloads" = "search";
	public searchInput: string = "";
	public message = "";
	public isSearching = false;
	public hasSearched = false;
	public playlist: SearchResultVideo[] = [];
	public jobs: DownloadJob[] = downloadsService.all;
	public activeCount = downloadsService.activeCount;
	/** Latest download job per video URL, for the Save buttons in search results. */
	public jobsByUrl: Record<string, DownloadJob> = {};

	private readonly handleDownloadsChange = () => this.syncJobs();

	attached() {
		this.syncJobs();
		downloadsService.addEventListener("change", this.handleDownloadsChange);
	}

	detaching() {
		downloadsService.removeEventListener("change", this.handleDownloadsChange);
	}

	public setTab(tab: "search" | "downloads") {
		this.activeTab = tab;
	}

	public async clickDownload(url: string, video?: SearchResultVideo) {
		const outputDir = await resolveDownloadDir(this.dialogs);
		if (!outputDir) {
			this.message = "Download cancelled.";
			return;
		}
		this.message = "";
		void downloadsService.start(
			{ url, title: video?.title ?? url, thumbnail: video ? this.thumbnailUrl(video) : null },
			outputDir,
		);
	}

	public retry(job: DownloadJob) {
		void downloadsService.retry(job.id);
	}

	public remove(job: DownloadJob) {
		downloadsService.remove(job.id);
	}

	public clearFinished() {
		downloadsService.clearFinished();
	}

	public play(job: DownloadJob) {
		downloadsService.play(job);
	}

	public reveal(job: DownloadJob) {
		if (job.path) void downloadsService.reveal(job.path);
	}

	public formatSpeed(bytesPerSecond: number | null): string {
		if (!bytesPerSecond) return "";
		const megabytes = bytesPerSecond / (1024 * 1024);
		return megabytes >= 1 ? `${megabytes.toFixed(1)} MB/s` : `${Math.round(bytesPerSecond / 1024)} KB/s`;
	}

	public formatEta(seconds: number | null): string {
		if (seconds === null || !Number.isFinite(seconds)) return "";
		return `${this.formatDuration(seconds)} left`;
	}

	public formatTime(timestamp: number | null): string {
		return timestamp ? new Date(timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
	}

	private syncJobs() {
		this.jobs = downloadsService.all;
		this.activeCount = downloadsService.activeCount;
		const byUrl: Record<string, DownloadJob> = {};
		for (const job of [...this.jobs].reverse()) byUrl[job.url] = job;
		this.jobsByUrl = byUrl;
	}

	public async submitSearch(event: SubmitEvent) {
		event.preventDefault();
		const query = this.searchInput.trim();
		if (!query || this.isSearching) return;

		if (this.isYoutubeUrl(query)) {
			await this.clickDownload(query);
			this.activeTab = "downloads";
			return;
		}

		this.isSearching = true;
		this.hasSearched = true;
		this.playlist = [];
		this.message = "Searching YouTube...";

		try {
			const result = await commands_yt.ytSearch(query, 0, 30);
			if (result.status === "error") {
				this.logger.error("YouTube search failed", result.error);
				this.message = `Search failed: ${result.error}`;
				return;
			}

			this.message = "";
			this.playlist = result.data.filter(video => video.duration !== null);
		} catch (error) {
			this.logger.error("YouTube search failed", error);
			this.message = `Search failed: ${String(error)}`;
		} finally {
			this.isSearching = false;
		}
	}

	public formatDuration(duration: number | null): string {
		if (duration === null || !Number.isFinite(duration)) return "";
		const totalSeconds = Math.floor(duration);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = String(totalSeconds % 60).padStart(2, "0");
		return `${minutes}:${seconds}`;
	}

	public thumbnailUrl(video: SearchResultVideo): string {
		return video.thumbnail_url ?? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
	}

	private isYoutubeUrl(value: string): boolean {
		try {
			const hostname = new URL(value).hostname.replace(/^www\./, "");
			return hostname === "youtube.com" || hostname === "youtu.be" || hostname === "m.youtube.com";
		} catch {
			return false;
		}
	}
}
