import * as THREE from 'three';
import { METALS } from '../data/items';
import { businessLevel, ORDERS, STAFF } from '../data/balance';
import { TRUCK_ROUTE } from '../data/layout';
import { requiredLevel, UPGRADES, upgradeCost, type UpgradeId } from '../data/upgrades';
import { itemName, t, type StringKey } from '../i18n';
import { binCapacity, metalUnlocked, processorCycleTicks } from '../sim/effective';
import type { Simulation } from '../sim/simulation';
import { secondsToTicks } from '../sim/state';
import type { BayDef, BinDef, CashPadDef, ProcessorDef, Rect, StaffHutDef, StationDef } from '../sim/stations';
import { currentObjective } from '../sim/systems/objectives';
import { processorStatus } from '../sim/systems/processing';
import { bayTruckX, bayTruckY, SUPPLIER_TRUCK_Y, supplierTruckX } from '../sim/vehicles';
import { bakedModel, fitToFootprint, type Models } from './assets';
import { Character } from './character';
import { centre, padTitle, type View } from './common';
import { FactoryView } from './factory';
import type { Puffs } from './fx';
import type { Label, LabelMaker, Labels } from './labels';
import type { Reveal } from './reveal';
import { BinProp, booth, lamp, LAMP_COLORS, PadProp, PileProp, RingGauge, setText } from './props';

/** How long a bin's "full" warning stays highlighted. */
const FLASH_MS = 1200;

export interface StationViews {
  views: View[];
  bins: Map<string, BinView>;
  shredders: Map<string, ShredderView>;
  bays: Map<string, BayView>;
  factory?: FactoryView;
}

/** One view per station, plus the supplier truck. */
export function createStationViews(
  world: THREE.Scene,
  models: Models,
  allLabels: Labels,
  stations: readonly StationDef[],
  smoke: Puffs,
  reveal: Reveal,
): StationViews {
  const out: StationViews = { views: [new SupplierTruckView(world, models, allLabels, smoke)], bins: new Map(), shredders: new Map(), bays: new Map() };
  const { views, bins } = out;
  for (const s of stations) {
    if (s.kind === 'dump') continue;
    // Each station lives in its own group, shown, teased or hidden by business level (reveal.ts), and
    // only updates while it's active.
    const scene = reveal.groupFor(s);
    const labels = allLabels.scoped(scene);
    const first = views.length;
    switch (s.kind) {
      case 'processor': {
        const view = new ShredderView(scene, models, labels, s);
        out.shredders.set(s.id, view);
        views.push(view);
        break;
      }
      case 'bin': {
        const view = new BinView(scene, labels, s);
        bins.set(s.id, view);
        views.push(view);
        break;
      }
      case 'cashPad':
        views.push(new CashPadView(scene, labels, s));
        break;
      case 'factory': {
        out.factory = new FactoryView(scene, models, labels, s, smoke);
        views.push(out.factory);
        // Behind the factory: the pad that opens the recipe card.
        scene.add(new PadProp(s.zones.recipes.w, s.zones.recipes.h, '☰', 0x7b5cc8).placeOn(s.zones.recipes).root);
        const label = labels.add('pad-title');
        label.at.copy(centre(s.zones.recipes, 0.7));
        label.el.textContent = t('factory.recipes');
        break;
      }
      case 'bay': {
        const view = new BayView(scene, models, labels, s, smoke);
        out.bays.set(s.id, view);
        views.push(view);
        break;
      }
      case 'outlet': {
        const stand = booth(0xe2534b);
        stand.position.copy(centre(s.rect)).add(new THREE.Vector3(0, 0, 1.3));
        stand.rotation.y = Math.PI;
        scene.add(new PadProp(s.zones.sell.w, s.zones.sell.h, '$', 0xc98a1e).placeOn(s.zones.sell).root, stand);
        break;
      }
      case 'staffHut':
        views.push(new StaffHutView(scene, models, labels, s));
        break;
      case 'dealer': {
        // A booth with a green awning; the gold pad in front buys every raw metal you carry.
        const stand = booth(0x2f8f57);
        stand.position.copy(centre(s.rect));
        const title = labels.add('area-title');
        title.at.copy(centre(s.rect, 2.4));
        title.el.textContent = t('dealer.title');
        const stock = labels.add('pad-title');
        stock.at.copy(centre(s.zones.stock, 0.7));
        stock.el.textContent = t('dealer.stock');
        scene.add(
          new PadProp(s.zones.sell.w, s.zones.sell.h, '$', 0xc98a1e).placeOn(s.zones.sell).root,
          new PadProp(s.zones.stock.w, s.zones.stock.h, '▦', 0xc98a1e).placeOn(s.zones.stock).root,
          stand,
        );
        break;
      }
    }
    for (let i = first; i < views.length; i++) {
      const view = views[i]!;
      views[i] = {
        update: (...args) => {
          if (reveal.isActive(s.id)) view.update(...args);
        },
      };
    }
  }
  // The dump site's own view is FieldView; here only the pad for putting scrap back.
  const dump = stations.find((s) => s.kind === 'dump');
  if (dump?.kind === 'dump') world.add(new PadProp(dump.zones.return.w, dump.zones.return.h, '↩', 0x8a6a48).placeOn(dump.zones.return).root);
  return out;
}

