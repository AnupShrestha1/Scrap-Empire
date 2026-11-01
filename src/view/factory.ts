import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { businessLevel } from '../data/balance';
import { itemName, t } from '../i18n';
import type { Simulation } from '../sim/simulation';
import type { FactoryDef, LineDef } from '../sim/stations';
import { batchTicks, lineStatus, missingInput, nextUnbuiltLine } from '../sim/systems/manufacturing';
import { fitToFootprint, type Models } from './assets';
import type { Puffs } from './fx';
import type { Label, Labels } from './labels';
import { lamp, LAMP_COLORS, mat, PadProp, PileProp, RingGauge, setText } from './props';
import { centre, padTitle, type View } from './common';

const WALL = 0x5c6283;
const STRIPE = 0xf2a13b;
const FLOOR = 0x9aa0ad;
/** Full walls are this tall; the two facing the camera stay low so the lines inside show. */
const TALL = 2.4;
const LOW = 0.6;
const THICK = 0.2;
/** How long a newly built line takes to pop into place. */
const POP_S = 0.5;

interface LineParts {
  def: LineDef;
  machine: THREE.Group;
  ghost: THREE.Object3D;
  lamp: THREE.Mesh;
  ring: RingGauge;
  note: Label;
  pile: PileProp;
  mixer?: THREE.AnimationMixer;
  action?: THREE.AnimationAction;
  arm?: THREE.Object3D;
  /** Seconds since it was built, for the pop-in; Infinity when it was built before the view started. */
  builtAge: number;
  wasBuilt: boolean;
}

/**
 * The factory: an open-topped hall seen over its low front and side walls, with one machine per
 * production line. Unbuilt lines are marked spots on the floor; a bought line pops in with a puff.
 * Working machines move (the press stamps, the can line's robot arm swings), with a status lamp and a
 * progress ring over each, and finished products stack on pallets in the hatches of the bay-side wall.
 */
export class FactoryView implements View {
  private readonly title: Label;
  private readonly buildPad: THREE.Object3D;
  private readonly buildLabel: Label;
  private readonly lines: LineParts[] = [];
  private primed = false;

  constructor(scene: THREE.Scene, models: Models, labels: Labels, private readonly def: FactoryDef, private readonly puffs: Puffs) {
    const { x, y, w, h } = def.rect;
    scene.add(hall(x, y, w, h));
    const chimney = fitToFootprint(models.get('chimney'), 1.1);
    chimney.position.add(new THREE.Vector3(x + 0.6, 0, y + 0.6));
    const screen = fitToFootprint(models.get('screen'), 1.2);
    screen.position.add(new THREE.Vector3(x + w / 2 + 0.6, 1.1, y + THICK + 0.25));
    scene.add(chimney, screen);
    this.title = labels.add('area-title');
    // Over the front wall, clear of the speed pads' labels behind the building.
    this.title.at.set(x + w / 2, 1.6, y + h);

    def.lines.forEach((line, i) => {
      const z = line.output.y + line.output.h / 2;
      const spot = new THREE.Vector3(x + w / 2 + 0.2, 0.12, z);
      const machine = new THREE.Group();
      machine.add(fitToFootprint(models.get('pressMachine'), 1.5));
      machine.rotation.y = -Math.PI / 2;
      machine.position.copy(spot);
      const parts: Partial<LineParts> = {};
      if (i % 2 === 0) {
        // The press: a piston stamping on top.
        const piston = fitToFootprint(models.get('piston'), 0.9);
        piston.position.y += 1.3;
        machine.add(piston);
        const mixer = new THREE.AnimationMixer(piston);
        const clip = models.clips('piston').find((c) => c.name === 'toggle');
        if (clip) {
          parts.mixer = mixer;
          parts.action = mixer.clipAction(clip);
        }
      } else {
        // The can line: a robot arm beside the machine.
        const arm = fitToFootprint(models.get('robotArm'), 0.9);
        arm.position.set(0, 0, 1.1);
        machine.add(arm);
        parts.arm = arm.getObjectByName('element-b') ?? arm;
      }
      const ghost = new PadProp(1.6, 1.6, String(i + 1), 0x6b6f8a).root;
      ghost.position.set(spot.x, 0.14, spot.z);
      const l = lamp();
      l.position.set(spot.x, 2.1, z);
      const ring = new RingGauge(0x5cc84a, 0.7);
      ring.root.position.set(spot.x, 2.6, z);
      const note = labels.add('note');
      note.at.set(spot.x, 2.3, z);
      // Half inside the wall, like a hatch, so the worker collecting from the spot doesn't stand in it.
      const pile = new PileProp([line.recipe.output], 12);
      pile.root.position.copy(centre(line.output)).setX(line.output.x - 0.15);
      scene.add(machine, ghost, l, ring.root, pile.root);
      this.lines.push({ def: line, machine, ghost, lamp: l, ring, note, pile, builtAge: Infinity, wasBuilt: false, ...parts });
    });

    this.buildPad = new PadProp(def.zones.build.w, def.zones.build.h, '⚒', 0x3a7bd5).placeOn(def.zones.build).root;
    scene.add(this.buildPad);
    this.buildLabel = labels.add('pad-title');
    this.buildLabel.at.copy(centre(def.zones.build, 0.7));
  }

