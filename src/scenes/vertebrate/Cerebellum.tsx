import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, smoothstep } from '../../world/util';
import { Backdrop, NOISE, Plankton, TM, makeBodyMat, useBrain } from './shared';

const BOX: [number, number, number] = [20, 11, 8];

function foliaMat() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOp: { value: 1 }, uGrow: { value: 0 }, uSig: { value: 0 }, uTime: { value: 0 }, uBoost: { value: 1 } },
    vertexShader: /* glsl */ `${NOISE}
      uniform float uGrow,uTime; varying float vR; varying float vY; varying vec3 vN; varying vec3 vV; varying float vX;
      void main(){ vec3 p=position; float n=snoise(vec3(p.x*1.3,p.y*0.4,p.z*1.3))*.35;
        float ph=p.y*58.+n*3.; float rid=sin(ph); float sharp=1.-abs(rid);
        float amp=.011*uGrow; vec3 nn=normalize(position+vec3(0.,.001,0.));
        p+=nn*(rid*amp); vR=rid*.5+.5; vY=p.y; vX=p.x;
        p=vec3(p.x*1.7,p.y*.95,p.z*1.35);
        vec4 mv=modelViewMatrix*vec4(p,1.); vN=normalize(normalMatrix*nn); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uOp,uSig,uBoost; varying float vR; varying float vY; varying vec3 vN; varying vec3 vV; varying float vX;
      void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.);
        vec3 deep=vec3(.55,.15,.95), hi=vec3(.3,.95,1.);
        vec3 c=mix(deep,hi,pow(vR,2.));
        float sweep=exp(-fract(uSig-vY*1.4+vX*.3)*5.);
        c=c*(.04+vR*.22+f*.5)+vec3(1.,.8,1.)*sweep*vR*.25*uBoost;
        gl_FragColor=vec4(c*uOp,1.); }`,
  });
}

/** lamprey brain with a large, finely ruffled cerebellum (folia) and image-forming eyes */
export default function Cerebellum() {
  const scene = useScene();
  const grp = useRef<THREE.Group>(null);
  const dome = useRef<THREE.Mesh>(null);
  const { geo, mat } = useBrain(220, 44);
  const S = useMemo(() => {
    const dg = new THREE.SphereGeometry(1, 260, 90, 0, Math.PI * 2, 0, Math.PI / 2);
    const eyeG = new THREE.SphereGeometry(0.34, 28, 20);
    const eyeM = makeBodyMat('#ffe9b0', { rim: 1.2, base: 0.12 });
    const irisM = makeBodyMat('#5fe8ff', { rim: 1, base: 0.7 });
    const irisG = new THREE.SphereGeometry(0.16, 20, 14);
    return { dg, dm: foliaMat(), eyeG, eyeM, irisM, irisG };
  }, []);
  useEffect(() => () => { S.dg.dispose(); S.dm.dispose(); S.eyeG.dispose(); S.eyeM.dispose(); S.irisM.dispose(); S.irisG.dispose(); }, [S]);
  const p19 = eventPos('lampreys-brain-and-cerebellum');
  useFrame(() => {
    if (!scene.active) return;
    const w = scene.weight, f = world.stationF, tm = TM();
    const n = near(p19, 0.9);
    const grow = smoothstep(0.1, 0.6, scene.t);
    const u = mat.uniforms;
    u.uSw.value = 1; u.uFold.value = 0.85; u.uHemi.value = 0.6; u.uWr.value = 0.7; u.uTime.value = tm; u.uSig.value = f * 2;
    u.uOpacity.value = w * 0.75; u.uRim.value = 1.1; u.uBase.value = 0.05; u.uBoost.value = 1;
    S.dm.uniforms.uOp.value = w; S.dm.uniforms.uGrow.value = grow * (0.6 + n * 0.7);
    S.dm.uniforms.uSig.value = f * 1.8 + tm * 0.2; S.dm.uniforms.uTime.value = tm; S.dm.uniforms.uBoost.value = 0.6 + n * 1.2;
    S.eyeM.uniforms.uOpacity.value = w * smoothstep(0.2, 0.5, scene.t); S.irisM.uniforms.uOpacity.value = S.eyeM.uniforms.uOpacity.value * (0.6 + n);
    if (dome.current) dome.current.scale.setScalar(0.3 + grow * 1.0);
    if (grp.current) grp.current.rotation.y = -0.5 + scene.t * 1.0;
  });
  return (
    <group>
      <Backdrop top="#2a0d52" bottom="#02030a" ray={0.3} />
      <Plankton count={600} box={BOX} color="#b99bff" size={0.04} flow={-2} center={[0, 0, -2]} />
      <group ref={grp} position={[0.2, 0, 0]} scale={1.15}>
        <mesh geometry={geo} material={mat} frustumCulled={false} scale={1.1} position={[0, 0.2, 0]} />
        <mesh ref={dome} geometry={S.dg} material={S.dm} position={[-1.2, 0.55, 0]} frustumCulled={false} />
        <mesh geometry={S.eyeG} material={S.eyeM} position={[1.4, 0.1, 1.15]} />
        <mesh geometry={S.eyeG} material={S.eyeM} position={[1.4, 0.1, -1.15]} />
        <mesh geometry={S.irisG} material={S.irisM} position={[1.55, 0.1, 1.32]} />
        <mesh geometry={S.irisG} material={S.irisM} position={[1.55, 0.1, -1.32]} />
      </group>
    </group>
  );
}
