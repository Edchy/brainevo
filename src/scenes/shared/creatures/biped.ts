import { MAT, PrimSet } from './sdf';
import type { Palette, Look } from './sdf';
import { footCycle, ik2, mix, vnoise } from './rig';
import type { Leg, RigState } from './rig';

/** Upright hominin / human. Metres, standing on y=0, facing +x, z = left/right. */
export interface BipedParams {
  thigh: number; shin: number; foot: number; ankleH: number; hipHalf: number; thighR: number;
  abdLen: number; chestLen: number; chestHalfW: number; chestD: number; waistD: number; shoulderHalf: number;
  neckLen: number; neckR: number; neckFwd: number;       // neckFwd: radians the neck leans forward
  upperArm: number; foreArm: number; hand: number; armR: number;
  cranR: number; cranElong: number; brow: number; prognath: number; jaw: number; noseL: number; chin: number; earR: number;
  lean: number;               // trunk lean forward (rad)
  kneeFlex: number;           // 0 straight-legged .. 1 bent-hip-bent-knee
  gait: { stride: number; duty: number; lift: number; bob: number; sway: number; armSwing: number };
  palette: Palette; look: Partial<Look>;
}

const SAP: BipedParams = {
  thigh: 0.43, shin: 0.42, foot: 0.26, ankleH: 0.075, hipHalf: 0.085, thighR: 0.082,
  abdLen: 0.19, chestLen: 0.25, chestHalfW: 0.17, chestD: 0.125, waistD: 0.105, shoulderHalf: 0.19,
  neckLen: 0.15, neckR: 0.056, neckFwd: 0.1,
  upperArm: 0.31, foreArm: 0.27, hand: 0.19, armR: 0.045,
  cranR: 0.093, cranElong: 0.1, brow: 0.01, prognath: 0.0, jaw: 1, noseL: 0.03, chin: 0.015, earR: 0.03,
  lean: 0.03, kneeFlex: 0.05,
  gait: { stride: 1.45, duty: 0.62, lift: 0.07, bob: 0.014, sway: 0.016, armSwing: 0.45 },
  palette: { base: '#a77a62', belly: '#b88c74', rim: '#ffe4cc', skin: '#a8706a', splash: '#ffcf90', key: '#b09888', bone: '#eee6d8' },
  look: { fur: 0.12, sss: 0.9, gloss: 0.5, keyK: 0.7, amb: 0.4 },
};
const B = (o: Partial<BipedParams>): BipedParams => ({ ...SAP, ...o });

export type BipedPresetName = 'sapiens' | 'erectus' | 'lucy' | 'sahelanthropus';

