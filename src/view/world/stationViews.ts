import Phaser from 'phaser';
import { SUPPLIER } from '../../data/balance';
import { ITEM_IDS } from '../../data/items';
import { TRUCK_ROUTE } from '../../data/layout';
import { itemName, t } from '../../i18n';
import type { Simulation } from '../../sim/simulation';
import { secondsToTicks } from '../../sim/state';
import type { BinDef, DumpDef, ProcessorDef, StationDef } from '../../sim/stations';
import { pieceFrame } from '../art/scrap';
import { processorStatus, trayTotal } from '../../sim/systems/processing';
import { binCapacity, processorCycleTicks } from '../../sim/effective';
import { currentObjective } from '../../sim/systems/objectives';
import { UPGRADES, upgradeCost, type UpgradeId } from '../../data/upgrades';
import { businessLevel } from '../../data/balance';
import type { StringKey } from '../../i18n';
import type { CashPadDef } from '../../sim/stations';
import { BIN_FRAME, BIN_LEVELS, SHREDDER_FRAME, SHREDDER_LAMP_OFFSET, TRUCK_FRAME } from '../art/stations';
import { depthAt, toScreen, type IsoProjection } from '../iso';
import { FRAME, TEX } from '../keys';
import { placeFrame } from './decor';
import { LABEL_DEPTH, type Labels } from './labels';
import { FACTORY_FRAME, LINE_LAMP_HEIGHT, lineWindowPoint } from '../art/factory';
import { ART_SCALE } from '../art/pixel';
import { padFrame } from '../art/stations';
import type { FactoryDef } from '../../sim/stations';
import { batchTicks, lineStatus, missingInput, nextUnbuiltLine } from '../../sim/systems/manufacturing';

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

/** How long a delivered piece takes to drop onto the field, and how long a pick-up takes to fly to the player. */
const LAND_MS = 420;
const COLLECT_MS = 160;

/**
 * The dump site: one sprite per scrap piece. New pieces drop in with a bounce; collected ones zip to the
 * player and vanish. Sprites ease towards their piece's position, so the magnet pull looks smooth.
 */
