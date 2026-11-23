// Detailed exterior for rectangular buildings with a catalogue exterior spec: eaves roof with overhangs,
// gable walls, eaves band, cladding zones, canopy, gutters, downpipes, PV, roof windows and chimneys.
// Generic: reads only the manufacturer-independent CatalogExterior description.
import * as THREE from 'three';
import {resolveHouseOptions} from '../core/house-options.ts';
import type { CatalogExterior } from '../core/catalogs.ts';
import type { SceneItem } from '../core/scene.ts';
import type { TextureFactory } from './model.ts';
import { materialPresets, resolveAppearance } from '../core/materials.ts';

type Appearance = ReturnType<typeof resolveAppearance>;
type Frame = { origin: THREE.Vector3; u: THREE.Vector3; n: THREE.Vector3; length: number };
const mat = (color: string, roughness = .8, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const shadowed = <T extends THREE.Object3D>(o: T) => { o.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };

/** Wall frame: origin at the plan-left (or plan-top) end, u along the wall, outward normal n. */
function wallFrame(item: SceneItem, wall: CatalogExterior['openings'][number]['wall']): Frame {
  const hw = item.w / 2, hd = item.d / 2;
  switch (wall) {
    case 'front': return { origin: new THREE.Vector3(-hw, 0, hd), u: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 0, 1), length: item.w };
    case 'back': return { origin: new THREE.Vector3(-hw, 0, -hd), u: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 0, -1), length: item.w };
    case 'left': return { origin: new THREE.Vector3(-hw, 0, -hd), u: new THREE.Vector3(0, 0, 1), n: new THREE.Vector3(-1, 0, 0), length: item.d };
    case 'right': return { origin: new THREE.Vector3(hw, 0, -hd), u: new THREE.Vector3(0, 0, 1), n: new THREE.Vector3(1, 0, 0), length: item.d };
  }
}
/** A box lying on a wall: `along` metres from the frame origin, centred `up` metres high, `out` metres proud of the wall. */
function onWall(frame: Frame, along: number, up: number, out: number, w: number, h: number, depth: number, material: THREE.Material | THREE.Material[]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), material);
  mesh.position.copy(frame.origin).addScaledVector(frame.u, along).addScaledVector(frame.n, out).setY(up);
  mesh.rotation.y = Math.atan2(frame.n.x, frame.n.z);
  return mesh;
}

function canvasTexture(draw: (g: CanvasRenderingContext2D) => void, w = 128, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (g) draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const planks = (color: string) => canvasTexture(g => {
  g.fillStyle = color; g.fillRect(0, 0, 64, 256);
  for (let x = 0; x < 64; x += 16) { g.fillStyle = 'rgba(60,35,15,.35)'; g.fillRect(x, 0, 2, 256); g.fillStyle = 'rgba(255,240,210,.12)'; g.fillRect(x + 4, 0, 5, 256); }
}, 64, 256);
const roofTiles = (color: string, covering: string) => canvasTexture(g => {
  g.fillStyle = color; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(0,0,0,.35)';
  if (covering === 'tile') for (let y = 0; y < 128; y += 32) { g.fillRect(0, y + 28, 128, 4); for (let x = (y / 32) % 2 ? 16 : 0; x < 128; x += 32) g.fillRect(x, y, 2, 28); }
  else for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 3, 128);
});
const slats = () => canvasTexture(g => {
  g.fillStyle = '#b07a44'; g.fillRect(0, 0, 32, 64);
  for (let y = 0; y < 64; y += 8) { g.fillStyle = 'rgba(70,40,15,.45)'; g.fillRect(0, y + 6, 32, 2); g.fillStyle = 'rgba(255,230,190,.18)'; g.fillRect(0, y, 32, 2); }
}, 32, 64);
const solarCells = () => canvasTexture(g => {
  g.fillStyle = '#151d2b'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#3d4a5e'; g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  g.strokeStyle = '#26303f'; g.lineWidth = 1; for (let i = 16; i < 128; i += 16) { g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
});