export const BIPED_PRESETS: Record<BipedPresetName, BipedParams> = {
  sapiens: SAP,
  erectus: B({
    thigh: 0.44, shin: 0.43, foot: 0.26, thighR: 0.088, chestD: 0.115, abdLen: 0.2, shoulderHalf: 0.2,
    cranR: 0.088, cranElong: 0.45, brow: 0.024, prognath: 0.07, jaw: 1.2, noseL: 0.035, chin: -0.005, earR: 0.032, lean: 0.04, kneeFlex: 0.08,
    upperArm: 0.32, foreArm: 0.28,
    gait: { stride: 1.5, duty: 0.62, lift: 0.07, bob: 0.014, sway: 0.016, armSwing: 0.45 },
    palette: { base: '#8a5e4a', belly: '#9a6e58', rim: '#ffd6b0', skin: '#8a5a52', splash: '#ffcf90', key: '#a89080', bone: '#e8dfd0' },
    look: { fur: 0.2, sss: 0.8, gloss: 0.35 },
  }),
  lucy: B({
    thigh: 0.27, shin: 0.25, foot: 0.18, ankleH: 0.055, hipHalf: 0.075, thighR: 0.062,
    abdLen: 0.15, chestLen: 0.2, chestHalfW: 0.14, chestD: 0.092, waistD: 0.082, shoulderHalf: 0.15,
    neckLen: 0.1, neckR: 0.055, neckFwd: 0.3,
    upperArm: 0.3, foreArm: 0.27, hand: 0.16, armR: 0.036,
    cranR: 0.07, cranElong: 0.45, brow: 0.02, prognath: 0.22, jaw: 1.3, noseL: 0.02, chin: -0.02, earR: 0.03,
    lean: 0.12, kneeFlex: 0.3,
    gait: { stride: 0.95, duty: 0.66, lift: 0.05, bob: 0.01, sway: 0.02, armSwing: 0.35 },
    palette: { base: '#3e2f2a', belly: '#4e3c34', rim: '#ffd2a0', skin: '#7a5a52', splash: '#ffcf90', key: '#9a8472', bone: '#e8dfd0' },
    look: { fur: 0.85, furScale: 0.9, sss: 0.5, gloss: 0.1 },
  }),
  sahelanthropus: B({
    thigh: 0.26, shin: 0.25, foot: 0.17, ankleH: 0.055, hipHalf: 0.075, thighR: 0.062,
    abdLen: 0.16, chestLen: 0.21, chestHalfW: 0.145, chestD: 0.095, waistD: 0.085, shoulderHalf: 0.155,
    neckLen: 0.09, neckR: 0.058, neckFwd: 0.35,
    upperArm: 0.3, foreArm: 0.28, hand: 0.17, armR: 0.038,
    cranR: 0.065, cranElong: 0.6, brow: 0.03, prognath: 0.3, jaw: 1.3, noseL: 0.015, chin: -0.03, earR: 0.032,
    lean: 0.2, kneeFlex: 0.4,
    gait: { stride: 0.9, duty: 0.66, lift: 0.05, bob: 0.01, sway: 0.022, armSwing: 0.3 },
    palette: { base: '#2c2420', belly: '#3a302a', rim: '#ffd8a8', skin: '#6a504a', splash: '#ffcf90', key: '#8a7868', bone: '#e8dfd0' },
    look: { fur: 0.95, furScale: 0.9, sss: 0.4, gloss: 0 },
  }),
};

export function bipedParams(name: BipedPresetName, over?: Partial<BipedParams>): BipedParams {
  return over ? { ...BIPED_PRESETS[name], ...over } : BIPED_PRESETS[name];
}

const leg: Leg = { jx: 0, jy: 0, ex: 0, ey: 0 };
const fc = { x: 0, lift: 0 };

