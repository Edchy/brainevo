import { MAT, PrimSet } from './sdf';
import { GAITS, clamp, footCycle, mix, vnoise } from './rig';
import type { Leg, RigState } from './rig';
import type { QuadParams } from './quadruped';

/**
 * Primate pose solver (quadruped rig, 'primate' | 'ape' | 'prosimian' presets).
 * Differences from the plain quadruped: a spine that can pitch from all-fours to sitting upright, limbs that can be
 * pulled to explicit hand/foot targets (RigState.pm), grasping hands and feet with curling digits, a brow ridge, a bare
 * face, forward-facing eyes and a prehensile tail. Primitive budget is exactly MAXP (32); the tail is added last so it is
 * the first thing to drop if the budget is ever exceeded.
 */
const leg: Leg = { jx: 0, jy: 0, ex: 0, ey: 0 };
const fc = { x: 0, lift: 0 };

/** 2-bone IK where the joint is pushed toward a pole direction (robust for horizontal / reversed limbs) */
function ik2pole(rx: number, ry: number, tx: number, ty: number, l1: number, l2: number, pdx: number, pdy: number, out: Leg) {
  let dx = tx - rx, dy = ty - ry;
  let d = Math.hypot(dx, dy);
  const maxD = (l1 + l2) * 0.999, minD = Math.abs(l1 - l2) + 1e-3;
  if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
  if (d < minD) d = minD;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const ux = dx / (d || 1), uy = dy / (d || 1);
  let px = -uy, py = ux;
  if (px * pdx + py * pdy < 0) { px = -px; py = -py; }
  out.jx = rx + ux * a + px * h; out.jy = ry + uy * a + py * h;
  out.ex = rx + ux * d; out.ey = ry + uy * d;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** palm + 1..2 curling digit segments. (ex,ey,ez) = wrist/ankle, `ang` direction of the palm in the x-y plane. */
function digits(ps: PrimSet, ex: number, ey: number, ez: number, ang: number, len: number, palmFrac: number, r: number,
  grip: number, zw: number, segs: number, groundY: number) {
  const pl = len * palmFrac;
  const kx = ex + Math.cos(ang) * pl, ky = Math.max(ey + Math.sin(ang) * pl, groundY);
  // curl toward the palm side: down when the hand points forward, forward when it hangs down
  const dir = clamp((0.25 - Math.cos(ang)) * 6, -1, 1); // +1 for hanging/up hands (curl +angle), -1 for forward hands (curl -angle)
  const a1 = ang + dir * (0.12 + 0.95 * grip);
  const rest = len - pl;
  const l1 = segs === 2 ? rest * 0.56 : rest;
  const jx = kx + Math.cos(a1) * l1, jy = Math.max(ky + Math.sin(a1) * l1, groundY);
  ps.add(ex, ey, ez, r, kx, ky, ez, r * 0.82, 0.045, MAT.skin, 1.0, 0.85);
  if (segs === 2) {
    const a2 = a1 + dir * (0.18 + 1.25 * grip);
    const l2 = rest - l1;
    const tx = jx + Math.cos(a2) * l2, ty = Math.max(jy + Math.sin(a2) * l2, groundY * 0.5);
    ps.add(kx, ky, ez, r * 0.8, jx, jy, ez, r * 0.62, 0.025, MAT.skin, zw, 0.78);
    ps.add(jx, jy, ez, r * 0.6, tx, ty, ez, r * 0.42, 0.018, MAT.skin, zw * 0.9, 0.72);
  } else {
    ps.add(kx, ky, ez, r * 0.8, jx, jy, ez, r * 0.42, 0.03, MAT.skin, zw, 0.76);
  }
}

export function solvePrimate(ps: PrimSet, Q: QuadParams, st: RigState) {
  ps.reset();
  const pm = st.pm;
  const T = st.time, walk = st.walk, ph = st.phase;
  const gait = GAITS[Q.gait];
  const lr = Q.limbR, hip = Q.hipR, ch = Q.chestR, bl = Q.bodyLen;
  const sit = clamp01(pm.sit);

  // ---- stand heights -------------------------------------------------------------------------------------------
  const fToe = 0.012 + Q.front[2] * 0.05, hToe = 0.012 + Q.hind[2] * 0.05;
  const hAnkleY = hToe + Q.hind[2] * 0.2, fAnkleY = fToe + Q.front[2] * 0.12;
  const hAnkOff = -0.1, fAnkOff = 0.06;
  const stand = (l1: number, l2: number, ay: number, dx: number) => { const r = Q.ext * (l1 + l2); return ay + Math.sqrt(Math.max(r * r - dx * dx, 0.0004)); };
  const yHq = stand(Q.hind[0], Q.hind[1], hAnkleY, hAnkOff) - st.crouch * 0.08;
  const yHs = hip * 0.5;
  const yHroot = mix(yHq, yHs, sit) + pm.oy;
  const ySroot = stand(Q.front[0], Q.front[1], fAnkleY, fAnkOff) - st.crouch * 0.08;
  const breathe = 1 + 0.03 * Math.sin(T * 2.2 * (1 + 0.5 * st.alert)) * (1 - 0.5 * walk) + 0.01 * Math.sin(T * 6);
  const bob = Q.bob * walk * Math.cos(4 * Math.PI * ph + 0.6) * (1 - sit);
  const undul = Q.wave * walk * Math.sin(2 * Math.PI * ph) * (1 - sit);

  const Hcy = yHroot + hip * 0.45 + bob * 0.8;
  const sinq = clamp((ySroot + ch * 0.2 - (yHroot + hip * 0.45)) / bl, -0.4, 0.55);
  const pitch0 = Math.asin(sinq) + 0.05 + Q.arch * 0.12;
  const p = mix(pitch0, 1.42, sit) + pm.tilt;
  const cpp = Math.cos(p), spp = Math.sin(p);
  const Hcx = -bl * cpp * 0.5 + pm.ox, Hcz = -undul + pm.oz;
  const Scx = Hcx + bl * cpp, Scy = Hcy + bl * spp + bob * 0.2, Scz = undul + pm.oz;
  const zs = Q.bodyW;
  // mid-spine sags a touch (belly) when horizontal, straight when upright
  const Mx = (Hcx + Scx) / 2, My = (Hcy + Scy) / 2 - Q.waistR * 0.1 * Q.belly * (1 - sit) + Q.arch * 0.05 * bl * (1 - sit), Mz = (Hcz + Scz) / 2;
  ps.add(Hcx, Hcy, Hcz, hip * (1 + 0.2 * sit), Mx, My, Mz, Q.waistR * breathe, 0.16, MAT.fur, zs);
  ps.add(Mx, My, Mz, Q.waistR * breathe, Scx, Scy, Scz, ch * breathe, 0.16, MAT.fur, zs);

  // ---- limbs ---------------------------------------------------------------------------------------------------
  const gripOf = [pm.gripL, pm.gripR];
  for (let i = 0; i < 4; i++) {
    const front = i < 2, side = i % 2 === 0 ? 1 : -1;
    const L = front ? Q.front : Q.hind;
    const rx = front ? Scx + ch * 0.05 : Hcx + hip * 0.05;
    const ry = front ? Scy - ch * 0.2 : Hcy - hip * 0.45;
    const rzc = front ? Scz : Hcz;
    const rz0 = rzc + side * (front ? ch : hip) * Q.bodyW * 0.8;
    const lph = ph + gait.off[i];
    footCycle(lph, gait.duty, fc);
    const sweep = Q.stride * gait.duty * walk * (1 - sit);
    const ank0 = front ? fAnkOff : hAnkOff;
    const ankY0 = front ? fAnkleY : hAnkleY;
    let ax = rx + ank0 + fc.x * sweep + (front ? 0 : 0);
    let ay = ankY0 + fc.lift * Q.lift * walk * (1 - sit);
    let az = rz0 + side * Q.sprawl * 0.1;
    if (sit > 0.001) {
      const sx = front ? rx + 0.06 : rx + L[0] * 0.85, sy = front ? ry - (L[0] + L[1]) * 0.86 : ankY0;
      ax = mix(ax, sx, sit); ay = mix(ay, sy, sit);
      if (!front) az = mix(az, rz0 + side * 0.04, sit);
    }
    const tgt = front ? pm.hand : pm.foot;
    const o = side > 0 ? 0 : 4;
    const w = clamp01(tgt[o + 3]);
    if (w > 0.001) { ax = mix(ax, tgt[o], w); ay = mix(ay, tgt[o + 1], w); az = mix(az, tgt[o + 2], w); }
    if (front) ik2pole(rx, ry, ax, ay, L[0], L[1], -0.55, -0.85, leg); else ik2pole(rx, ry, ax, ay, L[0], L[1], 0.75, 0.6, leg);
    const jz = (rz0 + az) / 2 + side * Q.sprawl * 0.1 * L[0];
    const r0 = (front ? ch * 0.62 : hip * 0.82) * lr, r1 = r0 * 0.55, r2 = Math.max(r1 * 0.62, 0.014);
    ps.add(rx, ry, rz0, r0, leg.jx, leg.jy, jz, r1, front ? 0.08 : 0.1, MAT.fur, 0.92, 1);
    ps.add(leg.jx, leg.jy, jz, r1 * 0.95, leg.ex, leg.ey, az, r2, 0.05, MAT.fur, 0.88, 1);
    // hand / foot
    const grip = front ? gripOf[side > 0 ? 0 : 1] : pm.footGrip;
    const fx = leg.ex - leg.jx, fy = leg.ey - leg.jy;
    const angF = Math.atan2(fy, fx);
    const hl = L[2];
    const palmF = front ? 0.5 : 0.58;
    const ground = front ? fToe : hToe;
    const angG = Math.atan2(ground - leg.ey, Math.max(hl * palmF * 0.95, 0.05));
    const kk = clamp01(Math.max(sit * (front ? 1 : 0.0), w, front ? fc.lift * walk : fc.lift * walk * 0.5));
    const ang = mix(angG, angF - (front ? 0.15 : 0.0), kk);
    digits(ps, leg.ex, leg.ey, az, ang, hl, palmF, Math.max(r2, front ? 0.02 : 0.024) * lr, grip, front ? 1.35 : 1.3, front ? 2 : 1, ground);
  }

  // ---- head ----------------------------------------------------------------------------------------------------
  const idle = vnoise(T * 0.6) * 0.2 + vnoise(T * 1.7 + 4) * 0.1;
  const hpitch = mix(-Q.headDrop, -0.02, sit) + st.alert * 0.2 + st.headPitch + idle * 0.15 + 0.03 * walk * Math.sin(4 * Math.PI * ph + 1);
  const yaw = st.headYaw + idle * 0.3 + 0.03 * walk * Math.sin(2 * Math.PI * ph);
  const na = mix(Q.neckUp, 1.5, sit) + st.alert * 0.1 + st.headPitch * 0.3 + pm.tilt * 0.3;
  const bx = Scx + ch * 0.35 * cpp, by = Scy + ch * 0.35 * spp + ch * 0.1;
  const hbx = bx + Math.cos(na) * Q.neckLen, hby = by + Math.sin(na) * Q.neckLen, hbz = Scz * 0.7;
  const cp = Math.cos(hpitch), sp = Math.sin(hpitch), cyw = Math.cos(yaw), syw = Math.sin(yaw);
  // head frame: forward f, up u, side s (+z when facing +x), with optional roll
  let fx = cp * cyw, fy = sp, fz = cp * syw;
  let ux = -sp * cyw, uy = cp, uz = -sp * syw;
  let sx = fy * uz - fz * uy, sy = fz * ux - fx * uz, sz = fx * uy - fy * ux;
  if (pm.roll !== 0) {
    const cr = Math.cos(pm.roll), sr = Math.sin(pm.roll);
    const nux = ux * cr + sx * sr, nuy = uy * cr + sy * sr, nuz = uz * cr + sz * sr;
    sx = sx * cr - ux * sr; sy = sy * cr - uy * sr; sz = sz * cr - uz * sr;
    ux = nux; uy = nuy; uz = nuz;
  }
  void fx; void fy; void fz;
  const sR = Q.skullR, sL = Q.skullLen;
  const cx = hbx + fx * sL * 0.45 + ux * sR * 0.12, cy = hby + fy * sL * 0.45 + uy * sR * 0.12, cz = hbz + fz * sL * 0.45 + uz * sR * 0.12;
  // neck first so the head blends into it
  ps.add(Scx + ch * 0.1 * cpp, Scy + ch * 0.1 * spp, Scz, ch * 0.88, hbx, hby, hbz, Q.neckR, 0.16, MAT.fur, zs);
  // skull: rounded cranium
  ps.add(cx - fx * sL * 0.32, cy - fy * sL * 0.32, cz - fz * sL * 0.32, sR * 0.98, cx + fx * sL * 0.22, cy + fy * sL * 0.22, cz + fz * sL * 0.22, sR * 0.95, 0.12, MAT.fur, 0.92);
  st.headX = cx; st.headY = cy; st.headZ = cz;
  // muzzle (bare skin)
  const mL = Q.muzzleLen;
  const m0x = cx + fx * sL * 0.3 - ux * sR * 0.22, m0y = cy + fy * sL * 0.3 - uy * sR * 0.22, m0z = cz + fz * sL * 0.3 - uz * sR * 0.22;
  const m1x = m0x + fx * mL - ux * mL * 0.14, m1y = m0y + fy * mL - uy * mL * 0.14, m1z = m0z + fz * mL - uz * mL * 0.14;
  ps.add(m0x, m0y, m0z, Q.muzzleR, m1x, m1y, m1z, Q.muzzleTipR, 0.05, MAT.skin, 0.82, 1.0);
  // lower jaw: opens with st.mouth, a small gap line (crease) otherwise
  const open = st.mouth * 0.5;
  const jdx = Math.cos(open), jdy = -Math.sin(open);
  const j0x = m0x - fx * mL * 0.1 - ux * Q.muzzleR * 0.8, j0y = m0y - fy * mL * 0.1 - uy * Q.muzzleR * 0.8, j0z = m0z - fz * mL * 0.1 - uz * Q.muzzleR * 0.8;
  const jl = mL * 0.95 * Q.jaw + 0.02;
  ps.add(j0x, j0y, j0z, Q.muzzleR * 0.62, j0x + (fx * jdx + ux * jdy) * jl, j0y + (fy * jdx + uy * jdy) * jl, j0z + (fz * jdx + uz * jdy) * jl, Q.muzzleTipR * 0.62, 0.012, MAT.skin, 0.8, 0.85);
  // brow ridge: a bar over the eyes (raise / furrow with pm.brow)
  const bR = Q.browR ?? 0.03;
  {
    const bw = sR * 0.62;
    // brow ridge arcs over both eyes, resting on the skull surface just above and ahead of the eye line
    const up = Q.eyeUp + 0.32 + 0.06 * pm.brow;
    let vx = fx * (sL * (Q.eyeFwd - 0.22) + sR * 0.5) + ux * sR * up, vy = fy * (sL * (Q.eyeFwd - 0.22) + sR * 0.5) + uy * sR * up, vz = fz * (sL * (Q.eyeFwd - 0.22) + sR * 0.5) + uz * sR * up;
    const vl = Math.hypot(vx, vy, vz) || 1, rr = sR * 0.98;
    vx *= rr / vl; vy *= rr / vl; vz *= rr / vl;
    const bcx = cx + fx * sL * 0.22 + vx, bcy = cy + fy * sL * 0.22 + vy, bcz = cz + fz * sL * 0.22 + vz;
    const bin = 0.5 * bR * pm.brow;
    ps.add(bcx + sx * bw - fx * bR * 0.6 + ux * bin, bcy + sy * bw - fy * bR * 0.6 + uy * bin, bcz + sz * bw - fz * bR * 0.6 + uz * bin, bR * 0.8,
      bcx - sx * bw - fx * bR * 0.6 + ux * bin, bcy - sy * bw - fy * bR * 0.6 + uy * bin, bcz - sz * bw - fz * bR * 0.6 + uz * bin, bR * 0.8, 0.05, MAT.fur, 1, 0.9);
  }
  // eyes: forward facing, close together, with a lit glint (see eye shading in sdf)
  const eyeSide = Q.eyeSide ?? 0.55;
  // eyes sit on the front hemisphere of the skull: take the wanted direction and push it out to the surface
  const sfx = cx + fx * sL * 0.22, sfy = cy + fy * sL * 0.22, sfz = cz + fz * sL * 0.22; // centre of the skull's front sphere
  const eo = sR * eyeSide;
  for (let s = -1; s <= 1; s += 2) {
    let vx = fx * (sL * (Q.eyeFwd - 0.22) + sR * 0.5) + ux * sR * Q.eyeUp + sx * eo * s;
    let vy = fy * (sL * (Q.eyeFwd - 0.22) + sR * 0.5) + uy * sR * Q.eyeUp + sy * eo * s;
    let vz = fz * (sL * (Q.eyeFwd - 0.22) + sR * 0.5) + uz * sR * Q.eyeUp + sz * eo * s;
    const vl = Math.hypot(vx, vy, vz) || 1;
    const rr = sR * 0.95 - Q.eyeR * 0.1;
    vx *= rr / vl; vy *= rr / vl; vz *= rr / vl;
    const px = sfx + vx, py = sfy + vy, pz = sfz + vz;
    ps.add(px, py, pz, Q.eyeR, px + vx / rr * 0.003, py + vy / rr * 0.003, pz + vz / rr * 0.003, Q.eyeR * 0.98, 0.004, MAT.eye, 1, 0.3); // tone 0.3: dark ape sclera
  }
  // ears
  if (Q.earSize > 0.005) {
    const tw = Math.pow(Math.max(0, vnoise(T * 0.8 + 11)), 3) * 1.4;
    for (let s = -1; s <= 1; s += 2) {
      const E = Q.earSize;
      const ebx = cx - fx * sL * 0.22 + ux * sR * 0.18 + sx * sR * 0.86 * s, eby = cy - fy * sL * 0.22 + uy * sR * 0.18 + sy * sR * 0.86 * s, ebz = cz - fz * sL * 0.22 + uz * sR * 0.18 + sz * sR * 0.86 * s;
      const flick = tw * Math.sin(T * 36 + s) * 0.12;
      const tx = ebx + sx * E * 0.75 * s + ux * E * (0.55 + flick) - fx * E * Q.earBack, ty = eby + sy * E * 0.75 * s + uy * E * (0.55 + flick) - fy * E * Q.earBack, tz = ebz + sz * E * 0.75 * s + uz * E * (0.55 + flick) - fz * E * Q.earBack;
      ps.add(ebx, eby, ebz, E * 0.46 * Q.earW, tx, ty, tz, E * 0.4 * Q.earW, 0.04, MAT.skin, 0.3, 0.9);
    }
  }

  // ---- prehensile tail --------------------------------------------------------------------------------------
  if (Q.tailLen > 0.02) {
    const segs = 3;
    let tx = Hcx - hip * 0.7 * cpp, ty = Hcy - hip * 0.1 - hip * 0.5 * spp, tz = Hcz;
    let tYaw = Math.PI, tPit = Q.tailRise + pm.tailPit + st.alert * 0.2 - sit * 0.25 + 0.03 * Math.sin(T * 1.6);
    const curl = Q.tailCurl + pm.tailCurl;
    for (let i = 0; i < segs; i++) {
      const Ls = Q.tailLen / segs * (i === 1 ? 1.1 : 1);
      tYaw += (0.16 * Math.sin(T * 1.7 - i * 0.9) * (1 - 0.4 * walk) + 0.2 * walk * Math.sin(2 * Math.PI * ph - i * 0.8)) * 0.6;
      tPit += i === 0 ? 0 : -curl * (0.12 + 0.12 * i) + 0.04 * Math.sin(T * 2.1 - i);
      const dx = Math.cos(tYaw) * Math.cos(tPit), dy = Math.sin(tPit), dz = -Math.sin(tYaw) * Math.cos(tPit);
      const u0 = i / segs, u1 = (i + 1) / segs;
      const r0 = mix(Q.tailR0, Q.tailR1, Math.pow(u0, 0.9)), r1 = mix(Q.tailR0, Q.tailR1, Math.pow(u1, 0.9));
      const nx = tx + dx * Ls, ny = ty + dy * Ls, nz = tz + dz * Ls;
      ps.add(tx, ty, tz, r0, nx, ny, nz, r1, i === 0 ? 0.1 : 0.03, MAT.fur, 1);
      tx = nx; ty = ny; tz = nz;
    }
  }
}
