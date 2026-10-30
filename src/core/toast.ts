export type ToastKind = 'success' | 'error' | 'info';

export type ToastAction = {
  label: string;
  run: () => void;
};

export type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  actions: ToastAction[];
};

const DEFAULT_DURATION_MS = 6000;

class ToastService extends EventTarget {
  private items: Toast[] = [];
  private nextId = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  get all() {
    return this.items.slice();
  }

  show(toast: Omit<Toast, 'id' | 'actions'> & { actions?: ToastAction[] }, durationMs = DEFAULT_DURATION_MS) {
    const id = this.nextId++;
    this.items = [...this.items, { ...toast, id, actions: toast.actions ?? [] }];
    this.emit();
    this.timers.set(id, setTimeout(() => this.dismiss(id), durationMs));
    return id;
  }

  /** Keeps a toast on screen while the pointer is over it. */
  hold(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }

  release(id: number, durationMs = 2500) {
    if (!this.items.some(toast => toast.id === id)) return;
    this.hold(id);
    this.timers.set(id, setTimeout(() => this.dismiss(id), durationMs));
  }

  dismiss(id: number) {
    this.hold(id);
    this.items = this.items.filter(toast => toast.id !== id);
    this.emit();
  }

  private emit() {
    this.dispatchEvent(new CustomEvent('change', { detail: this.all }));
  }
}

export const toastService = new ToastService();
