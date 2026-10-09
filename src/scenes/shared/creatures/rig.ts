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
  /** OUTPUT: head centre in creature space (for look-at and attaching things) */
  headX: number; headY: number; headZ: number;
}

export const newRigState = (): RigState => ({
  time: 0, phase: 0, walk: 0, headYaw: 0, headPitch: 0, sniff: 0.5, alert: 0, mouth: 0, armsFree: 0, armL: 0, armR: 0, crouch: 0, headX: 0, headY: 0, headZ: 0,
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
