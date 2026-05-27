import { bindable } from 'aurelia';

export class SongList {
  @bindable public items: Array<any> = [];
  @bindable public search = '';
  @bindable public group = 'none';
  @bindable public play: ((path: string) => void) | null = null;

  filtered() {
    if (!this.items) return [];
    const q = (this.search || '').toLowerCase();
    return this.items.filter((i: any) => (i.name || '').toLowerCase().includes(q));
  }
}
