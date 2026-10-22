import { useSyncExternalStore } from 'react';
import type { FaceLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

/**
 * The mirror: the visitor's own face, painted in oil (src/scenes/shared/Mirror.tsx). Strictly opt-in: the camera only
 * starts from a button press, the image never leaves the device (nothing is recorded or sent), and the stream stops
 * whenever the visitor moves away from the stations that use it; it comes back without asking again when they return.
 *
 * Face and hand tracking (MediaPipe, run on the device; the models are downloaded once) put the red mark on the
 * visitor's real forehead and follow it as they move, see a fingertip reach it, and place the glowing brain inside
 * their head at "Now". If tracking cannot load, the test still works: the mark sits where an aligned face's forehead
 * would be, and the visitor answers with a button.
 */
export type MirrorStatus = 'off' | 'asking' | 'on' | 'denied' | 'unsupported';
/**
 * The mirror test, in order: look into the mirror, the mark appears, "can you find it?", a hint, then (if no touch was
 * seen) a question with buttons; it ends touched (a fingertip reached the mark) or answered (by button).
 */
export type TestPhase = 'loading' | 'find' | 'mark' | 'hint' | 'ask' | 'touched' | 'answered';
export type Tracking = 'off' | 'loading' | 'on' | 'failed';

interface State {
  status: MirrorStatus; video: HTMLVideoElement | null; wanted: boolean;
  phase: TestPhase; tracking: Tracking; face: boolean;
  /** how the visitor answered, if they did by button */
  answer: 'forehead' | 'mirror' | null;
}
let state: State = { status: 'off', video: null, wanted: false, phase: 'loading', tracking: 'off', face: false, answer: null };
let stream: MediaStream | null = null;
let isNear = false;
/** which station's mirror is showing: the test runs only at the mirror-test station */
let testing = false;
const subs = new Set<() => void>();
const set = (p: Partial<State>) => {
  const n = { ...state, ...p };
  if ((Object.keys(p) as (keyof State)[]).every((k) => n[k] === state[k])) return;
  state = n; subs.forEach((f) => f());
};
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const getMirror = () => state;
export const useMirror = () => useSyncExternalStore(subscribe, getMirror);
/** listen to every change (the voice guide follows the mirror test) */
export const onMirror = subscribe;

/** the mirror's shape (width / height); the camera image is cropped to cover it */
export const MIRROR_ASPECT = 0.8;
/** fraction of the camera frame a mirror of this aspect shows, per axis (cover fit) */
export const coverFit = (videoAspect: number, aspect = MIRROR_ASPECT): [number, number] =>
  [Math.min(1, aspect / videoAspect), Math.min(1, videoAspect / aspect)];
/** a point in the camera image (0..1, y down, not mirrored) -> mirror uv (0..1, y up, mirrored, cover-fit) */
export function toMirrorUv(x: number, y: number, videoAspect: number, aspect = MIRROR_ASPECT): [number, number] {
  const [fx, fy] = coverFit(videoAspect, aspect);
  return [0.5 + ((1 - x) - 0.5) / fx, 0.5 + ((1 - y) - 0.5) / fy];
}

/**
 * Live tracking, in camera-image coordinates (0..1, y down, not mirrored). Read every frame by the painted mirror.
 * `fore` is the middle of the forehead, `head` the centre/size/roll of the brain inside the head; `seen` the time (ms)
 * the face was last found.
 */
export const track = {
  fore: [0.5, 0.29] as [number, number],
  head: { x: 0.5, y: 0.3, w: 0.3, h: 0.2, roll: 0 },
  /** the middle of the face and its height (image heights), to frame it at the end */
  face: { x: 0.5, y: 0.42, h: 0.4 },
  seen: 0,
  /** 0..1: how close the nearest fingertip is to the mark (1 = on it) */
  reach: 0,
};

async function start() {
  if (stream || state.status === 'asking') return;
  if (!navigator.mediaDevices?.getUserMedia) { set({ status: 'unsupported' }); return; }
  set({ status: 'asking' });
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    if (!state.wanted) { s.getTracks().forEach((t) => t.stop()); set({ status: 'off' }); return; }
    stream = s;
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.srcObject = s;
    await v.play().catch(() => {});
    set({ status: 'on', video: v });
    loadTrackers();
    loop();
  } catch {
    set({ status: 'denied', wanted: false });
  }
}

function stop(status: MirrorStatus = 'off') {
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if (state.video) state.video.srcObject = null;
  set({ status, video: null, face: false });
}

/** the visitor asked for the mirror */
export function openMirror() { set({ wanted: true }); restartTest(); start(); }
/** the visitor closed it */
export function closeMirror() { set({ wanted: false }); stop(); }
/** start the mirror test again */
export function restartTest() { phaseAt = performance.now(); touchFrames = 0; set({ phase: state.tracking === 'loading' ? 'loading' : 'find', answer: null }); }
/** the visitor's answer, by button */
export function answerTest(a: 'forehead' | 'mirror') { set({ phase: 'answered', answer: a }); }
/** called as the visitor moves: the camera only runs near a station that shows the mirror; `test` = at the mirror test */
export function mirrorNear(near: boolean, test = false) {
  isNear = near;
  if (test !== testing) { testing = test; if (test) restartTest(); }
  if (!state.wanted) return;
  if (near && !stream) start();
  else if (!near && stream) stop();
}

