export type ToastKind = 'info' | 'warn' | 'good';

const SHOW_MS = 2600;
const MAX_SHOWN = 2;

interface Toast {
  el: HTMLDivElement;
  text: string;
  timer: ReturnType<typeof setTimeout>;
}

/** Short messages under the HUD. At most two at once; repeating a message refreshes it instead of stacking. */
export class Toasts {
  private readonly root: HTMLDivElement;
  private readonly shown: Toast[] = [];

  constructor(layer: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'toasts';
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    layer.append(this.root);
  }

  show(text: string, kind: ToastKind = 'info'): void {
    const existing = this.shown.find((t) => t.text === text);
    if (existing) {
      clearTimeout(existing.timer);
      existing.timer = setTimeout(() => this.remove(existing), SHOW_MS);
      return;
    }
    if (this.shown.length >= MAX_SHOWN) this.remove(this.shown[0]!);
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = text;
    this.root.append(el);
    const toast: Toast = { el, text, timer: setTimeout(() => this.remove(toast), SHOW_MS) };
    this.shown.push(toast);
  }

  private remove(toast: Toast): void {
    const i = this.shown.indexOf(toast);
    if (i < 0) return;
    this.shown.splice(i, 1);
    clearTimeout(toast.timer);
    toast.el.remove();
  }
}
