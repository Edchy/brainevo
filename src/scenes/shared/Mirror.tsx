import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { world } from '../../world/store';
import { eventPos, near } from '../../world/util';
import { MIRROR_ASPECT, toMirrorUv, track, useMirror } from '../../lib/mirror';

// The visitor's reflection, drawn into the 3D frame so the oil pass paints it like everything else. It appears only
// once they have opened the mirror (src/lib/mirror.ts), at three stations:
//  - the mirror test: an oval hand mirror beside the text; a red mark sits on their tracked forehead, pulses as a finger
//    nears it, and bursts into a gold ring when they touch it
//  - "Now": a glowing brain painted inside their head, firing, sized and tilted to their face
//  - "Here, Now" at the end: their face inside the breathing light

const FS = /* glsl */ `
uniform sampler2D uTex; uniform sampler2D uBrainTex;
uniform vec2 uFit; uniform vec2 uMarkUv; uniform vec2 uBrainC; uniform vec2 uBrainS; uniform vec4 uCrop; uniform float uCropOn;
uniform float uW, uMark, uReach, uBurst, uGuide, uRound, uTime, uBrain, uBrainRot, uAspect;
varying vec2 vUv;
void main(){
  vec2 uv = vUv;
  // mirrored, cropped to cover the shape
  vec2 tc = vec2(1. - (.5 + (uv.x - .5) * uFit.x), .5 + (uv.y - .5) * uFit.y);
  // at the end, framed on the face itself (mirrored crop around the tracked face)
  tc = mix(tc, vec2(uCrop.x - (uv.x - .5) * uCrop.z, uCrop.y + (uv.y - .5) * uCrop.w), uCropOn);
  vec3 c = texture2D(uTex, tc).rgb;
  c *= vec3(1.06, .97, .86) * .92;                                 // warm, as if lit by the scene's own light
  vec2 q = (uv - .5) * 2.;
  float r = length(q);
  float m = smoothstep(1., mix(.84, .55, uRound), r);              // the oval (or, at the end, a soft round glow)
  float rim = smoothstep(.035, 0., abs(r - .965)) * (1. - uRound);  // a thin gilt rim, like a hand mirror's
  // look into the mirror: a faint ellipse where a face should sit
  float guide = smoothstep(.02, 0., abs(length(q * vec2(1., .82)) - .74)) * uGuide * (.55 + .45 * sin(uTime * 2.4));

  // the brain inside the head: the glowing outline of two hemispheres and their folds, neurons firing along them
  vec2 d = (uv - uBrainC) * vec2(uAspect, 1.);
  float cr = cos(-uBrainRot), sr = sin(-uBrainRot);
  d = vec2(cr * d.x - sr * d.y, sr * d.x + cr * d.y);
  vec2 bt = d / uBrainS + .5;
  if (uBrain > .001 && bt.x > 0. && bt.x < 1. && bt.y > 0. && bt.y < 1.) {
    vec4 b = texture2D(uBrainTex, vec2(bt.x, 1. - bt.y));
    // painted, not glowing: a warm brain seen through the skull, its folds as darker grooves, and small sparks of light
    // running along them (bright lines bloomed into white blobs once painted)
    float fire = smoothstep(.82, .99, (sin(bt.x * 31. + uTime * 3.6) * .5 + .5) * (sin(bt.y * 23. - uTime * 2.7 + bt.x * 11.) * .5 + .5) * 1.25);
    vec3 tissue = vec3(.56, .40, .36) * (.85 + .3 * bt.y);
    c = mix(c, tissue, b.g * .72 * uBrain);
    c *= 1. - .42 * b.r * uBrain;
    c += vec3(1.1, .78, .4) * b.r * fire * 1.1 * uBrain;
  }

  // the red mark on the forehead; it pulses as a finger nears, and bursts into a gold ring when touched
  float dm = length((uv - uMarkUv) * vec2(uAspect, 1.));
  float rad = .022 * (1. + .25 * uReach * (.6 + .4 * sin(uTime * 14.)));
  float mark = smoothstep(rad + .008, rad, dm) * uMark;
  c = mix(c, vec3(.8, .05, .04), mark);
  float ring = smoothstep(.012, 0., abs(dm - .03 - uBurst * .22)) * (1. - uBurst) * step(.001, uBurst);
  c += vec3(1.3, 1., .45) * ring;

  vec3 col = c * m + vec3(1.25, .92, .45) * (rim + guide * .6);
  gl_FragColor = vec4(col, clamp(m + rim + guide * .6, 0., 1.) * uW);
}`;

