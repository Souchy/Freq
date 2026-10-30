export class PlayerPage {
	public activeView: 'library' | 'queue' = 'library';

	public setView(view: 'library' | 'queue') {
		this.activeView = view;
	}
}
