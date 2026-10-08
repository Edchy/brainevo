import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, POINT_FRAG, pxScale, timeNow, useDispose } from './common';

const H = 3.2;
/** vase profile: narrow stalk, flaring to an open osculum */
const wallR = (h: number) => { const u = Math.min(1, Math.max(0, h / H)); return 0.36 + 0.78 * Math.pow(u, 0.75) - 0.2 * Math.pow(u, 4); };
const WALLR_GLSL = `float wallR(float h){ float u=clamp(h/${H.toFixed(1)},0.,1.); return .36+.78*pow(u,.75)-.2*pow(u,4.); }`;
const NC = 300;
const SRC = new THREE.Vector3(0.9, 0.4, 0.3);

const SPONGES: Array<{ pos: [number, number, number]; s: number; rot: number; main?: boolean }> = [
  { pos: [0, -1.3, 0], s: 1, rot: 0.25 * Math.PI, main: true },
  { pos: [-4.2, -1.3, -2.5], s: 0.75, rot: 1.2 },
  { pos: [3.9, -1.3, -3.2], s: 0.6, rot: 2.4 },
  { pos: [-6.5, -1.3, -6], s: 0.9, rot: 3.1 },
];

export default function Sponge() {
  const scene = useScene();
  const mkLathe = (sweep: number) => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 44; i++) { const h = (i / 44) * H; pts.push(new THREE.Vector2(wallR(h), h)); }
    return new THREE.LatheGeometry(pts, 96, 0, sweep);
  };
  const geo = useMemo(() => mkLathe(Math.PI * 1.5), []);
  const full = useMemo(() => mkLathe(Math.PI * 2), []);
  const mkLip = (sweep: number) => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; pts.push(new THREE.Vector2(wallR(H) + Math.cos(a) * 0.075, H + Math.sin(a) * 0.075)); }
    return new THREE.LatheGeometry(pts, 96, 0, sweep);
  };
  const lip = useMemo(() => mkLip(Math.PI * 1.5), []);
  const lipFull = useMemo(() => mkLip(Math.PI * 2), []);

  const wallMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide,
    uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uFront: { value: 0 }, uAmp: { value: 0 }, uSeed: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vWP; uniform float uSeed; ${NOISE}
      void main(){
        vUv=uv; vec3 p=position; vec3 nrm=normal;
        float b=fbm(p*vec3(2.4,1.3,2.4)+uSeed)*.55+fbm(p*6.)*.12;
        p.xz*=1.+(b-.3)*.28;
        vP=p; vN=normalize(mat3(modelMatrix)*nrm);
        vec4 wp=modelMatrix*vec4(p,1.); vWP=wp.xyz; vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `uniform float uW,uTime,uFront,uAmp,uSeed; varying vec3 vP; varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vWP; ${NOISE}
      vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
      // returns (F1, F2-F1)
      vec2 worley(vec2 p){ vec2 i=floor(p),f=fract(p); float d1=9.,d2=9.;
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=hash2(i+g); vec2 r=g+o-f; float d=dot(r,r); if(d<d1){d2=d1;d1=d;} else if(d<d2){d2=d;} }
        return vec2(sqrt(d1),sqrt(d2)-sqrt(d1)); }
      void main(){
        bool front=gl_FrontFacing;
        vec3 n=normalize(vN); if(!front) n=-n;
        vec3 V=normalize(vV);
        vec3 L=normalize(vec3(-.4,.8,.5));
        float lit=max(dot(n,L),0.);
        float fr=pow(1.-abs(dot(n,V)),2.2);
        // surface parameterisation: around the vase and up it
        vec2 q=vec2(vUv.x*34.,vUv.y*18.)+uSeed*3.;
        vec2 w=worley(q);
        float pore=smoothstep(.27,.16,w.x);                // ostia: incurrent pores
        float fibre=smoothstep(.2,.0,w.y)*(1.-pore);        // reticulate spongin net
        float n1=fbm(vP*vec3(3.,2.,3.)+uSeed);
        float wv=0.; float d=length(vP-vec3(.9,.4,.3)); wv=exp(-pow((d-uFront)*1.6,2.))*uAmp;
        vec3 flesh=mix(vec3(.62,.28,.22),vec3(.95,.55,.32),n1);
        vec3 col;
        if(front){
          col=flesh*(.16+.8*lit)*(.75+.5*n1);
          col=mix(col,vec3(1.,.72,.45)*(.22+.55*lit),fibre*.7);
          col*=1.-pore*.9;
          col+=vec3(1.1,.5,.25)*pore*.35*(.5+.5*sin(uTime*2.+q.x));  // warm light seen through ostia
          col+=vec3(.75,.55,.45)*fr*.35;
        } else {
          // inside: lit chambers (choanocyte chambers) glowing from within
          vec2 w2=worley(vec2(vUv.x*22.,vUv.y*13.)+5.+uSeed);
          float chamber=smoothstep(.45,.15,w2.x);
          vec3 inner=mix(vec3(.18,.08,.1),vec3(.9,.4,.3),n1)*.55;
          col=inner*(.5+.6*lit)+vec3(.25,.7,.8)*chamber*.5+vec3(.85,.4,.25)*pow(w2.y,.7)*.05;
          col+=vec3(.2,.8,1.)*chamber*wv*.9;
        }
        col+=vec3(.1,.8,1.)*wv*(.35+n1)*.8*(front?.6:1.);
        float fog=smoothstep(6.,22.,length(cameraPosition-vWP));
        col=mix(col,vec3(.02,.1,.14),fog*.6);
        gl_FragColor=vec4(col*uW,uW); }`,
  }), []);

  const lipMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.75, 0.45), transparent: true, toneMapped: false }), []);

  const seaMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uW: { value: 0 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vP; void main(){vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}',
    fragmentShader: /* glsl */ `varying vec3 vP; uniform float uW,uTime; ${NOISE}
      void main(){ float n=fbm(vP*vec3(.5,1.,.5)); float rip=pow(1.-abs(vnoise(vec3(vP.xz*1.2,uTime*.2))*2.-1.),6.);
       float fade=exp(-length(vP.xz-vec2(0.,-2.))*.09);
       gl_FragColor=vec4((vec3(.05,.13,.16)*(.5+n)+vec3(.2,.5,.55)*rip*.25)*fade*uW,1.); }`,
  }), []);

  // water currents: in through pores, up the atrium, jetting out of the osculum. 3-point trails read as streaks.
  const flowGeo = useMemo(() => {
    const r = rng(81), n = Math.floor(1000 * world.quality);
    const a = new Float32Array(n * 3 * 4), t = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const b = [r(), r(), r(), r()]; for (let k = 0; k < 3; k++) { a.set(b, (i * 3 + k) * 4); t[i * 3 + k] = k; } }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 9), 3));
    g.setAttribute('aR', new THREE.BufferAttribute(a, 4));
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    return g;
  }, []);
  const flowMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 }, uFlow: { value: 1 } },
    vertexShader: /* glsl */ `uniform float uTime,uPx,uW,uFlow; attribute vec4 aR; attribute float aT; varying vec3 vC; varying float vA; ${WALLR_GLSL}
      void main(){
        float s=fract(aR.x+uTime*.075*uFlow*(.7+.6*aR.y)-aT*.011);
        float h0=.3+aR.z*2.3; float a=aR.w*6.2832*.75; float wr=wallR(h0);
        vec3 p;
        if(s<.42){ float u=s/.42; float rad=mix(3.6,wr+.04,u*u*(3.-2.*u)); p=vec3(sin(a)*rad,h0+sin(u*3.)*.15,cos(a)*rad); vC=vec3(.45,.85,1.15); }
        else { float u=(s-.42)/.58; float rad=mix(wr*.8,.08,pow(u,.55)); float y=h0+pow(u,1.3)*(${H.toFixed(1)}+.1-h0);
          float sw=a+u*3.+aR.y*2.;
          p=vec3(sin(sw)*rad,y,cos(sw)*rad);
          if(u>.9){ float j=(u-.9)*10.; p.y+=j*j*1.6; p.xz+=vec2(sin(a),cos(a))*j*(.5+aR.y)*1.3; }
          vC=mix(vec3(.45,.85,1.15),vec3(1.5,.85,.5),smoothstep(.2,1.,u)); }
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.5,.1*(.6+aR.y)*(1.-.22*aT)*uPx/-mv.z); vA=uW*smoothstep(0.,.06,s)*smoothstep(1.,.88,s)*(1.-.3*aT)*1.1; }`,
    fragmentShader: POINT_FRAG,
  }), []);

  // choanocytes: flagellated collar cells lining the atrium wall
  const collar = useMemo(() => {
    const body = new THREE.SphereGeometry(0.03, 10, 8);
    const cone = new THREE.ConeGeometry(0.048, 0.075, 10, 1, true); cone.rotateX(Math.PI); cone.translate(0, 0.07, 0);
    const flag = new THREE.CylinderGeometry(0.004, 0.002, 0.2, 5); flag.translate(0, 0.2, 0);
    const g = mergeGeometries([body, cone, flag])!;
    body.dispose(); cone.dispose(); flag.dispose();
    return g;
  }, []);
  const collarMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), []);
  const collarData = useMemo(() => {
    const r = rng(33), n = Math.floor(NC * Math.max(0.5, world.quality));
    const pos: THREE.Vector3[] = [], mats: THREE.Matrix4[] = [];
    const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), s = new THREE.Vector3(), m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const h = (0.06 + r() * 0.9) * H, ph = r() * Math.PI * 1.5, rad = wallR(h) - 0.06;
      const p = new THREE.Vector3(Math.sin(ph) * rad, h, Math.cos(ph) * rad);
      const dir = new THREE.Vector3(-Math.sin(ph), 0.25, -Math.cos(ph)).normalize();
      q.setFromUnitVectors(up, dir); s.setScalar(1.5 + r() * 0.7);
      m.compose(p, q, s); pos.push(p); mats.push(m.clone());
    }
    return { pos, mats };
  }, []);
  const collarRef = useRef<THREE.InstancedMesh>(null);
  const colTmp = useMemo(() => new THREE.Color(), []);
  useDispose(geo, full, lip, lipFull, wallMat, lipMat, seaMat, flowGeo, flowMat, collar, collarMat);

  const groups = useMemo(() => SPONGES.map(() => ({ current: null as THREE.Group | null })), []);
  useFrame((state) => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, time = timeNow(), px = pxScale(state);
    const pulse = near(eventPos('sponges-no-neurons'), 0.7);
    const grow = 0.35 + 0.65 * smoothstep(0, 0.5, t);
    const amp = 0.35 + 0.65 * smoothstep(0.2, 0.55, t);
    wallMat.uniforms.uW.value = w; wallMat.uniforms.uTime.value = time;
    const front = ((t * 4.5) % 1) * 3.8;
    wallMat.uniforms.uFront.value = front; wallMat.uniforms.uAmp.value = amp + pulse * 0.4;
    lipMat.opacity = w; collarMat.opacity = w;
    seaMat.uniforms.uW.value = w; seaMat.uniforms.uTime.value = time;
    flowMat.uniforms.uTime.value = time + t * 6; flowMat.uniforms.uPx.value = px; flowMat.uniforms.uW.value = w; flowMat.uniforms.uFlow.value = 0.5 + 0.7 * grow;
    const C = collarRef.current;
    if (C) {
      const A = amp + pulse * 0.4;
      for (let i = 0; i < collarData.pos.length; i++) {
        const d = collarData.pos[i].distanceTo(SRC);
        const wv = Math.exp(-Math.pow((d - front) * 1.6, 2)) * A;
        const beat = 0.5 + 0.5 * Math.sin(time * 6 + i * 1.7);
        colTmp.setRGB(0.25 + wv * 1.6 + beat * 0.12, 0.6 + wv * 1.9, 0.7 + wv * 1.8);
        C.setColorAt(i, colTmp);
      }
      if (C.instanceColor) C.instanceColor.needsUpdate = true;
    }
    SPONGES.forEach((sp, i) => {
      const g = groups[i].current; if (!g) return;
      const k = sp.s * (sp.main ? grow : 0.5 + 0.5 * grow);
      g.scale.setScalar(k);
      g.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
      g.rotation.y = sp.rot + Math.sin(time * 0.3 + i) * 0.01;
    });
  });

  return (
    <group>
      <Backdrop color="#35a8c0" caustics={0.5} shafts={0.5} haze={0.15} z={-16} />
      <mesh material={seaMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, -4]} frustumCulled={false}>
        <planeGeometry args={[60, 40, 1, 1]} />
      </mesh>
      <Plankton count={900} box={[24, 12, 14]} color="#9fe4ff" size={0.04} dir={[0.04, 0.03, 0]} />
      {SPONGES.map((sp, i) => (
        <group key={i} ref={(g) => { groups[i].current = g; }}>
          <mesh geometry={sp.main ? geo : full} material={wallMat} frustumCulled={false} onBeforeRender={() => { wallMat.uniforms.uSeed.value = i * 3.7; }} />
          <mesh geometry={sp.main ? lip : lipFull} material={lipMat} frustumCulled={false} />
          {sp.main && (
            <>
              <instancedMesh ref={(m) => { collarRef.current = m; if (m && !m.userData.init) { collarData.mats.forEach((mm, k) => m.setMatrixAt(k, mm)); m.instanceMatrix.needsUpdate = true; m.userData.init = true; } }}
                args={[collar, collarMat, collarData.mats.length]} frustumCulled={false} />
              <points geometry={flowGeo} material={flowMat} frustumCulled={false} />
            </>
          )}
        </group>
      ))}
    </group>
  );
}
