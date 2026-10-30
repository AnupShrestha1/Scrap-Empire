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
} as const;

export const SCENE = {
  boot: 'boot',
  world: 'world',
} as const;
