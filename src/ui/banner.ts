/**
 * The big centre banner for milestones: "Business level 3!", what it opened, and the chest's cash.
 * One at a time; a new one replaces the old.
 */
export class Banner {
  private readonly el: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly chest: HTMLDivElement;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(layer: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'banner';
    this.el.hidden = true;
    this.title = document.createElement('div');
    this.title.className = 'banner-title';
    this.body = document.createElement('div');
    this.body.className = 'banner-body';
    this.chest = document.createElement('div');
    this.chest.className = 'banner-chest';
    this.el.append(this.title, this.body, this.chest);
    layer.append(this.el);
  }

  show(title: string, body: string, chest: string, ms = 3200): void {
    this.title.textContent = title;
    this.body.textContent = body;
    this.chest.textContent = chest;
    this.chest.hidden = chest === '';
    this.el.hidden = false;
    // Restart the entrance animation.
    this.el.classList.remove('in');
    void this.el.offsetWidth;
    this.el.classList.add('in');
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.el.hidden = true;
    }, ms);
  }
}
