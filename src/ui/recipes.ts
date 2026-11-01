import { PRICES } from '../data/balance';
import { PRODUCTS, type MetalId, type ProductId } from '../data/items';
import { RECIPES, recipeMetals } from '../data/recipes';
import { itemName, t } from '../i18n';
import { metalUnlocked, productUnlocked } from '../sim/effective';
import type { Simulation } from '../sim/simulation';
import type { FactoryDef } from '../sim/stations';
import { ITEM_COLORS } from '../view/props';

/** CSS colour for an item's swatch and chips. */
export function cssColor(item: keyof typeof ITEM_COLORS): string {
  return `#${ITEM_COLORS[item].toString(16).padStart(6, '0')}`;
}

/** Light metals get dark chip text, dark ones white. */
function chipText(metal: MetalId): string {
  return metal === 'iron' ? '#ffffff' : '#1d2238';
}

/**
 * The product chooser, opened by standing on the factory's recipe pad (see the "Product chooser" artboard
 * of the UI design). A tab per line slot, then a tile per product: its recipe as metal chips, its price,
 * and badges for what the line is making and what trucks want. "Auto" hands the line to the employees,
 * who switch it to whatever waiting trucks need. It closes when the player walks off the pad.
 */
export class RecipeCard {
  private readonly el: HTMLDivElement;
  private readonly tabs: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private open: string | null = null;
  private selected: string | null = null;
  /** What the card last showed, so it only rebuilds when something changed (rebuilding eats taps). */
  private shown = '';

