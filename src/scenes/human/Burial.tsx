import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScene } from '../../world/context';
import { world } from '../../world/store';
import { eventPos, near, range } from '../../world/util';
import { GLSL_UTIL, LBuf, PBuf, lineMat, pointMat, tickU } from './common';


// ---- candle + flame (camera-facing billboard, local q: x in [-1.2,1.2], y = world height) ----
const CANDLE_FS = /* glsl */ `${GLSL_UTIL}
uniform float uW,uTime,uFlick; varying vec2 vQ;
void main(){
  vec2 q=vQ;
  float t=uTime;
  float fl = .88+.12*sin(t*9.+sin(t*4.)*2.)+.05*sin(t*17.);
  float H = .5*(.92+.1*sin(t*5.3)+.06*sin(t*11.7));
  vec2 base = vec2(0.,.64);
  vec3 col = vec3(0.);
  // --- wax candle: slim hand-rolled tallow, lit from above by its own flame ---
  float wy = .5;
  float cw = .115 + .008*sin(q.y*18.+1.) + .01*(1.-smoothstep(0.,.1,q.y));   // slight melt flare at the foot
  float inW = step(0.,q.y)*step(q.y,wy)*(1.-smoothstep(cw-.004,cw,abs(q.x)));
  float cyl = clamp(q.x/cw,-1.,1.), nrm=sqrt(max(1.-cyl*cyl,0.));
  float distF = length(q-base);
  float wax = (.1+.9*nrm)*exp(-distF*1.2)*(.5+.5*smoothstep(0.,wy,q.y));
  wax *= .85+.3*fbm(vec3(q.x*30.,q.y*8.,2.));
  // wax runs
  float run = smoothstep(.01,0.,abs(q.x-.07*sin(q.y*7.))-.012)*smoothstep(.3,.5,q.y)*(.5+.5*sin(q.x*40.));
  col += inW * vec3(1.5,1.05,.6)*wax*.9*fl;
  col += inW * vec3(1.0,.6,.3)*pow(max(cyl,0.),3.)*.0;
  // pool of molten wax on top: a glowing ellipse
  float pool = 1.-smoothstep(.0,.012, length((q-vec2(0.,wy))/vec2(cw*.95,.03))-1.);
  col += pool * vec3(2.2,1.3,.5)*(.55+.2*fl);
  // wick: charred stem with a glowing tip
  float wick = 1.-smoothstep(.003,.006, length(vec2(q.x - .012*sin((q.y-wy)*40.)*(q.y-wy)*8., 0.))*1. ) ;
  wick *= step(wy,q.y)*step(q.y,.66);
  col += wick*vec3(.25,.12,.06)*.8;
  col += exp(-pow(length(q-vec2(0.,.64))/.018,2.))*vec3(2.5,.8,.2)*.7;

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

// ---- flowers: petal rosettes on small tilted quads ----
const FLOWER_VS = 'attribute vec3 aS; varying vec2 vUv; varying vec3 vS; varying vec3 vW; void main(){ vUv=uv; vS=aS; vW=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const FLOWER_FS = /* glsl */ `uniform float uW,uTime; varying vec2 vUv; varying vec3 vS; varying vec3 vW;
void main(){
  vec2 p=(vUv-.5)*2.;
  float r=length(p), a=atan(p.y,p.x);
  float n=floor(5.+vS.y*4.);               // 5..8 petals
  float an=a+vS.x*6.28+uTime*.0;
  float ph=abs(fract(an*n/6.28318)-.5)*2.;   // 0 at petal axis? 1 at gap
  float pet=cos(an*n)*.5+.5;
  float R=.62+.36*pow(pet,1.6);               // petal outline radius
  float inner=smoothstep(R,R-.05,r);
  // second whorl, rotated, shorter and darker (depth)
  float pet2=cos((an+3.14159/n)*n)*.5+.5;
  float R2=.5+.3*pow(pet2,1.6);
  float inner2=smoothstep(R2,R2-.05,r);
  float vein=pow(abs(cos(an*n)),24.)*.35;
  float rad=r/R;
  float shade=.35+.65*smoothstep(.0,.9,rad)*(1.-.35*rad);
  float rim=smoothstep(.78,1.,rad)*.35;
  vec3 pc=mix(vec3(1.05,1.0,.95),vec3(1.2,1.12,.85),vS.z);
  vec3 c=pc*(shade+rim-vein*.6)*inner;
  c=mix(c, pc*(.28+.5*rad)*inner2, (1.-inner)*inner2);
  // warm pollen centre
  float cen=smoothstep(.2,.12,r);
  c=mix(c, vec3(2.0,1.2,.25)*(.7+.3*sin(r*60.)), cen);
  float a2=max(inner,inner2*.9);
  // warm up with the candle: fades off with distance from the origin
  float lt=exp(-dot(vW.xz,vW.xz)*.28);
  c*=(.18+.9*lt)*mix(vec3(1.),vec3(1.5,.9,.55),lt*.75);
  gl_FragColor=vec4(c*uW*.8,a2*uW);
}`;

export default function Burial() {
  const scene = useScene();
  const { geo, mat, lgeo, lmat, ground, candle, fg, fmat, sgeo, smat } = useMemo(() => {
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
        p = vec3(cos(an)*rad + sin(uTime*5.+ph*7.)*.03*ph, .07+h, sin(an)*rad);
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
        p = vec3(0., .25, 0.);
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
        vec3 c=vec3(.7,.3,.1)*exp(-r*r*.35)*fl*.35+vec3(.012,.01,.016);
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
    // flowers: tilted rosettes on curved stems around the grave
    const fr = new PBuf(77).r;
    const NF = 11;
    const fpos: number[] = [], fuv: number[] = [], fs: number[] = [], fidx: number[] = [];
    const sb = new LBuf(78);
    const nrm = new THREE.Vector3(0, 0.62, 0.78).normalize();
    const rx = new THREE.Vector3(1, 0, 0), ry = new THREE.Vector3().crossVectors(nrm, rx).normalize();
    for (let i = 0; i < NF; i++) {
      const a = (i / NF) * 6.283 + (fr() - 0.5) * 0.4;
      const rad = 1.05 + fr() * 0.9;
      const gx = Math.cos(a) * rad * 1.15, gz = Math.sin(a) * rad * 0.8;
      const hgt = 0.22 + fr() * 0.2;
      const lean = 0.08 + fr() * 0.1;
      const hx = gx + Math.cos(a) * lean, hz = gz + Math.sin(a) * lean;
      const size = 0.13 + fr() * 0.07;
      const sd = [fr(), fr(), fr()];
      const spin = fr() * 6.283, cs = Math.cos(spin), sn = Math.sin(spin);
      const ax = rx.clone().multiplyScalar(cs).addScaledVector(ry, sn), ay = ry.clone().multiplyScalar(cs).addScaledVector(rx, -sn);
      const base = fpos.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const vv = new THREE.Vector3(hx, hgt, hz).addScaledVector(ax, (u - 0.5) * 2 * size).addScaledVector(ay, (v - 0.5) * 2 * size);
        fpos.push(vv.x, vv.y, vv.z); fuv.push(u, v); fs.push(...sd);
      }
      fidx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      // stem: a gentle curve with a leaf
      let prev: [number, number, number] = [gx, 0, gz];
      for (let k = 1; k <= 6; k++) {
        const u = k / 6;
        const cur: [number, number, number] = [gx + (hx - gx) * u * u, hgt * u, gz + (hz - gz) * u * u];
        sb.seg(prev, cur, 0, 1, [0.7, 1.0, 0.65]); prev = cur;
      }
      const lx = Math.cos(a + 1.6) * 0.1, lz = Math.sin(a + 1.6) * 0.1;
      sb.seg([gx, hgt * 0.35, gz], [gx + lx, hgt * 0.5, gz + lz], 0, 1, [0.6, 0.9, 0.55]);
      sb.seg([gx + lx, hgt * 0.5, gz + lz], [gx + lx * 1.8, hgt * 0.42, gz + lz * 1.8], 0, 1, [0.6, 0.9, 0.55]);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(fpos), 3));
    fg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(fuv), 2));
    fg.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(fs), 3));
    fg.setIndex(fidx);
    fg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const fmat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uW: { value: 0 }, uTime: { value: 0 } },
      vertexShader: FLOWER_VS, fragmentShader: FLOWER_FS,
    });
    const smat = lineMat({ body: 'float lt=exp(-dot(p.xz,p.xz)*.3); a=.55*lt+.06; col=col*(.25+.9*lt);' });
    return { geo: b.build(), mat, lgeo: lb.build(), lmat, ground, candle, fg, fmat, sgeo: sb.build(), smat };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); lgeo.dispose(); lmat.dispose(); ground.dispose(); candle.dispose(); fg.dispose(); fmat.dispose(); sgeo.dispose(); smat.dispose(); }, [geo, mat, lgeo, lmat, ground, candle, fg, fmat, sgeo, smat]);
  const cm = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!scene.active) return;
    const f = world.stationF;
    const tm = world.reduced ? 0 : world.time;
    candle.uniforms.uW.value = scene.weight; candle.uniforms.uTime.value = tm; candle.uniforms.uFlick.value = near(eventPos('burial-ritual'), 0.5);
    fmat.uniforms.uW.value = scene.weight; fmat.uniforms.uTime.value = tm;
    tickU(smat, scene);
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
      <mesh ref={cm} position={[0, 1.2, 0]} scale={1.75} material={candle} frustumCulled={false}><planeGeometry args={[6, 4.4]} /></mesh>
      <mesh geometry={fg} material={fmat} frustumCulled={false} />
      <lineSegments geometry={sgeo} material={smat} frustumCulled={false} />
    </group>
  );
}
