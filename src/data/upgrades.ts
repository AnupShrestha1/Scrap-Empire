// Upgrades bought on in-world cash pads. Starting numbers from docs/M1_PLAN.md §2.

export const UPGRADE_IDS = [
  'carry',
  'magnet',
  'shredderSpeed',
  'binSize',
  'supply',
  'shredderYield',
  'extraction',
  'pressSpeed',
  'canSpeed',
] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

export interface UpgradeDef {
  /** Price of the first level. */
  cost: number;
  /** Each level costs this much more than the last. */
  growth: number;
  maxLevel: number;
  /** Business level needed before the pad takes payment. */
  requiresLevel?: number;
  /** Factory line that must be built first (for line upgrades). */
  requiresLine?: string;
}

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDef>> = {
  carry: { cost: 25, growth: 1.6, maxLevel: 8 },
  magnet: { cost: 45, growth: 1.6, maxLevel: 6 },
  shredderSpeed: { cost: 40, growth: 1.5, maxLevel: 8 },
  binSize: { cost: 30, growth: 1.5, maxLevel: 8 },
  supply: { cost: 60, growth: 1.7, maxLevel: 8 },
  shredderYield: { cost: 120, growth: 1.6, maxLevel: 6, requiresLevel: 2 },
  extraction: { cost: 250, growth: 1.8, maxLevel: 4, requiresLevel: 3 },
  pressSpeed: { cost: 90, growth: 1.55, maxLevel: 6, requiresLine: 'press' },
  canSpeed: { cost: 180, growth: 1.55, maxLevel: 6, requiresLine: 'can-line' },
};

/** What each level does. */
export const UPGRADE_EFFECTS = {
  carryPerLevel: 3,
  /** Tiles added to the pick-up pull per Magnet level. */
  magnetPerLevel: 0.35,
  /** Cycle time is multiplied by this per level. */
  shredderCycleFactor: 0.85,
  binPerLevel: 15,
  /** Supply levels alternate: odd levels add scrap per load, even levels shorten the wait between trucks. */
  supplyLoadPerStep: 2,
  supplyIntervalPerStepS: 2,
  supplyMinIntervalS: 6,
  /** Shredder output multiplied by 1 + this per Yield level. */
  yieldPerLevel: 0.1,
  /** Copper per scrap at Extraction level 1, and added per further level. */
  copperBase: 0.15,
  copperPerLevel: 0.05,
  /** Line batch time is multiplied by this per speed level. */
  lineCycleFactor: 0.85,
} as const;

/** How cash pads take payment. */
export const PURCHASE = {
  /**
   * Standing still this long on a sell, upgrade or build pad before anything happens, so walking across
   * one costs nothing (the user asked for 2 s). A ring above the worker fills while waiting.
   */
  delayS: 2,
  /** The drop-off pad only gives scrap back to the field, so it waits just long enough to skip walk-overs. */
  returnDelayS: 0.4,
  /** A level is paid off in about this long, whatever it costs. */
  payS: 1.2,
  /** Pause before paying for the next level when the player stays on the pad. */
  nextLevelPauseS: 0.6,
} as const;

export function upgradeCost(id: UpgradeId, level: number): number {
  const u = UPGRADES[id];
  return Math.round(u.cost * u.growth ** level);
}

export function emptyUpgradeCounts(): Record<UpgradeId, number> {
  return {
    carry: 0,
    magnet: 0,
    shredderSpeed: 0,
    binSize: 0,
    supply: 0,
    shredderYield: 0,
    extraction: 0,
    pressSpeed: 0,
    canSpeed: 0,
  };
}
