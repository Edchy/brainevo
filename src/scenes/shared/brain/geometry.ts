import * as THREE from 'three';
import { rng } from '../../../world/util';

const cache = new Map<string, THREE.BufferGeometry>();

/** indexed cube-sphere of unit directions in `position` (outward winding). `twin` duplicates it with aSide = +1 / -1. */
function cubeSphereArrays(n: number) {
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  const pos: number[] = [];
  const idx: number[] = [];
  const v = new THREE.Vector3();
  for (const [a, u, w] of faces) {
    const base = pos.length / 3;
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const s = Math.tan(((i / n) * 2 - 1) * Math.PI / 4), t = Math.tan(((j / n) * 2 - 1) * Math.PI / 4);
        v.set(a[0] + u[0] * s + w[0] * t, a[1] + u[1] * s + w[1] * t, a[2] + u[2] * s + w[2] * t).normalize();
        pos.push(v.x, v.y, v.z);
      }
    }
    // pick winding so the first triangle faces outward
    const p0 = new THREE.Vector3(pos[base * 3], pos[base * 3 + 1], pos[base * 3 + 2]);
    const p1 = new THREE.Vector3(pos[(base + 1) * 3], pos[(base + 1) * 3 + 1], pos[(base + 1) * 3 + 2]);
    const p2 = new THREE.Vector3(pos[(base + n + 1) * 3], pos[(base + n + 1) * 3 + 1], pos[(base + n + 1) * 3 + 2]);
    const nrm = p1.clone().sub(p0).cross(p2.clone().sub(p0));
    const flip = nrm.dot(p0) < 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const q = base + j * (n + 1) + i;
        if (!flip) idx.push(q, q + 1, q + n + 1, q + 1, q + n + 2, q + n + 1);
        else idx.push(q, q + n + 1, q + 1, q + 1, q + n + 1, q + n + 2);
      }
    }
  }
  return { pos, idx };
}

export function cubeSphere(n: number, twin = false): THREE.BufferGeometry {
  const key = `cs${n}${twin ? 't' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { pos, idx } = cubeSphereArrays(n);
  let P = pos, I = idx, S: number[];
  if (twin) {
    const m = pos.length / 3;
    P = pos.concat(pos);
    I = idx.concat(idx.map((k) => k + m));
    S = new Array(m).fill(1).concat(new Array(m).fill(-1));
  } else S = new Array(pos.length / 3).fill(1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(S, 1));
  g.setIndex(I);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
  cache.set(key, g);
  return g;
}

/** neuraxis lathe: position = (s along the axis 0..1, cos phi, sin phi) */
export function axialTube(ns: number, np: number): THREE.BufferGeometry {
  const key = `ax${ns}_${np}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pos: number[] = [], idx: number[] = [], side: number[] = [];
  for (let i = 0; i <= ns; i++) {
    const s = i / ns;
    for (let j = 0; j <= np; j++) {
      const a = (j / np) * Math.PI * 2;
      pos.push(s, Math.cos(a), Math.sin(a)); side.push(1);
    }
  }
  for (let i = 0; i < ns; i++) {
    for (let j = 0; j < np; j++) {
      const q = i * (np + 1) + j;
      // cross(ds, dphi) points inward, so wind the other way
      idx.push(q, q + 1, q + np + 1, q + 1, q + np + 2, q + np + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
  cache.set(key, g);
  return g;
}

/** star / constellation sample on the cerebrum: random directions + nearest-neighbour links. aR = random per star. */
export function constellation(nStars: number, links: number, seed = 7) {
  const key = `co${nStars}_${links}_${seed}`;
  const hit = cache.get(key);
  const hitL = cache.get(key + 'L');
  if (hit && hitL) return { stars: hit, lines: hitL };
  const r = rng(seed);
  const dirs: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < nStars; i++) {
    v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    if (v.lengthSq() > 1 || v.lengthSq() < 0.05) { i--; continue; }
    dirs.push(v.clone().normalize());
  }
  const pos: number[] = [], rr: number[] = [];
  for (const d of dirs) { pos.push(d.x, d.y, d.z); rr.push(r(), r(), r(), r()); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sg.setAttribute('aR', new THREE.Float32BufferAttribute(rr, 4));
  sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
  // links: each star to its nearest neighbours (angular), subdivided so the segments follow the surface
  const lp: number[] = [], lr: number[] = [];
  const seen = new Set<string>();
  const SUB = 4;
  for (let i = 0; i < dirs.length; i++) {
    const ds: [number, number][] = [];
    for (let j = 0; j < dirs.length; j++) if (j !== i) ds.push([dirs[i].distanceToSquared(dirs[j]), j]);
    ds.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < links; k++) {
      const j = ds[k][1];
      const key2 = i < j ? `${i}_${j}` : `${j}_${i}`;
      if (seen.has(key2)) continue;
      seen.add(key2);
      const o = r();
      let prev = dirs[i];
      for (let s = 1; s <= SUB; s++) {
        const cur = new THREE.Vector3().lerpVectors(dirs[i], dirs[j], s / SUB).normalize();
        lp.push(prev.x, prev.y, prev.z, cur.x, cur.y, cur.z);
        lr.push(o, rr[i * 4 + 1], 0, 0, o, rr[i * 4 + 1], 0, 0);
        prev = cur;
      }
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  lg.setAttribute('aR', new THREE.Float32BufferAttribute(lr, 4));
  lg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
  cache.set(key, sg); cache.set(key + 'L', lg);
  return { stars: sg, lines: lg };
}