export function buildExterior(item: SceneItem, spec: CatalogExterior, appearance: Appearance, textures: TextureFactory | undefined, season: string) {
  const group = new THREE.Group(); group.name = 'exterior';
  const h = item.architecture.height, pitch = item.architecture.pitch * Math.PI / 180, hw = item.w / 2, hd = item.d / 2;
  const o = spec.overhang, g = spec.gableOverhang, rise = hd * Math.tan(pitch), slope = (hd + o) / Math.cos(pitch), thick = .22;
  const wallPreset = materialPresets[appearance.facade], wallMat = mat(wallPreset.color, wallPreset.roughness, { side: THREE.DoubleSide });
  const winter = season === 'winter';

  // Roof: two slabs from the ridge to the overhanging eaves; ridge along the width (x).
  const roofTex = winter ? null : roofTiles(appearance.roofColor, appearance.roofCovering);
  roofTex?.repeat.set((item.w + 2 * g) / .6, slope / .6);
  const roofMat = mat(winter ? '#eef0ee' : '#ffffff', .7, { map: roofTex }), soffit = mat('#f1f1ee', .9), fascia = mat(appearance.gutterColor, .5);
  const eaveY = h - o * Math.tan(pitch), metal = mat(appearance.gutterColor, .45, { metalness: .4, side: THREE.DoubleSide });
  for (const side of [1, -1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(item.w + 2 * g, thick, slope), [fascia, fascia, roofMat, soffit, fascia, fascia]);
    slab.rotation.x = side * pitch;
    slab.position.set(0, h + rise - ((hd + o) / 2) * Math.tan(pitch) + thick / 2 / Math.cos(pitch), side * (hd + o) / 2);
    slab.name = 'roof'; group.add(slab);
    const gutter = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, item.w + 2 * g, 10, 1, true, 0, Math.PI), metal);
    gutter.rotation.set(side > 0 ? Math.PI : 0, 0, Math.PI / 2); gutter.position.set(0, eaveY, side * (hd + o + .03)); group.add(gutter);
    for (const x of [-hw + .25, hw - .25]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, eaveY, 8), metal);
      pipe.position.set(x, eaveY / 2, side * (hd + .07)); group.add(pipe);
    }
  }
  // Gable end walls above the eaves line, in the wall finish.
  const gable = new THREE.Shape([new THREE.Vector2(-hd, h), new THREE.Vector2(hd, h), new THREE.Vector2(0, h + rise)]);
  for (const side of [1, -1]) { const tri = new THREE.Mesh(new THREE.ShapeGeometry(gable), wallMat); tri.rotation.y = Math.PI / 2; tri.position.x = side * hw; group.add(tri); }
  // Eaves band around all walls.
  if (spec.band) {
    const band = mat(spec.band.color, .85);
    for (const wall of ['front', 'back', 'left', 'right'] as const) { const f = wallFrame(item, wall); group.add(onWall(f, f.length / 2, h - spec.band.height / 2, .03, f.length + .1, spec.band.height, .06, band)); }
  }
  // Cladding zones (e.g. timber boards) from the ground up to the band.
  for (const c of spec.claddings) {
    const f = wallFrame(item, c.wall), top = h - (spec.band?.height ?? 0), width = Math.max(0, Math.min(c.to, f.length) - c.from);
    if (!width) continue;
    const preset = materialPresets[c.material], tex = c.material === 'wood' || c.material === 'wood-larch' ? planks(preset.color) : textures?.(c.material, appearance) ?? null;
    tex?.repeat.set(width / 1.2, top / 2.4);
    group.add(onWall(f, c.from + width / 2, top / 2, .025, width, top, .04, mat(tex ? '#ffffff' : preset.color, preset.roughness, { map: tex })));
  }
  if (spec.canopy) {
    const f = wallFrame(item, spec.canopy.wall);
    group.add(onWall(f, spec.canopy.center, 2.62, spec.canopy.depth / 2, spec.canopy.width, .14, spec.canopy.depth, mat('#f1f1ee', .8)));
  }
  // Roof furniture: positions are fractions along the ridge (0 = plan left), `down` the fraction of the slope from the ridge.
  const onSlope = (side: 'front' | 'back', at: number, down: number, w: number, l: number, lift: number, material: THREE.Material) => {
    const s = side === 'front' ? 1 : -1, d = down * (hd + o), m = new THREE.Mesh(new THREE.BoxGeometry(w, .06, l), material);
    m.rotation.x = s * pitch; m.position.set(-hw - g + at * (item.w + 2 * g), h + rise - d * Math.tan(pitch) + thick / Math.cos(pitch) + lift, s * d);
    return m;
  };
  if (spec.roof.pv && resolveHouseOptions(item,spec).solarPanels) {
    const span = (spec.roof.pv.to - spec.roof.pv.from) * (item.w + 2 * g), length = slope * .62, pv = solarCells();
    pv.repeat.set(span / 1.13, length / 1.72);
    const array=onSlope(spec.roof.pv.side, (spec.roof.pv.from + spec.roof.pv.to) / 2, .5, span, length, .05, mat('#ffffff', .25, { map: pv, metalness: .35 }));array.name='solar-panels';group.add(array);
  }
  for (const w of spec.roof.windows) {
    group.add(onSlope(w.side, w.at, .45, .78, 1.18, .07, mat('#f3f3f0', .6)));
    group.add(onSlope(w.side, w.at, .45, .64, 1.02, .1, mat('#5c7486', .15, { metalness: .5 })));
  }
  return shadowed(group);
}

