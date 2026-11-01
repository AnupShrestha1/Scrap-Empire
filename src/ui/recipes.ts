import { PRICES } from '../data/balance';
import { PRODUCTS, type ProductId } from '../data/items';
import { RECIPES, recipeMetals } from '../data/recipes';
import { itemName, t } from '../i18n';
import { metalUnlocked, productUnlocked } from '../sim/effective';
import type { Simulation } from '../sim/simulation';
import type { FactoryDef } from '../sim/stations';

/**
 * The recipe card, opened by standing on the factory's recipe pad: one row per line slot, each with every
 * product as a button. Unlocked products show their recipe and price; locked ones are greyed with the
 * metal they still need. Tapping one switches that line over. It closes when the player walks off the pad.
 */
export class RecipeCard {
  private readonly el: HTMLDivElement;
  private readonly rows: HTMLDivElement;
  private open: string | null = null;
  /** What the card last showed, so it only rebuilds when something changed. */
  private shown = '';

  constructor(
    layer: HTMLElement,
    private readonly sim: Simulation,
    private readonly onPick: () => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'recipe-card';
    this.el.hidden = true;
    const title = document.createElement('h2');
    title.textContent = t('recipes.title');
    this.rows = document.createElement('div');
    this.rows.className = 'recipe-rows';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'recipe-close';
    close.textContent = t('recipes.close');
    close.addEventListener('click', () => this.close());
    this.el.append(title, this.rows, close);
    // Taps on the card must not move the joystick underneath.
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    layer.append(this.el);
  }

  /** Opens for the factory whose recipe pad the player is standing on. */
  show(factoryId: string): void {
    this.open = factoryId;
    this.shown = '';
    this.el.hidden = false;
    this.update();
  }

  close(): void {
    this.open = null;
    this.el.hidden = true;
  }

  /** Call every frame: closes when the player leaves the pad, refreshes when lines or unlocks change. */
  update(): void {
    if (!this.open) return;
    if (this.sim.zone !== `${this.open}:recipes`) {
      this.close();
      return;
    }
    const factory = this.sim.stations.find((s): s is FactoryDef => s.kind === 'factory' && s.id === this.open);
    if (!factory) return;
    const { state } = this.sim;
    const key = JSON.stringify([factory.lines.map((l) => state.lines[l.id]), PRODUCTS.map((p) => productUnlocked(p, state))]);
    if (key === this.shown) return;
    this.shown = key;
    this.rows.replaceChildren(
      ...factory.lines.map((line, i) => {
        const st = state.lines[line.id]!;
        const row = document.createElement('div');
        row.className = 'recipe-row';
        const name = document.createElement('div');
        name.className = 'recipe-line';
        name.textContent = t('line.name', { n: i + 1 });
        row.append(name);
        if (!st.built) {
          row.classList.add('unbuilt');
          const note = document.createElement('div');
          note.className = 'recipe-note';
          note.textContent = t('build.line', { n: i + 1 });
          row.append(note);
          return row;
        }
        const options = document.createElement('div');
        options.className = 'recipe-options';
        for (const product of PRODUCTS) options.append(this.button(line.id, product, st.product === product));
        row.append(options);
        return row;
      }),
    );
  }

  private button(lineId: string, product: ProductId, current: boolean): HTMLButtonElement {
    const { state } = this.sim;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'recipe-option';
    b.classList.toggle('current', current);
    const name = document.createElement('b');
    name.textContent = itemName(product);
    const detail = document.createElement('small');
    const unlocked = productUnlocked(product, state);
    if (unlocked) {
      const inputs = recipeMetals(product).map((m) => `${RECIPES[product].inputs[m]} ${itemName(m)}`);
      detail.textContent = `${inputs.join(' + ')} · $${PRICES[product]}`;
      b.addEventListener('click', () => {
        if (this.sim.setLineProduct(lineId, product)) this.onPick();
        this.shown = '';
        this.update();
      });
    } else {
      b.disabled = true;
      const missing = recipeMetals(product).find((m) => !metalUnlocked(m, state))!;
      detail.textContent = t('recipes.locked', { item: itemName(missing) });
    }
    b.append(name, detail);
    return b;
  }
}
