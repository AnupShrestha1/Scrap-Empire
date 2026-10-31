import type { ItemId } from '../data/items';
import type { ProcessorStatus } from '../sim/events';

export const TEX = {
  ground: 'ground',
  atlas: 'atlas',
} as const;

export const FRAME = {
  playerFront: 'player-front',
  playerBack: 'player-back',
  crate: 'crate',
  fencePost: 'fence-post',
  fenceRun: (dir: string) => `fence-${dir}`,
  tree: (variant: number) => `tree-${variant}`,
  lampPost: 'lamp-post',
  booth: 'booth',
  shredder: (frame: number) => `shredder-${frame}`,
  lamp: (status: ProcessorStatus) => `lamp-${status}`,
  bin: (item: string, level: number) => `bin-${item}-${level}`,
  truck: (loaded: boolean) => (loaded ? 'truck-loaded' : 'truck-empty'),
  boxTruck: 'box-truck',
  staffFront: 'staff-front',
  staffBack: 'staff-back',
  hut: 'staff-hut',
  item: (item: ItemId) => `item-${item}`,
  pad: (station: string, zone: string) => `pad-${station}-${zone}`,
  arrow: 'hint-arrow',
  factory: 'factory',
  piece: (kind: number) => `piece-${kind}`,
} as const;

export const SCENE = {
  boot: 'boot',
  world: 'world',
} as const;
