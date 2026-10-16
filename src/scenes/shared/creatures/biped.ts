import { MAT, PrimSet } from './sdf';
import type { Palette, Look } from './sdf';
import { footCycle, ik2, ik3, mix, vnoise, clamp } from './rig';
import type { Leg, RigState } from './rig';

/**
 * Upright hominin / human. Metres, standing on y=0, facing +x. z+ is the figure's RIGHT side (the side nearest a camera that looks
 * down -z), z- its LEFT. "R"/"L" in RigState follow that (R = z+, near camera).
 */
export interface BipedParams {
  thigh: number; shin: number; foot: number; ankleH: number; hipHalf: number; thighR: number;
  abdLen: number; chestLen: number; chestHalfW: number; chestD: number; waistD: number; shoulderHalf: number;
  neckLen: number; neckR: number; neckFwd: number;       // neckFwd: radians the neck leans forward
  upperArm: number; foreArm: number; hand: number; armR: number;
  cranR: number; cranElong: number; brow: number; prognath: number; jaw: number; noseL: number; chin: number; earR: number;
  lean: number;               // trunk lean forward (rad)
  kneeFlex: number;           // 0 straight-legged .. 1 bent-hip-bent-knee
  gait: { stride: number; duty: number; lift: number; bob: number; sway: number; armSwing: number };
  // ---- anatomy detail (all have defaults, so older partial overrides keep working)
  vault: number;              // cranial vault height 1 = sapiens .. 0.45 = chimp-like
  noseW: number; noseUp: number; lip: number; cheek: number; eyeR: number; eyeSet: number;
  muscle: number;             // limb fullness
  calf: number; arch: number; hallux: number; toes: number;
  hairy: number;              // 1 = body is furred, 0 = bare skin
  hair: number; beard: number; hairLen: number;
  barrel: number;             // rib cage depth multiplier (neanderthal ~1.18)
  pelvisW: number;            // extra hip breadth
  fingerLen: number;
  palette: Palette; look: Partial<Look>;
}

const SAP: BipedParams = {
  thigh: 0.43, shin: 0.41, foot: 0.26, ankleH: 0.078, hipHalf: 0.088, thighR: 0.077,
  abdLen: 0.2, chestLen: 0.25, chestHalfW: 0.165, chestD: 0.118, waistD: 0.1, shoulderHalf: 0.185,
  neckLen: 0.15, neckR: 0.056, neckFwd: 0.12,
  upperArm: 0.31, foreArm: 0.26, hand: 0.19, armR: 0.043,
  cranR: 0.101, cranElong: 0.0, brow: 0.012, prognath: 0.0, jaw: 1, noseL: 0.03, chin: 0.012, earR: 0.03,
  lean: 0.03, kneeFlex: 0.04,
  gait: { stride: 1.12, duty: 0.62, lift: 0.075, bob: 0.0, sway: 0.016, armSwing: 0.42 },
  vault: 1, noseW: 1, noseUp: 0, lip: 1, cheek: 1, eyeR: 1, eyeSet: 1, muscle: 1, calf: 1, arch: 1, hallux: 0, toes: 1,
  hairy: 0, hair: 0.8, beard: 0, hairLen: 0, barrel: 1, pelvisW: 0, fingerLen: 1,
  palette: { base: '#2a1d16', belly: '#3a2a20', rim: '#ffe4cc', skin: '#b07a62', splash: '#ffcf90', key: '#b8a090', bone: '#d9d1c2' },
  look: { fur: 0.35, furScale: 1.2, sss: 0.9, gloss: 0.5, keyK: 0.7, amb: 0.4 },
};
const B = (o: Partial<BipedParams>): BipedParams => ({ ...SAP, ...o });
const FUR = { fur: 0.6, furScale: 1.5, sss: 0.5, gloss: 0.08 };

export type BipedPresetName = 'sahelanthropus' | 'ardipithecus' | 'lucy' | 'habilis' | 'erectus' | 'heidelbergensis' | 'neanderthal' | 'sapiens';