  constructor(
    layer: HTMLElement,
    private readonly sim: Simulation,
    private readonly onPick: () => void,
  ) {
    this.el = div('game-card recipe-card');
    this.el.hidden = true;
    const head = div('card-head');
    const icon = div('card-icon');
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8 3.5-2.2.6a6 6 0 0 1-.6 1.5l1.1 2-2.1 2.1-2-1.1a6 6 0 0 1-1.5.6L12 20h-3l-.6-2.2a6 6 0 0 1-1.5-.6l-2 1.1-2.1-2.1 1.1-2a6 6 0 0 1-.6-1.5L1 12V9l2.2-.6a6 6 0 0 1 .6-1.5l-1.1-2 2.1-2.1 2 1.1a6 6 0 0 1 1.5-.6L9 1h3l.6 2.2a6 6 0 0 1 1.5.6l2-1.1 2.1 2.1-1.1 2a6 6 0 0 1 .6 1.5L20 9z"/></svg>';
    const titles = div('card-titles');
    const title = document.createElement('h2');
    title.textContent = t('recipes.title');
    const sub = div('card-sub');
    sub.textContent = t('recipes.subtitle');
    titles.append(title, sub);
    const done = button('btn btn-go', t('recipes.close'));
    done.addEventListener('click', () => this.close());
    head.append(icon, titles, done);
    this.tabs = div('line-tabs');
    this.grid = div('tile-grid');
    this.el.append(head, this.tabs, this.grid);
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

  /** Call every frame: closes when the player leaves the pad, refreshes when lines, unlocks or orders change. */
  update(): void {
    if (!this.open) return;
    if (this.sim.zone !== `${this.open}:recipes`) {
      this.close();
      return;
    }
    const factory = this.sim.stations.find((s): s is FactoryDef => s.kind === 'factory' && s.id === this.open);
    if (!factory) return;
    const { state } = this.sim;
    const built = factory.lines.filter((l) => state.lines[l.id]!.built);
    if (!this.selected || !built.some((l) => l.id === this.selected)) this.selected = built[0]?.id ?? null;
    const wants = this.truckWants();
    const key = JSON.stringify([
      this.selected,
      factory.lines.map((l) => [state.lines[l.id]!.built, state.lines[l.id]!.product, state.lines[l.id]!.auto]),
      PRODUCTS.map((p) => productUnlocked(p, state)),
      [...wants],
    ]);
    if (key === this.shown) return;
    this.shown = key;
    this.renderTabs(factory);
    this.renderTiles(wants);
  }

  /** How many of each product waiting trucks still want. */
  private truckWants(): Map<ProductId, number> {
    const wants = new Map<ProductId, number>();
    for (const bay of Object.values(this.sim.state.bays)) {
      if (bay.phase !== 'waiting' || !bay.item) continue;
      const p = bay.item as ProductId;
      wants.set(p, (wants.get(p) ?? 0) + bay.want - bay.have);
    }
    return wants;
  }

  private renderTabs(factory: FactoryDef): void {
    const { state } = this.sim;
    this.tabs.replaceChildren(
      ...factory.lines.map((line, i) => {
        const st = state.lines[line.id]!;
        const tab = button('line-tab', '');
        const name = document.createElement('b');
        name.textContent = t('line.name', { n: i + 1 });
        const what = document.createElement('small');
        if (!st.built) {
          tab.disabled = true;
          tab.classList.add('unbuilt');
          what.textContent = t('recipes.unbuilt');
        } else {
          what.textContent = st.auto ? t('recipes.autoMaking', { item: itemName(st.product) }) : itemName(st.product);
          tab.classList.toggle('selected', line.id === this.selected);
          tab.addEventListener('click', () => {
            this.selected = line.id;
            this.update();
          });
        }
        tab.append(name, what);
        return tab;
      }),
    );
  }

  private renderTiles(wants: Map<ProductId, number>): void {
    const { state } = this.sim;
    const lineId = this.selected;
    if (!lineId) {
      this.grid.replaceChildren();
      return;
    }
    const st = state.lines[lineId]!;
    const auto = button('tile tile-auto', '');
    auto.classList.toggle('current', st.auto);
    const badge = div('tile-badge-round');
    badge.textContent = 'A';
    const text = div('tile-text');
    const name = document.createElement('b');
    name.textContent = t('recipes.auto');
    const sub = document.createElement('small');
    sub.textContent = t('recipes.autoHint');
    text.append(name, sub);
    auto.append(badge, text);
    auto.addEventListener('click', () => {
      this.sim.setLineAuto(lineId, true);
      this.onPick();
      this.shown = '';
      this.update();
    });
    this.grid.replaceChildren(auto, ...PRODUCTS.map((p) => this.tile(lineId, p, st.product === p, wants.get(p) ?? 0)));
  }

  private tile(lineId: string, product: ProductId, making: boolean, wanted: number): HTMLButtonElement {
    const { state } = this.sim;
    const tile = button('tile', '');
    const top = div('tile-top');
    const swatch = div('tile-swatch');
    swatch.style.background = cssColor(product);
    top.append(swatch);
    if (making) top.append(tag('tag tag-go', t('recipes.making')));
    else if (wanted > 0) top.append(tag('tag tag-safety', t('recipes.wanted', { n: wanted })));
    const name = document.createElement('b');
    name.className = 'tile-name';
    name.textContent = itemName(product);
    tile.append(top, name);
    if (productUnlocked(product, state)) {
      tile.classList.toggle('current', making);
      const chips = div('chips');
      for (const metal of recipeMetals(product)) {
        const chip = tag('chip', `${RECIPES[product].inputs[metal]} ${itemName(metal)}`);
        chip.style.background = cssColor(metal);
        chip.style.color = chipText(metal);
        chips.append(chip);
      }
      const price = div('tile-price');
      price.textContent = `$${PRICES[product]}`;
      tile.append(chips, price);
      tile.addEventListener('click', () => {
        if (this.sim.setLineProduct(lineId, product)) this.onPick();
        this.shown = '';
        this.update();
      });
    } else {
      tile.disabled = true;
      tile.classList.add('locked');
      const missing = recipeMetals(product).find((m) => !metalUnlocked(m, state))!;
      const note = document.createElement('small');
      note.textContent = t('recipes.locked', { item: itemName(missing) });
      tile.append(note);
    }
    return tile;
  }
}

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

function button(className: string, text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  if (text) b.textContent = text;
  return b;
}

function tag(className: string, text: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = className;
  s.textContent = text;
  return s;
}
