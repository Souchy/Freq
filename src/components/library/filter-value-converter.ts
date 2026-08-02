export class FilterValueConverter {
  public toView(items: any[] | undefined, term: string | undefined) {
    if (!items) return items;
    if (term === null || term === undefined) return items;
    const q = typeof term === 'string' ? term.toLowerCase() : String(term).toLowerCase();
    return items.filter(i => (i && i.name ? String(i.name).toLowerCase() : '').includes(q));
  }
}
