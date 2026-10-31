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
  /** Shown and hidden by its station's view (e.g. a build pad that goes once the machine is built). */
  dynamic?: boolean;
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
    } else if (s.kind === 'bin') {
      pads.push({ station: s.id, zone: 'sell', rect: s.zones.sell, kind: 'sell', label: t('pad.sell') });
    } else if (s.kind === 'cashPad') {
      // Cash pads label themselves with the live price (see CashPadView).
      pads.push({ station: s.id, zone: 'buy', rect: s.zones.buy, kind: 'buy' });
    } else if (s.kind === 'factory') {
      // Shown only while there are lines left to build (see FactoryView).
      pads.push({ station: s.id, zone: 'build', rect: s.zones.build, kind: 'buy', dynamic: true });
    }
  }
  return pads;
}

export function placePads(scene: Phaser.Scene, proj: IsoProjection, labels: Labels, stations: readonly StationDef[]): void {
  for (const pad of padsFor(stations)) {
    if (pad.dynamic) continue;
    const { x, y, w, h } = pad.rect;
    placeFrame(scene, proj, FRAME.pad(pad.station, pad.zone), x + w, y + h, padFrame(w, h), PAD_DEPTH);
    if (pad.label) {
      const at = toScreen(proj, x + w / 2, y + h / 2);
      labels.add(11, '#ffe9a8').setText(pad.label).setPosition(at.x, at.y - 6);
    }
  }
}