class FieldView implements View {
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly label: Phaser.GameObjects.Text;
  private readonly at = { x: 0, y: 0 };
  private primed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly proj: IsoProjection,
    labels: Labels,
    private readonly def: DumpDef,
    private readonly playerAt: () => { x: number; y: number },
  ) {
    const top = toScreen(proj, def.rect.x + def.rect.w / 2, def.rect.y);
    this.label = labels.add(13, '#ffe0b0').setPosition(top.x, top.y - 4);
  }

  update(sim: Simulation): void {
    const pieces = sim.state.field.pieces;
    const seen = new Set<number>();
    for (const piece of pieces) {
      seen.add(piece.id);
      toScreen(this.proj, piece.x, piece.y, this.at);
      let sprite = this.sprites.get(piece.id);
      if (!sprite) {
        const frame = pieceFrame(piece.kind);
        sprite = this.scene.add.image(this.at.x, this.at.y, TEX.atlas, FRAME.piece(piece.kind)).setOrigin(0.5, frame.originY);
        this.sprites.set(piece.id, sprite);
        // Pieces already on the field when the scene starts just appear; new ones drop in.
        if (this.primed) {
          sprite.y -= 70;
          this.scene.tweens.add({ targets: sprite, y: this.at.y, duration: LAND_MS, ease: 'Bounce.easeOut' });
        }
      } else if (!this.scene.tweens.isTweening(sprite)) {
        sprite.x += (this.at.x - sprite.x) * 0.5;
        sprite.y += (this.at.y - sprite.y) * 0.5;
      }
      sprite.setDepth(depthAt(piece.x, piece.y));
    }
    for (const [id, sprite] of this.sprites) {
      if (seen.has(id)) continue;
      this.sprites.delete(id);
      const to = this.playerAt();
      this.scene.tweens.killTweensOf(sprite);
      this.scene.tweens.add({
        targets: sprite,
        x: to.x,
        y: to.y - 60,
        scale: 0.5,
        alpha: 0,
        duration: COLLECT_MS,
        ease: 'Quad.easeIn',
        onComplete: () => sprite.destroy(),
      });
    }
    this.primed = true;
    this.label.setText(t('dump.title', { count: pieces.length }));
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
    const cycle = processorCycleTicks(this.def, sim.state);
    const status = processorStatus(this.def, state, cycle);
    this.body.setFrame(FRAME.shredder(status === 'processing' && Math.floor(timeMs / 150) % 2 === 1 ? 1 : 0));
    this.lamp.setFrame(FRAME.lamp(status));

    this.ring.clear();
    if (status === 'processing') {
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
    const capacity = binCapacity(this.def, sim.state);
    const full = count >= capacity;
    this.image.setFrame(FRAME.bin(this.def.item, level(count, capacity, BIN_LEVELS)));
    const name = itemName(this.def.item);
    this.label.setText(full ? t('station.storageFull', { item: name }) : `${name} ${count}/${capacity}`);
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

/** An upgrade pad: name, level and price above it, with a bar filling as the player pays in. */
class CashPadView implements View {
  private readonly title: Phaser.GameObjects.Text;
  private readonly price: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, proj: IsoProjection, labels: Labels, private readonly def: CashPadDef) {
    const { x, y, w, h } = def.rect;
    const at = toScreen(proj, x + w / 2, y + h / 2);
    this.title = labels.add(12, '#cfe3ff').setPosition(at.x, at.y - 40);
    this.price = labels.add(13, '#ffd76a').setPosition(at.x, at.y - 22);
    this.bar = scene.add.graphics().setPosition(at.x, at.y - 14).setDepth(LABEL_DEPTH);
  }

  update(sim: Simulation): void {
    const id = this.def.upgrade;
    const level = sim.state.upgrades[id];
    const max = level >= UPGRADES[id].maxLevel;
    this.title.setText(t(`upgrade.${id}` as StringKey, { level: Math.min(level + 1, UPGRADES[id].maxLevel) }));
    const lock = lockReason(id, sim);
    this.price.setText(max ? t('upgrade.max') : (lock ?? `$${upgradeCost(id, level)}`));
    this.price.setColor(lock ? '#9fb3c8' : '#ffd76a');
    this.bar.clear();
    const paid = sim.state.upgradePaid[id];
    if (!max && paid > 0) {
      const width = 44;
      this.bar.fillStyle(0x13243a, 0.9).fillRect(-width / 2 - 2, -3, width + 4, 8);
      this.bar.fillStyle(0x5cc84a, 1).fillRect(-width / 2, -1, (width * paid) / upgradeCost(id, level), 4);
    }
  }
}

/** Why an upgrade pad won't take money yet, as display text; undefined when it's available. */
function lockReason(id: UpgradeId, sim: Simulation): string | undefined {
  const def = UPGRADES[id];
  if (def.requiresLevel && businessLevel(sim.state.earned) < def.requiresLevel) {
    return t('locked.level', { level: def.requiresLevel });
  }
  if (def.requiresLine && !sim.state.lines[def.requiresLine]?.built) {
    const line = sim.factoryLine(def.requiresLine);
    return t('locked.line', { name: line ? t(line.name) : def.requiresLine });
  }
  return undefined;
}

/** A bobbing arrow over the zone the current objective is about, when hints are on. */
export class HintArrowView {
  private readonly arrow: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    private readonly proj: IsoProjection,
    private readonly stations: readonly StationDef[],
  ) {
    this.arrow = scene.add.image(0, 0, TEX.atlas, FRAME.arrow).setOrigin(0.5, 1).setDepth(LABEL_DEPTH).setVisible(false);
  }

  update(sim: Simulation, timeMs: number, enabled: boolean): void {
    const hint = enabled ? currentObjective(sim.state)?.hint : undefined;
    const station = hint && this.stations.find((s) => s.id === hint.station);
    const zones = station?.zones as Readonly<Record<string, { x: number; y: number; w: number; h: number }>> | undefined;
    const rect = hint && zones?.[hint.zone];
    if (!rect) {
      this.arrow.setVisible(false);
      return;
    }
    const at = toScreen(this.proj, rect.x + rect.w / 2, rect.y + rect.h / 2);
    const bob = Math.abs(Math.sin(timeMs / 260)) * 10;
    // Just above the pad itself, so it never seems to point at a neighbouring zone.
    this.arrow.setVisible(true).setPosition(at.x, at.y - 8 - bob);
  }
}

/** One production line's indicators: a lamp and progress ring over its window, and a status note. */
interface LineIndicators {
  lamp: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
  note: Phaser.GameObjects.Text;
}

/**
 * The factory building. Each built line lights a lamp over its window, with a progress ring while it
 * works and "Needs Iron" when its bin runs short. The build pad in front sells the next line until all
 * are built.
 */
class FactoryView implements View {
  private readonly title: Phaser.GameObjects.Text;
  private readonly buildPad: Phaser.GameObjects.Image;
  private readonly buildTitle: Phaser.GameObjects.Text;
  private readonly buildPrice: Phaser.GameObjects.Text;
  private readonly buildBar: Phaser.GameObjects.Graphics;
  private readonly lines: LineIndicators[] = [];

