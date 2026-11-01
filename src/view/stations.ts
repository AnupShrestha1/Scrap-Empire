import * as THREE from 'three';
import { businessLevel, ORDERS, STAFF } from '../data/balance';
import { TRUCK_ROUTE } from '../data/layout';
import { UPGRADES, upgradeCost, type UpgradeId } from '../data/upgrades';
import { itemName, t, type StringKey } from '../i18n';
import { binCapacity, processorCycleTicks } from '../sim/effective';
import type { Simulation } from '../sim/simulation';
import { secondsToTicks } from '../sim/state';
import type { BayDef, BinDef, CashPadDef, FactoryDef, ProcessorDef, Rect, StaffHutDef, StationDef } from '../sim/stations';
import { batchTicks, lineStatus, missingInput, nextUnbuiltLine } from '../sim/systems/manufacturing';
import { currentObjective } from '../sim/systems/objectives';
import { processorStatus } from '../sim/systems/processing';
import { bayTruckX, bayTruckY, SUPPLIER_TRUCK_Y, supplierTruckX } from '../sim/vehicles';
import { fitToFootprint, type Models } from './assets';
import { Character } from './character';
import type { Label, Labels } from './labels';
import { BinProp, booth, lamp, LAMP_COLORS, PadProp, PileProp, RingGauge, setText } from './props';

/** Something drawn from simulation state every frame. */
export interface View {
  update(sim: Simulation, dt: number, timeMs: number, camera: THREE.Camera): void;
}

export const centre = (r: Rect, y = 0): THREE.Vector3 => new THREE.Vector3(r.x + r.w / 2, y, r.y + r.h / 2);

/** How long a bin's "full" warning stays highlighted. */
const FLASH_MS = 1200;

export interface StationViews {
  views: View[];
  bins: Map<string, BinView>;
}

/** One view per station, plus the supplier truck. */
export function createStationViews(scene: THREE.Scene, models: Models, labels: Labels, stations: readonly StationDef[]): StationViews {
  const views: View[] = [new SupplierTruckView(scene, models, labels)];
  const bins = new Map<string, BinView>();
  for (const s of stations) {
    switch (s.kind) {
      case 'dump':
        // The field itself is FieldView; here only the pad for putting scrap back.
        scene.add(new PadProp(s.zones.return.w, s.zones.return.h, '↩', 0x8a6a48).placeOn(s.zones.return).root);
        break;
      case 'processor':
        views.push(new ShredderView(scene, models, labels, s));
        break;
      case 'bin': {
        const view = new BinView(scene, labels, s);
        bins.set(s.id, view);
        views.push(view);
        break;
      }
      case 'cashPad':
        views.push(new CashPadView(scene, labels, s));
        break;
      case 'factory':
        views.push(new FactoryView(scene, models, labels, s));
        break;
      case 'bay':
        views.push(new BayView(scene, models, labels, s));
        break;
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
    }
  }
  return { views, bins };
}

// ---------------------------------------------------------------------------------------------- trucks

class SupplierTruckView implements View {
  private readonly truck: THREE.Object3D;
  private readonly bubble: Label;

  constructor(scene: THREE.Scene, models: Models, labels: Labels) {
    this.truck = new THREE.Group().add(fitToFootprint(models.get('supplierTruck'), TRUCK_ROUTE.length));
    // Nose east, towards the dump site.
    this.truck.rotation.y = Math.PI / 2;
    scene.add(this.truck);
    this.bubble = labels.add('bubble');
  }