export const BIPED_PRESETS: Record<BipedPresetName, BipedParams> = {
  sapiens: SAP,
  neanderthal: B({
    thigh: 0.4, shin: 0.355, foot: 0.255, thighR: 0.09, hipHalf: 0.095, pelvisW: 0.02,
    abdLen: 0.19, chestLen: 0.26, chestHalfW: 0.19, chestD: 0.14, waistD: 0.115, shoulderHalf: 0.205, barrel: 1.12,
    neckLen: 0.08, neckR: 0.07, neckFwd: 0.18, upperArm: 0.3, foreArm: 0.24, hand: 0.2, armR: 0.053, muscle: 1.15,
    cranR: 0.108, cranElong: 0.28, vault: 0.78, brow: 0.026, prognath: 0.09, jaw: 1.12, noseL: 0.055, noseW: 1.3, chin: -0.012, earR: 0.03, cheek: 0.9,
    lean: 0.05, kneeFlex: 0.07, hair: 1.1, beard: 0.8, hairLen: 0.6,
    gait: { stride: 1.18, duty: 0.63, lift: 0.07, bob: 0, sway: 0.018, armSwing: 0.38 },
    palette: { base: '#4a3022', belly: '#5a3c2c', rim: '#ffd6b0', skin: '#c9a08a', splash: '#ffcf90', key: '#b0988a', bone: '#d9d1c2' },
    look: { fur: 0.5, furScale: 1.2, sss: 0.8, gloss: 0.3 },
  }),
  heidelbergensis: B({
    thigh: 0.445, shin: 0.4, foot: 0.27, thighR: 0.085, hipHalf: 0.092,
    abdLen: 0.2, chestLen: 0.27, chestHalfW: 0.18, chestD: 0.128, waistD: 0.108, shoulderHalf: 0.2, barrel: 1.05,
    neckLen: 0.09, neckR: 0.065, neckFwd: 0.16, upperArm: 0.32, foreArm: 0.26, hand: 0.2, armR: 0.049, muscle: 1.1,
    cranR: 0.104, cranElong: 0.32, vault: 0.76, brow: 0.034, prognath: 0.08, jaw: 1.12, noseL: 0.045, noseW: 1.2, chin: -0.012, cheek: 0.95,
    lean: 0.05, kneeFlex: 0.06, hair: 0.9, beard: 0.6, hairLen: 0.2,
    gait: { stride: 1.28, duty: 0.63, lift: 0.07, bob: 0, sway: 0.016, armSwing: 0.4 },
    palette: { base: '#3a2a20', belly: '#4a3a2c', rim: '#ffd6b0', skin: '#a8806a', splash: '#ffcf90', key: '#a89080', bone: '#d9d1c2' },
    look: { fur: 0.5, furScale: 1.2, sss: 0.8, gloss: 0.25 },
  }),
  erectus: B({
    thigh: 0.435, shin: 0.41, foot: 0.26, thighR: 0.08, hipHalf: 0.085,
    abdLen: 0.195, chestLen: 0.265, chestHalfW: 0.16, chestD: 0.116, waistD: 0.098, shoulderHalf: 0.19,
    neckLen: 0.1, neckR: 0.06, neckFwd: 0.15, upperArm: 0.31, foreArm: 0.26, armR: 0.044,
    cranR: 0.094, cranElong: 0.42, vault: 0.66, brow: 0.026, prognath: 0.075, jaw: 1.15, noseL: 0.035, noseW: 1.15, chin: -0.008, cheek: 1,
    lean: 0.04, kneeFlex: 0.05, hair: 0.55, beard: 0, hairLen: 0,
    gait: { stride: 1.32, duty: 0.62, lift: 0.075, bob: 0, sway: 0.015, armSwing: 0.42 },
    palette: { base: '#2c1e16', belly: '#3a2a20', rim: '#ffd6b0', skin: '#8a5e4a', splash: '#ffcf90', key: '#a89080', bone: '#d9d1c2' },
    look: { fur: 0.4, furScale: 1.2, sss: 0.8, gloss: 0.3 },
  }),
  habilis: B({
    thigh: 0.31, shin: 0.285, foot: 0.2, ankleH: 0.062, thighR: 0.062, hipHalf: 0.075,
    abdLen: 0.17, chestLen: 0.22, chestHalfW: 0.14, chestD: 0.102, waistD: 0.09, shoulderHalf: 0.16,
    neckLen: 0.08, neckR: 0.052, neckFwd: 0.22, upperArm: 0.29, foreArm: 0.26, hand: 0.165, armR: 0.037, muscle: 1.05, arch: 0.8,
    cranR: 0.076, cranElong: 0.44, vault: 0.55, brow: 0.02, prognath: 0.17, jaw: 1.18, noseL: 0.02, noseW: 1.1, chin: -0.02, earR: 0.03, cheek: 1.05,
    lean: 0.08, kneeFlex: 0.1, hairy: 0.55, hair: 0.3, beard: 0, hairLen: 0,
    gait: { stride: 0.98, duty: 0.64, lift: 0.055, bob: 0, sway: 0.016, armSwing: 0.36 },
    palette: { base: '#3a2a22', belly: '#4a382e', rim: '#ffd2a0', skin: '#7a5448', splash: '#ffcf90', key: '#9a8472', bone: '#d9d1c2' },
    look: { ...FUR, fur: 0.65 },
  }),
  lucy: B({
    thigh: 0.265, shin: 0.245, foot: 0.185, ankleH: 0.058, hipHalf: 0.078, thighR: 0.056, pelvisW: 0.015,
    abdLen: 0.15, chestLen: 0.2, chestHalfW: 0.13, chestD: 0.092, waistD: 0.082, shoulderHalf: 0.14, barrel: 1.0,
    neckLen: 0.07, neckR: 0.05, neckFwd: 0.3, upperArm: 0.265, foreArm: 0.245, hand: 0.155, armR: 0.034, muscle: 1.05, arch: 0.55, hallux: 0.08,
    cranR: 0.07, cranElong: 0.5, vault: 0.42, brow: 0.022, prognath: 0.24, jaw: 1.25, noseL: 0.012, noseW: 1.15, chin: -0.025, earR: 0.03, cheek: 1.1,
    lean: 0.1, kneeFlex: 0.2, hairy: 1, hair: 0.2, beard: 0, hairLen: 0, fingerLen: 1.05,
    gait: { stride: 0.82, duty: 0.66, lift: 0.045, bob: 0, sway: 0.02, armSwing: 0.33 },
    palette: { base: '#4a362c', belly: '#5a443a', rim: '#ffd2a0', skin: '#7a5a52', splash: '#ffcf90', key: '#9a8472', bone: '#d9d1c2' },
    look: { ...FUR },
  }),
  ardipithecus: B({
    thigh: 0.275, shin: 0.25, foot: 0.195, ankleH: 0.06, hipHalf: 0.075, thighR: 0.057,
    abdLen: 0.16, chestLen: 0.2, chestHalfW: 0.135, chestD: 0.095, waistD: 0.086, shoulderHalf: 0.145,
    neckLen: 0.07, neckR: 0.052, neckFwd: 0.34, upperArm: 0.28, foreArm: 0.27, hand: 0.17, armR: 0.035, muscle: 1.05, arch: 0.2, hallux: 0.5, fingerLen: 1.15,
    cranR: 0.066, cranElong: 0.55, vault: 0.4, brow: 0.026, prognath: 0.26, jaw: 1.25, noseL: 0.01, noseW: 1.2, chin: -0.03, earR: 0.03, cheek: 1.1,
    lean: 0.15, kneeFlex: 0.28, hairy: 1, hair: 0.1, beard: 0, hairLen: 0,
    gait: { stride: 0.78, duty: 0.67, lift: 0.045, bob: 0, sway: 0.022, armSwing: 0.3 },
    palette: { base: '#2f2520', belly: '#3d312a', rim: '#ffd8a8', skin: '#6a504a', splash: '#ffcf90', key: '#8a7868', bone: '#d9d1c2' },
    look: { ...FUR },
  }),
  sahelanthropus: B({
    thigh: 0.26, shin: 0.245, foot: 0.18, ankleH: 0.058, hipHalf: 0.075, thighR: 0.056,
    abdLen: 0.16, chestLen: 0.205, chestHalfW: 0.14, chestD: 0.095, waistD: 0.085, shoulderHalf: 0.15,
    neckLen: 0.06, neckR: 0.056, neckFwd: 0.36, upperArm: 0.285, foreArm: 0.27, hand: 0.17, armR: 0.037, muscle: 1.05, arch: 0.3, hallux: 0.3, fingerLen: 1.12,
    cranR: 0.062, cranElong: 0.62, vault: 0.36, brow: 0.036, prognath: 0.3, jaw: 1.3, noseL: 0.008, noseW: 1.2, chin: -0.035, earR: 0.032, cheek: 1.15,
    lean: 0.2, kneeFlex: 0.35, hairy: 1, hair: 0.1, beard: 0, hairLen: 0,
    gait: { stride: 0.75, duty: 0.67, lift: 0.045, bob: 0, sway: 0.022, armSwing: 0.28 },
    palette: { base: '#2c2420', belly: '#3a302a', rim: '#ffd8a8', skin: '#5a443e', splash: '#ffcf90', key: '#8a7868', bone: '#d9d1c2' },
    look: { ...FUR, fur: 0.95 },
  }),
};

export function bipedParams(name: BipedPresetName, over?: Partial<BipedParams>): BipedParams {
  const base = BIPED_PRESETS[name] ?? SAP;
  return over ? { ...base, gait: { ...base.gait }, ...over } : base;
}

