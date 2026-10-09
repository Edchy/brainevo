import { MAT, PrimSet } from './sdf';
import type { Palette, Look } from './sdf';
import { GAITS, clamp, footCycle, hash1, ik2, mix, vnoise } from './rig';
import type { Leg, RigState } from './rig';
import { solvePrimate } from './primate';

/** Everything that makes one four-legged mammal differ from another. Units are creature-local (shrew ~0.7 body, rat ~0.95). */
export interface QuadParams {
  bodyLen: number;            // shoulder joint to hip joint
  chestR: number; waistR: number; hipR: number;
  bodyW: number;              // lateral squash of the trunk (z scale)
  belly: number;              // belly sag 0..1
  arch: number;               // spine arch 0..1
  ext: number;                // standing leg extension 0.6 (crouched) .. 0.95 (columnar)
  front: [number, number, number]; // upper arm, forearm, paw lengths
  hind: [number, number, number];  // thigh, shin, foot lengths
  limbR: number;              // limb thickness multiplier
  digi: number;               // 0 plantigrade .. 1 digitigrade (heel raised)
  sprawl: number;             // 0 upright .. 1 reptilian elbows/knees out
  neckLen: number; neckR: number; neckUp: number; // neckUp: radians above horizontal
  skullR: number; skullLen: number; headDrop: number; // headDrop: nose-down radians
  muzzleLen: number; muzzleR: number; muzzleTipR: number; noseR: number; jaw: number;
  eyeR: number; eyeFwd: number; eyeUp: number;
  earSize: number; earW: number; earTilt: number; earBack: number;
  whisker: number;            // whisker length factor (0 = none)
  tailLen: number; tailR0: number; tailR1: number; tailSegs: number; tailRise: number; tailCurl: number; tailNaked: boolean;
  gait: keyof typeof GAITS; stride: number; lift: number; bob: number; wave: number;
  palette: Palette; look: Partial<Look>;
  /** primate solver (sit/grasp/reach pose controls, digits, brow) instead of the plain quadruped */
  primate?: boolean; eyeSide?: number; browR?: number;
}

const BASE: QuadParams = {
  bodyLen: 0.95, chestR: 0.18, waistR: 0.17, hipR: 0.2, bodyW: 0.88, belly: 0.3, arch: 0.35, ext: 0.85,
  front: [0.2, 0.2, 0.14], hind: [0.26, 0.26, 0.2], limbR: 1, digi: 0.3, sprawl: 0,
  neckLen: 0.12, neckR: 0.11, neckUp: 0.45, skullR: 0.12, skullLen: 0.26, headDrop: 0.18,
  muzzleLen: 0.22, muzzleR: 0.075, muzzleTipR: 0.04, noseR: 0.026, jaw: 1,
  eyeR: 0.028, eyeFwd: 0.2, eyeUp: 0.32,
  earSize: 0.15, earW: 1, earTilt: 0.35, earBack: 0.2,
  whisker: 0, tailLen: 0.9, tailR0: 0.045, tailR1: 0.012, tailSegs: 3, tailRise: 0.1, tailCurl: 0.25, tailNaked: false,
  gait: 'trot', stride: 0.5, lift: 0.045, bob: 0.012, wave: 0.02,
  palette: { base: '#3a3b44', belly: '#6c6c76', rim: '#c4d6ff', skin: '#6a5359', splash: '#ffb866', key: '#8e9ac0', bone: '#d8d2c4' },
  look: {},
};

const P = (o: Partial<QuadParams>): QuadParams => ({ ...BASE, ...o });

export type QuadPresetName = 'shrew' | 'cynodont' | 'rat' | 'primate' | 'ape' | 'prosimian';

