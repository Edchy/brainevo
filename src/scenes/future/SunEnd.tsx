import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, smoothstep } from '../../world/util';
import { GLSL_UTIL, PBuf, pointMat, tickU } from '../human/common';
import { EarthSphere, useEarthMats } from '../human/Earth';
import { makeGlowMat } from '../hominin/common';

// The far future, painted because physics decides it: the Sun brightens over a small blue Earth, swells into a red giant
// that reaches out and swallows it, then shrinks to a white dwarf as the stars around it go out one by one, until only
// a few dim red embers are left in the dark.

const SUN_FS = /* glsl */ `${GLSL_UTIL}
uniform vec3 uHot; uniform vec3 uCool; uniform float uW, uTime, uGran;
varying vec3 vN; varying vec3 vV;
void main(){
  float mu = clamp(dot(normalize(vN), normalize(vV)), 0., 1.);
  float limb = pow(mu, .55);                                              // limb darkening
  float g = fbm(vN * uGran + vec3(0., uTime*.05, 0.));                    // granulation cells
  float g2 = fbm(vN * uGran * 3.1 - vec3(uTime*.08));
  vec3 c = mix(uCool, uHot, limb) * (.75 + .5 * g + .2 * g2);
  gl_FragColor = vec4(c * uW, 1.);
}`;
const SUN_VS = /* glsl */ `varying vec3 vN; varying vec3 vV;
void main(){ vN = normalize(normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;

const SUN_AT = new THREE.Vector3(2.2, 0.4, 0);
const EARTH_AT = new THREE.Vector3(-2.4, -0.4, 2.2);
const C = { white: new THREE.Color(3.2, 2.9, 2.3), red: new THREE.Color(1.15, 0.2, 0.055), dwarf: new THREE.Color(2.2, 2.4, 2.8),
  limbW: new THREE.Color(2.4, 1.3, 0.5), limbR: new THREE.Color(0.5, 0.045, 0.018), limbD: new THREE.Color(1.2, 1.3, 1.6) };
const tmpV = new THREE.Vector3();

export default function SunEnd() {
  const scene = useScene();
  const { mat: eMat, atmo } = useEarthMats();
  const sun = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const earth = useRef<THREE.Group>(null);
  const R = useMemo(() => {
    const sunMat = new THREE.ShaderMaterial({
      uniforms: { uHot: { value: new THREE.Color() }, uCool: { value: new THREE.Color() }, uW: { value: 0 }, uTime: { value: 0 }, uGran: { value: 7 } },
      vertexShader: SUN_VS, fragmentShader: SUN_FS,
    });
    const glowMat = makeGlowMat('#ffd38a', 1.8);
    const sb = new PBuf(451);
    const r = sb.r;
    for (let i = 0; i < 900 * world.quality; i++) {
      const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(70 + r() * 90);
      if (v.z > 40) v.z *= -1;
      sb.add(v.x, v.y, v.z, r() < 0.25 ? [2.0, 1.4, 0.9] : [1.3, 1.5, 2.2], r());
    }
    // uOut: 0 all stars shining .. 1 all gone; each star has its own moment (aSeed.w), the reddest linger longest
    const sMat = pointMat({
      decl: 'uniform float uOut;', uniforms: { uOut: { value: 0 } }, size: 2.2,
      body: `
      float life = 1. - smoothstep(aSeed.w*.92, aSeed.w*.92 + .08, uOut);
      float ember = smoothstep(.97, 1., aSeed.w) * (1. - smoothstep(.985, 1., uOut));
      col = mix(col, vec3(1.6, .45, .2), 1. - life);
      a = (.3 + .6*aSeed.x) * max(life, ember*.8) * (.7 + .3*sin(uTime*(.4+aSeed.y)+aSeed.z*60.));
      size = .3 + aSeed.x*.8;`,
    });
    return { sunMat, glowMat, sGeo: sb.build(), sMat };
  }, []);
  useEffect(() => () => { R.sunMat.dispose(); R.glowMat.dispose(); R.sGeo.dispose(); R.sMat.dispose(); }, [R]);

  const hot = useMemo(() => new THREE.Color(), []), cool = useMemo(() => new THREE.Color(), []);
  useFrame((st) => {
    if (!scene.active) return;
    const w = scene.weight, f = world.stationF, tm = world.reduced ? 0 : world.time;
    const pr = st.gl.getPixelRatio();
    // phases follow the three stations: brightening, red giant, last stars
    const giant = smoothstep(eventPos('red-giant') - 0.7, eventPos('red-giant') + 0.1, f);
    const dwarf = smoothstep(eventPos('last-stars') - 0.75, eventPos('last-stars') - 0.15, f);
    const out = smoothstep(eventPos('last-stars') - 0.5, eventPos('last-stars') + 0.6, f);
    const radius = (1.0 + 0.25 * smoothstep(-0.4, 0.2, f - eventPos('sun-brightens'))) * (1 + 3.2 * giant) * (1 - 0.95 * dwarf);
    // a red giant is cooler, so redder and dimmer per square metre: kept below clipping so it reads red, not white
    hot.copy(C.white).lerp(C.red, giant).lerp(C.dwarf, dwarf);
    cool.copy(C.limbW).lerp(C.limbR, giant).lerp(C.limbD, dwarf);
    const fade = 1 - 0.85 * smoothstep(0.55, 1, out);
    const u = R.sunMat.uniforms;
    (u.uHot.value as THREE.Color).copy(hot); (u.uCool.value as THREE.Color).copy(cool);
    u.uW.value = w * fade; u.uTime.value = tm; u.uGran.value = 7 - 4 * giant;
    if (sun.current) { sun.current.scale.setScalar(radius); sun.current.position.copy(SUN_AT); }
    if (glow.current) {
      glow.current.position.copy(SUN_AT);
      glow.current.quaternion.copy(st.camera.quaternion);
      glow.current.scale.setScalar(radius * (4.2 - 1.6 * giant));
      (R.glowMat.uniforms.uColor.value as THREE.Color).setRGB(1, 0.83 - 0.6 * giant + 0.4 * dwarf, 0.54 - 0.48 * giant + 0.5 * dwarf);
      R.glowMat.uniforms.uAlpha.value = w * fade * (0.55 - 0.2 * giant);
    }
    // Earth: lit by the Sun, scorched as it brightens, then swallowed by the giant
    const swallowed = smoothstep(0.55, 0.85, giant);
    if (earth.current) {
      earth.current.visible = swallowed < 0.999;
      earth.current.scale.setScalar(0.42 * (1 - swallowed));
      earth.current.position.copy(EARTH_AT).lerp(tmpV.copy(SUN_AT).lerp(EARTH_AT, 0.45), swallowed);
    }
    (eMat.uniforms.uSun.value as THREE.Vector3).copy(tmpV.copy(SUN_AT).sub(EARTH_AT).normalize());
    eMat.uniforms.uW.value = w * (1 - swallowed); atmo.uniforms.uW.value = w * (1 - swallowed) * (1 - giant * 0.6);
    tickU(R.sMat, scene, pr);
    R.sMat.uniforms.uOut.value = out;
  });

  return (
    <group>
      <points geometry={R.sGeo} material={R.sMat} frustumCulled={false} />
      <mesh ref={glow} material={R.glowMat}><planeGeometry args={[1, 1]} /></mesh>
      <mesh ref={sun} material={R.sunMat}><sphereGeometry args={[1, 96, 64]} /></mesh>
      <group ref={earth}><EarthSphere mat={eMat} atmo={atmo} /></group>
    </group>
  );
}
