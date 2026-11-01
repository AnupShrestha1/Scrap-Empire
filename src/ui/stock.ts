import { PRICES } from '../data/balance';
import { itemName, t } from '../i18n';
import { metalUnlocked } from '../sim/effective';
import type { Simulation } from '../sim/simulation';
import type { BinDef } from '../sim/stations';
import { cssColor } from './recipes';

/** How many one tap of the smaller button sells. */
const SMALL_BATCH = 10;

/**
 * The storage card, opened by standing on the Scrap Dealer's storage pad: one row per unlocked metal with
 * what's in its bin and what it fetches, and buttons to sell 10 or all of it. It closes when the player
 * walks off the pad.
 */
export class StockCard {
  private readonly el: HTMLDivElement;
  private readonly rows: HTMLDivElement;
  private open: string | null = null;
  private shown = '';

  constructor(
    layer: HTMLElement,
    private readonly sim: Simulation,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'game-card stock-card';
    this.el.hidden = true;
    const head = document.createElement('div');
    head.className = 'card-head';
    const titles = document.createElement('div');
    titles.className = 'card-titles';
    const title = document.createElement('h2');
    title.textContent = t('stock.title');
    titles.append(title);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-go';
    close.textContent = t('recipes.close');
    close.addEventListener('click', () => this.close());
    head.append(titles, close);
    this.rows = document.createElement('div');
    this.rows.className = 'stock-rows';
    this.el.append(head, this.rows);
    // Taps on the card must not move the joystick underneath.
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    layer.append(this.el);
  }

  show(dealerId: string): void {
    this.open = dealerId;
    this.shown = '';
    this.el.hidden = false;
    this.update();
  }

  close(): void {
    this.open = null;
    this.el.hidden = true;
  }

  /** Call every frame: closes when the player leaves the pad, refreshes when bin counts change. */
  update(): void {
    if (!this.open) return;
    if (this.sim.zone !== `${this.open}:stock`) {
      this.close();
      return;
    }
    const { state } = this.sim;
    const bins = [...this.sim.binDefs.values()].filter((b) => metalUnlocked(b.item, state));
    const key = bins.map((b) => state.bins[b.id]!.count).join(',');
    if (key === this.shown) return;
    this.shown = key;
    this.rows.replaceChildren(...bins.map((bin) => this.row(bin)));
  }

  private row(bin: BinDef): HTMLDivElement {
    const count = this.sim.state.bins[bin.id]!.count;
    const row = document.createElement('div');
    row.className = 'stock-row';
    const swatch = document.createElement('div');
    swatch.className = 'tile-swatch';
    swatch.style.background = cssColor(bin.item);
    const name = document.createElement('div');
    name.className = 'stock-name';
    const title = document.createElement('b');
    title.textContent = itemName(bin.item);
    const detail = document.createElement('small');
    detail.textContent = t('stock.detail', { count, price: PRICES[bin.item] });
    name.append(title, detail);
    const sell = (n: number, label: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = n === count ? 'btn btn-paper stock-sell' : 'btn btn-safety stock-sell';
      b.disabled = count === 0;
      b.innerHTML = '';
      const what = document.createElement('b');
      what.textContent = label;
      const value = document.createElement('small');
      value.textContent = `$${Math.min(n, count) * PRICES[bin.item]}`;
      b.append(what, value);
      b.addEventListener('click', () => {
        this.sim.sellStock(bin.id, n);
        this.update();
      });
      return b;
    };
    row.append(swatch, name, sell(SMALL_BATCH, t('stock.sellSome', { n: SMALL_BATCH })), sell(count, t('stock.sellAll')));
    return row;
  }
}
