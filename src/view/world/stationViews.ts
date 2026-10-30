import Phaser from 'phaser';
import { SUPPLIER } from '../../data/balance';
import { ITEM_IDS } from '../../data/items';
import { TRUCK_ROUTE } from '../../data/layout';
import { itemName, t } from '../../i18n';
import type { Simulation } from '../../sim/simulation';
import { secondsToTicks } from '../../sim/state';
import type { BinDef, PileDef, ProcessorDef, StationDef } from '../../sim/stations';
import { processorStatus, trayTotal } from '../../sim/systems/processing';
import { BIN_FRAME, BIN_LEVELS, PILE_FRAME, PILE_STAGES, SHREDDER_FRAME, SHREDDER_LAMP_OFFSET, TRUCK_FRAME } from '../art/stations';
import { depthAt, toScreen, type IsoProjection } from '../iso';
import { FRAME, TEX } from '../keys';
import { placeFrame } from './decor';
import type { Labels } from './labels';

/** Something drawn from simulation state every frame. */
export interface View {
  update(sim: Simulation, timeMs: number): void;
}

/** Vertical gap between stacked item icons, in render pixels. */
const ICON_STEP = 8;
/** How long a "full" warning stays highlighted. */
const FLASH_MS = 1200;

/** Fill level 0..levels-1; 0 only when empty and the top level only when completely full. */
function level(count: number, capacity: number, levels: number): number {
  if (count <= 0) return 0;
  if (count >= capacity) return levels - 1;
  return 1 + Math.min(levels - 3, Math.floor((count / capacity) * (levels - 2)));
}

class PileView implements View {
  private readonly image: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, proj: IsoProjection, labels: Labels, private readonly def: PileDef) {
    const { x, y, w, h } = def.rect;
    this.image = placeFrame(scene, proj, FRAME.pile(0), x + w, y + h, PILE_FRAME, depthAt(x + w / 2, y + h / 2));
    this.label = labels.add();
    const top = toScreen(proj, x + w / 2, y + h / 2);
    this.label.setPosition(top.x, top.y - 60);
  }

  update(sim: Simulation): void {
    const items = sim.state.piles[this.def.id]!.items;
    this.image.setFrame(FRAME.pile(level(items, this.def.capacity, PILE_STAGES)));
    this.label.setText(`${items}/${this.def.capacity}`);
  }
}

class ProcessorView implements View {
  private readonly body: Phaser.GameObjects.Image;
  private readonly lamp: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly tray: Phaser.GameObjects.Image[] = [];
  private readonly trayLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, proj: IsoProjection, labels: Labels, private readonly def: ProcessorDef) {
    const { x, y, w, h } = def.rect;
    const depth = depthAt(x + w / 2, y + h / 2);
    this.body = placeFrame(scene, proj, FRAME.shredder(0), x + w, y + h, SHREDDER_FRAME, depth);
    const anchor = toScreen(proj, x + w, y + h);
    this.lamp = scene.add
      .image(anchor.x + SHREDDER_LAMP_OFFSET.x, anchor.y + SHREDDER_LAMP_OFFSET.y, TEX.atlas, FRAME.lamp('idle'))
      .setDepth(depth + 1);
    this.ring = scene.add.graphics().setDepth(depth + 1);
    this.ring.setPosition(this.lamp.x, this.lamp.y);

    // Finished items pile up on the ground at the output zone, one icon per item.
    const out = def.zones.output;
    const trayAt = toScreen(proj, out.x + 0.5, out.y + out.h / 2);
    for (let i = 0; i < def.recipe.tray; i++) {
      const icon = scene.add
        .image(trayAt.x + ((i % 2) * 2 - 1) * 6, trayAt.y - Math.floor(i / 2) * ICON_STEP, TEX.atlas, FRAME.item('iron'))
        .setOrigin(0.5, 1)
        .setDepth(depthAt(out.x + 0.5, out.y + out.h / 2) + i * 0.01)
        .setVisible(false);
      this.tray.push(icon);
    }
    this.trayLabel = labels.add(12);
    this.trayLabel.setPosition(trayAt.x, trayAt.y - (def.recipe.tray / 2) * ICON_STEP - 16);
  }

  update(sim: Simulation, timeMs: number): void {
    const state = sim.state.processors[this.def.id]!;
    const status = processorStatus(this.def, state);
    this.body.setFrame(FRAME.shredder(status === 'processing' && Math.floor(timeMs / 150) % 2 === 1 ? 1 : 0));
    this.lamp.setFrame(FRAME.lamp(status));

    this.ring.clear();
    if (status === 'processing') {
      const cycle = secondsToTicks(this.def.recipe.cycleS);
      const fraction = Math.min(1, (state.progress + sim.alpha) / cycle);
      this.ring.lineStyle(4, 0x5cc84a, 1);
      this.ring.beginPath();
      this.ring.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
      this.ring.strokePath();
    }

    let i = 0;
    for (const item of ITEM_IDS) {
      for (let n = 0; n < state.tray[item] && i < this.tray.length; n++) {
        this.tray[i++]!.setFrame(FRAME.item(item)).setVisible(true);
      }
    }
    for (; i < this.tray.length; i++) this.tray[i]!.setVisible(false);
    const total = trayTotal(state);
    this.trayLabel.setText(status === 'blocked' ? t('station.outputFull') : '');
    this.trayLabel.setColor(total >= this.def.recipe.tray ? '#ff8a7a' : '#ffffff');
  }
}

