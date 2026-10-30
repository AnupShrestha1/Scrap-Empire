import type Phaser from 'phaser';
import { t } from '../../i18n';
import type { Rect, StationDef } from '../../sim/stations';
import { padFrame, type PadKind } from '../art/stations';
import { toScreen, type IsoProjection } from '../iso';
import { FRAME } from '../keys';
import { placeFrame } from './decor';
import type { Labels } from './labels';

/** Floor markings sit just above the ground and below everything standing on it. */
const PAD_DEPTH = -0.5;

export interface PadSpec {
  station: string;
  zone: string;
  rect: Rect;
  kind: PadKind;
  /** Shown above the pad when the zone's purpose isn't obvious. */
  label?: string;
}

/** The marked zones: pick up (green), drop off (orange) and sell (gold). Bins take deposits all round, unmarked. */
export function padsFor(stations: readonly StationDef[]): PadSpec[] {
  const pads: PadSpec[] = [];
  for (const s of stations) {
    if (s.kind === 'pile') {
      pads.push({ station: s.id, zone: 'take', rect: s.zones.take, kind: 'pickup' });
      pads.push({ station: s.id, zone: 'return', rect: s.zones.return, kind: 'dropoff', label: t('pile.return') });
    } else if (s.kind === 'processor') {
      pads.push({ station: s.id, zone: 'input', rect: s.zones.input, kind: 'dropoff' });
      pads.push({ station: s.id, zone: 'output', rect: s.zones.output, kind: 'pickup' });
    } else {
      pads.push({ station: s.id, zone: 'sell', rect: s.zones.sell, kind: 'sell', label: t('pad.sell') });
    }
  }
  return pads;
}

export function placePads(scene: Phaser.Scene, proj: IsoProjection, labels: Labels, stations: readonly StationDef[]): void {
  for (const pad of padsFor(stations)) {
    const { x, y, w, h } = pad.rect;
    placeFrame(scene, proj, FRAME.pad(pad.station, pad.zone), x + w, y + h, padFrame(w, h), PAD_DEPTH);
    if (pad.label) {
      const at = toScreen(proj, x + w / 2, y + h / 2);
      labels.add(11, '#ffe9a8').setText(pad.label).setPosition(at.x, at.y - 6);
    }
  }
}
