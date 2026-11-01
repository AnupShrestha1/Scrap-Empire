import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/** Every model the game uses, by key. Kenney packs (CC0); see public/models/CREDITS.md. */
export const MODEL_FILES = {
  player: 'mini-characters/character-male-a.glb',
  worker: 'mini-characters/character-male-c.glb',
  supplierTruck: 'car-kit/garbage-truck.glb',
  buyerTruck: 'car-kit/delivery.glb',
  tyre: 'car-kit/debris-tire.glb',
  door: 'car-kit/debris-door.glb',
  plate: 'car-kit/debris-plate-small-a.glb',
  axle: 'car-kit/debris-drivetrain-axle.glb',
  engine: 'car-kit/debris-drivetrain.glb',
  nut: 'car-kit/debris-nut.glb',
  hopper: 'factory-kit/hopper-high-square.glb',
  machine: 'factory-kit/machine-fortified.glb',
  crateLarge: 'factory-kit/box-large.glb',
  crateSmall: 'factory-kit/box-small.glb',
  factory: 'city-kit-industrial/building-f.glb',
  hut: 'city-kit-industrial/building-k.glb',
  chimney: 'city-kit-industrial/chimney-large.glb',
} as const;

export type ModelKey = keyof typeof MODEL_FILES;

export interface Models {
  /** A fresh copy of a model, sharing geometry and materials with the original. */
  get(key: ModelKey): THREE.Object3D;
  /** The model's animation clips (characters only). */
  clips(key: ModelKey): readonly THREE.AnimationClip[];
}

/** Loads every model in parallel; `onProgress` gets 0..1. */
export async function loadModels(onProgress?: (done: number) => void): Promise<Models> {
  const loader = new GLTFLoader();
  const base = `${import.meta.env.BASE_URL}models/`;
  const keys = Object.keys(MODEL_FILES) as ModelKey[];
  let loaded = 0;
  const entries = await Promise.all(
    keys.map(async (key) => {
      const gltf = await loader.loadAsync(base + MODEL_FILES[key]);
      prepare(gltf);
      onProgress?.(++loaded / keys.length);
      return [key, gltf] as const;
    }),
  );
  const byKey = new Map<ModelKey, GLTF>(entries);
  const need = (key: ModelKey) => {
    const gltf = byKey.get(key);
    if (!gltf) throw new Error(`Model not loaded: ${key}`);
    return gltf;
  };
  return {
    get: (key) => {
      const scene = need(key).scene;
      // Skinned characters need their skeleton cloned too.
      return need(key).animations.length > 0 ? cloneSkinned(scene) : scene.clone();
    },
    clips: (key) => need(key).animations,
  };
}

/** Shadows on, and crisp sampling of Kenney's flat palette textures. */
function prepare(gltf: GLTF): void {
  gltf.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const m of materials) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      // Palette textures: blending neighbouring swatches would muddy the colours.
      if (m.map) {
        m.map.magFilter = THREE.NearestFilter;
        m.map.minFilter = THREE.NearestFilter;
        m.map.generateMipmaps = false;
        m.map.needsUpdate = true;
      }
      m.metalness = 0;
      m.roughness = 0.85;
    }
  });
}

/** A model flattened into one geometry (one group per material), ready to draw as an InstancedMesh. */
export interface Baked {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

/**
 * Flattens every mesh under `obj` (with its current transforms) into one geometry, so many copies can be
 * drawn in one call. Meshes sharing a material are merged into one group.
 */
export function bake(obj: THREE.Object3D): Baked {
  obj.updateMatrixWorld(true);
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  obj.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || Array.isArray(node.material)) return;
    let g = node.geometry.clone().applyMatrix4(node.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    // Keep only what every source has, so they merge.
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2));
    const list = byMaterial.get(node.material) ?? [];
    list.push(g);
    byMaterial.set(node.material, list);
  });
  const materials = [...byMaterial.keys()];
  const parts = materials.map((m) => mergeGeometries(byMaterial.get(m)!)!);
  const geometry = parts.length === 1 ? parts[0]! : mergeGeometries(parts, true)!;
  return { geometry, material: materials.length === 1 ? materials[0]! : materials };
}

/**
 * Scales `obj` uniformly so its largest horizontal side is `size` tiles, centres it on its origin and
 * sits it on the ground, so it covers the footprint it's placed on.
 */
export function fitToFootprint(obj: THREE.Object3D, size: number): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(obj);
  const dims = box.getSize(new THREE.Vector3());
  const mid = box.getCenter(new THREE.Vector3());
  const s = size / Math.max(dims.x, dims.z);
  obj.scale.setScalar(s);
  obj.position.set(-mid.x * s, -box.min.y * s, -mid.z * s);
  return obj;
}
