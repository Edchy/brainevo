import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, smoothstep } from '../../world/util';
import { makeGlowMat, Shell } from './common';
import { Brain, stageGrow, useBrainCtl } from '../shared/brain';

const MOUTH = new THREE.Vector3(2.15, -0.55, 0);

export default function Broca() {
  const scene = useScene();
  const brain = useBrainCtl({ grow: stageGrow('hominin') * 1.04, tissue: '#d8d0cc' });
  const regs = useMemo(() => [
    { at: 'broca' as const, color: '#ffa31c', i: 0 },
    { at: 'motor' as const, color: '#ffd05a', i: 0 },
  ], []);
  brain.regions = regs;
  const shell = useMemo(() => ({ alpha: 0.4 }), []);
  const larynx = useMemo(() => ({ m: null as THREE.Mesh | null }), []);
  const R = useMemo(() => {
    const tract = new THREE.CatmullRomCurve3([new THREE.Vector3(0.1, -1.7, 0), new THREE.Vector3(0.15, -1.05, 0), new THREE.Vector3(0.45, -0.62, 0), new THREE.Vector3(1.1, -0.5, 0), MOUTH.clone()]);
    const motor = new THREE.CatmullRomCurve3([new THREE.Vector3(1.6, 1.3, 0.3), new THREE.Vector3(1.85, 0.55, 0.3), new THREE.Vector3(2.0, -0.2, 0.15), MOUTH.clone().add(new THREE.Vector3(-0.08, 0.05, 0))]);
    const mk = (c: THREE.CatmullRomCurve3, r: number) => new THREE.TubeGeometry(c, 140, r, 10);
    const tg = mk(tract, 0.075), mg = mk(motor, 0.025);
    const pulseMat = (col: [number, number, number]) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 1 }, uPh: { value: 0 }, uAmp: { value: 0 }, uC: { value: new THREE.Vector3(...col) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vU; void main(){ vU=uv.x; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: `uniform float uAlpha,uPh,uAmp; uniform vec3 uC; varying vec3 vN; varying vec3 vV; varying float vU;
        void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.5); float p=pow(.5+.5*sin(vU*26.-uPh),6.);
          gl_FragColor=vec4(uC*(.12+f*.6+p*uAmp*2.)*uAlpha,1.); }`,
    });
    const tm = pulseMat([1, .65, .35]), mm = pulseMat([1.1, .8, .4]);
    const waves = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 0 }, uPh: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uAlpha,uPh; varying vec2 vUv;
        void main(){ vec2 p=(vUv-.5)*10.; float r=length(p); float a=atan(p.y,p.x);
          float ring=pow(.5+.5*sin(r*5.5-uPh),4.); float env=exp(-r*.3)*smoothstep(.15,.8,r)*smoothstep(5.,3.6,r);
          float cone=.35+.65*exp(-a*a*.5);
          float mod2=.6+.4*sin(r*1.3-uPh*.25);
          vec3 c=mix(vec3(.4,.8,1.),vec3(1.,.7,.35),smoothstep(0.,5.,r));
          gl_FragColor=vec4(c*ring*env*cone*mod2*uAlpha*1.4,1.); }`,
    });
    const orb = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, .7), toneMapped: false, transparent: true });
    const halo = makeGlowMat('#ffa050', 2);
    const skin = new THREE.LineBasicMaterial({ color: new THREE.Color(.5, .8, 1.2), transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const face = new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.55, 1.1, 0), new THREE.Vector3(1.95, 0.45, 0), new THREE.Vector3(2.05, -0.15, 0), new THREE.Vector3(2.3, -0.5, 0), new THREE.Vector3(2.1, -0.8, 0),
      new THREE.Vector3(1.6, -1.4, 0), new THREE.Vector3(0.9, -1.75, 0), new THREE.Vector3(0.1, -2.2, 0),
    ]).getPoints(80));
    return { tg, mg, tm, mm, waves, orb, halo, skin, face, faceLine: new THREE.Line(face, skin) };
  }, []);
  useEffect(() => () => { R.tg.dispose(); R.mg.dispose(); R.tm.dispose(); R.mm.dispose(); R.waves.dispose(); R.orb.dispose(); R.halo.dispose(); R.skin.dispose(); R.face.dispose(); }, [R]);

  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = world.reduced ? 0 : world.time;
    const ev = near(eventPos('broca-vocal-tract'), 0.7);
    const on = smoothstep(0.3, 0.62, t);
    const ph = t * 60 + tm * 2;
    brain.alpha = w; brain.size = 0.95; regs[0].i = (on * (0.8 + 0.3 * Math.sin(ph * 0.6)) + ev * 0.6) * 2.0; regs[1].i = on * 0.5 * (0.7 + 0.3 * Math.sin(ph * 0.9)); shell.alpha = w * 0.05;
    for (const m of [R.tm, R.mm]) { m.uniforms.uAlpha.value = w; m.uniforms.uPh.value = ph * 0.5; m.uniforms.uAmp.value = on; }
    R.waves.uniforms.uAlpha.value = w * on * 0.45; R.waves.uniforms.uPh.value = ph;
    R.skin.opacity = 0;
    const ly = lerp(-1.25, -1.75, smoothstep(0.05, 0.55, t));
    if (larynx.m) { larynx.m.position.set(0.1, ly, 0); larynx.m.scale.setScalar((0.1 + ev * 0.04) * w); }
    R.halo.uniforms.uAlpha.value = w * (0.2 + 0.5 * on);
  });

  return (
    <group>
      <group position={[0.4, 1.2, 0]}><Brain ctl={brain} /><Shell ctl={shell} scale={[2.6, 1.9, 1.9]} /></group>
      <mesh geometry={R.tg} material={R.tm} frustumCulled={false} />
      <mesh geometry={R.mg} material={R.mm} frustumCulled={false} />
      <primitive object={R.faceLine} />
      <mesh ref={(m) => { larynx.m = m; }} material={R.orb}><sphereGeometry args={[1, 18, 12]} /></mesh>
      <mesh position={[MOUTH.x, MOUTH.y, 0.1]} material={R.waves} renderOrder={5}><planeGeometry args={[10, 10]} /></mesh>
      <mesh position={[MOUTH.x, MOUTH.y, 0.2]} material={R.halo}><planeGeometry args={[1.2, 1.2]} /></mesh>
    </group>
  );
}

export const brocaCamera = (t: number) => ({ pos: [0.5 + Math.sin(t * 2) * 0.3, 0.3, 7.6] as [number, number, number], look: [0.5, 0.05, 0] as [number, number, number], fov: 52 });
