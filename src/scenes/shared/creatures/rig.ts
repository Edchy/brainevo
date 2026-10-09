/** Shared rig maths: 2-bone IK in the sagittal (x-y) plane, gait cycle, head frame. Allocation-free. */

export interface RigState {
  /** seconds (ambient motion: breathing, tail, ears). Frozen when reduced motion. */
  time: number;
  /** gait phase in cycles (add 1 per full stride). Derive from distance travelled so feet plant and scrubbing works both ways. */
  phase: number;
  /** 0 = standing, 1 = full gait */
  walk: number;
  /** head yaw/pitch offset in radians (positive yaw = toward +z, positive pitch = nose up) on top of the idle sniffing */
  headYaw: number;
  headPitch: number;
  /** extra idle fidget/sniff amount 0..1 */
  sniff: number;
  /** 0 = relaxed, 1 = alert (ears up, head high, tail raised) */
  alert: number;
  /** 0..1 mouth open */
  mouth: number;
  /** arm raise etc. for bipeds: 0 swinging gait arms .. 1 free (arms ignored by gait) */
  armsFree: number;
  /** biped only: arm pose overrides (radians swing forward) when armsFree > 0 */
  armL: number; armR: number;
  /** crouch 0..1 (lowers hips) */
  crouch: number;
  /** biped hands: grip 0 open .. 1 fist; prop 0 none, 1 cobble, 2 stick, 3 spear, 4 torch, 5 handaxe, 6 hammerstone, 7 core; roll = wrist roll (rad) */
  gripL: number; gripR: number; propL: number; propR: number; rollL: number; rollR: number;
  /** biped hand IK targets (wrist, creature space) blended by weight 0..1 */
  hLx: number; hLy: number; hLz: number; hLw: number; hRx: number; hRy: number; hRz: number; hRw: number;
  /** biped poses 0..1: reach forward/up, strike (0 = struck down .. 1 = raised overhead; right arm, left assists), throw -1 cocked .. 1 follow-through */
  reach: number; reachY: number; strike: number; throwK: number; twist: number; bend: number; detail: number;
  /** biped: carried infant (0..1) at creature-space anchor k, head direction yaw */
  carry: number; kx: number; ky: number; kz: number; kyaw: number;
  /** OUTPUT biped: palm centre and prop tip per hand */
  pLx: number; pLy: number; pLz: number; pRx: number; pRy: number; pRz: number;
  tLx: number; tLy: number; tLz: number; tRx: number; tRy: number; tRz: number;
  /** OUTPUT: head centre in creature space (for look-at and attaching things) */
  headX: number; headY: number; headZ: number;
  /** extra pose controls used by the primate quadruped solver (ignored by every other rig) */
  pm: PrimatePose;
}

/**
 * Primate pose controls. Targets are in creature-local space (x forward, y up, z left, feet at y = 0).
 * hand / foot = [lx, ly, lz, lw, rx, ry, rz, rw] wrist / ankle targets blended in with weight w (0 = gait / default).
 */
export interface PrimatePose {
  /** 0 = on all fours, 1 = sitting upright on the haunches */ sit: number;
  /** extra torso pitch in radians */ tilt: number;
  /** pelvis offset (leaps, hanging) */ ox: number; oy: number; oz: number;
  hand: number[]; foot: number[];
  /** finger / toe curl 0..1 */ gripL: number; gripR: number; footGrip: number;
  /** added to the tail's base pitch / total curl */ tailPit: number; tailCurl: number;
  /** -1 furrowed .. +1 raised */ brow: number;
  /** extra head roll (rad) */ roll: number;
}
export const newPrimatePose = (): PrimatePose => ({
  sit: 0, tilt: 0, ox: 0, oy: 0, oz: 0, hand: [0, 0, 0, 0, 0, 0, 0, 0], foot: [0, 0, 0, 0, 0, 0, 0, 0],
  gripL: 0, gripR: 0, footGrip: 0, tailPit: 0, tailCurl: 0, brow: 0, roll: 0,
});

export const newRigState = (): RigState => ({
  time: 0, phase: 0, walk: 0, headYaw: 0, headPitch: 0, sniff: 0.5, alert: 0, mouth: 0, armsFree: 0, armL: 0, armR: 0, crouch: 0, headX: 0, headY: 0, headZ: 0,
  gripL: 0, gripR: 0, propL: 0, propR: 0, rollL: 0, rollR: 0, hLx: 0, hLy: 0, hLz: 0, hLw: 0, hRx: 0, hRy: 0, hRz: 0, hRw: 0,
  reach: 0, reachY: 0.2, strike: 0, throwK: 0, twist: 0, bend: 0, detail: 1, carry: 0, kx: 0, ky: 0, kz: 0, kyaw: 0, pLx: 0, pLy: 0, pLz: 0, pRx: 0, pRy: 0, pRz: 0, tLx: 0, tLy: 0, tLz: 0, tRx: 0, tRy: 0, tRz: 0, pm: newPrimatePose(),
});

