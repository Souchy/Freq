import { bindable } from 'aurelia';

export class FilterBar {
  @bindable public search = '';
  @bindable public group = 'none';
  @bindable public onScan: (() => void) | null = null;

  scanClicked() {
    if (this.onScan) this.onScan();
  }
}