/** How often a truck puffs exhaust while driving, and while parked with the engine running. */
const EXHAUST_S = { driving: 0.12, idle: 0.7 } as const;

/** Puffs exhaust from a truck's tail (its west end) now and then. */
class Exhaust {
  private wait = 0;

  constructor(private readonly smoke: Puffs) {}

  update(dt: number, tailX: number, z: number, driving: boolean): void {
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = driving ? EXHAUST_S.driving : EXHAUST_S.idle;
    this.smoke.add(new THREE.Vector3(tailX - 0.1, 0.35, z + 0.4), driving ? 0.35 : 0.25, 0.9, 0.8);
  }
}

// ---------------------------------------------------------------------------------------------- trucks

class SupplierTruckView implements View {
  private readonly truck: THREE.Object3D;
  private readonly bubble: Label;
  private readonly exhaust: Exhaust;

  constructor(scene: THREE.Scene, models: Models, labels: Labels, smoke: Puffs) {
    this.exhaust = new Exhaust(smoke);
    this.truck = new THREE.Group().add(bakedModel(models, 'supplierTruck', TRUCK_ROUTE.length));
    // Nose east, towards the dump site.
    this.truck.rotation.y = Math.PI / 2;
    scene.add(this.truck);
    this.bubble = labels.add('bubble');
  }

  update(sim: Simulation, dt: number, timeMs: number): void {
    const truck = sim.state.truck;
    this.truck.visible = truck.phase !== 'away';
    const x = supplierTruckX(truck, sim.alpha) + TRUCK_ROUTE.length / 2;
    if (this.truck.visible) this.exhaust.update(dt, x - TRUCK_ROUTE.length / 2, SUPPLIER_TRUCK_Y, truck.phase === 'arriving' || truck.phase === 'leaving');
    this.truck.position.set(x, 0, SUPPLIER_TRUCK_Y);
    // It rocks while tipping its load.
    this.truck.rotation.z = truck.phase === 'unloading' ? Math.sin(timeMs / 90) * 0.015 : 0;
    this.bubble.at.set(x, 2.4, SUPPLIER_TRUCK_Y);
    setText(this.bubble, truck.phase === 'waiting' ? t('truck.yardFull') : '');
  }
}

/**
 * A loading bay lane: the buyer truck reverses in from the east gate and waits with an order bubble over
 * it (product, how many loaded, and a bar for its patience), then drives off.
 */
export class BayView implements View {
  private readonly truck: THREE.Object3D;
  private readonly bubble: Label;
  private readonly what: HTMLElement;
  private readonly patience: HTMLElement;
  private readonly exhaust: Exhaust;

  constructor(scene: THREE.Object3D, models: Models, labels: LabelMaker, private readonly def: BayDef, smoke: Puffs) {
    this.exhaust = new Exhaust(smoke);
    this.truck = new THREE.Group().add(bakedModel(models, 'buyerTruck', 3));
    this.truck.rotation.y = Math.PI / 2;
    scene.add(this.truck, new PadProp(def.zones.load.w, def.zones.load.h, '▶', 0xd9a62b).placeOn(def.zones.load).root);
    this.bubble = labels.add('bubble order');
    this.what = document.createElement('span');
    const bar = document.createElement('i');
    bar.className = 'patience';
    this.patience = document.createElement('i');
    bar.append(this.patience);
    this.bubble.el.append(this.what, bar);
  }