  update(sim: Simulation, dt: number, timeMs: number, camera: THREE.Camera): void {
    const { state, binDefs } = sim;
    const built = this.def.lines.filter((l) => state.lines[l.id]!.built).length;
    setText(this.title, t('factory.title', { built, total: this.def.lines.length }));

    for (const parts of this.lines) {
      const line = parts.def;
      const st = state.lines[line.id]!;
      const status = lineStatus(line, st, binDefs, state.bins);
      // Lines built before the game started just stand there; new ones pop in with a puff.
      if (st.built && !parts.wasBuilt && this.primed) {
        parts.builtAge = 0;
        this.puffs.burst(parts.machine.position, 8, 0.6);
      }
      parts.wasBuilt = st.built;
      parts.builtAge += dt;
      parts.machine.visible = st.built;
      parts.ghost.visible = !st.built;
      const pop = Math.min(1, parts.builtAge / POP_S);
      // Overshoot a little, then settle.
      parts.machine.scale.setScalar(pop < 1 ? Math.sin(pop * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1);

      const working = status === 'processing';
      if (parts.action) {
        if (working && !parts.action.isRunning()) parts.action.play();
        parts.action.paused = !working;
        parts.mixer!.update(dt);
      }
      if (parts.arm) parts.arm.rotation.y = working ? Math.sin(timeMs / 300) * 0.9 : parts.arm.rotation.y * 0.9;
      parts.machine.position.y = 0.12 + (working ? Math.abs(Math.sin(timeMs / 70)) * 0.02 : 0);

      parts.lamp.visible = st.built;
      if (status !== 'unbuilt') (parts.lamp.material as THREE.MeshBasicMaterial).color.setHex(LAMP_COLORS[status]);
      parts.ring.set(working ? (st.progress + sim.alpha) / batchTicks(line, state) : undefined);
      parts.ring.face(camera);
      parts.pile.root.visible = st.built;
      parts.pile.show({ [line.recipe.output]: st.out });
      const missing = status === 'starved' ? missingInput(line, binDefs, state.bins) : undefined;
      setText(parts.note, status === 'blocked' ? t('station.outputFull') : missing ? t('station.needs', { item: itemName(missing) }) : '');
    }

    this.primed = true;
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

  /** Where items from a bin enter a line's machine, for flying-item effects. */
  machinePoint(lineId: string): THREE.Vector3 | undefined {
    const parts = this.lines.find((p) => p.def.id === lineId);
    return parts?.machine.position.clone().setY(1.2);
  }

  /** The pallet a line's products stack on. */
  outputPoint(lineId: string): THREE.Vector3 | undefined {
    return this.lines.find((p) => p.def.id === lineId)?.pile.root.position.clone().setY(0.4);
  }
}

/**
 * The hall: floor, tall back and west walls with an orange band, low front and bay-side walls and corner
 * posts. Merged into three meshes (walls, stripe, floor).
 */
function hall(x: number, y: number, w: number, h: number): THREE.Object3D {
  const walls: THREE.BufferGeometry[] = [];
  const stripes: THREE.BufferGeometry[] = [];
  const box = (list: THREE.BufferGeometry[], cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) =>
    list.push(new THREE.BoxGeometry(sx, sy, sz).translate(cx, cy, cz));
  // Back (north) and west walls, full height, with a band.
  box(walls, x + w / 2, TALL / 2, y + THICK / 2, w, TALL, THICK);
  box(walls, x + THICK / 2, TALL / 2, y + h / 2, THICK, TALL, h);
  box(stripes, x + w / 2, TALL - 0.5, y + THICK + 0.01, w - THICK * 2, 0.18, 0.02);
  box(stripes, x + THICK + 0.01, TALL - 0.5, y + h / 2, 0.02, 0.18, h - THICK * 2);
  // Low front (south) and bay-side (east) walls.
  box(walls, x + w / 2, LOW / 2, y + h - THICK / 2, w, LOW, THICK);
  box(walls, x + w - THICK / 2, LOW / 2, y + h / 2, THICK, LOW, h);
  box(stripes, x + w / 2, LOW + 0.03, y + h - THICK / 2, w, 0.06, THICK + 0.02);
  box(stripes, x + w - THICK / 2, LOW + 0.03, y + h / 2, THICK + 0.02, 0.06, h);
  // Corner posts frame the open hall.
  for (const [px, pz] of [[x + w - 0.15, y + h - 0.15], [x + w - 0.15, y + 0.15], [x + 0.15, y + h - 0.15]] as const) {
    box(walls, px, TALL / 2, pz, 0.3, TALL, 0.3);
  }

  const group = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, h).translate(x + w / 2, 0.06, y + h / 2), mat(FLOOR));
  floor.receiveShadow = true;
  for (const [list, color] of [[walls, WALL], [stripes, STRIPE]] as const) {
    const m = new THREE.Mesh(mergeGeometries(list)!, mat(color));
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group.add(floor);
}
