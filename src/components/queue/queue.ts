export class Queue {
  public items: any[] = [];

  attached() {
    document.addEventListener('queue:add', (e: Event) => {
      const it = (e as CustomEvent).detail;
      this.items.push(it);
    });
  }

  remove(item: any) {
    this.items = this.items.filter((i) => i.path !== item.path);
  }
}
