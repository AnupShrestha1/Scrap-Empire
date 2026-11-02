// What each business level opens up (docs/PROGRESSION.md §4.1 and §4.3). Stations appear when their
// level is reached, show as a dark silhouette one level before, and stay hidden until then. The simulation
// gates the same things (upgrade levels, line slots, the staff hut, the second bay), so nothing hidden
// can be used.

/** Business level at which each station appears; anything not listed is there from the start. */
export const STATION_LEVELS: Readonly<Record<string, number>> = {
  'staff-hut': 2,
  'pad-staff-speed': 2,
  'pad-shredder-capacity': 1,
  'pad-staff-carry': 2,
  'bin-aluminium': 2,
  'pad-shredder': 2,
  'pad-bins': 2,
  factory: 3,
  outlet: 3,
  'bay-a': 3,
  'bin-copper': 3,
  'pad-supply': 3,
  'pad-yield': 3,
  'pad-extraction': 3,
  'pad-line-speed': 3,
  'bay-b': 4,
  'shredder-2': 4,
  'bay-c': 5,
  'bay-d': 6,
  'bay-e': 7,
  'bay-f': 8,
  'bin-titanium': 5,
  'bin-gold': 6,
  'bin-platinum': 7,
};

export function stationLevel(id: string): number {
  return STATION_LEVELS[id] ?? 1;
}

/** Cash in the chest for reaching each business level (index = level). It doesn't count as earnings. */
export const LEVEL_CHESTS: readonly number[] = [0, 0, 100, 250, 600, 1200, 2000, 3500, 6000];

export function levelChest(level: number): number {
  return LEVEL_CHESTS[level] ?? 0;
}
