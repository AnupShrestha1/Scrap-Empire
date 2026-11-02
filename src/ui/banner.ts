interface Message {
  title: string;
  body: string;
  chest: string;
  ms: number;
}

/**
 * The big centre banner for milestones: "Business level 3!", what it opened, and the chest's cash, or the
 * welcome-back summary. Messages queue and show one after another, so several level-ups at once (say,
 * from offline earnings) each get their moment.
 */
export class Banner {
  private readonly el: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly chest: HTMLDivElement;
  private readonly queue: Message[] = [];
  private showing = false;

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
    this.queue.push({ title, body, chest, ms });
    if (!this.showing) this.next();
  }

  private next(): void {
    const message = this.queue.shift();
    this.showing = message !== undefined;
    if (!message) {
      this.el.hidden = true;
      return;
    }
    this.title.textContent = message.title;
    this.body.textContent = message.body;
    this.chest.textContent = message.chest;
    this.chest.hidden = message.chest === '';
    this.el.hidden = false;
    // Restart the entrance animation.
    this.el.classList.remove('in');
    void this.el.offsetWidth;
    this.el.classList.add('in');
    // Later messages in a burst get a little less time each, so a pile of them doesn't drag on.
    setTimeout(() => this.next(), this.queue.length > 0 ? Math.min(message.ms, 2200) : message.ms);
  }
}