  update(sim: Simulation, _dt: number, timeMs: number): void {
    const truck = sim.state.truck;
    this.truck.visible = truck.phase !== 'away';
    const x = supplierTruckX(truck, sim.alpha) + TRUCK_ROUTE.length / 2;
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
class BayView implements View {
  private readonly truck: THREE.Object3D;
  private readonly bubble: Label;
  private readonly what: HTMLElement;
  private readonly patience: HTMLElement;

  constructor(scene: THREE.Scene, models: Models, labels: Labels, private readonly def: BayDef) {
    this.truck = new THREE.Group().add(fitToFootprint(models.get('buyerTruck'), 3));
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

  update(sim: Simulation): void {
    const bay = sim.state.bays[this.def.id]!;
    this.truck.visible = bay.phase !== 'empty';
    const x = bayTruckX(this.def, bay, sim.alpha) + 1.5;
    this.truck.position.set(x, 0, bayTruckY(this.def));
    this.bubble.at.set(x, 2.5, bayTruckY(this.def));
    const waiting = bay.phase === 'waiting' && bay.item !== null;
    this.bubble.visible = waiting;
    if (!waiting) return;
    setText({ el: this.what }, `${itemName(bay.item!)} ${t('bay.waiting', { have: bay.have, want: bay.want })}`);
    const left = bay.timer / secondsToTicks(ORDERS.patienceS);
    this.patience.style.width = `${Math.round(left * 100)}%`;
    this.patience.classList.toggle('low', left < 0.3);
  }
}

// ---------------------------------------------------------------------------------------------- machines

/** The shredder: rumbles while working, with a status lamp, a progress ring and its output pallet. */
class ShredderView implements View {
  private readonly body = new THREE.Group();
  private readonly tray = new PileProp(['iron', 'aluminium', 'copper']);
  private readonly lamp = lamp();
  private readonly ring = new RingGauge(0x5cc84a, 0.8);
  private readonly note: Label;

  constructor(scene: THREE.Scene, models: Models, labels: Labels, private readonly def: ProcessorDef) {
    const machine = fitToFootprint(models.get('machine'), 2.1);
    const hopper = fitToFootprint(models.get('hopper'), 1.4);
    hopper.position.y += 1.6;
    hopper.position.z += 0.35;
    this.body.add(machine, hopper);
    this.body.position.copy(centre(def.rect));
    const top = centre(def.rect, 3.3);
    this.lamp.position.copy(top);
    this.ring.root.position.copy(top).add(new THREE.Vector3(0, 0.55, 0));
    // Against the machine's side, so the worker collecting from the spot doesn't stand in it.
    this.tray.root.position.copy(centre(def.zones.output)).setX(def.zones.output.x + 0.1);
    this.note = labels.add('note');
    this.note.at.copy(centre(def.zones.output, 1.4));
    scene.add(this.body, this.lamp, this.ring.root, this.tray.root, new PadProp(def.zones.input.w, def.zones.input.h, '▲', 0x6b6f8a).placeOn(def.zones.input).root);
  }

  update(sim: Simulation, _dt: number, timeMs: number, camera: THREE.Camera): void {
    const m = sim.state.processors[this.def.id]!;
    const cycle = processorCycleTicks(this.def, sim.state);
    const status = processorStatus(this.def, m, cycle);
    const working = status === 'processing';
    this.body.position.x = this.def.rect.x + this.def.rect.w / 2 + (working ? Math.sin(timeMs / 28) * 0.03 : 0);
    this.body.rotation.z = working ? Math.sin(timeMs / 41) * 0.01 : 0;
    (this.lamp.material as THREE.MeshBasicMaterial).color.setHex(LAMP_COLORS[status]);
    this.ring.set(working ? (m.progress + sim.alpha) / cycle : undefined);
    this.ring.face(camera);
    this.tray.show(m.tray);
    setText(this.note, status === 'blocked' ? t('station.outputFull') : '');
  }
}

export class BinView implements View {
  private readonly prop: BinProp;
  private readonly label: Label;
  private flashUntil = 0;

  constructor(scene: THREE.Scene, labels: Labels, private readonly def: BinDef) {
    this.prop = new BinProp(def.item);
    this.prop.root.position.copy(centre(def.rect));
    scene.add(this.prop.root, new PadProp(def.zones.sell.w, def.zones.sell.h, '$', 0xc98a1e).placeOn(def.zones.sell).root);
    this.label = labels.add('bin-count');
    this.label.at.copy(centre(def.rect, 1.3));
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
    const full = count >= capacity;
    setText(this.label, full ? t('station.storageFull', { item: name }) : `${name} ${count}/${capacity}`);
    this.label.el.classList.toggle('warn', full || performance.now() < this.flashUntil);
  }
}

/**
 * The factory: one building with a lamp per line on its bay-side wall (and a progress ring while the line
 * works, "Needs Iron" when its bin runs short), output pallets beside it, and the build pad in front
 * selling the next line.
 */
class FactoryView implements View {
  private readonly title: Label;
  private readonly buildPad: THREE.Object3D;
  private readonly buildLabel: Label;
  private readonly lines: { lamp: THREE.Mesh; ring: RingGauge; note: Label; pile: PileProp }[] = [];

  constructor(scene: THREE.Scene, models: Models, labels: Labels, private readonly def: FactoryDef) {
    const building = models.get('factory');
    // Kenney's building is long along x; turn it to run along the factory's depth and stretch it to fit.
    building.rotation.y = Math.PI / 2;
    const box = new THREE.Box3().setFromObject(building);
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    // Kenney models aren't always centred on their origin; centre it so it covers exactly the solid area.
    building.position.set(-mid.x, -box.min.y, -mid.z);
    const holder = new THREE.Group().add(building);
    holder.scale.set(def.rect.w / size.x, 1.5, def.rect.h / size.z);
    holder.position.copy(centre(def.rect));
    const chimney = fitToFootprint(models.get('chimney'), 1.2);
    chimney.position.add(new THREE.Vector3(def.rect.x + 0.8, 0, def.rect.y + 0.8));
    scene.add(holder, chimney);
    this.title = labels.add('area-title');
    // Over the front edge of the roof, clear of the speed pads' labels behind the building.
    this.title.at.set(def.rect.x + def.rect.w / 2, 2.6, def.rect.y + def.rect.h);

    for (const line of def.lines) {
      const wall = new THREE.Vector3(def.rect.x + def.rect.w + 0.05, 2.2, line.output.y + line.output.h / 2);
      const l = lamp();
      l.position.copy(wall);
      const ring = new RingGauge(0x5cc84a, 0.7);
      ring.root.position.copy(wall).add(new THREE.Vector3(0.1, 0.5, 0));
      const note = labels.add('note');
      note.at.copy(wall).add(new THREE.Vector3(0.6, 0.2, 0));
      // Half inside the wall, like a hatch, so the worker collecting from the spot doesn't stand in it.
      const pile = new PileProp([line.recipe.output], 12);
      pile.root.position.copy(centre(line.output)).setX(line.output.x - 0.15);
      scene.add(l, ring.root, pile.root);
      this.lines.push({ lamp: l, ring, note, pile });
    }

    this.buildPad = new PadProp(def.zones.build.w, def.zones.build.h, '⚒', 0x3a7bd5).placeOn(def.zones.build).root;
    scene.add(this.buildPad);
    this.buildLabel = labels.add('pad-title');
    this.buildLabel.at.copy(centre(def.zones.build, 0.7));
  }

  update(sim: Simulation, _dt: number, _timeMs: number, camera: THREE.Camera): void {
    const { state, binDefs } = sim;
    const built = this.def.lines.filter((l) => state.lines[l.id]!.built).length;
    setText(this.title, t('factory.title', { built, total: this.def.lines.length }));

    this.def.lines.forEach((line, i) => {
      const st = state.lines[line.id]!;
      const ind = this.lines[i]!;
      const status = lineStatus(line, st, binDefs, state.bins);
      ind.lamp.visible = st.built;
      if (status !== 'unbuilt') (ind.lamp.material as THREE.MeshBasicMaterial).color.setHex(LAMP_COLORS[status]);
      ind.ring.set(status === 'processing' ? (st.progress + sim.alpha) / batchTicks(line, state) : undefined);
      ind.ring.face(camera);
      ind.pile.root.visible = st.built;
      ind.pile.show({ [line.recipe.output]: st.out });
      const missing = status === 'starved' ? missingInput(line, binDefs, state.bins) : undefined;
      setText(ind.note, status === 'blocked' ? t('station.outputFull') : missing ? t('station.needs', { item: itemName(missing) }) : '');
    });

    const next = nextUnbuiltLine(this.def, state);
    this.buildPad.visible = next !== undefined;
    if (!next) {
      setText(this.buildLabel, '');
      return;
    }
    const locked = next.requiresLevel !== undefined && businessLevel(state.earned) < next.requiresLevel;
    padTitle(
      this.buildLabel,
      t('build.line', { n: this.def.lines.indexOf(next) + 1, name: t(next.name) }),
      locked ? t('locked.level', { level: next.requiresLevel! }) : `$${next.buildCost - (state.buildPaid[next.id] ?? 0)}`,
      locked,
    );
  }
}

// ---------------------------------------------------------------------------------------------- pads

/** Two-line pad label: a small name over the price (or why it's locked). */
function padTitle(label: Label, name: string, price: string, locked: boolean): void {
  const key = `${name}|${price}`;
  if (label.el.dataset.key !== key) {
    label.el.dataset.key = key;
    label.el.innerHTML = '';
    const small = document.createElement('small');
    small.textContent = name;
    label.el.append(small, price);
  }
  label.el.classList.toggle('locked', locked);
}

class CashPadView implements View {
  private readonly title: Label;

  constructor(scene: THREE.Scene, labels: Labels, private readonly def: CashPadDef) {
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
  if (def.requiresLevel && businessLevel(sim.state.earned) < def.requiresLevel) return t('locked.level', { level: def.requiresLevel });
  if (def.requiresLine && !sim.state.lines[def.requiresLine]?.built) {
    const line = sim.factoryLine(def.requiresLine);
    return t('locked.line', { name: line ? t(line.name) : def.requiresLine });
  }
  return undefined;
}

class StaffHutView implements View {
  private readonly title: Label;

  constructor(scene: THREE.Scene, models: Models, labels: Labels, private readonly def: StaffHutDef) {
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
    padTitle(this.title, name, cost === undefined ? t('staff.full') : `$${cost - sim.state.hirePaid}`, false);
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
