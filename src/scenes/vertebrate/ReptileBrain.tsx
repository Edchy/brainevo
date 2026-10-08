import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, near, smoothstep } from '../../world/util';
import { NOISE, Plankton, TM, Backdrop, makeTubeMat, useBrain } from './shared';

const BOX: [number, number, number] = [18, 12, 8];

const LAYERS = [
  { name: 'pallium', color: '#6fe08a', y: 1.9, rx: 1.15, rz: 0.8, glow: 0.6 },
  { name: 'basal ganglia', color: '#58b8ff', y: 0.95, rx: 1.5, rz: 1.0, glow: 0.7 },
  { name: 'tectum', color: '#42e8ff', y: 0.0, rx: 1.7, rz: 1.1, glow: 0.7 },
  { name: 'cerebellum', color: '#c06bff', y: -0.95, rx: 1.55, rz: 1.0, glow: 0.7 },
  { name: 'brainstem', color: '#ff8a3c', y: -1.9, rx: 1.8, rz: 1.15, glow: 1.2 },
];

function discMat(color: string, glow: number) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC: { value: new THREE.Color(color) }, uOp: { value: 1 }, uGlow: { value: glow }, uTime: { value: 0 }, uBoost: { value: 1 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv=uv; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */ `${NOISE}
      uniform vec3 uC; uniform float uOp,uGlow,uTime,uBoost; varying vec2 vUv; varying vec3 vP;
      void main(){ vec2 q=vUv*2.-1.; float r=length(q); if(r>1.) discard;
        float rim=smoothstep(.9,1.,r)*smoothstep(1.,.97,r)*2.2; float rings=.5+.5*sin(r*26.-uTime*.8); rings=pow(rings,6.)*.35;
        float tex=smoothstep(.4,.9,snoise(vec3(q*3.,uTime*.05))*.5+.5)*.25;
        float spokes=pow(.5+.5*sin(atan(q.y,q.x)*12.),12.)*.2*smoothstep(.2,.9,r);
        float core=exp(-r*r*14.)*.7;
        vec3 c=uC*(.05+rim+rings+tex+spokes+core)*uGlow*uBoost; gl_FragColor=vec4(c*uOp,1.); }`,
  });
}

/** the reptile brain as an exploded, layered diagram in space; the brainstem "reptile core" glows through the stack */
export default function ReptileBrain() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const layerRefs = useRef<(THREE.Mesh | null)[]>([]);
  const brainRef = useRef<THREE.Mesh>(null);
  const { geo, mat } = useBrain(160, 36);
  const S = useMemo(() => {
    const disc = new THREE.CircleGeometry(1, 72); disc.rotateX(-Math.PI / 2);
    const mats = LAYERS.map((l) => discMat(l.color, l.glow));
    const core = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, -2.4, 0), new THREE.Vector3(0, 2.3, 0)), 120, 0.11, 14, false);
    const coreM = makeTubeMat('#ff9a4a', { base: 0.8, count: 2 });
    coreM.uniforms.uR0.value = 0.11;
    const lines = LAYERS.map((l) => new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(l.rx * 0.95, l.y, 0), new THREE.Vector3(3.6, l.y, 0)), 2, 0.012, 4, false));
    const lineMats = LAYERS.map((l) => makeTubeMat(l.color, { base: 0.9, count: 1 }));
    const dotG = new THREE.SphereGeometry(0.07, 12, 10);
    return { disc, mats, core, coreM, lines, lineMats, dotG };
  }, []);
  useEffect(() => () => {
    S.disc.dispose(); S.mats.forEach((m) => m.dispose()); S.core.dispose(); S.coreM.dispose(); S.lines.forEach((g) => g.dispose()); S.lineMats.forEach((m) => m.dispose()); S.dotG.dispose(); geo.dispose(); mat.dispose();
  }, [S, geo, mat]);
  const p26 = eventPos('reptile-brain-plan');
  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, tm = TM(), n = near(p26, 0.8);
    const ex = smoothstep(0.08, 0.6, t);
    const fadeBrain = 1 - smoothstep(0.05, 0.5, t) * 0.88;
    const u = mat.uniforms;
    u.uSw.value = 1; u.uFold.value = 0.5; u.uHemi.value = 0.3; u.uWr.value = 0.3; u.uTime.value = tm; u.uSig.value = t * 5;
    u.uOpacity.value = w * fadeBrain; u.uRim.value = 1.0; u.uBase.value = 0.07; u.uBoost.value = 1;
    u.uForeC.value.set('#6fe08a'); u.uMidC.value.set('#42e8ff'); u.uHindC.value.set('#ff9a4a');
    S.mats.forEach((m, i) => {
      const k = smoothstep(0.1 + i * 0.03, 0.4 + i * 0.03, t);
      m.uniforms.uOp.value = w * k; m.uniforms.uTime.value = tm;
      m.uniforms.uBoost.value = (i === 4 ? 1 + n * 1.2 + 0.25 * Math.sin(tm * 2.2) : 1 + n * 0.3);
      const mesh = layerRefs.current[i];
      if (mesh) { mesh.position.y = LAYERS[i].y * ex * 0.99 - (1 - ex) * 0; mesh.scale.set(LAYERS[i].rx * (0.5 + 0.5 * ex), 1, LAYERS[i].rz * (0.5 + 0.5 * ex)); }
      S.lineMats[i].uniforms.uOpacity.value = w * smoothstep(0.55, 0.8, t); S.lineMats[i].uniforms.uGrow.value = smoothstep(0.55, 0.8, t); S.lineMats[i].uniforms.uPulseAmt.value = 0;
    });
    S.coreM.uniforms.uOpacity.value = w * smoothstep(0.15, 0.45, t); S.coreM.uniforms.uSig.value = t * 6 + tm * 0.3;
    S.coreM.uniforms.uBoost.value = 1.2 + n * 2.0; S.coreM.uniforms.uBase.value = 0.5 + 0.2 * Math.sin(tm * 2.2) + n * 0.5;
    if (grp.current) grp.current.rotation.y = -0.5 + t * 1.1;
    if (brainRef.current) brainRef.current.scale.setScalar(1);
  });
  return (
    <group>
      <Backdrop top="#0a1a22" bottom="#03050b" ray={0.15} rays={false} />
      <Plankton count={500} box={BOX} color="#9fe8c8" size={0.035} flow={1.5} center={[0, 0, -2]} />
      <group ref={grp} position={[0, 0.2, 0]} scale={1.35}>
        <mesh ref={brainRef} geometry={geo} material={mat} frustumCulled={false} scale={1.1} position={[0, 0, 0]} rotation={[0, 0, 0]} />
        {LAYERS.map((l, i) => (
          <mesh key={l.name} ref={(m) => { layerRefs.current[i] = m; }} geometry={S.disc} material={S.mats[i]} />
        ))}
        <mesh geometry={S.core} material={S.coreM} frustumCulled={false} />
        {LAYERS.map((l, i) => <mesh key={'l' + l.name} geometry={S.lines[i]} material={S.lineMats[i]} frustumCulled={false} />)}
        {LAYERS.map((l, i) => <mesh key={'d' + l.name} geometry={S.dotG} material={S.lineMats[i]} position={[3.6, l.y, 0]} />)}
      </group>
    </group>
  );
}
