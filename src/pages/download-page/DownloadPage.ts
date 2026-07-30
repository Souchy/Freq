import { ILogger, resolve } from "aurelia";
import { commands_yt } from "../../generated/specta/commands/yt";
import { SearchResultVideo } from "../../generated/specta/types";

// export type DownloadableSearchResultVideo = SearchResultVideo | SearchResultVideo & {
// 	promise: Promise<void> | null
// 	downloaded: boolean
// };

export type DownloadStatus = {
	promise: Promise<void> | null
	downloaded: boolean
};

export class DownloadPage {
	private readonly logger = resolve(ILogger).scopeTo("DownloadPage");

	public urlInput: string = "";
	public searchInput: string = "";
	public message = "";

	// private promise: Promise<void> | null = null;

	public playlist: SearchResultVideo[] = [];
	public downloaded: Record<string, DownloadStatus> = {};

	public async clickDownload(url: string) {
		this.message = "Click download url: " + url;
		this.logger.debug("Click download url: ", url);

		const promise = commands_yt.dlYt(url, {
			output_dir: "C:/Robyn/Git/apps/Freq/output/",
			audio_codec: 0,
			audio_quality: 0
		}).then(result => {
			this.logger.debug("Dl result: ", result);
			if (result.status == "error") {
				this.message = "Error: " + result.error;
				// this.downloaded.set(url, { promise: null, downloaded: false });
				this.downloaded[url] = { promise: null, downloaded: false };
			} else {
				this.message = "Succeeded: " + result.data;
				// this.downloaded.set(url, { promise: null, downloaded: true });
				this.downloaded[url] = { promise: null, downloaded: true };
			}
		});

		// this.downloaded.set(url, { promise: promise, downloaded: false });
		this.downloaded[url] = { promise: promise, downloaded: false };
	}

	public async clickSearch(search: string) {
		this.playlist = [];
		let result = await commands_yt.ytSearch(search, 0, 20);

		this.logger.debug("Dl result: ", result);
		if (result.status == "error") {
			this.message = "Error: " + result.error;
		} else {
			this.message = "Succeeded: " + result.data;
			this.playlist = result.data;
		}
	}

}