// ------------------------------------------------------------------------------------------------------------------------------
// scratch (module level: no per-frame allocation)
const leg: Leg = { jx: 0, jy: 0, ex: 0, ey: 0 };
const fc = { x: 0, lift: 0 };
const A = [0, 0, 0], Bv = [0, 0, 0], Cv = [0, 0, 0];
const armO = [0, 0, 0, 0, 0, 0];
interface Fr { ox: number; oy: number; oz: number; fx: number; fy: number; fz: number; ux: number; uy: number; uz: number; sx: number; sy: number; sz: number }
const newFr = (): Fr => ({ ox: 0, oy: 0, oz: 0, fx: 1, fy: 0, fz: 0, ux: 0, uy: 1, uz: 0, sx: 0, sy: 0, sz: 1 });
const PV = newFr(), CH = newFr(), HD = newFr();
const fp = (F: Fr, a: number, b: number, c: number, o: number[]) => {
  o[0] = F.ox + F.fx * a + F.ux * b + F.sx * c; o[1] = F.oy + F.fy * a + F.uy * b + F.sy * c; o[2] = F.oz + F.fz * a + F.uz * b + F.sz * c;
};
/** spine frame: lean forward (rad) + yaw about the spine axis */
function setSpine(F: Fr, ox: number, oy: number, oz: number, lean: number, yaw: number) {
  const sl = Math.sin(lean), cl = Math.cos(lean), cy = Math.cos(yaw), sy = Math.sin(yaw);
  F.ox = ox; F.oy = oy; F.oz = oz;
  F.fx = cl * cy; F.fy = -sl * cy; F.fz = -sy;
  F.ux = sl; F.uy = cl; F.uz = 0;
  F.sx = cl * sy; F.sy = -sl * sy; F.sz = cy;
}
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function footPitch(p: number, duty: number) {
  if (p < duty) { const u = p / duty; return 0.3 * (1 - sstep(0, 0.14, u)) - 0.62 * sstep(0.52, 1, u); }
  const v = (p - duty) / (1 - duty);
  return v < 0.5 ? mix(-0.62, -0.06, sstep(0, 0.5, v)) : mix(-0.06, 0.3, sstep(0.5, 1, v));
}

// hand scratch vectors
let Wx = 0, Wy = 0, Wz = 0, dx_ = 0, dy_ = 0, dz_ = 0, nx_ = 0, ny_ = 0, nz_ = 0, sx_ = 0, sy_ = 0, sz_ = 0;
const hw = (a: number, b: number, c: number, o: number[]) => {
  o[0] = Wx + dx_ * a + nx_ * b + sx_ * c; o[1] = Wy + dy_ * a + ny_ * b + sy_ * c; o[2] = Wz + dz_ * a + nz_ * b + sz_ * c;
};
const dirv = (a: number, b: number, c: number, o: number[]) => { // direction from hand basis, normalised
  const x = dx_ * a + nx_ * b + sx_ * c, y = dy_ * a + ny_ * b + sy_ * c, z = dz_ * a + nz_ * b + sz_ * c;
  const l = Math.hypot(x, y, z) || 1; o[0] = x / l; o[1] = y / l; o[2] = z / l;
};

/** One finger of two segments curling toward the palm normal. */
function finger(ps: PrimSet, base: number[], r: number, l1: number, l2: number, a1: number, a2: number, spreadC: number, k: number) {
  const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a1 + a2), s2 = Math.sin(a1 + a2);
  // direction vectors in the hand basis (fingers fan slightly with spreadC along s)
  dirv(c1, s1, spreadC, A);
  const px = base[0] + A[0] * l1, py = base[1] + A[1] * l1, pz = base[2] + A[2] * l1;
  dirv(c2, s2, spreadC * 0.6, Cv);
  ps.add(base[0], base[1], base[2], r * 1.08, px, py, pz, r * 0.9, k, MAT.skin, 1);   // fuller at the knuckle
  ps.add(px, py, pz, r * 0.92, px + Cv[0] * l2, py + Cv[1] * l2, pz + Cv[2] * l2, r * 0.72, k, MAT.skin, 1.04);
  Cv[0] = px + Cv[0] * l2; Cv[1] = py + Cv[1] * l2; Cv[2] = pz + Cv[2] * l2;
}

/** hand + fingers + thumb, plus a held prop. W = wrist, forearm dir d, palm normal n, thumb side s. */
function buildHand(ps: PrimSet, Q: BipedParams, grip: number, prop: number, detail: number, out: { px: number; py: number; pz: number; tx: number; ty: number; tz: number }) {
  const hk = Q.hand / 0.19, fl = Q.fingerLen;
  const B0 = [0, 0, 0];
  const curl = (c0: number) => c0 * (1 - grip) + 1.12 * grip;
  const curl2 = (c0: number) => (c0 + 0.25) * (1 - grip) + 1.55 * grip;
  const spread = 0.16 * (1 - grip) + 0.02;
  // palm: two metacarpal bundles
  hw(0.012 * hk, 0, 0.02 * hk, A); hw(0.092 * hk, 0, 0.027 * hk, Bv);
  ps.add(A[0], A[1], A[2], 0.019 * hk, Bv[0], Bv[1], Bv[2], 0.02 * hk, 0.012, MAT.skin, 1, 0.97);
  hw(0.012 * hk, 0, -0.02 * hk, A); hw(0.088 * hk, 0, -0.028 * hk, Bv);
  ps.add(A[0], A[1], A[2], 0.018 * hk, Bv[0], Bv[1], Bv[2], 0.018 * hk, 0.012, MAT.skin, 1, 0.97);
  // fingers: index, middle, ring (two segments each) and a slimmer one-segment little finger; the knuckle line falls away
  // toward the little finger as on a real hand
  const kb = 0.094 * hk;
  if (detail > 0.5) {
    hw(kb, 0.002, 0.029 * hk, B0); finger(ps, B0, 0.0088 * hk, 0.04 * hk * fl, 0.046 * hk * fl, curl(0.22), curl2(0.22), spread, 0.006);
    hw(kb + 0.002, 0.002, 0.009 * hk, B0); finger(ps, B0, 0.0092 * hk, 0.046 * hk * fl, 0.05 * hk * fl, curl(0.3), curl2(0.3), spread * 0.2, 0.006);
    hw(kb - 0.003, 0.002, -0.0105 * hk, B0); finger(ps, B0, 0.0086 * hk, 0.043 * hk * fl, 0.047 * hk * fl, curl(0.38), curl2(0.38), -spread * 0.8, 0.006);
    hw(kb - 0.012, 0.002, -0.027 * hk, B0);
    const lc = curl(0.5) + 0.35 * curl2(0.5) * 0.5;
    dirv(Math.cos(lc), Math.sin(lc), -spread * 1.5, A);
    const ll = 0.068 * hk * fl;
    ps.add(B0[0], B0[1], B0[2], 0.0078 * hk, B0[0] + A[0] * ll, B0[1] + A[1] * ll, B0[2] + A[2] * ll, 0.0058 * hk, 0.006, MAT.skin, 1.04);
  } else {
    hw(kb, 0.002, 0.02 * hk, B0); finger(ps, B0, 0.011 * hk, 0.045 * hk * fl, 0.045 * hk * fl, curl(0.3), curl2(0.3), spread, 0.008);
    hw(kb, 0.002, -0.014 * hk, B0); finger(ps, B0, 0.013 * hk, 0.043 * hk * fl, 0.043 * hk * fl, curl(0.4), curl2(0.4), -spread, 0.008);
  }
  // thumb
  const opp = Math.max(grip * 0.9, prop ? 0.55 : 0.1) ;
  hw(0.025 * hk, 0.006, 0.03 * hk, B0);
  dirv(0.62, 0.15 + 0.7 * opp, 0.5 * (1 - 0.4 * opp), A);
  const t1 = 0.046 * hk;
  ps.add(B0[0], B0[1], B0[2], 0.0145 * hk, B0[0] + A[0] * t1, B0[1] + A[1] * t1, B0[2] + A[2] * t1, 0.0115 * hk, 0.007, MAT.skin, 1);
  const tx = B0[0] + A[0] * t1, ty = B0[1] + A[1] * t1, tz = B0[2] + A[2] * t1;
  dirv(0.52, 0.12 + 0.85 * Math.max(grip, opp * 0.8), 0.18 * (1 - grip), Cv);
  const t2 = 0.04 * hk;
  ps.add(tx, ty, tz, 0.0115 * hk, tx + Cv[0] * t2, ty + Cv[1] * t2, tz + Cv[2] * t2, 0.0092 * hk, 0.006, MAT.skin, 1);
  // grip point (inside the curled fingers)
  hw(0.066 * hk, 0.03 * hk, 0, A);
  out.px = A[0]; out.py = A[1]; out.pz = A[2]; out.tx = A[0]; out.ty = A[1]; out.tz = A[2];
  if (!prop) return;
  const ax = sx_ * Math.cos(0.45) + dx_ * Math.sin(0.45), ay = sy_ * Math.cos(0.45) + dy_ * Math.sin(0.45), az = sz_ * Math.cos(0.45) + dz_ * Math.sin(0.45);
  const gx = A[0], gy = A[1], gz = A[2];
  const bone = MAT.bone;
  if (prop === 1 || prop === 6) {
    const r = prop === 1 ? 0.05 : 0.06;
    ps.add(gx, gy, gz, r, gx + 0.004, gy, gz, r * 0.96, 0.01, bone, 1, 0.3);
  } else if (prop === 7) {
    ps.add(gx - 0.01, gy, gz, 0.052, gx + 0.012, gy + 0.004, gz, 0.045, 0.02, bone, 1, 0.5);
    ps.add(gx + 0.03, gy + 0.02, gz + 0.01, 0.034, gx + 0.04, gy + 0.03, gz + 0.012, 0.03, 0.02, bone, 1, 0.26);
  } else if (prop === 5) {
    // handaxe: almond, butt in the palm, point out along the thumb side
    ps.add(gx - sx_ * 0.01, gy - sy_ * 0.01, gz - sz_ * 0.01, 0.034, gx + sx_ * 0.1, gy + sy_ * 0.1, gz + sz_ * 0.1, 0.03, 0.03, bone, 0.5, 0.5);
    ps.add(gx + sx_ * 0.1, gy + sy_ * 0.1, gz + sz_ * 0.1, 0.03, gx + sx_ * 0.2, gy + sy_ * 0.2, gz + sz_ * 0.2, 0.005, 0.01, bone, 0.5, 0.5);
    out.tx = gx + sx_ * 0.2; out.ty = gy + sy_ * 0.2; out.tz = gz + sz_ * 0.2;
  } else {
    const back = prop === 3 ? 0.55 : prop === 4 ? 0.12 : 0.06, fwd = prop === 3 ? 1.35 : prop === 4 ? 0.42 : 0.5;
    const r0 = prop === 4 ? 0.016 : 0.017, r1 = prop === 4 ? 0.026 : prop === 3 ? 0.007 : 0.019;
    ps.add(gx - ax * back, gy - ay * back, gz - az * back, r0, gx + ax * fwd, gy + ay * fwd, gz + az * fwd, r1, 0.01, bone, 1, 0.42);
    out.tx = gx + ax * fwd; out.ty = gy + ay * fwd; out.tz = gz + az * fwd;
  }
}