  update(sim: Simulation, dt: number): void {
    const bay = sim.state.bays[this.def.id]!;
    this.truck.visible = bay.phase !== 'empty';
    const x = bayTruckX(this.def, bay, sim.alpha) + 1.5;
    this.truck.position.set(x, 0, bayTruckY(this.def));
    if (this.truck.visible) this.exhaust.update(dt, x - 1.5, bayTruckY(this.def), bay.phase === 'arriving' || bay.phase === 'leaving');
    this.bubble.at.set(x, 2.5, bayTruckY(this.def));
    const waiting = bay.phase === 'waiting' && bay.item !== null;
    this.bubble.visible = waiting;
    if (!waiting) return;
    setText({ el: this.what }, `${itemName(bay.item!)} ${t('bay.waiting', { have: bay.have, want: bay.want })}`);
    const left = bay.timer / secondsToTicks(ORDERS.patienceS);
    this.patience.style.width = `${Math.round(left * 100)}%`;
    this.patience.classList.toggle('low', left < 0.3);
  }

  /** The truck's open back, where loaded products go. */
  get loadPoint(): THREE.Vector3 {
    return this.truck.position.clone().add(new THREE.Vector3(-1.2, 1.1, 0));
  }
}

// ---------------------------------------------------------------------------------------------- machines

/**
 * The shredder: rumbles and spins its side cogs while working, with a status lamp, a progress ring and
 * its output pallet.
 */
export class ShredderView implements View {
  private readonly body = new THREE.Group();
  private readonly cogs: THREE.Object3D[] = [];
  private readonly tray = new PileProp(METALS, 12);
  private readonly lamp = lamp();
  private readonly ring = new RingGauge(0x5cc84a, 0.8);
  private readonly note: Label;
  /** A machine bought later: an empty plot with a build pad until then. */
  private readonly plot?: { ghost: THREE.Object3D; pad: THREE.Object3D; label: Label };
  private wasBuilt: boolean | null = null;
  private popAge = Infinity;

  constructor(scene: THREE.Object3D, models: Models, labels: LabelMaker, private readonly def: ProcessorDef) {
    const machine = fitToFootprint(models.get('machine'), 2.1);
    const hopper = fitToFootprint(models.get('hopper'), 1.4);
    hopper.position.y += 1.6;
    hopper.position.z += 0.35;
    this.body.add(machine, hopper);
    // Grinding cogs on both sides, turning while it works.
    for (const side of [-1, 1]) {
      const cog = new THREE.Group().add(fitToFootprint(models.get('cog'), 0.9));
      cog.rotation.z = Math.PI / 2;
      cog.position.set(side * 1.08, 0.75, 0.1);
      this.cogs.push(cog);
      this.body.add(cog);
    }
    this.body.position.copy(centre(def.rect));
    const top = centre(def.rect, 3.3);
    this.lamp.position.copy(top);
    this.ring.root.position.copy(top).add(new THREE.Vector3(0, 0.55, 0));
    // Against the machine's side, so the worker collecting from the spot doesn't stand in it.
    this.tray.root.position.copy(centre(def.zones.output)).setX(def.zones.output.x + 0.1);
    this.note = labels.add('note');
    this.note.at.copy(centre(def.zones.output, 1.4));
    scene.add(this.body, this.lamp, this.ring.root, this.tray.root, new PadProp(def.zones.input.w, def.zones.input.h, '▲', 0x6b6f8a).placeOn(def.zones.input).root);
    if (def.build && def.zones.build) {
      const ghost = new PadProp(def.rect.w, def.rect.h, '2', 0x6b6f8a).placeOn(def.rect).root;
      const pad = new PadProp(def.zones.build.w, def.zones.build.h, '⚒', 0x3a7bd5).placeOn(def.zones.build).root;
      const label = labels.add('pad-title');
      label.at.copy(centre(def.zones.build, 0.7));
      scene.add(ghost, pad);
      this.plot = { ghost, pad, label };
    }
  }

