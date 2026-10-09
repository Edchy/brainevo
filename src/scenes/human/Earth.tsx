import * as THREE from 'three';
import { useMemo } from 'react';
import { useEffect } from 'react';
import { world } from '../../world/store';
import { CITIES, LAND, WATER } from './geo';

export const llToVec = (lat: number, lon: number, r = 1): [number, number, number] => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r];
};

const W = 2048, H = 1024;
let mask: Uint8Array | null = null;       // land, row 0 = south pole
let lights: Uint8Array | null = null;
let tex: THREE.DataTexture | null = null;

function rasterise() {
  if (mask && lights) return;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cv = mk(), ctx = cv.getContext('2d', { willReadFrequently: true })!;
  const X = (lon: number) => ((lon + 180) / 360) * W, Y = (lat: number) => ((90 - lat) / 180) * H;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const poly = (p: number[], fill: string) => {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let i = 0; i < p.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p[i]), Y(p[i + 1]));
    ctx.closePath(); ctx.fill();
  };
  for (const p of LAND) poly(p, '#fff');
  for (const p of WATER) poly(p, '#000');
  // Antarctica: an irregular continent south of ~ -70
  const ant: number[] = [];
  for (let lon = -180; lon <= 180; lon += 6) ant.push(lon, -69 - 3 * Math.sin(lon * 0.09) - 2 * Math.sin(lon * 0.31 + 1) - (lon > -70 && lon < -55 ? 7 : 0));
  ant.push(180, -90, -180, -90);
  poly(ant, '#fff');
  // soften the edge slightly (the shader re-sharpens it with noise)
  const sm = mk(), sctx = sm.getContext('2d', { willReadFrequently: true })!;
  sctx.filter = 'blur(1.6px)'; sctx.drawImage(cv, 0, 0); sctx.filter = 'none';
  const img = sctx.getImageData(0, 0, W, H).data;
  mask = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) mask[(H - 1 - j) * W + i] = img[(j * W + i) * 4];
  // city lights: soft clusters with scattered fine points, restricted to land
  const lc = mk(), lctx = lc.getContext('2d', { willReadFrequently: true })!;
  lctx.fillStyle = '#000'; lctx.fillRect(0, 0, W, H);
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (const [lon, lat, k, rad] of CITIES) {
    const cx = X(lon), cy = Y(lat), R = (rad / 360) * W * (1 / Math.max(0.35, Math.cos((lat * Math.PI) / 180)) ** 0.0);
    const g = lctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`); g.addColorStop(0.25, `rgba(255,255,255,${0.35 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    lctx.fillStyle = g; lctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    // fine streets/towns
    for (let n = 0; n < 160 * k; n++) {
      const a = r() * 6.283, d = Math.pow(r(), 1.7) * R * 1.6;
      lctx.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.65})`; lctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, 1.6, 1.6);
    }
  }
  const limg = lctx.getImageData(0, 0, W, H).data;
  lights = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = (H - 1 - j) * W + i;
    const lat = ((H - 1 - j) / H) * 180 - 90;
    lights[k] = lat < -62 ? 0 : (limg[(j * W + i) * 4] * (mask[k] > 140 ? 1 : 0));
  }
}

/** continuous land value; > 0.5 is land (CPU sample of the same raster the globe uses) */
export function landV(lat: number, lon: number) {
  rasterise();
  const u = (((lon + 180) % 360) + 360) % 360 / 360, v = (lat + 90) / 180;
  const x = Math.min(W - 1, Math.max(0, Math.round(u * (W - 1)))), y = Math.min(H - 1, Math.max(0, Math.round(v * (H - 1))));
  return mask![y * W + x] / 255;
}

export function landTexture() {
  if (tex) return tex;
  rasterise();
  const d = new Uint8Array(W * H * 4);
  for (let k = 0; k < W * H; k++) { d[k * 4] = mask![k]; d[k * 4 + 1] = lights![k]; d[k * 4 + 2] = 0; d[k * 4 + 3] = 255; }
  tex = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping; tex.needsUpdate = true;
  return tex;
}

const NOISE = /* glsl */ `
float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float vn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fb(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+17.; a*=.5; } return s; }
`;

export function makeEarthMaterial() {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTex: { value: landTexture() }, uW: { value: 1 }, uDay: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vO; varying vec3 vNv; void main(){vO=normal; vNv=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: /* glsl */ `uniform sampler2D uTex; uniform float uW,uDay,uTime; varying vec3 vO; varying vec3 vNv;
${NOISE}
void main(){
  vec3 n=normalize(vO);
  vec2 uv=vec2(atan(n.x,n.z)/6.28318+.5, asin(clamp(n.y,-1.,1.))/3.14159+.5);
  vec4 t=texture2D(uTex,uv);
  // fractal coastlines: perturb the soft mask only near the shore
  float shore=1.-abs(t.r-.5)*2.;
  float wob=(fb(n*14.)-.5)*.34 + (fb(n*46.)-.5)*.18;
  float v=t.r+wob*shore*shore;
  float land=smoothstep(.47,.53,v);
  vec3 L=normalize(vec3(-.55,.5,.68));
  float ndl=dot(vNv,L);
  float lit=smoothstep(-.12,.45,ndl);
  float night=1.-smoothstep(-.18,.1,ndl);
  // relief: ridged mountains, low plains, polar ice, a hint of desert banding
  float el=fb(n*5.+3.)*.6+fb(n*21.)*.4;
  float ridge=1.-abs(2.*fb(n*9.+7.)-1.);
  float lat=abs(n.y);
  float ice=smoothstep(.86,.95,lat+ (el-.5)*.1);
  vec3 landC=mix(vec3(.02,.028,.022),vec3(.16,.15,.11),pow(el,1.6)*1.4+ridge*ridge*.7);
  landC=mix(landC,vec3(.2,.15,.075),smoothstep(.5,.64,fb(n*3.+11.))*smoothstep(.1,.5,1.-lat)*.8);  // arid belt
  landC=mix(landC,vec3(.5,.55,.62),ice);
  vec3 oceanC=mix(vec3(.004,.012,.03),vec3(.01,.03,.07),smoothstep(.3,.9,fb(n*4.)));
  vec3 base=mix(oceanC,landC,land);
  // specular glint of the sun on the sea
  float glint=pow(max(dot(reflect(-L,vNv),vec3(0.,0.,1.)),0.),70.)*(1.-land);
  // coast: thin bright line where the sea meets the land
  float coast=exp(-pow((v-.5)*18.,2.));
  // thin cloud belts
  vec3 cp=n*3.4+vec3(uTime*.012,0.,0.);
  float cl=smoothstep(.52,.78,fb(cp*vec3(1.,2.4,1.)+fb(cp*2.)*1.6))*(.6+.4*(1.-lat));
  vec3 col=base*(.03+1.0*lit);
  col+=vec3(.9,.95,1.)*glint*.6;
  col+=vec3(.12,.3,.5)*coast*(.25+.75*lit)*.9;
  col=mix(col,vec3(.9,.95,1.)*(.1+.9*lit)*.8,cl*.2*lit);
  // night side: cities
  float cities=t.g*.0039216;
  float city=smoothstep(.05,.9,cities+ (fb(n*90.)-.5)*.35*cities)*night;
  col+=vec3(2.2,1.05,.28)*city*(.55+.45*fb(n*140.+uTime*.02))*.55*land;
  // limb: thin blue edge light
  float rim=pow(1.-max(vNv.z,0.),4.);
  col+=vec3(.05,.2,.5)*rim*(.35+.65*lit)*.9;
  gl_FragColor=vec4(col,uW);
}`,
  });
  m.onBeforeRender = () => { m.uniforms.uTime.value = world.reduced ? 0 : world.time; };
  return m;
}

export function makeAtmoMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uW: { value: 1 } },
    vertexShader: 'varying vec3 vNv; void main(){vNv=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uW; varying vec3 vNv; void main(){
      float z=max(0.,-vNv.z);
      float i=pow(z,3.2)*2.6;                       // thin: only hugs the limb
      float lit=.35+.65*smoothstep(-.5,.7,dot(vec3(-vNv.x,vNv.y,0.),normalize(vec3(.55,.5,0.))));
      gl_FragColor=vec4(vec3(.18,.5,1.5)*lit,i*uW*.55); }`,
  });
}

export function EarthSphere({ mat, atmo }: { mat: THREE.ShaderMaterial; atmo: THREE.ShaderMaterial }) {
  return (
    <group>
      <mesh material={mat}><sphereGeometry args={[1, 128, 96]} /></mesh>
      <mesh material={atmo} scale={1.055}><sphereGeometry args={[1, 64, 48]} /></mesh>
    </group>
  );
}

export function useEarthMats() {
  const mats = useMemo(() => ({ mat: makeEarthMaterial(), atmo: makeAtmoMaterial() }), []);
  useEffect(() => () => { mats.mat.dispose(); mats.atmo.dispose(); }, [mats]);
  return mats;
}