export function solveBiped(ps: PrimSet, Q: BipedParams, st: RigState) {
  ps.reset();
  const T = st.time, ph = st.phase, walk = st.walk, G = Q.gait;
  const legLen = Q.thigh + Q.shin;
  const reach = legLen * (1 - 0.1 * Q.kneeFlex - 0.015) - st.crouch * legLen * 0.25;
  const hipHeight = Q.ankleH + 0.04 + Math.sqrt(Math.max(reach * reach - 0.0016, 0.001)) * 0.999;
  const bob = G.bob * walk * Math.cos(4 * Math.PI * ph + 0.3) * (legLen / 0.85);
  const sway = G.sway * walk * Math.sin(2 * Math.PI * ph);
  const rotY = 0.14 * walk * Math.sin(2 * Math.PI * ph);
  const pelvisY = hipHeight + bob;
  const lean = Q.lean + 0.03 * walk + st.crouch * 0.25;
  const breathe = 1 + 0.018 * Math.sin(T * 1.7 + 0.5);

  // ---- legs ---------------------------------------------------------------------------------------------------------
  const footL = Math.sqrt(Math.max(Q.foot ** 2 - 0.04 ** 2, 1e-4));
  const toeR = 0.026 * (Q.foot / 0.26 + 0.2);
  const sweep = G.stride * G.duty * walk;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1; // +z leg phase 0
    footCycle(ph + (i === 0 ? 0 : 0.5), G.duty, fc);
    const rx = -side * Q.hipHalf * Math.sin(rotY), rz = side * Q.hipHalf * Math.cos(rotY) + sway;
    const ax = Q.kneeFlex * -0.04 + fc.x * sweep, ay = Q.ankleH + 0.04 + fc.lift * G.lift * walk * (legLen / 0.85);
    ik2(rx, pelvisY, ax, ay, Q.thigh, Q.shin, 1, leg);
    const fz = side * (Q.hipHalf * 0.85) + sway * 0.4;
    const kz = (rz + fz) / 2 + side * 0.012;
    ps.add(rx, pelvisY, rz, Q.thighR, leg.jx, leg.jy, kz, Q.thighR * 0.6, 0.08, MAT.fur, 1);
    ps.add(leg.jx, leg.jy, kz, Q.thighR * 0.58, leg.ex, leg.ey, fz, Q.thighR * 0.36, 0.07, MAT.fur, 1);
    ps.add(leg.ex - 0.035, leg.ey - 0.02, fz, Q.thighR * 0.34, leg.ex + footL, toeR + fc.lift * G.lift * walk * (legLen / 0.85) * 0.9, fz, toeR, 0.04, MAT.skin, 1.2, 0.95);
  }

  // ---- trunk --------------------------------------------------------------------------------------------------------
  const sl = Math.sin(lean), cl = Math.cos(lean);
  const px = 0, py = pelvisY + 0.02, pz = sway * 0.6;
  const wx = px + sl * Q.abdLen, wy = py + cl * Q.abdLen;                 // waist
  const cx = wx + sl * Q.chestLen, cy = wy + cl * Q.chestLen;             // shoulder line
  const sc = 1 + 0.4 * st.crouch;
  ps.add(px, py, -Q.hipHalf * 0.9 + pz, Q.chestD * 0.92, px, py, Q.hipHalf * 0.9 + pz, Q.chestD * 0.92, 0.12, MAT.fur, 1, 1); // pelvis bar
  ps.add(px, py + 0.02, pz, Q.waistD * 1.0, wx, wy, pz * 0.6, Q.waistD * 0.9, 0.14, MAT.fur, 1.35);
  ps.add(wx, wy, pz * 0.6, Q.waistD * 0.95 * breathe, cx - sl * 0.05, cy - cl * 0.09, 0, Q.chestD * 0.97 * breathe, 0.16, MAT.fur, 1.45);
  const shy = cy - 0.07;
  // shoulder girdle: a bar across the top of the chest
  ps.add(cx, shy, -Q.shoulderHalf * 0.8, Q.armR * 1.35, cx, shy, Q.shoulderHalf * 0.8, Q.armR * 1.35, 0.12, MAT.fur, 1);
  void sc;

  // ---- arms (counter-swing to the leg on the same side) -------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const swingPh = ph + (i === 0 ? 0.5 : 0); // L arm opposes L leg (offset 0)
    const th = mix(G.armSwing * walk * Math.cos(2 * Math.PI * swingPh) - 0.05 - lean * 0.5, side > 0 ? st.armL : st.armR, st.armsFree);
    const flex = mix(0.18 + 0.5 * Math.max(0, Math.sin(th * 2.2)) * walk + 0.12 * Math.sin(T * 1.4 + i), 0.3, st.armsFree * 0.5);
    const shx = cx, shz = side * Q.shoulderHalf;
    const ex = shx + Math.sin(th) * Q.upperArm, ey = shy - Math.cos(th) * Q.upperArm, ez = shz + side * 0.035;
    const th2 = th + flex;
    const wxr = ex + Math.sin(th2) * Q.foreArm, wyr = ey - Math.cos(th2) * Q.foreArm, wzr = ez - side * 0.012;
    ps.add(shx, shy, shz, Q.armR * 1.15, ex, ey, ez, Q.armR * 0.85, 0.09, MAT.fur, 1);
    ps.add(ex, ey, ez, Q.armR * 0.82, wxr, wyr, wzr, Q.armR * 0.56, 0.06, MAT.fur, 1);
    const th3 = th2 + 0.12;
    ps.add(wxr, wyr, wzr, Q.armR * 0.55, wxr + Math.sin(th3) * Q.hand, wyr - Math.cos(th3) * Q.hand, wzr - side * 0.004, Q.armR * 0.34, 0.04, MAT.skin, 0.55, 0.95);
  }

  // ---- neck & head --------------------------------------------------------------------------------------------------
  const nf = Q.neckFwd + lean * 0.2 + st.headPitch * -0.1;
  const nx0 = cx + sl * 0.01, ny0 = shy + 0.02;
  const nx1 = nx0 + Math.sin(nf) * Q.neckLen, ny1 = ny0 + Math.cos(nf) * Q.neckLen;
  ps.add(nx0, ny0 - 0.02, 0, Q.neckR * 1.25, nx1, ny1, 0, Q.neckR, 0.1, MAT.fur, 1.0);
  const idle = vnoise(T * 0.5) * 0.12;
  const pitch = st.headPitch - lean * 0.9 - Q.neckFwd * 0.5 + 0.02 * Math.sin(4 * Math.PI * ph + 1) * walk + 0.01 * Math.sin(T * 0.9);
  const yaw = st.headYaw + idle * (1 - walk) * 0.5;
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cyw = Math.cos(yaw), syw = Math.sin(yaw);
  const fx = cp * cyw, fy = sp, fz = cp * syw, ux = -sp * cyw, uy = cp, uz = -sp * syw;
  const sx = fy * uz - fz * uy, sy = fz * ux - fx * uz, sz = fx * uy - fy * ux;
  const cr = Q.cranR;
  const Cx = nx1 + fx * cr * 0.1 + ux * cr * 0.78, Cy = ny1 + fy * cr * 0.1 + uy * cr * 0.78, Cz = fz * cr * 0.1 + uz * cr * 0.78;
  st.headX = Cx; st.headY = Cy; st.headZ = Cz;
  const el = Q.cranElong;
  const hp = (f: number, u: number, s: number, out: number[]) => { out[0] = Cx + fx * f * cr + ux * u * cr + sx * s * cr; out[1] = Cy + fy * f * cr + uy * u * cr + sy * s * cr; out[2] = Cz + fz * f * cr + uz * u * cr + sz * s * cr; };
  const a = [0, 0, 0], b = [0, 0, 0];
  // cranium (elongated and lower for early hominins), then a face that projects past it
  const pg = Q.prognath;
  hp(-0.15 - 0.55 * el, 0.14 - 0.1 * el, 0, a); hp(-0.04, 0.13 - 0.06 * el, 0, b);
  ps.add(a[0], a[1], a[2], cr * (1.0 - 0.1 * el), b[0], b[1], b[2], cr * (1.0 - 0.08 * el), 0.1, MAT.fur, 0.86);
  hp(0.52, -0.02, 0, a); hp(0.55 + pg * 1.4, -0.52, 0, b);
  ps.add(a[0], a[1], a[2], cr * 0.55, b[0], b[1], b[2], cr * 0.44, 0.08, MAT.fur, 0.8);
  hp(0.0, -0.42, 0, a); hp(0.58 + pg * 1.3 + Q.chin / cr, -0.82 + (1 - Q.jaw) * 0.12, 0, b);
  ps.add(a[0], a[1], a[2], cr * 0.36 * Q.jaw, b[0], b[1], b[2], cr * 0.28 * Q.jaw, 0.07, MAT.fur, 0.9);
  // brow ridge: a bar across the face
  hp(0.93, 0.17, -0.46, a); hp(0.93, 0.17, 0.46, b);
  ps.add(a[0], a[1], a[2], Q.brow + cr * 0.1, b[0], b[1], b[2], Q.brow + cr * 0.1, 0.06, MAT.fur, 1);
  // nose
  hp(0.95 + pg * 0.5, 0.0, 0, a); hp(1.2 + pg * 0.7 + Q.noseL / cr, -0.3, 0, b);
  ps.add(a[0], a[1], a[2], cr * 0.17, b[0], b[1], b[2], cr * 0.2, 0.06, MAT.skin, 0.7);
  for (let s = -1; s <= 1; s += 2) {
    hp(0.97, 0.02, 0.4 * s, a); hp(0.98, 0.02, 0.41 * s, b);
    ps.add(a[0], a[1], a[2], cr * 0.12, b[0], b[1], b[2], cr * 0.118, 0.004, MAT.eye, 1);
    hp(-0.12, -0.05, 0.9 * s, a); hp(-0.14, -0.28, 0.92 * s, b);
    ps.add(a[0], a[1], a[2], Q.earR * 0.7, b[0], b[1], b[2], Q.earR * 0.5, 0.04, MAT.skin, 0.4);
  }
}