/** Opening finish for every building: frame bars, dark glass and sill; doors as a solid leaf with a steel pull. */
export function buildOpening(origin: THREE.Vector3, u: THREE.Vector3, n: THREE.Vector3, opening: SceneItem['openings'][number], appearance: Appearance, blinds = false) {
  const group = new THREE.Group(), frame: Frame = { origin, u, n, length: 0 };
  const cx = opening.offset + opening.width / 2, cy = opening.sill + opening.height / 2, w = opening.width, h = opening.height, bar = .07;
  const frameMat = mat(opening.type === 'door' ? appearance.doorColor : appearance.frameColor, .55);
  if (opening.type === 'door' && w >= 2) {
    // Wide doors are garage doors: sectional panels, no pull handle.
    group.add(onWall(frame, cx, cy, .07, w, h, .06, frameMat));
    const groove = mat('#000000', .9, { transparent: true, opacity: .25 });
    for (let y = opening.sill + .5; y < opening.sill + h - .1; y += .5) group.add(onWall(frame, cx, y, .105, w - .04, .025, .01, groove));
  } else if (opening.type === 'door') {
    group.add(onWall(frame, cx, cy, .07, w, h, .06, frameMat));
    group.add(onWall(frame, cx + w * .3, cy, .12, .03, h * .55, .03, mat('#c9cdd0', .3, { metalness: .8 })));
  } else {
    group.add(onWall(frame, cx, cy, .055, w - bar, h - bar, .02, mat('#22303a', .08, { metalness: .6 })));
    // Catalogue renders show external timber blinds lowered over the upper part of each window.
    if (blinds) { const drop = (h - bar) * .55, tex = slats(); tex.repeat.set(1, drop / .5); group.add(onWall(frame, cx, opening.sill + h - bar / 2 - drop / 2, .065, w - bar * 1.6, drop, .015, mat('#ffffff', .8, { map: tex }))); }
    const bars: [number, number, number, number][] = [[0, h / 2 - bar / 2, w, bar], [0, -h / 2 + bar / 2, w, bar], [-w / 2 + bar / 2, 0, bar, h], [w / 2 - bar / 2, 0, bar, h]];
    if (w > 1.4) bars.push([0, 0, bar * .8, h]);
    for (const [dx, dy, bw, bh] of bars) group.add(onWall(frame, cx + dx, cy + dy, .08, bw, bh, .07, frameMat));
    if (opening.sill > .1) group.add(onWall(frame, cx, opening.sill - .02, .12, w + .1, .04, .16, mat('#5b5f63', .5, { metalness: .3 })));
  }
  return shadowed(group);
}
