// Upgrades bought on in-world cash pads. Starting numbers from docs/M1_PLAN.md §2.

export const UPGRADE_IDS = ['carry', 'shredderSpeed', 'binSize', 'supply'] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

export interface UpgradeDef {
  /** Price of the first level. */
  cost: number;
  /** Each level costs this much more than the last. */
  growth: number;
  maxLevel: number;
}

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDef>> = {
  carry: { cost: 25, growth: 1.6, maxLevel: 8 },
  shredderSpeed: { cost: 40, growth: 1.5, maxLevel: 8 },
  binSize: { cost: 30, growth: 1.5, maxLevel: 8 },
  supply: { cost: 60, growth: 1.7, maxLevel: 8 },
};

/** What each level does. */
export const UPGRADE_EFFECTS = {
  carryPerLevel: 3,
  /** Cycle time is multiplied by this per level. */
  shredderCycleFactor: 0.85,
  binPerLevel: 15,
  /** Supply levels alternate: odd levels add scrap per load, even levels shorten the wait between trucks. */
  supplyLoadPerStep: 2,
  supplyIntervalPerStepS: 2,
  supplyMinIntervalS: 6,
} as const;

/** How cash pads take payment. */
export const PURCHASE = {
  /** Standing still this long before paying starts, so walking across a pad costs nothing. */
  delayS: 0.4,
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
  return { carry: 0, shredderSpeed: 0, binSize: 0, supply: 0 };
}