export interface GaitDef {
  /** fraction of the cycle a foot is on the ground */ duty: number;
  /** body distance covered per full cycle (world units, creature-local) */ stride: number;
  /** swing foot lift height */ lift: number;
  /** phase offsets FL, FR, HL, HR */ off: [number, number, number, number];
  /** vertical body bob amplitude */ bob: number;
  /** lateral trunk undulation (radians-ish, scaled by body) */ wave: number;
}

export const GAITS = {
  walk: { duty: 0.66, off: [0, 0.5, 0.25, 0.75] },
  trot: { duty: 0.5, off: [0, 0.5, 0.5, 0] },
  scurry: { duty: 0.45, off: [0, 0.5, 0.5, 0] },
} as const;

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (u: number) => u * u * (3 - 2 * u);
export const fract = (x: number) => x - Math.floor(x);
export const hash1 = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** smooth 1D value noise, ~[-1,1] */
export const vnoise = (x: number) => { const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f); return (mix(hash1(i), hash1(i + 1), u) - 0.5) * 2; };

/** reusable output of the IK solve */
export interface Leg { jx: number; jy: number; ex: number; ey: number }

/**
 * Solve a 2-bone chain in a plane. Root (rx,ry), target (tx,ty), bone lengths l1,l2. `bend` = +1 puts the joint on the
 * +x side of the root->target line (knee forward), -1 on the other (elbow back). Reach is clamped. Result joint in `out`.
 */
export function ik2(rx: number, ry: number, tx: number, ty: number, l1: number, l2: number, bend: number, out: Leg) {
  let dx = tx - rx, dy = ty - ry;
  let d = Math.hypot(dx, dy);
  const maxD = (l1 + l2) * 0.999, minD = Math.abs(l1 - l2) + 1e-3;
  if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
  if (d < minD) { d = minD; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const ux = dx / (d || 1), uy = dy / (d || 1);
  // perpendicular, oriented so bend>0 points toward +x (when the leg points down this is (+1,0))
  let px = -uy, py = ux;
  if (px * bend < 0) { px = -px; py = -py; }
  out.jx = rx + ux * a + px * h; out.jy = ry + uy * a + py * h;
  out.ex = rx + ux * d; out.ey = ry + uy * d;
}

/**
 * Foot trajectory in body frame for one leg: returns x offset and lift (0..1) given cycle phase.
 * Stance: foot slides backwards linearly (so a body moving at stride/cycle plants it); swing: eased return with an arc.
 */
export function footCycle(ph: number, duty: number, out: { x: number; lift: number }) {
  ph = fract(ph);
  if (ph < duty) { out.x = 0.5 - ph / duty; out.lift = 0; }
  else { const u = (ph - duty) / (1 - duty); out.x = -0.5 + ease(u); out.lift = Math.pow(Math.sin(Math.PI * u), 0.85); }
}

/** 3D two-bone IK: shoulder S -> wrist target T, pole = direction the elbow bows toward. out = [ex,ey,ez,wx,wy,wz]. */
export function ik3(sx: number, sy: number, sz: number, tx: number, ty: number, tz: number, l1: number, l2: number, px: number, py: number, pz: number, out: number[]) {
  let dx = tx - sx, dy = ty - sy, dz = tz - sz;
  let d = Math.hypot(dx, dy, dz) || 1e-4;
  const maxD = (l1 + l2) * 0.998, minD = Math.abs(l1 - l2) + 0.02;
  const k = d > maxD ? maxD / d : d < minD ? minD / d : 1;
  dx *= k; dy *= k; dz *= k; d *= k;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const ux = dx / d, uy = dy / d, uz = dz / d;
  const pd = px * ux + py * uy + pz * uz;
  let qx = px - ux * pd, qy = py - uy * pd, qz = pz - uz * pd;
  const ql = Math.hypot(qx, qy, qz) || 1; qx /= ql; qy /= ql; qz /= ql;
  out[0] = sx + ux * a + qx * h; out[1] = sy + uy * a + qy * h; out[2] = sz + uz * a + qz * h;
  out[3] = sx + dx; out[4] = sy + dy; out[5] = sz + dz;
}
