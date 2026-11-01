// Upgrades bought on in-world cash pads. Starting numbers from docs/M1_PLAN.md §2.

export const UPGRADE_IDS = [
  'carry',
  'magnet',
  'shredderSpeed',
  'binSize',
  'supply',
  'shredderYield',
  'extraction',
  'lineSpeed',
  'staffSpeed',
  'staffCarry',
  'shredderCapacity',
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
  /** Business level needed for each level in turn (index 0 is level 1); overrides requiresLevel. */
  levelGates?: readonly number[];
  /** Factory line that must be built first (for line upgrades). */
  requiresLine?: string;
}

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDef>> = {
  carry: { cost: 50, growth: 1.6, maxLevel: 8 },
  magnet: { cost: 100, growth: 1.6, maxLevel: 6 },
  // Business levels here match when each pad appears (unlocks.ts).
  shredderSpeed: { cost: 160, growth: 1.5, maxLevel: 8, requiresLevel: 2 },
  binSize: { cost: 140, growth: 1.5, maxLevel: 8, requiresLevel: 2 },
  supply: { cost: 240, growth: 1.7, maxLevel: 8, requiresLevel: 3 },
  shredderYield: { cost: 500, growth: 1.6, maxLevel: 6, requiresLevel: 3 },
  // Levels 1, 3, 5 and 7 unlock copper, titanium, gold and platinum (balance.ts METAL_FINDS).
  extraction: { cost: 600, growth: 1.75, maxLevel: 8, levelGates: [3, 4, 5, 5, 6, 6, 7, 7] },
  lineSpeed: { cost: 400, growth: 1.55, maxLevel: 8, requiresLine: 'line-1' },
  // Employees start slow with small hands; these make them worth more than an extra player only over time.
  staffSpeed: { cost: 300, growth: 1.6, maxLevel: 6, requiresLevel: 2 },
  staffCarry: { cost: 300, growth: 1.6, maxLevel: 6, requiresLevel: 2 },
  // A bigger hopper and output tray, so the player doesn't have to drop scrap while the shredder catches up.
  shredderCapacity: { cost: 120, growth: 1.6, maxLevel: 6 },
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
  /** Line batch time is multiplied by this per speed level. */
  lineCycleFactor: 0.85,
  /** Employee walking speed (tiles/s) and items carried added per level. */
  staffSpeedPerLevel: 0.35,
  staffCarryPerLevel: 1,
  /** Shredder hopper and output tray space added per Shredder capacity level. */
  hopperPerLevel: 5,
  trayPerLevel: 6,
} as const;

/** How cash pads take payment. */
export const PURCHASE = {
  /**
   * Standing still this long on a sell, upgrade or build pad before anything happens, so walking across
   * one costs nothing (the user asked for 1 s, counted only while standing still). A ring above the
   * worker fills while waiting.
   */
  delayS: 1,
  /** The drop-off pad only gives scrap back to the field, so it waits just long enough to skip walk-overs. */
  returnDelayS: 0.4,
  /** A level is paid off in about this long, whatever it costs. */
  payS: 1.2,
  /** Pause before paying for the next level when the player stays on the pad. */
  nextLevelPauseS: 0.6,
} as const;

/** Business level needed to buy the next level of an upgrade (0 when there's no gate). */
export function requiredLevel(id: UpgradeId, level: number): number {
  const u = UPGRADES[id];
  return u.levelGates?.[level] ?? u.requiresLevel ?? 0;
}

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
    lineSpeed: 0,
    staffSpeed: 0,
    staffCarry: 0,
    shredderCapacity: 0,
  };
}
