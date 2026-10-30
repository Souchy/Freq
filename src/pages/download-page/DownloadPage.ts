import { ILogger, resolve } from "aurelia";
import { commands_yt } from "../../generated/specta/commands/yt";
import { SearchResultVideo } from "../../generated/specta/types";
import "./DownloadPage.scss";

type DownloadStatus = "downloading" | "downloaded" | "error";

export class DownloadPage {
	private readonly logger = resolve(ILogger).scopeTo("DownloadPage");

	public searchInput: string = "";
	public message = "";
	public isSearching = false;
	public hasSearched = false;
	public playlist: SearchResultVideo[] = [];
	public downloaded: Record<string, DownloadStatus> = {};

	public async clickDownload(url: string) {
		this.downloaded = { ...this.downloaded, [url]: "downloading" };
		this.message = "Saving audio...";

		try {
			const result = await commands_yt.dlYt(url, {
				output_dir: "",
				audio_codec: 0,
				audio_quality: 0
			});

			if (result.status === "error") {
				this.logger.error("Audio download failed", result.error);
				this.downloaded = { ...this.downloaded, [url]: "error" };
				this.message = `Download failed: ${result.error}`;
				return;
			}

			this.downloaded = { ...this.downloaded, [url]: "downloaded" };
			this.message = `Saved to ${result.data}`;
		} catch (error) {
			this.logger.error("Audio download failed", error);
			this.downloaded = { ...this.downloaded, [url]: "error" };
			this.message = `Download failed: ${String(error)}`;
		}
	}

	public async submitSearch(event: SubmitEvent) {
		event.preventDefault();
		const query = this.searchInput.trim();
		if (!query || this.isSearching) return;

		if (this.isYoutubeUrl(query)) {
			await this.clickDownload(query);
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
