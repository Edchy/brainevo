import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, rng, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, POINT_FRAG, pxScale, timeNow, useDispose } from './common';

const H = 3.2;
const wallR = (h: number) => 0.55 + 0.7 * Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, h / H)), 0.8));
const WALLR_GLSL = `float wallR(float h){ return .55+.7*sin(3.14159*pow(clamp(h/${H.toFixed(1)},0.,1.),.8)); }`;

const SPONGES: Array<{ pos: [number, number, number]; s: number; rot: number; main?: boolean }> = [
  { pos: [0, -1.3, 0], s: 1, rot: 0.25 * Math.PI, main: true },
  { pos: [-4.2, -1.3, -2.5], s: 0.75, rot: 1.2 },
  { pos: [3.9, -1.3, -3.2], s: 0.6, rot: 2.4 },
  { pos: [-6.5, -1.3, -6], s: 0.9, rot: 3.1 },
];

export default function Sponge() {
  const scene = useScene();
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 28; i++) { const h = (i / 28) * H; pts.push(new THREE.Vector2(wallR(h), h)); }
    return new THREE.LatheGeometry(pts, 64, 0, Math.PI * 1.5);
  }, []);
  const full = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 28; i++) { const h = (i / 28) * H; pts.push(new THREE.Vector2(wallR(h), h)); }
    return new THREE.LatheGeometry(pts, 64);
  }, []);
  const wallMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uFront: { value: 0 }, uAmp: { value: 0 }, uSeed: { value: 0 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP=position; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }',
    fragmentShader: /* glsl */ `uniform float uW,uTime,uFront,uAmp,uSeed; varying vec3 vP; varying vec3 vN; varying vec3 vV; ${NOISE}
      void main(){
        float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.);
        float n=fbm(vP*3.5+uSeed);
        float pore=smoothstep(.58,.66,vnoise(vP*9.+uSeed));
        float inner=gl_FrontFacing?0.:1.;
        vec3 body=mix(vec3(.9,.5,.35),vec3(.55,.28,.5),n)*(.1+.22*n);
        body=mix(body,vec3(.9,.45,.3)*.2,inner);
        float d=length(vP-vec3(.9,.4,.3)*1.);
        float wv=exp(-pow((d-uFront)*1.6,2.))*uAmp;
        vec3 c=body*(1.-pore*.85)+vec3(.9,.5,.4)*f*.3+vec3(.1,.8,1.)*wv*(.5+n)*1.1;
        c+=vec3(.2,.9,1.)*smoothstep(.1,0.,abs(d-uFront*.75)-.02)*uAmp*.2;
        gl_FragColor=vec4(c*uW,1.); }`,
  }), []);
  const seaMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uW: { value: 0 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vP; void main(){vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}',
    fragmentShader: /* glsl */ `varying vec3 vP; uniform float uW,uTime; ${NOISE}
      void main(){ float n=fbm(vP*vec3(.5,1.,.5)); float rip=pow(1.-abs(vnoise(vec3(vP.xz*1.2,uTime*.2))*2.-1.),6.);
       float fade=exp(-length(vP.xz-vec2(0.,-2.))*.09);
       gl_FragColor=vec4((vec3(.05,.13,.16)*(.5+n)+vec3(.2,.5,.55)*rip*.25)*fade*uW,1.); }`,
  }), []);
  const flowGeo = useMemo(() => {
    const r = rng(81), n = Math.floor(1100 * world.quality);
    const a = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) a[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aR', new THREE.BufferAttribute(a, 4));
    return g;
  }, []);
  const flowMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 }, uFlow: { value: 1 } },
    vertexShader: /* glsl */ `uniform float uTime,uPx,uW,uFlow; attribute vec4 aR; varying vec3 vC; varying float vA; ${WALLR_GLSL}
      void main(){
        float s=fract(aR.x+uTime*.07*uFlow*(.7+.6*aR.y));
        float h0=.4+aR.z*2.2; float a=aR.w*6.2832; float wr=wallR(h0);
        vec3 p;
        if(s<.45){ float u=s/.45; float rad=mix(3.4,wr+.05,u*u*(3.-2.*u)); p=vec3(sin(a)*rad,h0,cos(a)*rad); vC=vec3(.5,.8,1.); }
        else { float u=(s-.45)/.55; float rad=mix(wr*.75,0.,pow(u,.6)); float y=h0+u*(${H.toFixed(1)}+.2-h0);
          p=vec3(sin(a)*rad,y,cos(a)*rad); if(u>.9){ p.y+=(u-.9)*10.; p.xz+=vec2(sin(a),cos(a))*(u-.9)*8.*aR.y; }
          vC=mix(vec3(.5,.8,1.),vec3(1.2,.8,.5),u); }
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,.05*(.6+aR.y)*uPx/-mv.z); vA=uW*smoothstep(0.,.08,s)*smoothstep(1.,.85,s)*.8; }`,
    fragmentShader: POINT_FRAG,
  }), []);
  const choGeo = useMemo(() => {
    const r = rng(33), n = Math.floor(380 * world.quality);
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([0.05 + r() * 0.92, r() * Math.PI * 1.5, r()], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aC', new THREE.BufferAttribute(a, 3));
    return g;
  }, []);
  const choMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 500 }, uW: { value: 0 }, uFront: { value: 0 }, uAmp: { value: 0 } },
    vertexShader: /* glsl */ `uniform float uTime,uPx,uW,uFront,uAmp; attribute vec3 aC; varying vec3 vC; varying float vA; ${WALLR_GLSL}
      void main(){ float h=aC.x*${H.toFixed(1)}; float r=wallR(h)-.1; vec3 p=vec3(sin(aC.y)*r,h,cos(aC.y)*r);
        float d=length(p-vec3(.9,.4,.3)); float wv=exp(-pow((d-uFront)*1.6,2.))*uAmp;
        p+=vec3(0.,sin(uTime*6.+aC.z*30.)*.02,0.);
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.,(.07+wv*.1)*uPx/-mv.z);
        vC=mix(vec3(1.3,.8,.5),vec3(.3,1.4,1.5),clamp(wv*2.,0.,1.)); vA=uW*(.4+.6*wv+.3*sin(uTime*3.+aC.z*40.)); }`,
    fragmentShader: POINT_FRAG,
  }), []);
  useDispose(geo, full, wallMat, seaMat, flowGeo, flowMat, choGeo, choMat);

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
    seaMat.uniforms.uW.value = w; seaMat.uniforms.uTime.value = time;
    flowMat.uniforms.uTime.value = time + t * 6; flowMat.uniforms.uPx.value = px; flowMat.uniforms.uW.value = w; flowMat.uniforms.uFlow.value = 0.5 + 0.7 * grow;
    choMat.uniforms.uTime.value = time; choMat.uniforms.uPx.value = px; choMat.uniforms.uW.value = w; choMat.uniforms.uFront.value = front; choMat.uniforms.uAmp.value = amp + pulse * 0.4;
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
          <mesh geometry={sp.main ? geo : full} material={wallMat} frustumCulled={false} />
          {sp.main && (
            <>
              <points geometry={choGeo} material={choMat} frustumCulled={false} />
              <points geometry={flowGeo} material={flowMat} frustumCulled={false} />
            </>
          )}
        </group>
      ))}
    </group>
  );
}