export const QUAD_PRESETS: Record<QuadPresetName, QuadParams> = {
  // low, long, sprawling-ish, long muzzle, no external ears, heavy tail: a Thrinaxodon/Cynognathus feel
  cynodont: P({
    bodyLen: 1.05, chestR: 0.17, waistR: 0.15, hipR: 0.19, bodyW: 0.92, belly: 0.1, arch: 0.2, ext: 0.8,
    front: [0.25, 0.24, 0.17], hind: [0.3, 0.27, 0.2], limbR: 1.0, digi: 0.15, sprawl: 0.5,
    neckLen: 0.14, neckR: 0.125, neckUp: 0.15, skullR: 0.13, skullLen: 0.3, headDrop: 0.1,
    muzzleLen: 0.34, muzzleR: 0.092, muzzleTipR: 0.062, noseR: 0.03, eyeR: 0.03, eyeFwd: 0.12, eyeUp: 0.35,
    earSize: 0, tailLen: 0.85, tailR0: 0.1, tailR1: 0.016, tailRise: 0.0, tailCurl: 0.05,
    gait: 'walk', stride: 0.6, lift: 0.045, bob: 0.008, wave: 0.05,
    palette: { base: '#2b2d36', belly: '#4a4b55', rim: '#bcd0ff', skin: '#4a4048', splash: '#ffb060', key: '#8a96b8', bone: '#d4cdbd' },
    look: { fur: 0.35 },
  }),
  // tiny, hunched, a long flexible snout, thin legs, scaly-ish tail
  shrew: P({
    bodyLen: 0.66, chestR: 0.125, waistR: 0.118, hipR: 0.14, bodyW: 0.85, belly: 0.25,
    front: [0.12, 0.12, 0.1], hind: [0.17, 0.16, 0.14], limbR: 0.85, digi: 0.35, sprawl: 0.1,
    neckLen: 0.07, neckR: 0.075, neckUp: 0.3, skullR: 0.08, skullLen: 0.16, headDrop: 0.28,
    muzzleLen: 0.36, muzzleR: 0.048, muzzleTipR: 0.014, noseR: 0.018, eyeR: 0.0125, eyeFwd: 0.1, eyeUp: 0.35,
    earSize: 0.075, earW: 1, earTilt: 0.2, earBack: 0.35, whisker: 0.8,
    tailLen: 0.5, tailR0: 0.04, tailR1: 0.008, tailSegs: 3, tailRise: 0.05, tailCurl: 0.15,
    gait: 'scurry', stride: 0.34, lift: 0.03, bob: 0.01, wave: 0.03,
    palette: { base: '#24262e', belly: '#4c4d57', rim: '#d4e0ff', skin: '#5d4850', splash: '#e8f0ff', key: '#8a96b8', bone: '#d8d2c4' },
    look: { keyK: 0.55, amb: 0.2 },
  }),
  rat: P({
    bodyLen: 0.78, chestR: 0.14, ext: 0.9,
    palette: { base: '#33343c', belly: '#63636e', rim: '#c8d8ff', skin: '#7a5a62', splash: '#ffd9a0', key: '#8e9ac0', bone: '#d8d2c4' },
    waistR: 0.145, hipR: 0.18, arch: 0.3, belly: 0.5,
    neckUp: 0.3, headDrop: 0.3, skullR: 0.14, skullLen: 0.27, muzzleLen: 0.26, muzzleR: 0.08, muzzleTipR: 0.03, noseR: 0.026,
    eyeR: 0.03, eyeFwd: 0.14, eyeUp: 0.36,
    earSize: 0.12, earW: 1.55, earTilt: 0.6, earBack: 0.35,
    tailNaked: true, whisker: 1.0, look: { fur: 0.75 },
  }),
  // arboreal monkey: long grasping hands and feet, round head with a brow, forward eyes, long prehensile tail
  primate: P({
    primate: true, eyeSide: 0.5, browR: 0.03,
    bodyLen: 0.8, chestR: 0.17, waistR: 0.14, hipR: 0.15, bodyW: 0.88, belly: 0.1, arch: 0.4, ext: 0.88,
    front: [0.36, 0.34, 0.24], hind: [0.36, 0.33, 0.26], limbR: 0.88, digi: 0.0, sprawl: 0.1,
    neckLen: 0.07, neckR: 0.115, neckUp: 0.5, skullR: 0.185, skullLen: 0.21, headDrop: 0.3,
    muzzleLen: 0.1, muzzleR: 0.085, muzzleTipR: 0.065, noseR: 0.02, jaw: 1.0, eyeR: 0.034, eyeFwd: 0.52, eyeUp: 0.2,
    earSize: 0.075, earW: 1.1, earTilt: 0.5, earBack: 0.1,
    tailLen: 1.25, tailR0: 0.068, tailR1: 0.028, tailSegs: 3, tailRise: 0.25, tailCurl: 1.6,
    gait: 'walk', stride: 0.8, lift: 0.07, bob: 0.014, wave: 0.02,
    palette: { base: '#4a3f38', belly: '#8a7a6c', rim: '#ffe0b8', skin: '#8a6a5a', splash: '#ffd080', key: '#a09080', bone: '#e0d8c8' },
    look: { fur: 0.9, furScale: 1.1 },
  }),
  // great ape: tailless, heavy brow, long arms, big chest
  ape: P({
    primate: true, eyeSide: 0.5, browR: 0.04,
    bodyLen: 0.85, chestR: 0.185, waistR: 0.14, hipR: 0.16, bodyW: 0.88, belly: 0.2, arch: 0.3, ext: 0.88,
    front: [0.42, 0.4, 0.25], hind: [0.3, 0.28, 0.25], limbR: 1.02, digi: 0.0, sprawl: 0.2,
    neckLen: 0.1, neckR: 0.13, neckUp: 0.4, skullR: 0.19, skullLen: 0.2, headDrop: 0.25,
    muzzleLen: 0.12, muzzleR: 0.1, muzzleTipR: 0.08, noseR: 0.02, jaw: 1.1, eyeR: 0.032, eyeFwd: 0.5, eyeUp: 0.14,
    earSize: 0.06, earW: 1.0, earTilt: 0.5, earBack: 0.1,
    tailLen: 0, tailR0: 0.05, tailR1: 0.02, tailSegs: 3, tailRise: 0.1, tailCurl: 0,
    gait: 'walk', stride: 0.85, lift: 0.07, bob: 0.014, wave: 0.02,
    palette: { base: '#4a423b', belly: '#8d8174', rim: '#ffe0b8', skin: '#6e5548', splash: '#ffd080', key: '#a09080', bone: '#e0d8c8' },
    look: { fur: 0.95, furScale: 1.0 },
  }),
  // small early primate: huge forward eyes, long leaping hind legs, thin grasping fingers, long tail
  prosimian: P({
    primate: true, eyeSide: 0.64, browR: 0.024,
    bodyLen: 0.62, chestR: 0.155, waistR: 0.125, hipR: 0.16, bodyW: 0.9, belly: 0.1, arch: 0.5, ext: 0.84,
    front: [0.3, 0.29, 0.21], hind: [0.36, 0.34, 0.27], limbR: 1.0, digi: 0.0, sprawl: 0.1,
    neckLen: 0.05, neckR: 0.1, neckUp: 0.5, skullR: 0.16, skullLen: 0.17, headDrop: 0.3,
    muzzleLen: 0.12, muzzleR: 0.07, muzzleTipR: 0.045, noseR: 0.016, jaw: 1.0, eyeR: 0.056, eyeFwd: 0.4, eyeUp: 0.2,
    earSize: 0.12, earW: 1.2, earTilt: 0.45, earBack: 0.1,
    tailLen: 1.15, tailR0: 0.06, tailR1: 0.022, tailSegs: 3, tailRise: 0.35, tailCurl: 0.8,
    gait: 'walk', stride: 0.7, lift: 0.07, bob: 0.014, wave: 0.02,
    palette: { base: '#3c322b', belly: '#b9ac99', rim: '#ffe6c4', skin: '#a08674', splash: '#ffd080', key: '#c0b2a2', bone: '#e0d8c8' },
    look: { fur: 1.0, furScale: 1.3 },
  }),
};