class BinView implements View {
  private readonly image: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private flashUntil = 0;

  constructor(scene: Phaser.Scene, proj: IsoProjection, labels: Labels, private readonly def: BinDef) {
    const { x, y, w, h } = def.rect;
    this.image = placeFrame(scene, proj, FRAME.bin(def.item, 0), x + w, y + h, BIN_FRAME, depthAt(x + w / 2, y + h / 2));
    this.label = labels.add();
    const top = toScreen(proj, x + w / 2, y + h / 2);
    this.label.setPosition(top.x, top.y - 44);
  }

  /** Highlights the bin after the player tried to put something into it while full. */
  flash(timeMs: number): void {
    this.flashUntil = timeMs + FLASH_MS;
  }

  update(sim: Simulation, timeMs: number): void {
    const count = sim.state.bins[this.def.id]!.count;
    const full = count >= this.def.capacity;
    this.image.setFrame(FRAME.bin(this.def.item, level(count, this.def.capacity, BIN_LEVELS)));
    const name = itemName(this.def.item);
    this.label.setText(full ? t('station.storageFull', { item: name }) : `${name} ${count}/${this.def.capacity}`);
    const flashing = timeMs < this.flashUntil && Math.floor(timeMs / 150) % 2 === 0;
    this.label.setColor(full ? (flashing ? '#ffffff' : '#ff8a7a') : '#ffffff');
    this.image.setTint(flashing ? 0xff9a8a : 0xffffff);
  }
}

/** The supplier truck, driving along its road and parking by the pile. */
class TruckView implements View {
  private readonly image: Phaser.GameObjects.Image;
  private readonly bubble: Phaser.GameObjects.Text;
  private readonly at = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, private readonly proj: IsoProjection, labels: Labels) {
    this.image = scene.add.image(0, 0, TEX.atlas, FRAME.truck(true)).setOrigin(TRUCK_FRAME.originX, TRUCK_FRAME.originY);
    this.bubble = labels.add(13, '#ffd76a');
  }

  update(sim: Simulation): void {
    const truck = sim.state.truck;
    const route = TRUCK_ROUTE;
    let x: number;
    if (truck.phase === 'away') {
      this.image.setVisible(false);
      this.bubble.setText('');
      return;
    }
    if (truck.phase === 'arriving' || truck.phase === 'leaving') {
      const drive = secondsToTicks(truck.phase === 'arriving' ? SUPPLIER.driveInS : SUPPLIER.driveOutS);
      const done = Math.min(1, Math.max(0, (drive - truck.timer + sim.alpha) / drive));
      const eased = done * done * (3 - 2 * done);
      x = truck.phase === 'arriving'
        ? route.startX + (route.parkX - route.startX) * eased
        : route.parkX + (route.startX - route.parkX) * eased;
    } else {
      x = route.parkX;
    }
    toScreen(this.proj, x + route.length, route.row + 1, this.at);
    this.image
      .setVisible(true)
      .setFrame(FRAME.truck(truck.load > 0))
      .setPosition(this.at.x, this.at.y)
      .setDepth(depthAt(x + route.length / 2, route.row + 0.5));
    this.bubble.setPosition(this.at.x - 40, this.at.y - 70).setText(truck.phase === 'waiting' ? t('truck.yardFull') : '');
  }
}

export interface StationViews {
  views: View[];
  bins: Map<string, BinView>;
}

export function createStationViews(
  scene: Phaser.Scene,
  proj: IsoProjection,
  labels: Labels,
  stations: readonly StationDef[],
): StationViews {
  const views: View[] = [new TruckView(scene, proj, labels)];
  const bins = new Map<string, BinView>();
  for (const def of stations) {
    switch (def.kind) {
      case 'pile':
        views.push(new PileView(scene, proj, labels, def));
        break;
      case 'processor':
        views.push(new ProcessorView(scene, proj, labels, def));
        break;
      case 'bin': {
        const view = new BinView(scene, proj, labels, def);
        bins.set(def.id, view);
        views.push(view);
        break;
      }
    }
  }
  return { views, bins };
}

/** The items the player carries, stacked above their head. */
export class CarriedStackView {
  private readonly icons: Phaser.GameObjects.Image[] = [];
  private readonly extra: Phaser.GameObjects.Text;
  private static readonly SHOWN = 10;

  constructor(scene: Phaser.Scene, labels: Labels) {
    for (let i = 0; i < CarriedStackView.SHOWN; i++) {
      this.icons.push(scene.add.image(0, 0, TEX.atlas, FRAME.item('scrap')).setOrigin(0.5, 1).setVisible(false));
    }
    this.extra = labels.add(12);
  }

  /** `x`, `y` are the player's feet in render pixels; `depth` the player's depth. */
  update(sim: Simulation, x: number, y: number, depth: number): void {
    const stack = sim.state.player.stack;
    const base = y - 78;
    for (let i = 0; i < this.icons.length; i++) {
      const item = stack[i];
      const icon = this.icons[i]!;
      if (!item) {
        icon.setVisible(false);
        continue;
      }
      icon.setVisible(true).setFrame(FRAME.item(item)).setPosition(x, base - i * ICON_STEP).setDepth(depth + 0.1 + i * 0.001);
    }
    const hidden = stack.length - this.icons.length;
    this.extra.setText(hidden > 0 ? `+${hidden}` : '').setPosition(x + 22, base - this.icons.length * ICON_STEP);
  }
}