  update(sim: Simulation, dt: number, timeMs: number, camera: THREE.Camera): void {
    const m = sim.state.processors[this.def.id]!;
    if (this.plot) {
      // Unbought: the plot and its build pad. Bought: the machine pops in.
      if (this.wasBuilt === false && m.built) this.popAge = 0;
      this.wasBuilt = m.built;
      this.popAge += dt;
      this.plot.ghost.visible = this.plot.pad.visible = !m.built;
      const locked = businessLevel(sim.state.earned) < this.def.build!.requiresLevel;
      if (m.built) setText(this.plot.label, '');
      else {
        const price = locked ? t('locked.level', { level: this.def.build!.requiresLevel }) : `$${this.def.build!.cost - (sim.state.buildPaid[this.def.id] ?? 0)}`;
        padTitle(this.plot.label, t('shredder.build'), price, locked);
      }
    }
    for (const o of [this.body, this.lamp, this.ring.root, this.tray.root]) o.visible = m.built;
    if (!m.built) return;
    const k = Math.min(1, this.popAge / 0.5);
    this.body.scale.setScalar(k < 1 ? Math.max(0.01, Math.sin(k * Math.PI * 0.75) / Math.sin(Math.PI * 0.75)) : 1);
    const cycle = processorCycleTicks(this.def, sim.state, m);
    const status = processorStatus(this.def, m, cycle);
    const working = status === 'processing';
    this.body.position.x = this.def.rect.x + this.def.rect.w / 2 + (working ? Math.sin(timeMs / 28) * 0.03 : 0);
    this.body.rotation.z = working ? Math.sin(timeMs / 41) * 0.01 : 0;
    if (working) this.cogs.forEach((c, i) => (c.rotation.x += dt * (i === 0 ? 6 : -6)));
    (this.lamp.material as THREE.MeshBasicMaterial).color.setHex(LAMP_COLORS[status]);
    this.ring.set(working ? (m.progress + sim.alpha) / cycle : undefined);
    this.ring.face(camera);
    this.tray.show(m.tray);
    setText(this.note, status === 'blocked' ? t('station.outputFull') : '');
  }

  /** The hopper's mouth, where scrap goes in. */
  get inputPoint(): THREE.Vector3 {
    return centre(this.def.rect, 2.7).add(new THREE.Vector3(0, 0, 0.35));
  }

  /** The output pallet. */
  get outputPoint(): THREE.Vector3 {
    return this.tray.root.position.clone().setY(0.4);
  }
}

export class BinView implements View {
  private readonly prop: BinProp;
  private readonly label: Label;
  private flashUntil = 0;

  constructor(scene: THREE.Object3D, labels: LabelMaker, private readonly def: BinDef) {
    this.prop = new BinProp(def.item);
    this.prop.root.position.copy(centre(def.rect));
    scene.add(this.prop.root);
    this.label = labels.add('bin-count');
    this.label.at.copy(centre(def.rect, 1.3));
  }

  get point(): THREE.Vector3 {
    return centre(this.def.rect, 0.8);
  }

  /** Highlights the bin after the player tried to put something into it while full. */
  flash(): void {
    this.flashUntil = performance.now() + FLASH_MS;
  }

  update(sim: Simulation): void {
    const count = sim.state.bins[this.def.id]!.count;
    const capacity = binCapacity(this.def, sim.state);
    this.prop.fill(count);
    const name = itemName(this.def.item);
    // Bins for metals the shredder can't find yet stand dim and grey, so the next unlock is in view.
    const unlocked = metalUnlocked(this.def.item, sim.state);
    this.prop.setLocked(!unlocked);
    if (!unlocked) {
      setText(this.label, t('bin.locked', { item: name }));
      this.label.el.classList.remove('warn');
      return;
    }
    const full = count >= capacity;
    setText(this.label, full ? t('station.storageFull', { item: name }) : `${name} ${count}/${capacity}`);
    this.label.el.classList.toggle('warn', full || performance.now() < this.flashUntil);
  }
}

// ---------------------------------------------------------------------------------------------- pads

class CashPadView implements View {
  private readonly title: Label;

  constructor(scene: THREE.Object3D, labels: LabelMaker, private readonly def: CashPadDef) {
    scene.add(new PadProp(1, 1, '$').placeOn(def.rect).root);
    this.title = labels.add('pad-title');
    this.title.at.copy(centre(def.rect, 0.7));
  }

  update(sim: Simulation): void {
    const id: UpgradeId = this.def.upgrade;
    const def = UPGRADES[id];
    const level = sim.state.upgrades[id];
    const max = level >= def.maxLevel;
    const name = t(`upgrade.${id}` as StringKey, { level: Math.min(level + 1, def.maxLevel) });
    const lock = lockReason(id, sim);
    const owed = upgradeCost(id, level) - sim.state.upgradePaid[id];
    padTitle(this.title, name, max ? t('upgrade.max') : (lock ?? `$${owed}`), lock !== undefined);
  }
}

