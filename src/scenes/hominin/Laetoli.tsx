import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, lerp, near, rng, smoothstep } from '../../world/util';
import { GLSL_NOISE, makeGlowMat } from './common';
import { Creature } from '../shared/creatures/Creature';
import type { CreatureHandle } from '../shared/creatures/Creature';
import { BIPED_PRESETS } from '../shared/creatures/biped';

const N = 14;
const SC = 1.3;                                      // hero scale
const LUCY = BIPED_PRESETS.lucy;
const STRIDE_W = LUCY.gait.stride * SC;              // world distance per gait cycle
const SWEEP = LUCY.gait.stride * LUCY.gait.duty;
const X0 = -2.1, X1 = 2.2;
const wx = (t: number) => lerp(X0, X1, smoothstep(0.04, 0.96, t));
const tNow = () => (world.reduced ? 0 : world.time);
/** world-space centre of print k (alternating feet; heel strike when the gait phase passes k/2) */
const printX = (k: number) => (k / 2 + 0.0) * STRIDE_W + SC * (0.5 * SWEEP - 0.05 + 0.46 * LUCY.foot) + 0.0;
const printZ = (k: number) => (k % 2 === 0 ? 1 : -1) * LUCY.hipHalf * 0.78 * SC;

export default function Laetoli() {
  const scene = useScene();
  const q = world.quality;
  const hero = useRef<CreatureHandle>(null);
  const grp = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const R = useMemo(() => {
    const r = rng(5);
    const prints = Array.from({ length: N }, () => new THREE.Vector4());
    const ground = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uAlpha: { value: 1 }, uPr: { value: prints }, uL: { value: new THREE.Vector3(0.55, 0.28, -0.78).normalize() }, uSc: { value: SC }, uFoot: { value: LUCY.foot } },
      vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: `${GLSL_NOISE}
        uniform float uAlpha, uSc, uFoot; uniform vec4 uPr[${N}]; uniform vec3 uL; varying vec3 vW; varying float vD;
        float terrain(vec2 p){ return (n3(vec3(p*3.,0.))*.5 + n3(vec3(p*11.,2.))*.3 + n3(vec3(p*47.,5.))*.2)*.012; }
        // footprint height field: a rounded heel + ball + toe pad, sunk with a raised ash lip
        float prints(vec2 p){
          float h = 0.;
          for (int i = 0; i < ${N}; i++){
            vec4 P = uPr[i];
            if (P.z < .001) continue;
            vec2 d = p - P.xy;
            if (abs(d.x) > .22 || abs(d.y) > .13) continue;
            float L = uFoot*uSc;
            vec2 q = vec2(d.x / (L*.52), d.y / (L*.26*(1. - .0*P.w)));
            // heel, narrow mid-foot, ball and five toes (big toe on the medial side)
            float heel = 1. - smoothstep(.55, 1., length((q - vec2(-.62, 0.)) / vec2(.42, .5)));
            float mid  = 1. - smoothstep(.55, 1., length((q - vec2(-.08, P.w*.12)) / vec2(.52, .36)));
            float ball = 1. - smoothstep(.55, 1., length((q - vec2(.42, 0.)) / vec2(.4, .62)));
            float toes = 0.;
            for (int t = 0; t < 5; t++){
              float ft = float(t);
              vec2 c = vec2(.9 - .045*ft*ft*.25 - (t == 0 ? .0 : .03), -P.w*(.46 - ft*.22));
              float rr = t == 0 ? .2 : .12 + .0*ft;
              toes = max(toes, 1. - smoothstep(.5, 1., length(q - c)/rr));
            }
            float pit = max(max(heel, mid*.8), max(ball, toes));
            float s = length(q);
            float arch = mid * (1. - ball);
            float lip = smoothstep(.0, .5, pit) * (1. - smoothstep(.5, 1., pit));
            float toe = toes*.5;
            h += P.z * (-.075*pit + .03*arch*pit + .016*lip - .014*toe);
          }
          return h;
        }
        float H(vec2 p){ return terrain(p) + prints(p); }
        void main(){
          vec2 p = vW.xz;
          float e = .004;
          float h0 = H(p), hx = H(p + vec2(e, 0.)), hz = H(p + vec2(0., e));
          vec3 N = normalize(vec3(-(hx - h0)/e, 1., -(hz - h0)/e));
          float n = n3(vec3(p*5., 1.))*.5 + n3(vec3(p*30., 3.))*.5;
          vec3 base = mix(vec3(.045,.04,.045), vec3(.15,.125,.12), n);
          float ndl = max(dot(N, uL), 0.);
          vec3 warm = vec3(1., .52, .24);
          vec3 c = base * (.2 + ndl*2.6) * mix(vec3(.75,.8,.95), warm, .75);
          // wet ash sheen on the lip, catching the volcano glow
          vec3 V = normalize(cameraPosition - vW);
          float spec = pow(max(dot(reflect(-uL, N), V), 0.), 28.);
          c += warm * spec * .35 * smoothstep(.0, .02, abs(h0 - terrain(p)));
          // pressed prints are a little darker (wet, compacted)
          c *= 1. - clamp(-(h0 - terrain(p))*9., 0., .5);
          c = mix(c, vec3(.085,.034,.024), smoothstep(5., 40., vD));
          gl_FragColor = vec4(c, uAlpha);
        }`,
    });
    const sky = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 1 }, uPulse: { value: 0 } },
      vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `${GLSL_NOISE} uniform float uAlpha, uPulse; varying vec3 vD;
        void main(){
          float h = max(vD.y,0.);
          vec3 c = mix(vec3(.20,.085,.055), vec3(.022,.02,.034), pow(h,.38));
          float cl = n3(vec3(vD.x*5., vD.y*13., vD.z*5.))*.6 + n3(vec3(vD.x*13., vD.y*31., vD.z*13.))*.4;
          c *= .3 + cl * .32;
          vec3 vd = normalize(vec3(.4,.1,-1.));
          float s = max(dot(vD,vd),0.);
          c += vec3(1.,.38,.1) * (pow(s, 26.)*.55 + pow(s, 300.)*1.6) * (1.+uPulse*.4);
          gl_FragColor = vec4(c * (1.-step(vD.y,0.)) * uAlpha * .5, 1.); }`,
    });
    // the volcano (Sadiman): dark cone, glowing crater, plume
    const volGeo = new THREE.ConeGeometry(30, 15, 40, 1, true); volGeo.translate(0, 7.5, 0);
    const volMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true,
      uniforms: { uAlpha: { value: 1 } },
      vertexShader: 'varying float vY; varying vec3 vP; void main(){ vY=position.y; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `${GLSL_NOISE} uniform float uAlpha; varying float vY; varying vec3 vP;
        void main(){
          float n = n3(vec3(vP.x*.3, vP.y*.6, vP.z*.3));
          float glow = pow(smoothstep(11., 15., vY), 2.) * (.6 + .5*n);
          vec3 c = vec3(.018,.014,.02) + vec3(1.,.34,.07) * glow * 1.1 + vec3(.5,.14,.03) * pow(smoothstep(5., 12., vY), 3.) * n * .2;
          gl_FragColor = vec4(c, uAlpha); }`,
    });
    const nA = Math.floor(420 * q), ap = new Float32Array(nA * 3);
    for (let i = 0; i < nA; i++) { ap[i * 3] = -4 + r() * 16; ap[i * 3 + 1] = r() * 7; ap[i * 3 + 2] = -9 + r() * 12; }
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(ap, 3));
    const ashMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: `uniform float uTime; varying float vA; void main(){
        vec3 p = position; p.y = mod(p.y - uTime * .22, 7.); p.x += sin(uTime*.4 + p.y*.8 + position.z)*.4;
        vA = smoothstep(0., 1., p.y) * (1. - smoothstep(5., 7., p.y));
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = 60./-mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(.7,.62,.58)*a*a*vA*.28*uAlpha,1.); }`,
    });
    // embers rising from the crater
    const nE = Math.floor(70 * q), ep = new Float32Array(nE * 4);
    for (let i = 0; i < nE * 4; i++) ep[i] = r();
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nE * 3), 3));
    eg.setAttribute('aS', new THREE.BufferAttribute(ep, 4));
    const emberMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: `attribute vec4 aS; uniform float uTime; varying float vA; void main(){
        float k = fract(aS.y + uTime * (.03 + aS.w * .03));
        vec3 p = vec3((aS.x-.5)*8. * (.3 + k*1.6) + sin(uTime*.7+aS.z*20.)*k*2., k * 30., (aS.z-.5)*5.) + vec3(0., 14., 0.);
        vA = (1. - k) * smoothstep(0., .05, k) * (.6 + .4*sin(uTime*6.+aS.w*50.));
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = 150./-mv.z * (.5 + aS.w); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uAlpha; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=max(0.,1.-d); gl_FragColor=vec4(vec3(2.4,.8,.2)*a*a*vA*uAlpha,1.); }`,
    });
    const glow = makeGlowMat('#ff5a14', 2.4);
    return { prints, ground, sky, volGeo, volMat, ag, ashMat, eg, emberMat, glow };
  }, [q]);
  useEffect(() => () => { R.ground.dispose(); R.sky.dispose(); R.volGeo.dispose(); R.volMat.dispose(); R.ag.dispose(); R.ashMat.dispose(); R.eg.dispose(); R.emberMat.dispose(); R.glow.dispose(); }, [R]);

  const cam = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!scene.active) return;
    const t = scene.t, w = scene.weight, tt = tNow();
    const x = wx(t);
    for (const m of [R.ground, R.sky, R.volMat, R.ashMat, R.emberMat]) m.uniforms.uAlpha.value = w;
    R.glow.uniforms.uAlpha.value = w * 0.7;
    R.ashMat.uniforms.uTime.value = tt; R.emberMat.uniforms.uTime.value = tt;
    R.sky.uniforms.uPulse.value = Math.sin(tt * 0.8) * 0.5 + 0.5;
    const phase = (x - X0) / STRIDE_W;
    if (grp.current) grp.current.position.set(x, 0, 0);
    // footprints: pressed as each heel strike passes; the print stays
    for (let k = 0; k < N; k++) {
      const pk = k / 2, since = phase - pk;
      const press = smoothstep(0.0, 0.3, since);
      R.prints[k].set(printX(k) + X0, printZ(k), press, k % 2 === 0 ? 1 : -1);
    }
    const lucy = near(eventPos('australopithecus-lucy'), 0.6);
    const h = hero.current;
    if (h) {
      h.override.phase = phase;
      h.look.w = w;
      h.look.rimK = 1.7 + lucy * 1.1; h.look.keyK = 0.28 + lucy * 0.25;
      h.state.headYaw = lerp(0.0, 0.85, smoothstep(0.1, 1, lucy)) + Math.sin(tt * 0.5) * 0.06;
      h.state.headPitch = -0.05 + 0.08 * lucy;
      h.state.mouth = 0;
    }
    if (glowRef.current) { glowRef.current.getWorldPosition(cam); }
  });

  return (
    <group>
      <mesh material={R.sky} renderOrder={-10}><sphereGeometry args={[300, 32, 16]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={R.ground} position={[5, 0, -120]}><planeGeometry args={[500, 300, 1, 1]} /></mesh>
      <mesh geometry={R.volGeo} material={R.volMat} position={[26, -0.5, -70]} />
      <mesh ref={glowRef} material={R.glow} position={[26, 14, -68]}><planeGeometry args={[40, 22]} /></mesh>
      <points geometry={R.eg} material={R.emberMat} position={[26, 0, -70]} frustumCulled={false} />
      <points geometry={R.ag} material={R.ashMat} frustumCulled={false} />
      <group ref={grp} position={[X0, 0, 0]}>
        <group scale={SC}>
          <Creature ref={hero} rig="biped" preset="lucy" look={{ rimDir: [0.8, 0.28], keyDir: [-0.3, 0.2, 0.9] }} palette={{ rim: '#ff8a40', key: '#b09078' }} />
        </group>
      </group>
    </group>
  );
}

export const laetoliCamera = (t: number) => {
  const x = wx(t), e = near(eventPos('laetoli-footprints'), 0.45);   // dips to the ground to read the prints themselves
  return { pos: [x + 0.2, lerp(0.7, 1.25, e), lerp(4.3, 2.3, e)] as [number, number, number], look: [x - 0.65, lerp(0.5, 0.05, e), 0] as [number, number, number], fov: 38 };
};
