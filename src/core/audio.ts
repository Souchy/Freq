import { player_commands } from '../generated/specta/commands/player_commands';
// import { invoke } from '@tauri-apps/api/tauri';

export enum PlaybackState {
	Stopped = 'stopped',
	Playing = 'playing',
	Paused = 'paused',
}

export type Track = {
	path: string;
	title?: string;
	artist?: string;
	duration?: number;
};

class AudioService extends EventTarget {
	public state: PlaybackState = PlaybackState.Stopped;
	public current: Track | null = null;

	private emitState() {
		this.dispatchEvent(new CustomEvent('state', { detail: this.state }));
	}

	async loadAndPlay(path: string) {
		const res = await player_commands.loadAndPlayFile(path);
		if (res.status === 'ok') {
			this.state = PlaybackState.Playing;
			this.current = { path };
			this.emitState();
			return;
		}
		throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
	}

	async pause() {
		const res = await player_commands.pause();
		if (res.status === 'ok') {
			this.state = PlaybackState.Paused;
			this.emitState();
			return;
		}
		throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
	}

	async resume() {
		const res = await player_commands.resume();
		if (res.status === 'ok') {
			this.state = PlaybackState.Playing;
			this.emitState();
			return;
		}
		throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
	}

	async stop() {
		const res = await player_commands.stop();
		if (res.status === 'ok') {
			this.state = PlaybackState.Stopped;
			this.current = null;
			this.emitState();
			return;
		}
		throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
	}

	async setVolume(volume: number) {
		// Try generated command first, fallback to invoke
		const res = await player_commands.setVolume(volume);
		if (res.status === 'ok') return;
		throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
	}

	async scanFolder(path: string) {
		const res = await player_commands.scanFolder(path);
		if (res.status === 'ok') return res.data;
		throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
	}

	async getMetadata(path: string) {
		const res = await player_commands.getMetadata(path);
		if (res.status === 'ok') return res.data;
		throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
	}

	async seek(positionSeconds: number) {
		const res = await player_commands.seek(positionSeconds);
		if (res.status === 'ok') return;
		throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
	}

	async getPosition() {
		const res = await player_commands.getPosition();
		if (res.status === 'ok') return res.data;
		return 0;
	}

	async getDuration() {
		const res = await player_commands.getDuration();
		if (res.status === 'ok') return res.data;
		return 0;
	}
}

export const audioService = new AudioService();

export default audioService;