  constructor(scene: Phaser.Scene, proj: IsoProjection, labels: Labels, private readonly def: FactoryDef) {
    const { x, y, w, h } = def.rect;
    const depth = depthAt(x + w / 2, y + h / 2);
    placeFrame(scene, proj, FRAME.factory, x + w, y + h, FACTORY_FRAME, depth);
    const roof = toScreen(proj, x + w / 2, y + h / 2);
    this.title = labels.add(13, '#ffd0c8').setPosition(roof.x, roof.y - 58);

    def.lines.forEach((_line, i) => {
      const [gx, gy] = lineWindowPoint(def.rect, i);
      const at = toScreen(proj, gx, gy);
      const lampY = at.y - LINE_LAMP_HEIGHT * ART_SCALE;
      const lamp = scene.add.image(at.x, lampY, TEX.atlas, FRAME.lamp('idle')).setDepth(LABEL_DEPTH - 2);
      const ring = scene.add.graphics().setPosition(at.x, lampY).setDepth(LABEL_DEPTH - 2);
      const note = labels.add(11, '#ff8a7a').setPosition(at.x, lampY - 12);
      this.lines.push({ lamp, ring, note });
    });

    const b = def.zones.build;
    this.buildPad = placeFrame(scene, proj, FRAME.pad(def.id, 'build'), b.x + b.w, b.y + b.h, padFrame(b.w, b.h), -0.5);
    const buildAt = toScreen(proj, b.x + b.w / 2, b.y + b.h / 2);
    this.buildTitle = labels.add(12, '#cfe3ff').setPosition(buildAt.x, buildAt.y - 22);
    this.buildPrice = labels.add(13, '#ffd76a').setPosition(buildAt.x, buildAt.y - 4);
    this.buildBar = scene.add.graphics().setPosition(buildAt.x, buildAt.y + 4).setDepth(LABEL_DEPTH);
  }

  update(sim: Simulation): void {
    const { state, binDefs } = sim;
    const built = this.def.lines.filter((l) => state.lines[l.id]!.built).length;
    this.title.setText(t('factory.title', { built, total: this.def.lines.length }));

    this.def.lines.forEach((line, i) => {
      const st = state.lines[line.id]!;
      const ind = this.lines[i]!;
      const status = lineStatus(line, st, binDefs, state.bins);
      ind.lamp.setVisible(status !== 'unbuilt').setFrame(FRAME.lamp(status === 'processing' ? 'processing' : 'idle'));
      ind.ring.clear();
      if (status === 'processing') {
        const fraction = Math.min(1, (st.progress + sim.alpha) / batchTicks(line, state));
        ind.ring.lineStyle(4, 0x5cc84a, 1).beginPath();
        ind.ring.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2).strokePath();
      }
      const missing = status === 'starved' ? missingInput(line, binDefs, state.bins) : undefined;
      ind.note.setText(missing ? t('station.needs', { item: itemName(missing) }) : '');
    });

    const next = nextUnbuiltLine(this.def, state);
    this.buildPad.setVisible(!!next);
    this.buildTitle.setVisible(!!next);
    this.buildPrice.setVisible(!!next);
    this.buildBar.clear();
    if (!next) return;
    const index = this.def.lines.indexOf(next) + 1;
    this.buildTitle.setText(t('build.line', { n: index, name: t(next.name) }));
    const locked = next.requiresLevel && businessLevel(state.earned) < next.requiresLevel;
    this.buildPrice.setText(locked ? t('locked.level', { level: next.requiresLevel! }) : `$${next.buildCost}`);
    this.buildPrice.setColor(locked ? '#9fb3c8' : '#ffd76a');
    const paid = state.buildPaid[next.id] ?? 0;
    if (paid > 0) {
      const width = 44;
      this.buildBar.fillStyle(0x13243a, 0.9).fillRect(-width / 2 - 2, -3, width + 4, 8);
      this.buildBar.fillStyle(0x5cc84a, 1).fillRect(-width / 2, -1, (width * paid) / next.buildCost, 4);
    }
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
  /** The player's feet on screen, for pick-up animations. */
  playerAt: () => { x: number; y: number },
): StationViews {
  const views: View[] = [new TruckView(scene, proj, labels)];
  const bins = new Map<string, BinView>();
  for (const def of stations) {
    switch (def.kind) {
      case 'dump':
        views.push(new FieldView(scene, proj, labels, def, playerAt));
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
      case 'cashPad':
        views.push(new CashPadView(scene, proj, labels, def));
        break;
      case 'factory':
        views.push(new FactoryView(scene, proj, labels, def));
        break;
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