/** the brain seen from the front: two hemispheres, the fissure between them, and their folds (r = lines, g = fill) */
function brainTexture() {
  const W = 256, H = 192;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const hemi = (side: number) => { g.beginPath(); g.ellipse(W / 2 + side * 52, H * 0.5, 66, 80, side * -0.08, 0, Math.PI * 2); };
  // fill (green channel): the whole brain
  g.fillStyle = 'rgb(0,255,0)';
  hemi(-1); g.fill(); hemi(1); g.fill();
  // lines (red channel, added): outline, midline, gyri
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = 'rgb(255,0,0)'; g.lineCap = 'round'; g.lineJoin = 'round';
  // drawn twice: a wide soft glow, then the crisp lines (thin lines vanish once the mirror is a few hundred pixels tall)
  for (const pass of [0, 1]) {
  g.filter = pass === 0 ? 'blur(5px)' : 'none';
  const lw = pass === 0 ? 2.2 : 1;
  g.lineWidth = 7 * lw; hemi(-1); g.stroke(); hemi(1); g.stroke();
  g.lineWidth = 5 * lw; g.beginPath(); g.moveTo(W / 2, H * 0.1); g.bezierCurveTo(W / 2 - 4, H * 0.4, W / 2 + 4, H * 0.6, W / 2, H * 0.92); g.stroke();
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.lineWidth = 4.2 * lw;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 11; k++) {
      // a fold: a wandering curve inside the hemisphere
      let x = W / 2 + side * (18 + rnd() * 80), y = H * (0.18 + rnd() * 0.64), a = rnd() * Math.PI * 2;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 14; s++) {
        a += (rnd() - 0.5) * 1.6;
        const nx = x + Math.cos(a) * 6, ny = y + Math.sin(a) * 6;
        const dx = (nx - (W / 2 + side * 52)) / 60, dy = (ny - H * 0.5) / 72;
        if (dx * dx + dy * dy > 1 || Math.abs(nx - W / 2) < 6) break;
        x = nx; y = ny; g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
const LIGHT_AT = new THREE.Vector3(0, 1.55, 0); // the closing light (src/scenes/future/Coda.tsx)

export function MirrorOverlay() {
  const m = useMirror();
  const camera = useThree((s) => s.camera);
  const mesh = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => {
    if (!m.video) return null;
    const t = new THREE.VideoTexture(m.video);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [m.video]);
  useEffect(() => () => tex?.dispose(), [tex]);
  const brain = useMemo(brainTexture, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: {
      uTex: { value: null }, uBrainTex: { value: brain }, uFit: { value: new THREE.Vector2(1, 1) },
      uMarkUv: { value: new THREE.Vector2(0.5, 0.71) }, uBrainC: { value: new THREE.Vector2(0.5, 0.7) }, uBrainS: { value: new THREE.Vector2(0.5, 0.3) },
      uW: { value: 0 }, uMark: { value: 0 }, uReach: { value: 0 }, uBurst: { value: 0 }, uGuide: { value: 0 }, uRound: { value: 0 }, uTime: { value: 0 },
      uBrain: { value: 0 }, uBrainRot: { value: 0 }, uAspect: { value: MIRROR_ASPECT },
      uCrop: { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.5) }, uCropOn: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: FS,
  }), [brain]);
  useEffect(() => () => { mat.dispose(); brain.dispose(); }, [mat, brain]);
  const burstAt = useRef(0);

  useFrame(() => {
    const o = mesh.current;
    if (!o) return;
    const on = m.status === 'on' && !!tex && !!m.video;
    const wTest = near(eventPos('mirror-self-recognition'), 0.55);
    const wNow = near(eventPos('now'), 0.55);
    const wHere = near(eventPos('coda-here'), 0.7);
    const w = on ? Math.max(wTest, wNow, wHere) : 0;
    o.visible = w > 0.002;
    if (!o.visible || !m.video) return;
    const u = mat.uniforms;
    const now = performance.now();
    u.uTex.value = tex;
    u.uTime.value = world.time;
    const round = wHere > Math.max(wTest, wNow);
    const aspect = round ? 1 : MIRROR_ASPECT;
    const va = m.video.videoWidth / Math.max(1, m.video.videoHeight) || 4 / 3;
    const fx = Math.min(1, aspect / va), fy = Math.min(1, va / aspect);
    (u.uFit.value as THREE.Vector2).set(fx, fy);
    u.uRound.value = round ? 1 : 0;
    u.uAspect.value = aspect;
    u.uW.value = w;
    const tracked = m.tracking === 'on' && m.face;
    const test = wTest > 0.5 && !round;
    // the mark, on the tracked forehead (or where an aligned face's forehead would be)
    const [mx, my] = toMirrorUv(track.fore[0], track.fore[1], va, aspect);
    (u.uMarkUv.value as THREE.Vector2).set(mx, my);
    const markOn = test && (m.phase === 'mark' || m.phase === 'hint' || m.phase === 'ask');
    u.uMark.value += ((markOn ? 1 : 0) - u.uMark.value) * 0.08;
    u.uReach.value += (track.reach - u.uReach.value) * 0.2;
    if (test && m.phase === 'touched') { if (!burstAt.current) burstAt.current = now; } else burstAt.current = 0;
    u.uBurst.value = burstAt.current ? Math.min(1, (now - burstAt.current) / 900) : 0;
    u.uGuide.value = test && (m.phase === 'find' || m.phase === 'loading') && !tracked ? 1 : 0;
    // the brain inside the head at "Now"
    const brainOn = wNow > Math.max(wTest, wHere) && tracked;
    u.uBrain.value += ((brainOn ? 1 : 0) - u.uBrain.value) * 0.05;
    const [bx, by] = toMirrorUv(track.head.x, track.head.y, va, aspect);
    (u.uBrainC.value as THREE.Vector2).set(bx, by);
    // sizes in plane units (x scaled by the mirror's aspect): one uv of x is fx*va image-heights, one of y is fy
    (u.uBrainS.value as THREE.Vector2).set((track.head.w / (fx * va)) * aspect, track.head.h / fy);
    u.uBrainRot.value = track.head.roll;
    // the round light at the end frames the face: a square crop 1.7 face-heights tall, eased so it doesn't jitter
    const want = round && tracked ? 1 : 0;
    u.uCropOn.value += (want - u.uCropOn.value) * 0.06;
    const cs = Math.min(1, track.face.h * 1.7);
    const crop = u.uCrop.value as THREE.Vector4;
    const k = crop.z === 0.5 && crop.w === 0.5 ? 1 : 0.15;
    crop.set(crop.x + (track.face.x - crop.x) * k, crop.y + ((1 - track.face.y) - crop.y) * k, crop.z + (cs / va - crop.z) * k, crop.w + (cs - crop.w) * k);
    if (round) {
      // inside the breathing light at the end
      o.position.copy(LIGHT_AT);
      o.quaternion.copy(camera.quaternion);
      o.scale.set(1.9, 1.9, 1);
    } else {
      // a hand mirror held up beside the text
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const narrow = window.innerWidth < 760;
      o.position.copy(camera.position).addScaledVector(right, narrow ? 0 : 1.2).addScaledVector(up, narrow ? 0.7 : 0.5).addScaledVector(fwd, 3.2);
      o.quaternion.copy(camera.quaternion);
      const h = narrow ? 1.45 : 1.68;
      o.scale.set(h * aspect, h, 1);
    }
  });

  return <mesh ref={mesh} material={mat} renderOrder={1000} frustumCulled={false} visible={false}><planeGeometry args={[1, 1]} /></mesh>;
}