export function quadParams(name: QuadPresetName, over?: Partial<QuadParams>): QuadParams {
  return over ? { ...QUAD_PRESETS[name], ...over } : QUAD_PRESETS[name];
}

// scratch (no per-frame allocation)
const leg: Leg = { jx: 0, jy: 0, ex: 0, ey: 0 };
const fc = { x: 0, lift: 0 };

/** Height of the hip joint above ground when standing (leg slightly bent). */
function standHeight(l1: number, l2: number, ankleY: number, dx: number, ext: number) {
  const r = ext * (l1 + l2);
  return ankleY + Math.sqrt(Math.max(r * r - dx * dx, 0.0004));
}

/** Fill `ps` with the quadruped for this frame. Pure function of (params, state). */
export function solveQuad(ps: PrimSet, Q: QuadParams, st: RigState) {
  if (Q.primate) { solvePrimate(ps, Q, st); return; }
  ps.reset();
  const T = st.time, walk = st.walk, ph = st.phase;
  const gait = GAITS[Q.gait];
  const lr = Q.limbR;
  const hip = Q.hipR, ch = Q.chestR;

  // ---- legs: stand heights -> spine heights -------------------------------------------------------------------------
  const toeR = (len: number) => 0.01 * lr + len * 0.075; // toe radius
  const hAf = Q.hind[2] * mix(0.25, 0.82, Q.digi), fAf = Q.front[2] * mix(0.25, 0.7, Q.digi * 0.6);
  const hLf = Math.sqrt(Math.max(Q.hind[2] ** 2 - hAf ** 2, 1e-4)), fLf = Math.sqrt(Math.max(Q.front[2] ** 2 - fAf ** 2, 1e-4));
  const hToeR = toeR(Q.hind[2]), fToeR = toeR(Q.front[2]);
  const hAnkleY = hToeR + hAf, fAnkleY = fToeR + fAf;
  const hAnkOff = -0.07 - 0.06 * Q.digi, fAnkOff = 0.015;
  const yH = standHeight(Q.hind[0], Q.hind[1], hAnkleY, hAnkOff, Q.ext) - st.crouch * 0.08;
  const yS = standHeight(Q.front[0], Q.front[1], fAnkleY, fAnkOff, Q.ext) - st.crouch * 0.08;

  const bob = Q.bob * walk * Math.cos(4 * Math.PI * ph + 0.6);
  const undul = Q.wave * walk * Math.sin(2 * Math.PI * ph);
  const breathe = 1 + 0.03 * Math.sin(T * 2.6 * (1 + 0.6 * st.alert)) * (1 - 0.5 * walk) + 0.012 * Math.sin(T * 7);

  const bl2 = Q.bodyLen / 2;
  // joint roots sit under the spine
  const hjx = -bl2 + 0.02, hjy = yH + bob * 0.8, hjz = -undul;
  const sjx = bl2 - 0.04, sjy = yS + bob, sjz = undul;
  // spine centres
  const Hx = hjx, Hy = hjy + hip * 0.5, Hz = hjz;
  const Sx = sjx, Sy = sjy + ch * 0.5, Sz = sjz;
  const Mx = (Hx + Sx) / 2, My = (Hy + Sy) / 2 - Q.waistR * 0.08 * Q.belly + Q.arch * 0.1 * Q.bodyLen, Mz = 0;

  const zs = Q.bodyW;
  // torso: haunch -> waist -> ribcage -> chest, one continuous soft mass
  ps.add(Hx - hip * 0.55, Hy - hip * 0.02, Hz, hip * 0.88, Mx, My, Mz, Q.waistR, 0.16, MAT.fur, zs);
  ps.add(Mx, My, Mz, Q.waistR, Sx - ch * 0.1, Sy, Sz, ch * 1.02 * breathe, 0.16, MAT.fur, zs);
  ps.add(Sx - ch * 0.05, Sy + ch * 0.04, Sz, ch * 1.0 * breathe, Sx + ch * 0.45, Sy - ch * 0.12, Sz, ch * 0.78, 0.12, MAT.fur, zs);
  if (Q.belly > 0.01) ps.add(Mx - 0.02, My - Q.waistR * 0.55, 0, Q.waistR * 0.62, Mx + 0.12, My - Q.waistR * 0.5, 0, Q.waistR * 0.55 * (0.8 + 0.2 * Q.belly), 0.14, MAT.fur, zs * 0.9, 1.05);

  // ---- legs --------------------------------------------------------------------------------------------------------
  const legZ = (front: boolean) => (front ? ch : hip) * Q.bodyW * (0.62 + 0.5 * Q.sprawl);
  const spr = Q.sprawl;
  for (let i = 0; i < 4; i++) {
    const front = i < 2, side = i % 2 === 0 ? 1 : -1; // i: 0 FL(+z) 1 FR 2 HL 3 HR
    const L = front ? Q.front : Q.hind;
    const rx = front ? sjx : hjx, ry = (front ? sjy : hjy) - (front ? ch : hip) * 0.1 + 0.0;
    const rz0 = (front ? sjz : hjz) + side * legZ(front) * 0.82;
    const lph = ph + gait.off[i];
    footCycle(lph, gait.duty, fc);
    const sweep = Q.stride * gait.duty * walk;
    const ank0 = (front ? fAnkOff : hAnkOff);
    const Lf = front ? fLf : hLf, toeR_ = front ? fToeR : hToeR, ankY0 = front ? fAnkleY : hAnkleY;
    const ax = rx + ank0 + fc.x * sweep;
    const ay = ankY0 + fc.lift * Q.lift * walk;
    ik2(rx, ry, ax, ay, L[0], L[1], front ? -1 : 1, leg);
    const fz = rz0 + side * spr * 0.22 * (L[0] + L[1]); // foot is wider than the shoulder when sprawling
    const jz = (rz0 + fz) / 2 + side * spr * 0.28 * L[0];
    const r0 = (front ? ch * 0.58 : hip * 0.78) * lr, r1 = r0 * 0.5, r2 = Math.max(r1 * 0.55, 0.012);
    const tone = 1;
    // thigh/upper arm, shin/forearm, foot
    ps.add(rx, ry, rz0, r0, leg.jx, leg.jy, jz, r1, front ? 0.07 : 0.1, MAT.fur, 0.9, tone);
    ps.add(leg.jx, leg.jy, jz, r1 * 0.95, leg.ex, leg.ey, fz, r2, 0.05, MAT.fur, 0.85, tone);
    const sole = 1 - 0.35 * fc.lift;
    ps.add(leg.ex, leg.ey, fz, r2, leg.ex + Lf * sole, toeR_ + fc.lift * Q.lift * walk * 0.9, fz, toeR_ * 1.0, 0.04, MAT.skin, 1.5, 0.8);
  }

  // ---- head ---------------------------------------------------------------------------------------------------------
  const sn = st.sniff * (1 - 0.7 * walk);
  const idle = vnoise(T * 0.7) * 0.25 + vnoise(T * 1.9 + 4) * 0.12;
  const pitch = -Q.headDrop + st.alert * 0.3 + st.headPitch + sn * (0.05 * Math.sin(T * 7.3) + 0.08 * idle) + 0.04 * walk * Math.sin(4 * Math.PI * ph + 1) + 0.01 * Math.sin(T * 2.6);
  const yaw = st.headYaw + sn * idle * 0.7 + 0.03 * walk * Math.sin(2 * Math.PI * ph);
  const na = Q.neckUp + st.alert * 0.25 + st.headPitch * 0.35;
  const bx = Sx + ch * 0.45, by = Sy + ch * 0.3 + 0.0;
  const hbx = bx + Math.cos(na) * Q.neckLen, hby = by + Math.sin(na) * Q.neckLen, hbz = Sz * 0.5;
  ps.add(Sx + ch * 0.1, Sy + ch * 0.1, Sz, ch * 0.86, hbx, hby, hbz, Q.neckR, 0.14, MAT.fur, zs);

  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const fx = cp * cy, fy = sp, fz = cp * sy;           // head forward
  const ux = -sp * cy, uy = cp, uz = -sp * sy;          // head up
  const sx = fy * uz - fz * uy, sy2 = fz * ux - fx * uz, sz = fx * uy - fy * ux; // side = f x u  (+z when facing +x)
  const sR = Q.skullR, sL = Q.skullLen;
  const cx = hbx + fx * sL * 0.45 + ux * sR * 0.1, cy2 = hby + fy * sL * 0.45 + uy * sR * 0.1, cz = hbz + fz * sL * 0.45 + uz * sR * 0.1;
  ps.add(cx - fx * sL * 0.38, cy2 - fy * sL * 0.38, cz - fz * sL * 0.38, sR * 0.97, cx + fx * sL * 0.18, cy2 + fy * sL * 0.18, cz + fz * sL * 0.18, sR, 0.12, MAT.fur, 0.93);
  st.headX = cx; st.headY = cy2; st.headZ = cz;
  // muzzle
  const mL = Q.muzzleLen * (1 + 0.012 * sn * Math.sin(T * 14)); // nose twitch
  const m0x = cx + fx * sL * 0.33 - ux * sR * 0.14, m0y = cy2 + fy * sL * 0.33 - uy * sR * 0.14, m0z = cz + fz * sL * 0.33 - uz * sR * 0.14;
  const droop = mL * 0.1;
  const m1x = m0x + fx * mL - ux * droop, m1y = m0y + fy * mL - uy * droop, m1z = m0z + fz * mL - uz * droop;
  ps.add(m0x, m0y, m0z, Q.muzzleR, m1x, m1y, m1z, Q.muzzleTipR, 0.09, MAT.fur, 0.8);
  // nose pad
  ps.add(m1x + fx * Q.muzzleTipR * 0.3, m1y + fy * Q.muzzleTipR * 0.3 + uy * Q.muzzleTipR * 0.1, m1z + fz * Q.muzzleTipR * 0.3, Q.noseR, m1x + fx * Q.muzzleTipR * 0.75, m1y + fy * Q.muzzleTipR * 0.75 + uy * Q.muzzleTipR * 0.15, m1z + fz * Q.muzzleTipR * 0.75, Q.noseR * 0.8, 0.03, MAT.wet, 1);
  // mouth line: a thin dark lip where the jaw meets the muzzle
  { const lr = Math.max(0.006, Q.muzzleTipR * 0.2), o0 = Q.muzzleR * 0.34, o1 = Q.muzzleTipR * 0.3;
    ps.add(m0x - ux * o0, m0y - uy * o0, m0z - uz * o0, lr, m1x - ux * o1 + fx * Q.muzzleTipR * 0.3, m1y - uy * o1 + fy * Q.muzzleTipR * 0.3, m1z - uz * o1 + fz * Q.muzzleTipR * 0.3, lr * 0.8, 0.012, MAT.wet, 0.9, 0.7); }
  // lower jaw (hinged at the back of the muzzle), opens with st.mouth
  const open = st.mouth * 0.45;
  const jdx = Math.cos(open), jdy = -Math.sin(open);
  const j0x = m0x - fx * mL * 0.02 - ux * Q.muzzleR * 0.62, j0y = m0y - fy * mL * 0.02 - uy * Q.muzzleR * 0.62, j0z = m0z - fz * mL * 0.02 - uz * Q.muzzleR * 0.62;
  const jl = mL * 0.82 * Q.jaw;
  const jex = j0x + (fx * jdx + ux * jdy) * jl, jey = j0y + (fy * jdx + uy * jdy) * jl, jez = j0z + (fz * jdx + uz * jdy) * jl;
  ps.add(j0x, j0y, j0z, Q.muzzleR * 0.52, jex, jey, jez, Q.muzzleTipR * 0.5, 0.025, MAT.fur, 0.75, 1.02);
  // eyes
  const ex = cx + fx * sL * Q.eyeFwd + ux * sR * Q.eyeUp, ey = cy2 + fy * sL * Q.eyeFwd + uy * sR * Q.eyeUp, ez = cz + fz * sL * Q.eyeFwd + uz * sR * Q.eyeUp;
  const eo = sR * 0.8;
  for (let s = -1; s <= 1; s += 2) {
    ps.add(ex + sx * eo * s, ey + sy2 * eo * s, ez + sz * eo * s, Q.eyeR, ex + sx * (eo + 0.001) * s, ey + sy2 * (eo + 0.001) * s + 0.0005, ez + sz * (eo + 0.001) * s, Q.eyeR * 0.98, 0.004, MAT.eye, 1);
  }
  // whiskers: three fanned hairs per side, quivering with the sniff
  if (Q.whisker > 0) {
    const wl = Q.whisker * mL * 0.95;
    for (let s = -1; s <= 1; s += 2) {
      for (let k = 0; k < 3; k++) {
        const ang = (0.35 + k * 0.38) * s + 0.08 * sn * Math.sin(T * 17 + k * 2 + s);
        const rise = (0.22 - k * 0.2) + 0.04 * Math.sin(T * 13 + k);
        const rr = 0.6 + 0.12 * k;
        const wx0 = m0x + (m1x - m0x) * rr + sx * Q.muzzleR * 0.55 * s * (1 - rr * 0.35), wy0 = m0y + (m1y - m0y) * rr + sy2 * Q.muzzleR * 0.55 * s * (1 - rr * 0.35) + uy * Q.muzzleR * 0.12, wz0 = m0z + (m1z - m0z) * rr + sz * Q.muzzleR * 0.55 * s * (1 - rr * 0.35);
        const dxw = fx * Math.cos(ang) * 0.8 + sx * Math.sin(ang) * s * s + ux * rise, dyw = fy * Math.cos(ang) * 0.8 + sy2 * Math.sin(ang) * s * s + uy * rise - 0.06 * k, dzw = fz * Math.cos(ang) * 0.8 + sz * Math.sin(ang) * s * s + uz * rise;
        // side vector times sign: whiskers splay outward on each side
        ps.addWhisker(wx0, wy0, wz0, wx0 + dxw * wl * (1 - 0.12 * k) , wy0 + dyw * wl * (1 - 0.12 * k), wz0 + dzw * wl * (1 - 0.12 * k), Math.max(0.0025, Q.muzzleTipR * 0.09));
      }
    }
  }
  // ears with an occasional twitch
  if (Q.earSize > 0.005) {
    const tw = Math.pow(Math.max(0, vnoise(T * 0.9 + 11)), 3) * 1.6 + st.alert * 0.2;
    for (let s = -1; s <= 1; s += 2) {
      const twS = tw * (s > 0 ? 1 : 0.6) * Math.sin(T * 38 + s);
      const bx2 = cx - fx * sL * 0.1 + ux * sR * 0.76 + sx * sR * 0.5 * s, by2 = cy2 - fy * sL * 0.1 + uy * sR * 0.76 + sy2 * sR * 0.5 * s, bz2 = cz - fz * sL * 0.1 + uz * sR * 0.76 + sz * sR * 0.5 * s;
      const E = Q.earSize, tilt = Q.earTilt + twS * 0.12, back = Q.earBack - st.alert * 0.1;
      const tx = bx2 + ux * E * Math.cos(tilt) - fx * E * back + sx * E * Math.sin(tilt) * s;
      const ty = by2 + uy * E * Math.cos(tilt) - fy * E * back + sy2 * E * Math.sin(tilt) * s;
      const tz = bz2 + uz * E * Math.cos(tilt) - fz * E * back + sz * E * Math.sin(tilt) * s;
      ps.add(bx2, by2, bz2, E * 0.4 * Q.earW, tx, ty, tz, E * 0.28 * Q.earW, 0.05, MAT.skin, 0.28, 1);
    }
  }

  // ---- tail ----------------------------------------------------------------------------------------------------------
  const segs = Math.max(1, Math.round(Q.tailSegs));
  let tx = Hx - hip * 0.78, ty = Hy + hip * 0.12, tz = Hz;
  let tYaw = Math.PI, tPit = Q.tailRise + st.alert * 0.3 + 0.03 * Math.sin(T * 1.7);
  for (let i = 0; i < segs; i++) {
    const L = Q.tailLen / segs;
    tYaw += (0.18 * Math.sin(T * 1.9 - i * 0.9) * (1 - 0.3 * walk) + 0.25 * walk * Math.sin(2 * Math.PI * ph - i * 0.8)) * 0.6;
    tPit += (i === 0 ? 0 : -Q.tailCurl * 0.42 * (i / segs)) + 0.05 * Math.sin(T * 2.3 - i);
    const dx = Math.cos(tYaw) * Math.cos(tPit), dy = Math.sin(tPit), dz = -Math.sin(tYaw) * Math.cos(tPit);
    const u0 = i / segs, u1 = (i + 1) / segs;
    const r0 = mix(Q.tailR0, Q.tailR1, Math.pow(u0, 0.8)), r1 = mix(Q.tailR0, Q.tailR1, Math.pow(u1, 0.8));
    const nx = tx + dx * L, ny = ty + dy * L, nz = tz + dz * L;
    ps.add(tx, ty, tz, r0, nx, ny, nz, r1, i === 0 ? Math.min(0.1, r0 * 1.2) : Math.max(0.005, r0 * 0.25), Q.tailNaked && i > 0 ? MAT.skin : MAT.fur, 1);
    tx = nx; ty = ny; tz = nz;
  }
  void hash1; void clamp;
}