const hOutR = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 };
const hOutL = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 };

export function solveBiped(ps: PrimSet, Q: BipedParams, st: RigState) {
  ps.reset();
  const T = st.time, ph = st.phase, walk = st.walk, G = Q.gait;
  const body = Q.hairy > 0.5 ? MAT.fur : MAT.skin;
  const mus = Q.muscle;
  const legLen = Q.thigh + Q.shin;
  const crouch = st.crouch;
  const reach = legLen * (1 - 0.1 * Q.kneeFlex - 0.015) - crouch * legLen * 0.42;
  const hipMax = Q.ankleH + 0.04 + Math.sqrt(Math.max(reach * reach - 0.0016, 0.001)) * 0.999;
  const rotY = 0.13 * walk * Math.cos(2 * Math.PI * ph);              // hip yaw: leading hip forward at heel strike
  const sway = G.sway * walk * Math.sin(2 * Math.PI * ph);
  const lean = Q.lean + 0.035 * walk + crouch * 0.55 + st.bend;
  const breathe = 1 + 0.02 * Math.sin(T * 1.7 + 0.5);
  const sw = st.throwK;

  // ---- legs: foot placement first (so the pelvis can drop to keep both stance legs in reach) ------------------------------
  const F = Q.foot, ah = Q.ankleH;
  const hr = 0.036 * F / 0.26, br = 0.028 * F / 0.26;
  const sweep = G.stride * G.duty * walk;
  const lift = G.lift * walk * (legLen / 0.85);
  const ankX = [0, 0], ankY = [0, 0], ankP = [0, 0], ankZ = [0, 0], hipX = [0, 0], hipZ = [0, 0], toeA = [0, 0];
  let hy = hipMax;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const p = ((ph + (i === 0 ? 0 : 0.5)) % 1 + 1) % 1;
    footCycle(p, G.duty, fc);
    const phi = footPitch(p, G.duty) * (0.25 + 0.75 * walk);
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const hx = side * Q.hipHalf * Math.sin(rotY), hz = side * Q.hipHalf * Math.cos(rotY) + sway;
    hipX[i] = hx; hipZ[i] = hz;
    const psi = Math.max(0, -phi) * 0.95;                                   // toes stay flat while the heel lifts
    // lowest contact points in the pitched foot frame (ankle origin)
    const hx0 = -0.15 * F, hyy = -ah, bx0 = 0.43 * F;
    const hyR = hx0 * sp + hyy * cp, byR = bx0 * sp + hyy * cp;
    const tipX = bx0 + 0.28 * F * Math.cos(psi), tipY = hyy + 0.016 + (-0.28 * F * Math.sin(psi));
    const tyR = tipX * sp + tipY * cp;
    const low = Math.min(hyR, byR, tyR);
    const ay0 = -low;
    const swingW = 1 - Math.min(1, fc.lift * 7);
    const heelC = hyR <= byR;
    const dxc = heelC ? (hx0 * cp - hyy * sp) - hx0 : (bx0 * cp - hyy * sp) - bx0;
    const stag = (1 - walk) * side * 0.03;
    const ax = fc.x * sweep - dxc * swingW + stag + Q.kneeFlex * -0.03;
    const ay = ay0 + fc.lift * lift;
    ankX[i] = ax; ankY[i] = ay; ankP[i] = phi; toeA[i] = psi;
    ankZ[i] = side * (Q.hipHalf * 0.78) + sway * 0.4 + side * 0.01 * (1 - walk);
    // highest the hip may sit so this leg still reaches the ankle
    const dxh = ax - hx, Lm = legLen * 0.995;
    const maxHy = ay + Math.sqrt(Math.max(Lm * Lm - dxh * dxh, 0.01));
    if (swingW > 0.2 || fc.lift < 0.15) { const k = 0.05; const h = Math.max(k - Math.abs(hy - maxHy), 0) / k; hy = Math.min(hy, maxHy) - h * h * k * 0.25; }
  }
  const pelvisY = hy;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const hx = hipX[i], hz = hipZ[i], ax = ankX[i], ay = ankY[i], fz = ankZ[i], phi = ankP[i], psi = toeA[i];
    ik2(hx, pelvisY, ax, ay, Q.thigh, Q.shin, 1, leg);
    const kz = (hz + fz) / 2 + side * (0.014 + 0.02 * crouch);
    const R = Q.thighR * mus;
    // thigh: full upper mass tapering to the knee
    const mx = (hx + leg.jx) / 2, my = (pelvisY + leg.jy) / 2, mz = (hz + kz) / 2;
    ps.add(hx, pelvisY, hz, R * 1.14, mx, my, mz, R * 1.0, 0.05, body, 1);
    ps.add(mx, my, mz, R * 1.0, leg.jx, leg.jy, kz, R * 0.6, 0.05, body, 1);
    ps.add(leg.jx + 0.008, leg.jy, kz, R * 0.56, leg.jx + 0.012, leg.jy, kz, R * 0.54, 0.03, body, 1, 1.0);
    // shin with a calf bulge on the back
    const sdx = leg.ex - leg.jx, sdy = leg.ey - leg.jy, sl = Math.hypot(sdx, sdy) || 1;
    const nbx = -sdy / sl, nby = sdx / sl;                                 // perpendicular (points toward +x when the shin hangs down... pick the back side)
    const bs = nbx > 0 ? -1 : 1;
    const cx = leg.jx + sdx * 0.3 + nbx * bs * 0.014 * Q.calf, cy = leg.jy + sdy * 0.3 + nby * bs * 0.014 * Q.calf, cz = kz + (fz - kz) * 0.3;
    ps.add(leg.jx, leg.jy, kz, R * 0.56, cx, cy, cz, R * (0.5 + 0.1 * Q.calf), 0.04, body, 1);
    ps.add(cx, cy, cz, R * (0.5 + 0.1 * Q.calf), leg.ex, leg.ey, fz, R * 0.29, 0.04, body, 1);
    // foot (rigid in the pitched frame about the ankle)
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const fx = (x: number, y: number) => leg.ex + (x * cp - y * sp);
    const fy = (x: number, y: number) => leg.ey + (x * sp + y * cp);
    const arch = 0.012 * Q.arch + 0.003;
    // heel / achilles
    ps.add(fx(-0.005, 0.02), fy(-0.005, 0.02), fz, R * 0.3, fx(-0.15 * F, -ah + hr), fy(-0.15 * F, -ah + hr), fz, hr, 0.02, MAT.skin, 1.1, 0.96);
    // midfoot (arched)
    const mfx = 0.13 * F, mfy = -ah + 0.032 + arch;
    ps.add(fx(-0.15 * F, -ah + hr), fy(-0.15 * F, -ah + hr), fz, hr * 0.92, fx(mfx, mfy), fy(mfx, mfy), fz, 0.03 * F / 0.26, 0.02, MAT.skin, 1.25, 0.96);
    ps.add(fx(mfx, mfy), fy(mfx, mfy), fz, 0.03 * F / 0.26, fx(0.43 * F, -ah + br), fy(0.43 * F, -ah + br), fz, br * 1.02, 0.02, MAT.skin, 1.55, 0.96);
    // toes rotate about the ball
    const bx = 0.43 * F, by = -ah + br;
    const ca = Math.cos(psi), sa = Math.sin(psi);
    const hl = 0.3 * F, tl = 0.27 * F;
    const hallux = Q.hallux, hzo = -side * (0.026 + hallux * 0.05) * (F / 0.26);
    const hxe = bx + hl * ca * Math.cos(hallux * 0.5), hye = by + 0.002 + hl * sa;
    ps.add(fx(bx, by), fy(bx, by), fz + hzo * 0.6, br * 0.95, fx(hxe, hye), fy(hxe, hye), fz + hzo, br * 0.62, 0.012, MAT.skin, 1, 0.96);
    const txe = bx + tl * ca, tye = by + 0.002 + tl * sa;
    ps.add(fx(bx, by), fy(bx, by), fz + side * 0.012, br * 1.0, fx(txe, tye), fy(txe, tye), fz + side * 0.026 * Q.toes, br * 0.55, 0.012, MAT.skin, 1.55, 0.94);
  }

  // ---- trunk --------------------------------------------------------------------------------------------------------------
  const px = -0.1 * crouch, py = pelvisY + 0.03, pz = sway * 0.6;
  const yawC = -1.1 * rotY + st.twist + 0.75 * sw;
  setSpine(PV, px, py, pz, lean * 0.8, rotY);
  const hh = Q.hipHalf, pr = (Q.chestD * 0.78 + 0.01);
  fp(PV, -0.005, 0.0, -(hh * 0.75 + Q.pelvisW), A); fp(PV, -0.005, 0.0, hh * 0.75 + Q.pelvisW, Bv);
  ps.add(A[0], A[1], A[2], pr, Bv[0], Bv[1], Bv[2], pr, 0.05, body, 1, 1);                       // iliac crest / hips
  fp(PV, -0.045, -0.01, -hh * 0.55, A); fp(PV, -0.045, -0.01, hh * 0.55, Bv);
  ps.add(A[0], A[1], A[2], pr * 0.82, Bv[0], Bv[1], Bv[2], pr * 0.82, 0.05, body, 1, 1);        // glutes
  fp(PV, 0, 0.03, 0, A); fp(PV, 0.005, Q.abdLen, 0, Bv);
  setSpine(CH, Bv[0], Bv[1], Bv[2], lean * 1.15, yawC);
  ps.add(A[0], A[1], A[2], Q.waistD, Bv[0], Bv[1], Bv[2], Q.waistD * 0.88, 0.06, body, 1.32, 1);  // abdomen
  const cD = Q.chestD * Q.barrel * breathe, zsC = Q.chestHalfW / Q.chestD;
  fp(CH, 0, -0.01, 0, A); fp(CH, 0.0, Q.chestLen * 0.62, 0, Bv);
  ps.add(A[0], A[1], A[2], Q.waistD * 0.95 * breathe, Bv[0], Bv[1], Bv[2], cD * 1.0, 0.09, body, zsC * 0.97, 1);     // lower ribs
  fp(CH, 0.0, Q.chestLen * 0.3, 0, A); fp(CH, 0.0, Q.chestLen - 0.045, 0, Bv);
  ps.add(A[0], A[1], A[2], cD * 0.99, Bv[0], Bv[1], Bv[2], cD * 0.84, 0.09, body, zsC * 0.97, 1);                     // upper chest
  // shoulder girdle: trapezius slope down to each deltoid
  const nBase = [0, 0, 0]; fp(CH, -0.02, Q.chestLen + 0.0, 0, nBase);

  // ---- neck & head ----------------------------------------------------------------------------------------------------------
  const nf = Q.neckFwd + lean * 0.15 - st.headPitch * 0.15;
  const nx0 = nBase[0], ny0 = nBase[1] - 0.03, nz0 = nBase[2];
  const nx1 = nx0 + Math.sin(nf) * Q.neckLen, ny1 = ny0 + Math.cos(nf) * Q.neckLen, nz1 = nz0;
  ps.add(nx0, ny0, nz0, Q.neckR * 1.3, nx1, ny1, nz1, Q.neckR * 1.0, 0.05, body, 1.05, 1);
  const idle = vnoise(T * 0.5) * 0.12;
  const pitch = st.headPitch - lean * 0.85 - Q.neckFwd * 0.5 + 0.02 * Math.sin(4 * Math.PI * ph + 1) * walk + 0.01 * Math.sin(T * 0.9);
  const yaw = st.headYaw + idle * (1 - walk) * 0.5 - yawC * 0.5;
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cyw = Math.cos(yaw), syw = Math.sin(yaw);
  HD.fx = cp * cyw; HD.fy = sp; HD.fz = cp * syw; HD.ux = -sp * cyw; HD.uy = cp; HD.uz = -sp * syw;
  HD.sx = HD.fy * HD.uz - HD.fz * HD.uy; HD.sy = HD.fz * HD.ux - HD.fx * HD.uz; HD.sz = HD.fx * HD.uy - HD.fy * HD.ux;
  const cr = Q.cranR, el = Q.cranElong, pg = Q.prognath, vt = Q.vault;
  HD.ox = nx1 + HD.fx * cr * 0.14 + HD.ux * cr * 0.8; HD.oy = ny1 + HD.fy * cr * 0.14 + HD.uy * cr * 0.8; HD.oz = nz1 + HD.fz * cr * 0.14 + HD.uz * cr * 0.8;
  st.headX = HD.ox; st.headY = HD.oy; st.headZ = HD.oz;
  // head-space helper: coordinates in units of cranR, +f forward, +u up, +s toward z+
  const hp = (f: number, u: number, s: number, o: number[]) => fp(HD, f * cr, u * cr, s * cr, o);
  const uC = 0.12 - (1 - vt) * 0.55;
  // cranium: long axis tilts with elongation, forehead recedes with a low vault
  hp(-0.12 - 0.34 * el, uC, 0, A); hp(-0.02, uC + 0.02 - (1 - vt) * 0.12, 0, Bv);
  ps.add(A[0], A[1], A[2], cr * 0.98, Bv[0], Bv[1], Bv[2], cr * (0.82 + 0.12 * vt), 0.03, Q.hairy > 0.5 ? MAT.fur : MAT.skin, 0.8, 1);
  // face plate: forehead-to-cheek mass
  hp(0.5, -0.02, 0, A); hp(0.56 + pg * 1.3, -0.4, 0, Bv);
  ps.add(A[0], A[1], A[2], cr * 0.46, Bv[0], Bv[1], Bv[2], cr * (0.4 + 0.03 * pg), 0.028, MAT.skin, 1.3 * Q.cheek, 1);
  // mandible: hinge at the ramus, mouth opens by rotating the front end down about it
  const mo = st.mouth * 0.38, cm = Math.cos(mo), sm = Math.sin(mo);
  const jfx = 0.74 + pg * 1.15 + Q.chin / cr * 0.7, jfy = -0.82 * (0.9 + 0.1 * Q.jaw);
  const hxj = -0.18, hyj = -0.3;
  const rfx = hxj + (jfx - hxj) * cm + (jfy - hyj) * sm, rfy = hyj - (jfx - hxj) * sm + (jfy - hyj) * cm;
  for (let s = -1; s <= 1; s += 2) {
    hp(-0.2, -0.3, 0.68 * s, A); hp(rfx, rfy, 0.2 * s, Bv);
    ps.add(A[0], A[1], A[2], cr * 0.22 * Q.jaw, Bv[0], Bv[1], Bv[2], cr * 0.2 * Q.jaw, 0.025, MAT.skin, 1, 1);
  }
  // brow ridge: two arcs sweeping back over the orbits
  const bro = Q.brow / cr;
  for (let s = -1; s <= 1; s += 2) {
    hp(0.86 + pg * 0.15, 0.17, 0.05 * s, A); hp(0.76, 0.19, 0.5 * s, Bv);
    ps.add(A[0], A[1], A[2], cr * 0.07 + Q.brow * 1.0, Bv[0], Bv[1], Bv[2], cr * 0.07 + Q.brow * 0.85, 0.012, MAT.skin, 1, 1);
  }
  void bro;
  // cheekbones (lower orbit rim)
  for (let s = -1; s <= 1; s += 2) {
    hp(0.55, -0.24, 0.6 * s, A); hp(0.78 + pg * 0.5, -0.24, 0.4 * s, Bv);
    ps.add(A[0], A[1], A[2], cr * 0.1, Bv[0], Bv[1], Bv[2], cr * 0.1, 0.014, MAT.skin, 1, 1);
  }
  // eyes recessed under the brow. The capsule's tiny A->B offset runs along the gaze (head forward, toed out a little),
  // which the shader reads to place iris and pupil; an upper lid hoods each eye.
  const er = 0.085 * Q.eyeR;
  for (let s = -1; s <= 1; s += 2) {
    const ef = 0.91 + pg * 0.2, es = 0.33 * s * Q.eyeSet;  // cornea at the face plane, so the eyeball itself is visible
    hp(ef, 0.02, es, A); hp(ef + 0.004 / cr, 0.02 - 0.0006 / cr, es + 0.0005 / cr * s, Bv);  // 4mm gaze axis, a few degrees down
    ps.add(A[0], A[1], A[2], cr * er, Bv[0], Bv[1], Bv[2], cr * er * 0.99, 0.004, MAT.eye, 1);
    // lids wrap the eyeball: capsules centred on it, offset up / down, radius just over the eye's, so they leave an almond
    // opening from ~18 degrees below to ~15 above the gaze
    hp(ef, 0.02 + er * 0.38, es - 0.07 * s, A); hp(ef, 0.02 + er * 0.36, es + 0.08 * s, Bv);
    ps.add(A[0], A[1], A[2], cr * er * 1.03, Bv[0], Bv[1], Bv[2], cr * er * 0.98, 0.01, MAT.skin, 1, 0.97);
    hp(ef - 0.004, 0.02 - er * 0.45, es - 0.06 * s, A); hp(ef - 0.004, 0.02 - er * 0.43, es + 0.07 * s, Bv);
    ps.add(A[0], A[1], A[2], cr * er * 0.99, Bv[0], Bv[1], Bv[2], cr * er * 0.95, 0.008, MAT.skin, 1, 0.97);
  }
  // nose: a narrow bridge widening to a rounded tip, and two separate alar wings either side of it
  const ntf = 0.98 + pg * 0.55 + Q.noseL / cr * 0.5, nty = -0.3 + Q.noseUp * 0.1;
  hp(0.8 + pg * 0.35, 0.05, 0, A); hp(ntf, nty, 0, Bv);
  ps.add(A[0], A[1], A[2], cr * 0.075 * Q.noseW, Bv[0], Bv[1], Bv[2], cr * 0.13 * Q.noseW, 0.012, MAT.skin, 0.95, 1);
  for (let s = -1; s <= 1; s += 2) {
    hp(ntf - 0.1, nty - 0.06, 0.1 * Q.noseW * s, A); hp(ntf - 0.06, nty - 0.08, 0.15 * Q.noseW * s, Bv);
    ps.add(A[0], A[1], A[2], cr * 0.062, Bv[0], Bv[1], Bv[2], cr * 0.055, 0.012, MAT.skin, 1, 0.95);
  }
  // lips and mouth line
  const mfx = 0.96 + pg * 1.25;
  hp(mfx, -0.5, -0.27, A); hp(mfx, -0.5, 0.27, Bv);
  ps.add(A[0], A[1], A[2], cr * 0.058 * Q.lip, Bv[0], Bv[1], Bv[2], cr * 0.058 * Q.lip, 0.008, MAT.skin, 1, 0.9);
  const lfx = mfx - 0.03 * cm + (0.0), lfy = -0.65;
  const lx = hxj + (lfx - hxj) * cm + (lfy - hyj) * sm, ly = hyj - (lfx - hxj) * sm + (lfy - hyj) * cm;
  hp(lx, ly, -0.25, A); hp(lx, ly, 0.25, Bv);
  ps.add(A[0], A[1], A[2], cr * 0.068 * Q.lip, Bv[0], Bv[1], Bv[2], cr * 0.068 * Q.lip, 0.008, MAT.skin, 1, 0.9);
  hp(mfx + 0.045, -0.575 - mo * 0.25, -0.24, A); hp(mfx + 0.045, -0.575 - mo * 0.25, 0.24, Bv);
  ps.add(A[0], A[1], A[2], cr * (0.022 + mo * 0.12), Bv[0], Bv[1], Bv[2], cr * (0.022 + mo * 0.12), 0.002, st.mouth > 0.15 ? MAT.wet : MAT.skin, 1, 0.12);  // closed: a dark crease, not a glossy slot
  // ears
  for (let s = -1; s <= 1; s += 2) {
    hp(-0.05, 0.12, 0.97 * s, A); hp(-0.14, -0.22, 0.99 * s, Bv);
    ps.add(A[0], A[1], A[2], Q.earR * 0.62, Bv[0], Bv[1], Bv[2], Q.earR * 0.5, 0.008, MAT.skin, 0.32, 0.95);
  }
  // hair and beard
  if (Q.hair > 0.05) {
    const h = Q.hair, hl = Q.hairLen;
    hp(-0.3 - 0.3 * el, uC + 0.1 - hl * 0.9, 0, A); hp(-0.02, uC + 0.36 - (1 - vt) * 0.1, 0, Bv);
    ps.add(A[0], A[1], A[2], cr * (1.06 + 0.1 * h), Bv[0], Bv[1], Bv[2], cr * (0.9 + 0.1 * h), 0.03, MAT.fur, 0.76, 0.32);
  }
  if (Q.beard > 0.05) {
    const b = Q.beard;
    hp(0.45, -0.55, 0, A); hp(0.65 + pg, -1.15 - b * 0.35 + (rfy + 0.86) * 0.5, 0, Bv);
    ps.add(A[0], A[1], A[2], cr * 0.5, Bv[0], Bv[1], Bv[2], cr * 0.38, 0.04, MAT.fur, 1.1, 0.32);
  }

  // ---- arms ---------------------------------------------------------------------------------------------------------------------
  const L1 = Q.upperArm, L2 = Q.foreArm, Lt = L1 + L2;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const isR = side > 0;
    fp(CH, -0.012, Q.chestLen - 0.04, side * Q.shoulderHalf, A);
    const shx = A[0], shy = A[1], shz = A[2];
    // gait arm: counter-swing to the leg of the same side
    const swingPh = ph + (i === 0 ? 0.5 : 0);
    const th0 = G.armSwing * walk * Math.cos(2 * Math.PI * swingPh) - 0.05 - lean * 0.4;
    const th = mix(th0, isR ? st.armR : st.armL, st.armsFree);
    const flex = mix(0.18 + 0.5 * Math.max(0, Math.sin(th * 2.2)) * walk + 0.1 * Math.sin(T * 1.4 + i), 0.3, st.armsFree * 0.5);
    const out = 0.045 + 0.02 * crouch;
    let tx = shx + Math.sin(th) * L1 + Math.sin(th + flex) * L2, ty = shy - Math.cos(th) * L1 - Math.cos(th + flex) * L2, tz = shz + side * out;
    // pose targets in the chest frame (fwd = CH.f, up = CH.u)
    let w = 0, gx = 0, gy = 0, gz = 0;
    if (st.reach > 0.001) {
      const r = st.reach;
      gx = shx + Lt * 0.92 * r; gy = shy + Lt * st.reachY * r - Lt * 0.5 * (1 - r); gz = shz - side * 0.03 * r + side * 0.04 * (1 - r); w = Math.max(w, Math.min(1, r * 1.5));
      tx = mix(tx, gx, w); ty = mix(ty, gy, w); tz = mix(tz, gz, w);
    }
    if (isR || st.strike > 0.001 || Math.abs(sw) > 0.001) {
      if (st.strike > 0.001 && isR) {
        const s = st.strike;                                                // 0 down-forward .. 1 raised overhead and slightly back
        const fa = Lt * mix(0.8, 0.05, s), ua = Lt * mix(-0.5, 0.92, s);
        const wt = Math.min(1, s * 40 + 0.0);
        tx = mix(tx, shx + CH.fx * fa + CH.ux * ua, wt); ty = mix(ty, shy + CH.fy * fa + CH.uy * ua, wt); tz = mix(tz, shz + CH.fz * fa + CH.uz * ua + 0.03, wt);
      }
      if (Math.abs(sw) > 0.001) {
        // throw: -1 cocked behind and above, +1 followed through forward-down; left arm points at the target
        const u = sw;
        if (isR) {
          const fa = Lt * (u < 0 ? mix(0.2, -0.75, -u) : mix(0.2, 0.85, u)), ua = Lt * (u < 0 ? mix(0.2, 0.55, -u) : mix(0.2, -0.55, u));
          const wt = Math.min(1, Math.abs(u) * 5);
          tx = mix(tx, shx + CH.fx * fa + CH.ux * ua + CH.sx * 0.1, wt); ty = mix(ty, shy + CH.fy * fa + CH.uy * ua + CH.sy * 0.1, wt); tz = mix(tz, shz + CH.fz * fa + CH.uz * ua + 0.18 * (u < 0 ? -u : 0), wt);
        } else {
          const a = Lt * 0.85, b = Lt * 0.3 * (u < 0 ? -u : 0.4), wt = Math.min(1, Math.abs(u) * 5) * (u < 0 ? 1 : 0.5);
          tx = mix(tx, shx + CH.fx * a + CH.ux * b, wt); ty = mix(ty, shy + CH.fy * a + CH.uy * b, wt); tz = mix(tz, shz + CH.fz * a + CH.uz * b - side * 0.05, wt);
        }
      }
    }
    const hw_ = isR ? st.hRw : st.hLw;
    if (hw_ > 0.001) {
      const ex = isR ? st.hRx : st.hLx, ey = isR ? st.hRy : st.hLy, ez = isR ? st.hRz : st.hLz;
      tx = mix(tx, ex, hw_); ty = mix(ty, ey, hw_); tz = mix(tz, ez, hw_);
    }
    ik3(shx, shy, shz, tx, ty, tz, L1, L2, -0.55, -0.55, side * 0.55, armO);
    const exx = armO[0], eyy = armO[1], ezz = armO[2];
    const wxx = armO[3], wyy = armO[4], wzz = armO[5];
    const R = Q.armR * mus;
    // deltoid cap + trapezius slope
    ps.add(nBase[0], nBase[1] - 0.012, nBase[2] + side * 0.01, Q.neckR * 1.05, shx, shy + 0.01, shz * 0.96, R * 1.0, 0.05, body, 1, 1);
    const bx = mix(shx, exx, 0.45), by = mix(shy, eyy, 0.45), bz = mix(shz, ezz, 0.45);
    ps.add(shx, shy - 0.01, shz, R * 1.1, exx, eyy, ezz, R * 0.74, 0.05, body, 1, 1);
    void bx; void by; void bz;
    const fx1 = mix(exx, wxx, 0.3), fy1 = mix(eyy, wyy, 0.3), fz1 = mix(ezz, wzz, 0.3);
    ps.add(exx, eyy, ezz, R * 0.74, fx1, fy1, fz1, R * 0.74, 0.04, body, 1, 1);
    ps.add(fx1, fy1, fz1, R * 0.74, wxx, wyy, wzz, R * 0.45, 0.03, body, 1, 1);
    // hand basis
    let dx = wxx - fx1, dy = wyy - fy1, dz = wzz - fz1;
    const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
    let n0x = CH.sx * -side, n0y = CH.sy * -side, n0z = CH.sz * -side;
    const dd = n0x * dx + n0y * dy + n0z * dz; n0x -= dx * dd; n0y -= dy * dd; n0z -= dz * dd;
    const nl = Math.hypot(n0x, n0y, n0z) || 1; n0x /= nl; n0y /= nl; n0z /= nl;
    const roll = isR ? st.rollR : st.rollL, cr_ = Math.cos(roll), sr_ = Math.sin(roll);
    const cxn = dy * n0z - dz * n0y, cyn = dz * n0x - dx * n0z, czn = dx * n0y - dy * n0x;
    nx_ = n0x * cr_ + cxn * sr_; ny_ = n0y * cr_ + cyn * sr_; nz_ = n0z * cr_ + czn * sr_;
    const grip = isR ? st.gripR : st.gripL;
    // slight wrist flex toward the palm when gripping
    const wf = 0.12 + 0.12 * grip;
    dx_ = dx * Math.cos(wf) + nx_ * Math.sin(wf); dy_ = dy * Math.cos(wf) + ny_ * Math.sin(wf); dz_ = dz * Math.cos(wf) + nz_ * Math.sin(wf);
    sx_ = side * (dy_ * nz_ - dz_ * ny_); sy_ = side * (dz_ * nx_ - dx_ * nz_); sz_ = side * (dx_ * ny_ - dy_ * nx_);
    Wx = wxx; Wy = wyy; Wz = wzz;
    const ho = isR ? hOutR : hOutL;
    buildHand(ps, Q, grip, isR ? st.propR : st.propL, st.detail, ho);
    if (isR) { st.pRx = ho.px; st.pRy = ho.py; st.pRz = ho.pz; st.tRx = ho.tx; st.tRy = ho.ty; st.tRz = ho.tz; }
    else { st.pLx = ho.px; st.pLy = ho.py; st.pLz = ho.pz; st.tLx = ho.tx; st.tLy = ho.ty; st.tLz = ho.tz; }
  }

  // ---- carried infant ----------------------------------------------------------------------------------------------------------
  if (st.carry > 0.01) {
    const c = st.carry, hx = Math.cos(st.kyaw), hz = Math.sin(st.kyaw), qx = -hz, qz = hx;
    const kx = st.kx, ky = st.ky, kz = st.kz, sc = (0.55 + 0.45 * c) * 1.25;
    ps.add(kx - hx * 0.1 * sc, ky, kz - hz * 0.1 * sc, 0.058 * sc, kx + hx * 0.08 * sc, ky + 0.004, kz + hz * 0.08 * sc, 0.062 * sc, 0.03, MAT.skin, 1, 1.05);
    ps.add(kx + hx * 0.165 * sc, ky + 0.012, kz + hz * 0.165 * sc, 0.066 * sc, kx + hx * 0.172 * sc, ky + 0.012, kz + hz * 0.172 * sc, 0.065 * sc, 0.02, MAT.skin, 1, 1.05);
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      ps.add(kx - hx * 0.09 * sc + qx * 0.03 * s2, ky - 0.01, kz - hz * 0.09 * sc + qz * 0.03 * s2, 0.03 * sc, kx - hx * 0.2 * sc + qx * 0.06 * s2, ky + 0.045 * sc, kz - hz * 0.2 * sc + qz * 0.06 * s2, 0.022 * sc, 0.015, MAT.skin, 1, 1.05);
      ps.add(kx + hx * 0.075 * sc + qx * 0.055 * s2, ky + 0.015, kz + hz * 0.075 * sc + qz * 0.055 * s2, 0.021 * sc, kx + hx * 0.1 * sc + qx * 0.09 * s2, ky + 0.06 * sc, kz + hz * 0.1 * sc + qz * 0.09 * s2, 0.017 * sc, 0.012, MAT.skin, 1, 1.05);
    }
  }
}

