import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { eventPos, near, range, smoothstep } from '../../world/util';
import { Backdrop, Plankton, TM } from './shared';

const BOX: [number, number, number] = [22, 10, 6];
const N = 9, X0 = -5.4, DX = 1.35, AY = 1.0, BY = -1.7;

function axonMat(color: string, wide: number) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: new THREE.Color(color) }, uOp: { value: 1 }, uXs: { value: -9 }, uAmp: { value: 1 }, uWide: { value: wide }, uNodes: { value: 1 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
    fragmentShader: /* glsl */ `
      uniform vec3 uC; uniform float uOp,uXs,uAmp,uWide,uNodes; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),1.4);
        float d=vP.x-uXs; float g=exp(-d*d/uWide);
        float tail=exp(-max(-d,0.)*.9)*step(d,0.)*.25; // faint trail behind the spike
        vec3 c=uC*(.18+f*.5)+vec3(1.,.82,.4)*(g*1.8+tail*.4)*uAmp*(.4+f)+vec3(1.)*g*g*.6*uAmp;
        gl_FragColor=vec4(c*uOp,1.); }`,
  });
}

function sheathMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uWrap: { value: 0 }, uOp: { value: 1 }, uGlow: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uWrap; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec3 p=position; float k=mix(.33,1.,uWrap); p.yz*=k; p.x*=mix(.15,1.,smoothstep(0.,.6,uWrap)); vP=p;
        vec4 mv=modelViewMatrix*vec4(p,1.); vN=normalize(normalMatrix*vec3(0.,position.y,position.z)); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uWrap,uOp,uGlow; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.);
        float ang=atan(vP.y,vP.z); float sp=.5+.5*sin(ang*2.+vP.x*14.); float lam=.5+.5*sin(length(vP.yz)*90.+vP.x*2.);
        vec3 c=vec3(1.,.82,.5)*(.04+f*.7+sp*.12*uWrap+lam*.05)+vec3(.5,.9,1.)*uGlow*.12;
        gl_FragColor=vec4(c*uOp*smoothstep(0.,.1,uWrap),1.); }`,
  });
}

/** zoomed axon: myelin sheath segments wrap; the spike leaps node to node, racing a bare axon */
export default function Myelin() {
  const scene = useScene();
  const S = useMemo(() => {
    const len = (N - 1) * DX + 1.5;
    const mk = (y: number, r: number) => new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(X0 - 0.6, y, 0), new THREE.Vector3(X0 - 0.6 + len, y, 0)), 220, r, 14, false);
    const prof: THREE.Vector2[] = [];
    const L = DX - 0.22;
    for (let i = 0; i <= 28; i++) {
      const u = i / 28, x = (u - 0.5) * L;
      const e = Math.min(u, 1 - u) * 28 / 3; // rounded paranodal ends
      prof.push(new THREE.Vector2(0.36 * Math.sqrt(Math.min(1, e) * (2 - Math.min(1, e))) + 0.001, x));
    }
    const sheathG = new THREE.LatheGeometry(prof, 36);
    sheathG.rotateZ(-Math.PI / 2);
    return { axA: mk(AY, 0.12), axB: mk(BY, 0.12), sheathG, aM: axonMat('#3fd0ff', 0.12), bM: axonMat('#ff7a5a', 0.6), sheaths: Array.from({ length: N }, sheathMat) };
  }, []);
  useEffect(() => () => { S.axA.dispose(); S.axB.dispose(); S.sheathG.dispose(); S.aM.dispose(); S.bM.dispose(); S.sheaths.forEach((m) => m.dispose()); }, [S]);
  const p21 = eventPos('myelin-jawed-fish');
  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, t = scene.t, n = near(p21, 0.8);
    const wrap = range(0.05, 0.45, t);
    const cyc = (range(0.3, 1, t) * 2.4) % 1;
    const run = range(0.3, 0.34, t);
    const arrive = 1 - smoothstep(0.4, 0.5, cyc);
    // saltatory: node index m jumps quickly between nodes
    const pm = Math.min(1, cyc / 0.4) * (N - 1);
    const k = Math.min(N - 2, Math.floor(pm)), fr = pm - k;
    const leap = smoothstep(0.0, 0.3, fr);
    const xs = X0 + (k + leap) * DX;
    S.aM.uniforms.uXs.value = run > 0 ? xs : -20; S.aM.uniforms.uAmp.value = run * arrive * (1 + n * 0.5); S.aM.uniforms.uOp.value = w;
    S.bM.uniforms.uXs.value = run > 0 ? X0 + cyc * (N - 1) * DX : -20; S.bM.uniforms.uAmp.value = run * 0.9; S.bM.uniforms.uOp.value = w;
    S.sheaths.forEach((m, i) => {
      const wi = smoothstep(i * 0.07, i * 0.07 + 0.45, wrap);
      m.uniforms.uWrap.value = wi; m.uniforms.uOp.value = w;
      const nodeX = X0 + (i + 0.5) * DX;
      m.uniforms.uGlow.value = run * arrive * Math.exp(-Math.pow(xs - nodeX, 2) / 0.8);
    });
    void TM;
  });
  return (
    <group>
      <Backdrop top="#0d3b3a" bottom="#02070a" ray={0.25} />
      <Plankton count={700} box={BOX} color="#9fe8ff" size={0.035} flow={-2.5} drift={[0.0, 0.03, 0]} center={[0, 0, -1]} />
      <mesh geometry={S.axA} material={S.aM} frustumCulled={false} />
      {S.sheaths.map((m, i) => <mesh key={i} geometry={S.sheathG} material={m} position={[X0 + (i + 0.5) * DX, AY, 0]} frustumCulled={false} />)}
      <mesh geometry={S.axB} material={S.bM} frustumCulled={false} />
    </group>
  );
}
