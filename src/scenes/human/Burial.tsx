import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { GLSL_UTIL, LBuf, PBuf, lineMat, pointMat, tickU } from './common';


// ---- stone fat lamp + flame (camera-facing billboard, local q: x in [-1.2,1.2], y = world height) ----
// Ice Age light: a hollowed stone burning animal fat with a moss wick (no wax candles for tens of thousands of years)
const CANDLE_FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uTime,uFlick; varying vec2 vQ;
void main(){
  vec2 q=vQ;
  float t=uTime;
  float fl = .88+.12*sin(t*9.+sin(t*4.)*2.)+.05*sin(t*17.);
  float H = .36*(.92+.1*sin(t*5.3)+.06*sin(t*11.7));
  vec2 base = vec2(-.04,.25);
  vec3 col = vec3(0.);
  // --- the lamp: a shallow, rounded stone bowl, lit from its own flame above ---
  float top=.2;
  float yy=(top-q.y)/.21;
  float bw=.36*sqrt(max(0.,1.-yy*yy))*(1.+.04*sin(q.y*30.+2.));
  float inB=step(0.,q.y)*step(q.y,top)*(1.-smoothstep(bw-.006,bw,abs(q.x)));
  float rough=fbm(vec3(q*vec2(22.,26.),4.))*.6+fbm(vec3(q*70.,9.))*.4;
  float lit=smoothstep(-.02,top,q.y)*(.55+.45*(1.-abs(q.x)/max(bw,.01)));
  col += inB*vec3(.52,.4,.3)*(.12+.88*lit)*(.6+.55*rough)*(.45+.35*fl);
  // pool of melted fat in the hollow, glowing under the flame
  float pool = 1.-smoothstep(.0,.015, length((q-vec2(0.,top))/vec2(.27,.028))-1.);
  col += pool * vec3(2.0,1.15,.42)*(.5+.25*fl);
  // a twist of moss wick at the lip
  float wick = (1.-smoothstep(.004,.008,abs(q.x-base.x-.01*sin(q.y*60.))))*step(top,q.y)*step(q.y,base.y+.01);
  col += wick*vec3(.3,.14,.06);
  col += exp(-pow(length(q-base)/.018,2.))*vec3(2.5,.8,.2)*.7;

  // --- the flame: teardrop, drawn from a width profile with turbulent edge ---
  float h = (q.y-base.y)/H;
  float sway = (sin(t*2.1+h*3.)*.02 + sin(t*5.3+h*7.)*.01 + (fbm(vec3(h*3.,t*1.3,1.))-.5)*.05)*h*h*2.2 + uFlick*0.;
  float edgeN = (fbm(vec3(q*vec2(7.,3.)+vec2(0.,-t*2.4),t*.6))-.5)*.05*smoothstep(.1,.7,h);
  float wid = .125*pow(max(h*(1.-h)*4.,0.),.55)*pow(max(1.-h,0.),.35) + .004;
  float dx = q.x - sway - edgeN;
  float inF = step(0.,h)*step(h,1.02);
  float dd = (wid-abs(dx))/wid;
  float body = smoothstep(0.,.5,dd)*inF;
  // colour zones across the flame: blue base, white-yellow core, orange mantle, red tip
  float core = exp(-pow(dx/(wid*.55+.002),2.))*smoothstep(.0,.3,h)*(1.-smoothstep(.45,.9,h));
  vec3 mant = mix(vec3(2.6,1.1,.2), vec3(1.7,.28,.05), smoothstep(.45,1.,h));
  vec3 fcol = mix(mant, vec3(3.2,2.7,1.5), core);
  float blue = exp(-pow((h-.03)/.07,2.))*exp(-pow(dx/(wid*.9+.01),2.));
  fcol = mix(fcol, vec3(.25,.55,2.4), blue*.85);
  float inten = body*(.6+.6*(1.-h))*fl;
  col += fcol*inten*1.15;
  // thin dark column inside the base (unburnt vapour around the wick)
  col *= 1.-.55*exp(-pow(dx/.012,2.))*exp(-pow((h-.0)/.18,2.))*body;
  // wide breathing halo + warm light thrown on the air
  float rF = length((q-vec2(0.,.62))*vec2(1.,.9));
  col += vec3(2.4,.95,.28)*(exp(-rF*rF*5.)*.24 + exp(-rF*rF*.9)*.05)*fl*(1.+uFlick*.3);
  // soot-free dark smoke thread above the tip, very faint
  float sm = smoothstep(.0,.05,q.y-(base.y+H*.95)) * exp(-pow((q.x-.05*sin(q.y*5.-t*1.2)*(q.y-.9))/(.01+.03*(q.y-.9)),2.))*.07*smoothstep(2.4,1.2,q.y);
  col += vec3(.8,.7,.6)*sm;
  vec2 e=abs((q-vec2(0.,1.2))/vec2(3.,2.2));
  col*=1.-smoothstep(.55,1.,max(e.x,e.y));
  gl_FragColor=vec4(col*uW,1.);
}`;

export default function Burial() {
  const scene = useScene();
  const { geo, mat, lgeo, lmat, ground, candle } = useMemo(() => {
    const b = new PBuf(71);
    const r = b.r;
    const q = world.quality;
    // 1 motes
    for (let i = 0; i < 380 * q; i++) {
      const a = r() * 6.283, rad = Math.sqrt(r()) * 7;
      b.add(Math.cos(a) * rad, 0, Math.sin(a) * rad - 1, [1, 1, 1], 1);
    }
    // 3 grave outline + ochre scatter
    for (let i = 0; i < 260 * q; i++) {
      const a = (i / (260 * q)) * 6.283;
      b.add(Math.cos(a) * 1.0, 0.0, Math.sin(a) * 0.55, [1.3, .9, .6], 3);
    }
    for (let i = 0; i < 700 * q; i++) {
      const a = r() * 6.283, rad = Math.sqrt(r());
      b.add(Math.cos(a) * rad * 0.95, 0.0, Math.sin(a) * rad * 0.5, [1.6, .35, .12], 3);
    }
    // 2 ivory beads in rows across a reclining figure, head toward the lamp (the Sunghir burials: thousands of beads)
    const inBody = (x: number, z: number) => {
      if (Math.hypot((x + 0.66) / 0.13, z / 0.11) < 1) return true;                         // head
      if (x > -0.55 && x < 0.12) return Math.abs(z) < 0.21 * (1 - 0.25 * Math.pow((x + 0.2) / 0.35, 2)); // torso
      if (x >= 0.12 && x < 0.78) return Math.abs(Math.abs(z) - 0.085) < 0.062 * (1 - 0.35 * (x - 0.12) / 0.66); // legs
      return false;
    };
    for (let x = -0.79; x < 0.8; x += 0.024) {
      for (let z = -0.24; z <= 0.24; z += 0.019) {
        const jx = x + (r() - 0.5) * 0.006, jz = z + (r() - 0.5) * 0.006;
        if (!inBody(jx, jz) || r() > 0.92 * q + 0.08) continue;
        b.add(jx, 0.012, jz, [1.25, 1.12, 0.95], 2);
      }
    }
    // 4 distant fires
    const fires: [number, number, number][] = [];
    for (let i = 0; i < 24; i++) {
      const a = r() * 6.283, rad = 3.2 + Math.pow(r(), 0.8) * 13;
      fires.push([Math.cos(a) * rad, 0, Math.sin(a) * rad * 0.9 - 2.5]);
    }
    fires.forEach((fp, i) => {
      const when = 0.12 + (Math.hypot(fp[0], fp[2] + 2.5) / 16) * 0.8;
      for (let k = 0; k < 8; k++) b.add(fp[0], 0, fp[2], [1, 1, 1], 4, { aW: [when] });
      void i;
    });
    // flame/others: aW default 0
    const total = b.count;
    const aw = new Array(total).fill(0);
    // fill aW for first (total - fires*8) with 0 and the fires with their value
    const nf = fires.length * 8;
    for (let i = 0; i < nf; i++) aw[total - nf + i] = b.ex.aW[i];
    b.ex.aW = aw;
    const mat = pointMat({
      decl: 'attribute float aW; uniform float uNet; uniform float uFlick;',
      uniforms: { uNet: { value: 0 }, uFlick: { value: 0 } },
      size: 0.9,
      body: `
      float k = aSeed.w;
      float fl = .85+.15*sin(uTime*9.+sin(uTime*4.)*2.);
      if (k < .5) {
        float ph = fract(aSeed.x + uTime*.6 + uT*3.);
        float h = ph*.95;
        float rad = (1.-ph)*.15*(.3+aSeed.z);
        float an = aSeed.y*6.283 + uTime*3.;
        p = vec3(cos(an)*rad + sin(uTime*5.+ph*7.)*.03*ph, .07+h, sin(an)*rad)*.6 + vec3(-1.32,-.06,.12);
        col = mix(vec3(2.6,2.1,1.4), vec3(1.9,.9,.4), ph);
        a = pow(1.-ph,1.4)*.9*fl; size = .9*(1.-ph)+.25;
      } else if (k < 1.5) {
        float y = fract(aSeed.y + uTime*.02 + uT*.35)*5.;
        p = vec3(position.x + sin(uTime*.3+aSeed.x*30.)*.4, y-.2, position.z + cos(uTime*.25+aSeed.z*20.)*.4);
        col = vec3(1.5,.55,.25);
        float d = length(p.xz*vec2(.6,.6));
        a = .5*(.3+.7*exp(-d*.3))*sin(3.14159*y/5.)*(.6+.6*sin(uTime*2.+aSeed.x*40.)); size = .35;
      } else if (k < 2.5) {
        a = .8*(.75+.25*sin(uTime*1.5+aSeed.x*20.)); size = .5; col = aCol*1.1;
        p.y += .01*sin(uTime+aSeed.x*10.);
      } else if (k < 3.5) {
        a = .5; size=.4; col = aCol*(.7+.4*sin(uTime*1.2+aSeed.x*30.));
        p.y += .005;
      } else if (k < 4.5) {
        float on = smoothstep(aW, aW+.08, uNet);
        float ph = fract(aSeed.x + uTime*.7);
        float h = ph*.28;
        float rad = (1.-ph)*.05*(.4+aSeed.z);
        p = vec3(position.x+cos(aSeed.y*6.28)*rad, .03+h, position.z+sin(aSeed.y*6.28)*rad);
        col = mix(vec3(2.2,1.2,.4), vec3(1.5,.35,.1), ph);
        a = on*pow(1.-ph,1.3)*1.5*(.8+.2*sin(uTime*8.+aSeed.z*30.)); size = 2.2*(1.-ph)+.6;
        a += on*.0;
      } else {
        float s = .9+.15*sin(uTime*3.+aSeed.x*6.);
        p = vec3(-1.32, .2, .12);
        col = vec3(1.7,.8,.3);
        a = (.05+.015*float(int(aSeed.x*14.)))*s*(.6+uFlick*.6); size = 4. + aSeed.x*14.;
      }
      `,
    });
    // network lines between fires
    const lb = new LBuf(72);
    fires.forEach((fp, i) => {
      const dists = fires.map((g, j) => [j, Math.hypot(g[0] - fp[0], g[2] - fp[2])] as const).filter(([j]) => j !== i).sort((a, c) => a[1] - c[1]).slice(0, 1);
      for (const [j] of dists) {
        if (j < i && dists.length) continue;
        const gp = fires[j];
        const wi = 0.12 + (Math.hypot(fp[0], fp[2] + 2.5) / 16) * 0.8, wj = 0.12 + (Math.hypot(gp[0], gp[2] + 2.5) / 16) * 0.8;
        const w = Math.max(wi, wj) + 0.06;
        // arc between fires, as a few segments
        const n = 8;
        let prev: [number, number, number] = [fp[0], 0.18, fp[2]];
        for (let s = 1; s <= n; s++) {
          const u = s / n;
          const cur: [number, number, number] = [fp[0] + (gp[0] - fp[0]) * u, 0.18 + Math.sin(u * Math.PI) * 0.35, fp[2] + (gp[2] - fp[2]) * u];
          lb.seg(prev, cur, w, w, [1.3, .8, .35], 0);
          prev = cur;
        }
      }
    });
    const lmat = lineMat({
      decl: 'uniform float uNet;',
      uniforms: { uNet: { value: 0 } },
      body: 'a = smoothstep(aG, aG+.1, uNet)*.6;',
    });
    const ground = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uW: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uW,uTime; varying vec2 vP;
      void main(){ float r=length(vP); float fl=.9+.1*sin(uTime*9.+sin(uTime*4.)*2.);
        float rl=length(vP-vec2(-1.32,-.12));
        vec3 c=vec3(.7,.3,.1)*(exp(-rl*rl*.6)*.45+exp(-r*r*.35)*.12)*fl*.35+vec3(.012,.01,.016);
        float edge=1.-smoothstep(10.,24.,r);
        gl_FragColor=vec4(c,uW*edge); }`,
    });
    // candle billboard
    const candle = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uW: { value: 0 }, uTime: { value: 0 }, uFlick: { value: 0 } },
      vertexShader: 'varying vec2 vQ; void main(){ vQ=position.xy+vec2(0.,1.2); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: CANDLE_FS,
    });
    return { geo: b.build(), mat, lgeo: lb.build(), lmat, ground, candle };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); lgeo.dispose(); lmat.dispose(); ground.dispose(); candle.dispose(); }, [geo, mat, lgeo, lmat, ground, candle]);
  const cm = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const tm = world.reduced ? 0 : world.time;
    candle.uniforms.uW.value = scene.weight; candle.uniforms.uTime.value = tm; candle.uniforms.uFlick.value = near(eventPos('burial-ritual'), 0.5);
    if (cm.current) cm.current.rotation.y = Math.atan2(state.camera.position.x, state.camera.position.z);
    const e71 = eventPos('behavioural-modernity');
    const net = range(e71 - 0.9, e71 + 0.4, f);
    tickU(mat, scene, state.gl.getPixelRatio());
    mat.uniforms.uNet.value = net;
    mat.uniforms.uFlick.value = near(eventPos('burial-ritual'), 0.5);
    tickU(lmat, scene);
    lmat.uniforms.uNet.value = net;
    ground.uniforms.uW.value = scene.weight; ground.uniforms.uTime.value = world.reduced ? 0 : world.time;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} material={ground}><planeGeometry args={[60, 60]} /></mesh>
      <points geometry={geo} material={mat} frustumCulled={false} />
      <mesh ref={cm} position={[-1.32, 1.32, 0.12]} scale={1.1} material={candle} frustumCulled={false}><planeGeometry args={[6, 4.4]} /></mesh>
    </group>
  );
}
