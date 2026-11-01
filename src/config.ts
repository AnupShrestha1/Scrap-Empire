// Technical constants. Gameplay balance and content live in src/data.

export const SIM = {
  /** Simulation ticks per second. */
  tickRate: 20,
  /** Most real time one frame may simulate; longer gaps (hidden tab, debugger) are dropped. */
  maxFrameMs: 250,
} as const;

export const TICK_MS = 1000 / SIM.tickRate;

export const VIEW = {
  /** Camera tilt down from the horizon, and its vertical field of view, in degrees. */
  pitchDeg: 46,
  fov: 34,
  /** Tiles of ground on screen; the camera distance follows from this and the screen shape. */
  visibleArea: 300,
  /** The camera looks this many tiles north of the player, so they sit below centre, clear of the HUD. */
  leadTiles: 1,
  /** How quickly the camera catches up with the player, per second. */
  cameraFollowRate: 7,
  /** Caps on devicePixelRatio, so low-end GPUs never get a huge canvas. */
  maxDpr: 2,
  maxDprMobile: 1.5,
} as const;

export const INPUT = {
  /** Distance from the joystick centre to its rim, in CSS pixels. */
  joystickRadiusPx: 56,
  /** Deflection (0..1 of the radius) below which the joystick does nothing. */
  joystickDeadZone: 0.15,
  /** Deflection at which the joystick reaches full speed. */
  joystickFullAt: 0.6,
} as const;

export const SAVE = {
  autosaveMs: 15_000,
  /** How often the last good save is copied to the backup slot. */
  backupMs: 5 * 60_000,
  keyPrefix: 'scrap-empire.',
} as const;
