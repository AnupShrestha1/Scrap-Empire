// What the factory lines can make (docs/PROGRESSION.md §7.2). Each product sells at the stall for about
// 1.6× what its metals fetch raw; buyer trucks pay ORDERS.bonus on top.
import type { MetalId, ProductId } from './items';

export interface Recipe {
  /** Metals pulled from the bins for one batch. */
  inputs: Readonly<Partial<Record<MetalId, number>>>;
  batchS: number;
  /** Stall price per product. */
  price: number;
}

export const RECIPES: Readonly<Record<ProductId, Recipe>> = {
  sheet: { inputs: { iron: 3 }, batchS: 4, price: 40 },
  can: { inputs: { aluminium: 2 }, batchS: 3, price: 65 },
  toolbox: { inputs: { iron: 2, aluminium: 1 }, batchS: 4, price: 60 },
  wire: { inputs: { copper: 2 }, batchS: 4, price: 115 },
  motor: { inputs: { iron: 2, copper: 1 }, batchS: 5, price: 90 },
  radiator: { inputs: { aluminium: 2, copper: 1 }, batchS: 5, price: 125 },
  drillBit: { inputs: { iron: 2, titanium: 1 }, batchS: 6, price: 140 },
  bikeFrame: { inputs: { aluminium: 2, titanium: 1 }, batchS: 6, price: 180 },
  circuitBoard: { inputs: { copper: 2, gold: 1 }, batchS: 7, price: 340 },
  watch: { inputs: { titanium: 1, gold: 1 }, batchS: 7, price: 350 },
  catalyst: { inputs: { iron: 2, copper: 1, platinum: 1 }, batchS: 8, price: 560 },
  jetEngine: { inputs: { titanium: 2, copper: 1, platinum: 1 }, batchS: 9, price: 780 },
};

/** The metals a recipe needs, in input order. */
export function recipeMetals(product: ProductId): MetalId[] {
  return Object.keys(RECIPES[product].inputs) as MetalId[];
}
