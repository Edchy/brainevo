import * as THREE from 'three';
import { useMemo } from 'react';
import { useEffect } from 'react';

// Stylised continents: lat, lon, radius lat, radius lon (degrees). Noise-warped; not a survey map.
const BLOBS: [number, number, number, number][] = [
  [8, 20, 30, 24], [-18, 24, 18, 14], [30, 8, 9, 22], [8, 43, 8, 7], [-3, 36, 8, 6],
  [55, 85, 20, 70], [48, 20, 11, 24], [40, 100, 16, 40], [22, 80, 12, 9], [15, 102, 12, 8], [35, 135, 8, 6],
  [60, 15, 10, 10], [25, 48, 12, 10], [-3, 115, 5, 12], [-2, 135, 4, 10], [54, -2, 5, 3], [38, 30, 7, 14],
  [-25, 134, 12, 20], [-42, 172, 6, 5],
  [50, -100, 22, 35], [65, -110, 12, 35], [22, -102, 12, 12], [38, -80, 12, 10], [72, -40, 10, 18], [64, -150, 7, 12],
  [-12, -60, 25, 15], [6, -66, 10, 12], [-40, -68, 15, 6],
];

const h3 = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const sm = (t: number) => t * t * (3 - 2 * t);
export function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = sm(x - ix), fy = sm(y - iy), fz = sm(z - iz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(h3(ix, iy, iz), h3(ix + 1, iy, iz), fx), l(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), fx), fy),
    l(l(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), fx), l(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), fx), fy),
    fz,
  );
}

export const llToVec = (lat: number, lon: number, r = 1): [number, number, number] => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r];
};

/** continuous land value; > 0.5 is land */
export function landV(lat: number, lon: number) {
  let v = 0;
  for (const [la, lo, rla, rlo] of BLOBS) {
    const dl = ((lon - lo + 540) % 360) - 180;
    const d = Math.hypot((lat - la) / rla, dl / rlo);
    v = Math.max(v, 1 - d);
  }
  if (lat < -72) v = Math.max(v, (-72 - lat) / 8 + 0.3);
  const p = llToVec(lat, lon, 1);
  const n = noise3(p[0] * 4, p[1] * 4, p[2] * 4) * 0.6 + noise3(p[0] * 11, p[1] * 11, p[2] * 11) * 0.25 - 0.4;
  v += n * 0.7;
  return Math.min(1, Math.max(0, 0.5 + (v - 0.18) * 1.4));
}

let tex: THREE.DataTexture | null = null;
export function landTexture() {
  if (tex) return tex;
  const W = 512, H = 256;
  const d = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const lat = (j / (H - 1)) * 180 - 90, lon = (i / W) * 360 - 180;
    const v = landV(lat, lon);
    const k = (j * W + i) * 4;
    d[k] = d[k + 1] = d[k + 2] = Math.round(v * 255); d[k + 3] = 255;
  }
  tex = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping; tex.needsUpdate = true;
  return tex;
}

export function makeEarthMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTex: { value: landTexture() }, uW: { value: 1 }, uDay: { value: 0 } },
    vertexShader: 'varying vec3 vO; varying vec3 vNv; void main(){vO=normal; vNv=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: /* glsl */ `uniform sampler2D uTex; uniform float uW,uDay; varying vec3 vO; varying vec3 vNv;
void main(){
  vec3 n=normalize(vO);
  vec2 uv=vec2(atan(n.x,n.z)/6.28318+.5, asin(n.y)/3.14159+.5);
  float v=texture2D(uTex,uv).r;
  float land=smoothstep(.47,.53,v);
  float edge=(1.-smoothstep(0.,.03,abs(v-.5)))*.9;
  float rim=smoothstep(.86,1.,1.-abs(vNv.z));
  float lit=.35+.65*smoothstep(-.3,.9,dot(vNv,normalize(vec3(-.5,.6,.7))));
  vec3 c=vec3(.004,.01,.03)+land*vec3(.02,.07,.08)*lit;
  c+=edge*vec3(.04,.3,.42)*(.4+.6*lit);
  c+=rim*vec3(.08,.12,.2);
  gl_FragColor=vec4(c,uW);
}`,
  });
}

export function makeAtmoMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uW: { value: 1 } },
    vertexShader: 'varying vec3 vNv; void main(){vNv=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float uW; varying vec3 vNv; void main(){ float i=pow(max(0.,-vNv.z),2.5)*5.; gl_FragColor=vec4(vec3(.25,.55,1.6),i*uW); }',
  });
}

export function EarthSphere({ mat, atmo }: { mat: THREE.ShaderMaterial; atmo: THREE.ShaderMaterial }) {
  return (
    <group>
      <mesh material={mat}><sphereGeometry args={[1, 96, 64]} /></mesh>
      <mesh material={atmo} scale={1.14}><sphereGeometry args={[1, 48, 32]} /></mesh>
    </group>
  );
}

export function useEarthMats() {
  const mats = useMemo(() => ({ mat: makeEarthMaterial(), atmo: makeAtmoMaterial() }), []);
  useEffect(() => () => { mats.mat.dispose(); mats.atmo.dispose(); }, [mats]);
  return mats;
}