const NUM_KEYS = ['thigh', 'shin', 'foot', 'ankleH', 'hipHalf', 'thighR', 'abdLen', 'chestLen', 'chestHalfW', 'chestD', 'waistD', 'shoulderHalf', 'neckLen', 'neckR', 'neckFwd', 'upperArm', 'foreArm', 'hand', 'armR',
  'cranR', 'cranElong', 'brow', 'prognath', 'jaw', 'noseL', 'chin', 'earR', 'lean', 'kneeFlex', 'vault', 'noseW', 'noseUp', 'lip', 'cheek', 'eyeR', 'eyeSet', 'muscle', 'calf', 'arch', 'hallux', 'toes',
  'hairy', 'hair', 'beard', 'hairLen', 'barrel', 'pelvisW', 'fingerLen'] as const;
/** write the blend of two presets into `out` (mutate a creature's live params in place; pass `params={{}}` so it owns a copy) */
export function morphBiped(out: BipedParams, a: BipedParams, b: BipedParams, t: number) {
  const o = out as unknown as Record<string, number>, x = a as unknown as Record<string, number>, y = b as unknown as Record<string, number>;
  for (const k of NUM_KEYS) o[k] = x[k] + (y[k] - x[k]) * t;
  for (const k of ['stride', 'duty', 'lift', 'bob', 'sway', 'armSwing'] as const) out.gait[k] = a.gait[k] + (b.gait[k] - a.gait[k]) * t;
}