/** Why an upgrade pad won't take money yet, as display text; undefined when it's available. */
function lockReason(id: UpgradeId, sim: Simulation): string | undefined {
  const def = UPGRADES[id];
  const gate = requiredLevel(id, sim.state.upgrades[id]);
  if (gate && businessLevel(sim.state.earned) < gate) return t('locked.level', { level: gate });
  if (def.requiresLine && !sim.state.lines[def.requiresLine]?.built) return t('locked.line', { name: lineName(sim, def.requiresLine) });
  return undefined;
}

/** "Line 2" for a factory line id. */
export function lineName(sim: Simulation, lineId: string): string {
  for (const s of sim.stations) {
    if (s.kind !== 'factory') continue;
    const i = s.lines.findIndex((l) => l.id === lineId);
    if (i >= 0) return t('line.name', { n: i + 1 });
  }
  return lineId;
}

class StaffHutView implements View {
  private readonly title: Label;

  constructor(scene: THREE.Object3D, models: Models, labels: LabelMaker, private readonly def: StaffHutDef) {
    const hut = new THREE.Group().add(fitToFootprint(models.get('hut'), 2.2));
    hut.position.copy(centre(def.rect));
    scene.add(hut, new PadProp(def.zones.hire.w, def.zones.hire.h, '+', 0x3a7bd5).placeOn(def.zones.hire).root);
    this.title = labels.add('pad-title');
    this.title.at.copy(centre(def.zones.hire, 0.7));
  }

  update(sim: Simulation): void {
    const hired = sim.state.employees.length;
    const cost = STAFF.costs[hired];
    const name = t('staff.title', { hired, max: STAFF.costs.length });
    const locked = businessLevel(sim.state.earned) < STAFF.requiresLevel;
    const price = locked
      ? t('locked.level', { level: STAFF.requiresLevel })
      : cost === undefined
        ? t('staff.full')
        : cost === 0
          ? t('staff.free')
          : `$${cost - sim.state.hirePaid}`;
    padTitle(this.title, name, price, locked);
  }
}

// ---------------------------------------------------------------------------------------------- people

/** Employees, each a character easing along their simulated route with their load on their back. */
export class StaffView implements View {
  readonly characters: Character[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly models: Models,
  ) {}

  /** The character for an employee id. */
  byId(sim: Simulation, id: number): Character | undefined {
    const i = sim.state.employees.findIndex((e) => e.id === id);
    return i < 0 ? undefined : this.characters[i];
  }

  update(sim: Simulation, dt: number): void {
    const list = sim.state.employees;
    while (this.characters.length < list.length) {
      const c = new Character(this.models, 'worker');
      const e = list[this.characters.length]!;
      c.root.position.set(e.x, 0, e.y);
      this.characters.push(c);
      this.scene.add(c.root);
    }
    list.forEach((e, i) => {
      const c = this.characters[i]!;
      // Employees move on the simulation tick; ease towards them so they glide like the player.
      const k = 1 - Math.exp(-20 * dt);
      c.update(dt, c.root.position.x + (e.x - c.root.position.x) * k, c.root.position.z + (e.y - c.root.position.z) * k, e.stack);
    });
  }
}

/** A bobbing arrow over the zone the current objective is about, when hints are on. */
export class HintArrow {
  readonly root: THREE.Mesh;

  constructor(
    private readonly stations: readonly StationDef[],
    private readonly enabled: () => boolean,
  ) {
    const geo = new THREE.ConeGeometry(0.28, 0.6, 4).rotateX(Math.PI);
    this.root = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd76a }));
    this.root.renderOrder = 5;
  }

  update(sim: Simulation, _dt: number, timeMs: number): void {
    const hint = this.enabled() ? currentObjective(sim.state)?.hint : undefined;
    const station = hint && this.stations.find((s) => s.id === hint.station);
    const zones = station?.zones as Readonly<Record<string, Rect>> | undefined;
    const rect = hint && zones?.[hint.zone];
    this.root.visible = rect !== undefined;
    if (!rect) return;
    this.root.position.copy(centre(rect, 1.3 + Math.abs(Math.sin(timeMs / 260)) * 0.35));
    this.root.rotation.y = timeMs / 600;
  }
}
