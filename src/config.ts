// Technical constants. Gameplay balance and content live in src/data.

export const SIM = {
  /** Simulation ticks per second. */
  tickRate: 20,
  /** Most real time one frame may simulate; longer gaps (hidden tab, debugger) are dropped. */
  maxFrameMs: 250,
} as const;

export const TICK_MS = 1000 / SIM.tickRate;

export const VIEW = {
  /** Isometric tile diamond in render pixels (2:1). */
  tileW: 64,
  tileH: 32,
  /** The camera zooms so at least this much of the world (render pixels) is visible on any screen. */
  minVisiblePx: { w: 1152, h: 648 },
  /** Cap on devicePixelRatio, so low-end GPUs never get a huge canvas. */
  maxDpr: 2,
  /** How quickly the camera catches up with the player, per second. */
  cameraFollowRate: 8,
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
