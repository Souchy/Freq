import { Toast, toastService } from '../../core/toast';

export class ToastHost {
  public toasts: Toast[] = toastService.all;

  private readonly handleChange = () => {
    this.toasts = toastService.all;
  };

  attached() {
    toastService.addEventListener('change', this.handleChange);
  }

  detaching() {
    toastService.removeEventListener('change', this.handleChange);
  }

  public runAction(toast: Toast, index: number) {
    toast.actions[index]?.run();
    toastService.dismiss(toast.id);
  }

  public dismiss(toast: Toast) {
    toastService.dismiss(toast.id);
  }

  public hold(toast: Toast) {
    toastService.hold(toast.id);
  }

  public release(toast: Toast) {
    toastService.release(toast.id);
  }
}