// --- tracking ------------------------------------------------------------------------------------------------------
const MP = '1.0.1'; // keep in step with package.json
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP}/wasm`;
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
let trackers: { face: FaceLandmarker; hand: HandLandmarker } | null = null;
let loading: Promise<void> | null = null;

function loadTrackers() {
  if (trackers || loading) return;
  set({ tracking: 'loading', phase: state.phase === 'loading' || state.phase === 'find' ? 'loading' : state.phase });
  loading = (async () => {
    try {
      const { FilesetResolver, FaceLandmarker, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(WASM);
      const make = async (delegate: 'GPU' | 'CPU') => ({
        face: await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate }, runningMode: 'VIDEO', numFaces: 1 }),
        hand: await HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: HAND_MODEL, delegate }, runningMode: 'VIDEO', numHands: 2 }),
      });
      trackers = await make('GPU').catch(() => make('CPU'));
      set({ tracking: 'on' });
    } catch {
      set({ tracking: 'failed' });
    }
    if (state.phase === 'loading') { phaseAt = performance.now(); set({ phase: 'find' }); }
  })();
}

let raf = 0, lastDetect = 0, phaseAt = 0, faceSince = 0, touchFrames = 0;
const FINGERTIPS = [4, 8, 12, 16, 20];
function loop() {
  cancelAnimationFrame(raf);
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const v = state.video;
    if (!v || v.readyState < 2) return;
    const now = performance.now();
    const va = v.videoWidth / Math.max(1, v.videoHeight) || 4 / 3;
    // detection at ~15 Hz (it is the main cost); hands only while the test is waiting for a touch
    if (trackers && now - lastDetect > 66) {
      lastDetect = now;
      const fr = trackers.face.detectForVideo(v, now);
      const lm = fr.faceLandmarks?.[0];
      if (lm && lm.length > 400) {
        const top = lm[10], chin = lm[152], l = lm[234], r = lm[454], fh = lm[151], eL = lm[33], eR = lm[263];
        const faceW = Math.hypot((r.x - l.x) * va, r.y - l.y), faceH = Math.hypot((chin.x - top.x) * va, chin.y - top.y);
        track.fore = [fh.x, fh.y];
        const roll = Math.atan2(eR.y - eL.y, (eR.x - eL.x) * va);
        // the brain sits behind the forehead, above the eyes: up from the forehead point, along the face's own up
        const ux = Math.sin(roll) / va, uy = -Math.cos(roll);
        const lift = faceH * 0.17; // its lower edge stays above the brows
        track.head = { x: fh.x + ux * lift, y: fh.y + uy * lift, w: faceW * 1.08, h: faceH * 0.62, roll };
        track.face = { x: (top.x + chin.x) / 2, y: (top.y + chin.y) / 2, h: faceH };
        if (!state.face) faceSince = now;
        track.seen = now;
        set({ face: true });
      } else if (now - track.seen > 1500) set({ face: false });

      // (a hand on the forehead can hide the face from the tracker for a moment: keep using where it last was)
      if (testing && (state.phase === 'mark' || state.phase === 'hint' || state.phase === 'ask') && now - track.seen < 2000) {
        const hr = trackers.hand.detectForVideo(v, now);
        const faceW = track.head.w;
        let best = 9;
        for (const hand of hr.landmarks ?? []) for (const i of FINGERTIPS) {
          const p = hand[i];
          if (p) best = Math.min(best, Math.hypot((p.x - track.fore[0]) * va, p.y - track.fore[1]) / Math.max(0.05, faceW));
        }
        track.reach = Math.max(0, Math.min(1, 1 - (best - 0.12) / 0.5));
        // a fingertip within ~a third of a face-width of the mark counts (people touch near it, not on its centre)
        touchFrames = best < 0.38 ? touchFrames + 1 : Math.max(0, touchFrames - 1);
        if (touchFrames >= 2) set({ phase: 'touched' });
      } else track.reach = 0;
    }
    // the test's pacing
    if (!testing) return;
    const el = (now - phaseAt) / 1000;
    const tracked = state.tracking === 'on';
    if (state.phase === 'find' && (state.tracking === 'failed' ? el > 3 : state.face && now - faceSince > 1200)) { phaseAt = now; set({ phase: 'mark' }); }
    else if (state.phase === 'mark' && el > 6) { phaseAt = now; set({ phase: 'hint' }); }
    else if (state.phase === 'hint' && el > (tracked ? 9 : 4)) { phaseAt = now; set({ phase: 'ask' }); }
    // tracking that never finishes loading (offline, blocked) must not leave the visitor waiting: fall back
    if (state.phase === 'loading' && el > 25) { phaseAt = now; set({ tracking: 'failed', phase: 'find' }); }
  };
  raf = requestAnimationFrame(tick);
}

if (typeof document !== 'undefined') {
  // never leave the camera on in a hidden tab
  document.addEventListener('visibilitychange', () => { if (document.hidden && stream) stop(); else if (!document.hidden && state.wanted && isNear && !stream) start(); });
}
