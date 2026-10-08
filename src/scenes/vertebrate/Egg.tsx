import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, near, smoothstep } from '../../world/util';
import { NOISE, Plankton, TM, Backdrop, useBrain } from './shared';

const BOX: [number, number, number] = [18, 10, 8];

/** egg-shaped lathe profile (y axis) */
function eggGeo(r: number, h: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI; // 0 bottom .. PI top
    const y = -Math.cos(a) * h;
    const taper = 1 - 0.18 * (y / h + 1) * 0.5; // narrower on top
    pts.push(new THREE.Vector2(Math.max(Math.sin(a) * r * taper, 0.0005), y));
  }
  return new THREE.LatheGeometry(pts, 64);
}

function layerMat(color: string, rim: number, base: number, cut: boolean) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC: { value: new THREE.Color(color) }, uOp: { value: 1 }, uRim: { value: rim }, uBase: { value: base }, uCut: { value: 2 }, uTime: { value: 0 }, uSpeck: { value: cut ? 1 : 0 }, uBoost: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
    fragmentShader: /* glsl */ `${NOISE}
      uniform vec3 uC; uniform float uOp,uRim,uBase,uCut,uTime,uSpeck,uBoost; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ if(vP.x*0.3+vP.z*0.95>uCut) discard;
        float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.2);
        float sp=0.; if(uSpeck>0.){ sp=smoothstep(.62,.9,snoise(vP*14.)*.5+.5)*.5; }
        float edge=smoothstep(.05,0.,abs(vP.x*.6+vP.z*.8-uCut))*1.5;
        gl_FragColor=vec4(uC*(uBase+f*uRim+sp+edge)*uBoost*uOp,1.); }`,
  });
}

/** amniote egg: shell, amnion, yolk sac and a curled embryo with a glowing brain; cutaway reveals the inside */
export default function Egg() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const emb = useRef<THREE.Group>(null);
  const { geo, mat } = useBrain(120, 28);
  const S = useMemo(() => {
    const shell = eggGeo(1.45, 1.95), amnion = eggGeo(1.2, 1.62), yolk = new THREE.SphereGeometry(0.72, 48, 32);
    const alla = new THREE.SphereGeometry(0.5, 32, 24);
    const curve = new THREE.CatmullRomCurve3([[-0.4, -0.35, 0], [-0.55, 0.05, 0.05], [-0.3, 0.45, 0.1], [0.1, 0.6, 0.05], [0.45, 0.4, 0], [0.55, 0.05, -0.05], [0.4, -0.25, 0]].map((p) => new THREE.Vector3(...p)));
    const body = new THREE.TubeGeometry(curve, 80, 0.13, 12, false);
    const bodyM = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uOp: { value: 1 }, uPulse: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec3 p=position; p+=normal*(sin(uv.x*3.14159)*.07); vec4 mv=modelViewMatrix*vec4(p,1.); vN=normalize(normalMatrix*normal); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform float uOp,uPulse; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.6); float s=.5+.5*sin(vUv.x*60.); gl_FragColor=vec4(vec3(1.,.55,.5)*(.15+f*.9+s*.08+uPulse*.3)*uOp,1.); }',
    });
    const heart = new THREE.SphereGeometry(0.1, 16, 12);
    return { shell, amnion, yolk, alla, body, bodyM, heart, shellM: layerMat('#e9e2cf', 1.1, 0.03, true), amnM: layerMat('#7fd3ff', 0.9, 0.04, false), yolkM: layerMat('#ffb43c', 1.4, 0.18, false), allaM: layerMat('#ff7ab0', 1.2, 0.04, false),
      heartM: new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uOp: { value: 1 } }, vertexShader: 'void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'uniform float uOp; void main(){ gl_FragColor=vec4(vec3(1.,.3,.25)*1.8*uOp,1.); }' }) };
  }, []);
  useEffect(() => () => {
    S.shell.dispose(); S.amnion.dispose(); S.yolk.dispose(); S.alla.dispose(); S.body.dispose(); S.bodyM.dispose(); S.heart.dispose();
    S.shellM.dispose(); S.amnM.dispose(); S.yolkM.dispose(); S.allaM.dispose(); S.heartM.dispose(); geo.dispose(); mat.dispose();
  }, [S, geo, mat]);
  const p24 = eventPos('amniotes-first-eggs');
  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, tm = TM(), t = scene.t, n = near(p24, 0.8);
    const cut = 2 - smoothstep(0.1, 0.55, t) * 1.9; // slice sweeps away the front of the egg
    for (const m of [S.shellM, S.amnM, S.yolkM, S.allaM]) { m.uniforms.uOp.value = w; m.uniforms.uTime.value = tm; }
    S.shellM.uniforms.uCut.value = cut; S.amnM.uniforms.uCut.value = cut + 0.15 - smoothstep(0.5, 0.9, t) * 0.5;
    S.yolkM.uniforms.uCut.value = 3; S.allaM.uniforms.uCut.value = 3;
    const beat = Math.pow(Math.max(0, Math.sin(tm * 5 + t * 30)), 6);
    S.bodyM.uniforms.uOp.value = w; S.bodyM.uniforms.uPulse.value = beat * 0.5 + n * 0.5;
    S.heartM.uniforms.uOp.value = w * (0.6 + beat * 0.8);
    const u = mat.uniforms; u.uSw.value = 1; u.uFold.value = 0.7; u.uHemi.value = 0.5; u.uWr.value = 0.4; u.uTime.value = tm;
    u.uOpacity.value = w; u.uRim.value = 1.4; u.uBase.value = 0.15; u.uBoost.value = 1 + n * 1.2; u.uSig.value = t * 5;
    if (grp.current) { grp.current.rotation.y = -0.45 + t * 0.9; grp.current.position.y = 0.2 + Math.sin(tm * 0.6) * 0.04; }
    if (emb.current) emb.current.scale.setScalar(0.85 + smoothstep(0.1, 0.8, t) * 0.25);
  });
  return (
    <group>
      <Backdrop top="#4a2a18" bottom="#04030a" ray={0.2} rays={false} />
      <Plankton count={600} box={BOX} color="#ffcf9a" size={0.035} flow={-1.5} drift={[0.05, 0.02, 0]} center={[0, 0, -1]} />
      <group ref={grp} scale={1.25}>
        <mesh geometry={S.shell} material={S.shellM} frustumCulled={false} />
        <mesh geometry={S.amnion} material={S.amnM} frustumCulled={false} />
        <mesh geometry={S.yolk} material={S.yolkM} position={[0, -0.85, 0.1]} />
        <mesh geometry={S.alla} material={S.allaM} position={[0.55, 0.15, -0.5]} scale={[1, 0.85, 1]} />
        <group ref={emb} position={[0, 0.2, 0.05]}>
          <mesh geometry={S.body} material={S.bodyM} frustumCulled={false} />
          <mesh geometry={S.heart} material={S.heartM} position={[0.1, 0.0, 0.14]} />
          <group position={[0.4, -0.25, 0]} rotation={[0, 0, -2.2]} scale={0.14}>
            <mesh geometry={geo} material={mat} frustumCulled={false} position={[-1, 0, 0]} />
          </group>
        </group>
      </group>
    </group>
  );
}
