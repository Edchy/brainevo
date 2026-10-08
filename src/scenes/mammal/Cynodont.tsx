import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { near, eventPos, rng, smoothstep } from '../../world/util';
import { GLSL_NOISE, GLSL_THERMAL, pointMaterial, pointScale } from './kit';

const BODY_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }`;
const BODY_FRAG = /* glsl */ `
uniform float uHeat, uW, uTime, uPulse;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
${GLSL_NOISE}${GLSL_THERMAL}
void main(){
  float fr = pow(1.-abs(dot(vN,vV)),1.5);
  float n = vnoise(vP.xy*5.+vP.z*3.+uTime*.15);
  float h = uHeat*(0.88 - 0.42*fr + 0.22*n) + uPulse*.18;
  gl_FragColor = vec4(thermal(h)*uW, 1.);
}`;
const GROUND_FRAG = /* glsl */ `
uniform float uW, uTime, uHeat;
varying vec2 vUv; varying vec3 vWp;
${GLSL_NOISE}${GLSL_THERMAL}
void main(){
  float n = fbm(vWp.xz*.6 + vec2(uTime*.03,0.));
  float ripple = .5+.5*sin(vWp.x*3.+n*14.+uTime*.6);
  float d = length(vWp.xz-vec2(0.,-1.));
  float warm = uHeat*.26*exp(-d*d*.22); // body warms the ground it stands on
  float h = .03 + n*.06 + ripple*.01 + warm;
  float fog = smoothstep(4., 26., length(vWp.xz-vec2(0.,6.)));
  vec3 c = thermal(h);
  c = mix(c, vec3(.01,.015,.1), fog);
  gl_FragColor = vec4(c*uW, 1.);
}`;
const GROUND_VERT = /* glsl */ `varying vec2 vUv; varying vec3 vWp; void main(){ vUv=uv; vec4 w = modelMatrix*vec4(position,1.); vWp=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;

function makeBody(heat: number) {
  return new THREE.ShaderMaterial({
    vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, toneMapped: false,
    uniforms: { uHeat: { value: heat }, uW: { value: 1 }, uTime: { value: 0 }, uPulse: { value: 0 } },
  });
}

interface BeastProps { mat: THREE.ShaderMaterial; lizard?: boolean; legRefs: React.MutableRefObject<(THREE.Object3D | null)[]> }
function Beast({ mat, lizard, legRefs }: BeastProps) {
  const tail = useMemo(() => {
    const L = lizard ? 1.9 : 1.0;
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.65, 0.05, 0), new THREE.Vector3(-0.65 - L * 0.4, 0.0, 0.1),
      new THREE.Vector3(-0.65 - L * 0.75, -0.1, -0.1), new THREE.Vector3(-0.65 - L, -0.05, 0.1),
    ]);
    return new THREE.TubeGeometry(c, 20, 0.1, 8, false);
  }, [lizard]);
  useEffect(() => () => tail.dispose(), [tail]);
  const legY = lizard ? -0.22 : -0.38;
  const spread = lizard ? 0.42 : 0.2;
  return (
    <group>
      <mesh scale={[1.0, lizard ? 0.28 : 0.42, lizard ? 0.36 : 0.42]} material={mat}><sphereGeometry args={[0.7, 24, 16]} /></mesh>
      <mesh position={[0.78, lizard ? 0.04 : 0.12, 0]} scale={[1, 0.8, 0.8]} material={mat}><sphereGeometry args={[0.3, 20, 14]} /></mesh>
      <mesh position={[1.12, lizard ? 0.02 : 0.08, 0]} rotation={[0, 0, -Math.PI / 2]} material={mat}><coneGeometry args={[0.14, 0.4, 12]} /></mesh>
      {!lizard && <mesh position={[0.74, 0.4, 0.14]} material={mat}><sphereGeometry args={[0.08, 8, 8]} /></mesh>}
      {!lizard && <mesh position={[0.74, 0.4, -0.14]} material={mat}><sphereGeometry args={[0.08, 8, 8]} /></mesh>}
      <mesh geometry={tail} material={mat} />
      {[[0.45, 1], [0.45, -1], [-0.4, 1], [-0.4, -1]].map(([x, s], i) => (
        <group key={i} position={[x, legY * 0.2, s * spread]} ref={(o) => { legRefs.current[i] = o; }}>
          <mesh position={[0, legY * 0.5, lizard ? s * 0.12 : 0]} rotation={[lizard ? s * 0.7 : 0, 0, 0]} material={mat}>
            <capsuleGeometry args={[0.07, Math.abs(legY) * 1.1, 4, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function Cynodont() {
  const scene = useScene();
  const warm = useMemo(() => makeBody(0.1), []);
  const cold = useMemo(() => makeBody(0.1), []);
  const groundMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, toneMapped: false,
    uniforms: { uW: { value: 1 }, uTime: { value: 0 }, uHeat: { value: 0 } },
  }), []);
  const cyno = useRef<THREE.Group>(null);
  const liz = useRef<THREE.Group>(null);
  const legsA = useRef<(THREE.Object3D | null)[]>([]);
  const legsB = useRef<(THREE.Object3D | null)[]>([]);
  const reeds = useRef<THREE.InstancedMesh>(null);

  const reedData = useMemo(() => {
    const r = rng(11); const n = Math.floor(260 * world.quality);
    return Array.from({ length: n }, () => ({ x: (r() - 0.5) * 30, z: -r() * 18 - 1.5, h: 0.8 + r() * 1.8, ph: r() * 6 }));
  }, []);
  const reedMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0a1048', toneMapped: false }), []);

  const heatPts = useMemo(() => {
    const n = Math.floor(900 * world.quality); const r = rng(5);
    const seed = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { seed[i * 4] = r(); seed[i * 4 + 1] = r(); seed[i * 4 + 2] = r(); seed[i * 4 + 3] = r(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW, uHeat; uniform vec3 uOrigin; varying vec3 vCol; varying float vA;
      void main(){
        float life = fract(aSeed.x + uTime*(.12+aSeed.y*.1));
        vec3 p = uOrigin + vec3((aSeed.y-.5)*1.6*(1.-life*.7), -.1 + life*3.2, (aSeed.z-.5)*.9);
        p.x += sin(life*9.+aSeed.w*20.)*.18*life;
        vec4 mv = modelViewMatrix*vec4(p,1.);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = (.07+aSeed.w*.16) * (1.+life) * uScale / -mv.z;
        vCol = mix(vec3(1.,.5,.1), vec3(.6,.1,.5), life);
        vA = uW * uHeat * (1.-life) * smoothstep(0.,.1,life) * .55;
      }`, { uHeat: { value: 0 }, uOrigin: { value: new THREE.Vector3() } });
    return { g, m };
  }, []);
  const mist = useMemo(() => {
    const n = Math.floor(120 * world.quality); const r = rng(9);
    const seed = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { seed[i * 4] = r(); seed[i * 4 + 1] = r(); seed[i * 4 + 2] = r(); seed[i * 4 + 3] = r(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const m = pointMaterial(/* glsl */ `
      attribute vec4 aSeed; uniform float uTime, uScale, uW; varying vec3 vCol; varying float vA;
      void main(){
        vec3 p = vec3((aSeed.x-.5)*30. + sin(uTime*.05+aSeed.w*6.)*1.5, -.6+aSeed.y*.7, -aSeed.z*16.+1.);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (2.+aSeed.w*3.) * uScale / -mv.z;
        vCol = vec3(.12,.1,.5); vA = uW*.16;
      }`, {});
    return { g, m };
  }, []);

  useEffect(() => () => { heatPts.g.dispose(); heatPts.m.dispose(); mist.g.dispose(); mist.m.dispose(); warm.dispose(); cold.dispose(); groundMat.dispose(); reedMat.dispose(); }, [heatPts, mist, warm, cold, groundMat, reedMat]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    if (!scene.active) return;
    const { t, weight: w } = scene;
    const time = world.reduced ? 0 : world.time;
    const k = pointScale(state);
    const beat = near(eventPos('cynodont-endothermy'), 0.9);
    // the cynodont warms from cold blue to white-hot as t advances
    const heat = 0.14 + smoothstep(0.05, 0.8, t) * 0.62;
    warm.uniforms.uHeat.value = heat;
    warm.uniforms.uPulse.value = beat * (0.5 + 0.5 * Math.sin(time * 5));
    cold.uniforms.uHeat.value = 0.14 + 0.06 * Math.sin(t * 3);
    for (const m of [warm, cold, groundMat, heatPts.m, mist.m]) { m.uniforms.uW.value = w; m.uniforms.uTime.value = time; }
    groundMat.uniforms.uHeat.value = heat;
    heatPts.m.uniforms.uScale.value = mist.m.uniforms.uScale.value = k;
    heatPts.m.uniforms.uHeat.value = smoothstep(0.1, 0.7, t);

    const x = -1.3 + t * 2.6;
    const c = cyno.current!, l = liz.current!;
    c.position.set(x, -0.45 + Math.abs(Math.sin(x * 7)) * 0.03, -1);
    c.scale.setScalar(1.35);
    l.position.set(-1.9 + t * 0.4, -0.72, -2.6);
    l.rotation.y = Math.PI * 0.12;
    l.scale.setScalar(1.1);
    for (let i = 0; i < 4; i++) {
      const a = legsA.current[i], b = legsB.current[i];
      if (a) a.rotation.z = Math.sin(x * 7 + (i % 2) * Math.PI + (i > 1 ? 1.2 : 0)) * 0.5;
      if (b) b.rotation.z = Math.sin(t * 3 + (i % 2) * Math.PI) * 0.12 * (1 - smoothstep(0.1, 0.4, t));
    }
    (heatPts.m.uniforms.uOrigin.value as THREE.Vector3).set(x - 0.2, -0.6, -1);

    const rm = reeds.current;
    if (rm) {
      for (let i = 0; i < reedData.length; i++) {
        const d = reedData[i];
        dummy.position.set(d.x, -1 + d.h * 0.5, d.z);
        dummy.rotation.set(0, 0, Math.sin(time * 0.6 + d.ph) * 0.05);
        dummy.scale.set(0.05, d.h, 0.05);
        dummy.updateMatrix(); rm.setMatrixAt(i, dummy.matrix);
      }
      rm.instanceMatrix.needsUpdate = true;
      reedMat.color.setRGB(0.01 * w, 0.03 * w, 0.14 * w);
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, -6]} material={groundMat}><planeGeometry args={[60, 40, 1, 1]} /></mesh>
      <instancedMesh ref={reeds} args={[undefined, undefined, reedData.length]} material={reedMat} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <points geometry={mist.g} material={mist.m} frustumCulled={false} />
      <group ref={liz}><Beast mat={cold} lizard legRefs={legsB} /></group>
      <group ref={cyno}><Beast mat={warm} legRefs={legsA} /></group>
      <points geometry={heatPts.g} material={heatPts.m} frustumCulled={false} />
    </group>
  );
}
