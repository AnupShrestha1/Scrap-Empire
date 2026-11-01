import * as THREE from 'three';
import { VIEW } from '../config';
import type { GameContext } from '../context';
import { itemName, t, upgradeName } from '../i18n';
import type { SimEvent } from '../sim/events';
import type { Models } from './assets';
import { Character } from './character';
import { FieldView } from './field';
import { buildGround } from './ground';
import { Labels } from './labels';
import { RingGauge } from './props';
import { centre, createStationViews, HintArrow, StaffView, type BinView, type View } from './stations';

/** Pick-ups closer together than this keep a combo going. */
const COMBO_WINDOW_MS = 700;

/** Draws the yard in 3D from simulation state, and feeds input into the simulation each frame. */
export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.5, 200);
  private readonly sun = new THREE.DirectionalLight(0xfff1d8, 2.6);
  private readonly labels: Labels;
  private readonly player: Character;
  /** The stand-still timer over the player's head on sell, upgrade, build and hire pads. */
  private readonly charge = new RingGauge();
  private readonly views: View[] = [];
  private readonly staff: StaffView;
  private readonly bins: Map<string, BinView>;
  private readonly simEvents: SimEvent[] = [];
  /** Cash earned per station this frame, shown as one floating "+$" each. */
  private readonly sales = new Map<string, number>();
  private readonly move = { x: 0, y: 0 };
  private readonly focus = new THREE.Vector3();
  private lastFrameAt = performance.now();
  private combo = 0;
  private lastPickupAt = -Infinity;
  private width = 1;
  private height = 1;

  constructor(
    private readonly parent: HTMLElement,
    private readonly ctx: GameContext,
    models: Models,
    uiLayer: HTMLElement,
  ) {
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? VIEW.maxDprMobile : VIEW.maxDpr));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    parent.append(this.renderer.domElement);
    this.labels = new Labels(uiLayer);
    this.setUpLights(mobile);

    const { sim } = ctx;
    this.scene.add(buildGround(sim.grid, models));
    this.player = new Character(models, 'player');
    this.staff = new StaffView(this.scene, models);
    const dump = sim.stations.find((s) => s.kind === 'dump');
    if (!dump || dump.kind !== 'dump') throw new Error('The yard has no dump site');
    const field = new FieldView(this.scene, models, this.labels, dump, (at) => this.nearestWorker(at));
    const stations = createStationViews(this.scene, models, this.labels, sim.stations);
    this.bins = stations.bins;
    const hint = new HintArrow(sim.stations, () => ctx.settings.value.hints);
    this.views.push(field, this.staff, ...stations.views, hint);
    this.scene.add(this.player.root, this.charge.root, hint.root);

    window.addEventListener('resize', () => this.resize());
    parent.addEventListener('contextmenu', (e) => e.preventDefault());
    this.resize();
    const p = sim.state.player;
    this.focus.set(p.x, 0, p.y - VIEW.leadTiles);
  }

  start(): void {
    this.lastFrameAt = performance.now();
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  private setUpLights(mobile: boolean): void {
    const sky = 0xbfe3ff;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(sky, 35, 70);
    this.scene.add(new THREE.HemisphereLight(0xdff0ff, 0x7a6a50, 1.5));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(mobile ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -22;
    sc.right = 22;
    sc.top = 22;
    sc.bottom = -22;
    sc.near = 1;
    sc.far = 70;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
  }

  private frame(time: number): void {
    const now = performance.now();
    const elapsed = Math.min(now - this.lastFrameAt, 250);
    this.lastFrameAt = now;
    const dt = elapsed / 1000;
    const { sim, input, hud } = this.ctx;

    // The camera looks north, so screen directions are grid directions.
    input.readMove(this.move);
    sim.setMoveInput(this.move.x, this.move.y);
    sim.advance(elapsed);

    this.sales.clear();
    for (const event of sim.drainEvents(this.simEvents)) this.react(event, time);
    for (const [station, value] of this.sales) this.showSale(station, value);
    hud.update(sim.state);

    const { state, prevPlayer, alpha } = sim;
    const px = prevPlayer.x + (state.player.x - prevPlayer.x) * alpha;
    const py = prevPlayer.y + (state.player.y - prevPlayer.y) * alpha;
    this.player.update(dt, px, py, state.player.stack);
    this.follow(px, py, dt);
    for (const view of this.views) view.update(sim, dt, time, this.camera);
    // Over the head, facing the camera.
    this.charge.set(sim.padCharge);
    this.charge.root.position.set(px, 2.2, py);
    this.charge.face(this.camera);

    this.labels.update(this.camera, this.width, this.height, dt);
    this.renderer.render(this.scene, this.camera);
  }

  private follow(x: number, z: number, dt: number): void {
    const k = 1 - Math.exp(-VIEW.cameraFollowRate * dt);
    this.focus.x += (x - this.focus.x) * k;
    // Look a little ahead (north) of the player, so they sit below centre, clear of the HUD.
    this.focus.z += (z - VIEW.leadTiles - this.focus.z) * k;
    const pitch = THREE.MathUtils.degToRad(VIEW.pitchDeg);
    const d = this.cameraDistance();
    this.camera.position.set(this.focus.x, Math.sin(pitch) * d, this.focus.z + Math.cos(pitch) * d);
    this.camera.lookAt(this.focus);
    // The sun's shadow box follows the camera, so shadows stay sharp wherever the player goes.
    this.sun.position.set(this.focus.x - 10, 22, this.focus.z + 8);
    this.sun.target.position.copy(this.focus);
  }

  /**
   * Far enough that about VIEW.visibleArea tiles of ground show. Keeping the area rather than the width
   * fixed gives tiles a similar size on screen in landscape and portrait alike.
   */
  private cameraDistance(): number {
    const tanV = Math.tan(THREE.MathUtils.degToRad(VIEW.fov) / 2);
    const tanH = tanV * this.camera.aspect;
    // Visible ground ≈ (2·d·tanH) × (2·d·tanV / sin(pitch)).
    return Math.sqrt((VIEW.visibleArea * Math.sin(THREE.MathUtils.degToRad(VIEW.pitchDeg))) / (4 * tanH * tanV));
  }

  private resize(): void {
    this.width = Math.max(1, this.parent.clientWidth);
    this.height = Math.max(1, this.parent.clientHeight);
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  /** The worker (player or employee) nearest a point: where a collected piece flies to. */
  private nearestWorker(at: THREE.Vector3): Character {
    let best = this.player;
    let bestD = best.root.position.distanceToSquared(at);
    for (const c of this.staff.characters) {
      const d = c.root.position.distanceToSquared(at);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  /** Turns simulation events into feedback: sounds, toasts and floating cash. */
  private react(event: SimEvent, timeMs: number): void {
    const { sfx, toasts, sim } = this.ctx;
    switch (event.type) {
      case 'itemMoved':
        // Pick-ups from the dump site have their own pop (see 'pickedUp').
        if (event.to === 'player' && event.from !== 'dump') sfx.play('pickup');
        else if (event.from === 'player') sfx.play('drop');
        break;
      case 'pickedUp': {
        // Quick pick-ups in a row climb in pitch, so sweeping a cluster sings.
        this.combo = timeMs - this.lastPickupAt < COMBO_WINDOW_MS ? Math.min(this.combo + 1, 12) : 0;
        this.lastPickupAt = timeMs;
        sfx.play('pop', 1 + this.combo * 0.06);
        if (event.units > 1) this.labels.floating(`+${event.units}`, new THREE.Vector3(event.x, 1.2, event.y), 'white');
        break;
      }
      case 'dropped':
        sfx.play('drop');
        break;
      case 'processed':
        sfx.play('chunk');
        break;
      case 'storageFull':
        this.bins.get(event.station)?.flash();
        toasts.show(t('toast.storageFull', { item: itemName(event.item) }), 'warn');
        sfx.play('warn');
        break;
      case 'sold':
        this.sales.set(event.station, (this.sales.get(event.station) ?? 0) + event.value);
        sfx.play('cash');
        break;
      case 'needCash':
        toasts.show(t('toast.needCash', { amount: event.amount }), 'warn');
        sfx.play('warn');
        break;
      case 'upgraded':
        toasts.show(t('toast.upgraded', { name: upgradeName(event.upgrade), level: event.level }), 'good');
        sfx.play('upgrade');
        break;
      case 'objectiveDone':
        toasts.show(t('toast.objectiveDone', { reward: event.reward }), 'good');
        sfx.play('objective');
        break;
      case 'built': {
        const line = sim.factoryLine(event.station);
        if (line) toasts.show(t('toast.built', { name: t(line.name) }), 'good');
        sfx.play('upgrade');
        break;
      }
      case 'locked':
        if (event.level) toasts.show(t('toast.locked', { level: event.level }), 'warn');
        else if (event.line) {
          const line = sim.factoryLine(event.line);
          toasts.show(t('locked.line', { name: line ? t(line.name) : event.line }), 'warn');
        }
        sfx.play('warn');
        break;
      case 'levelUp':
        toasts.show(t('toast.levelUp', { level: event.level }), 'good');
        sfx.play('objective');
        break;
      case 'hired':
        toasts.show(t('toast.hired', { count: event.count }), 'good');
        sfx.play('upgrade');
        break;
      case 'orderArrived':
        toasts.show(t('toast.orderArrived', { want: event.want, item: itemName(event.item) }), 'info');
        sfx.play('horn');
        break;
      case 'orderFilled': {
        toasts.show(t('toast.orderFilled', { value: event.value }), 'good');
        sfx.play('upgrade');
        const bay = sim.stations.find((s) => s.id === event.bay);
        if (bay) this.labels.floating(`+$${event.value}`, centre(bay.rect, 2.4));
        break;
      }
      case 'orderExpired':
        toasts.show(t('toast.orderExpired'), 'warn');
        break;
      case 'truckArriving':
        sfx.play('horn');
        break;
      case 'truckWaiting':
        toasts.show(t('toast.yardFull'), 'warn');
        break;
      default:
        break;
    }
  }

  private showSale(station: string, value: number): void {
    const def = this.ctx.sim.stations.find((s) => s.id === station);
    if (!def) return;
    const at = def.kind === 'bin' ? def.zones.sell : def.rect;
    this.labels.floating(`+$${value}`, centre(at, 1.4));
  }
}
