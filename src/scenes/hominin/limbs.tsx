import * as THREE from 'three';

/** Lit, warm-keyed "skin/stone" material: readable body (not just a rim) + fresnel edge + optional hot glow. Not additive. */
export function makeSkin(color: THREE.ColorRepresentation, rim: THREE.ColorRepresentation = '#ffd9a8', opts: { flat?: boolean; rimPow?: number } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) },
      uInt: { value: 1 }, uAlpha: { value: 1 }, uHot: { value: new THREE.Color(1.6, 0.9, 0.4) }, uHotAmt: { value: 0 },
      uFlat: { value: opts.flat ? 1 : 0 }, uPow: { value: opts.rimPow ?? 2.2 }, uLight: { value: new THREE.Vector3(-0.45, 0.8, 0.55) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vP; varying vec3 vL; uniform vec3 uLight;
      void main(){
        vec4 lp = vec4(position,1.); vec3 ln = normal;
        #ifdef USE_INSTANCING
          lp = instanceMatrix*lp; ln = mat3(instanceMatrix)*ln;
        #endif
        vec4 mv = modelViewMatrix*lp;
        vN = normalize(normalMatrix*ln); vP = mv.xyz;
        vL = normalize((viewMatrix*vec4(uLight,0.)).xyz);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor,uRim,uHot; uniform float uInt,uAlpha,uHotAmt,uFlat,uPow;
      varying vec3 vN; varying vec3 vP; varying vec3 vL;
      void main(){
        vec3 n = normalize(vN);
        if(uFlat>.5) n = normalize(cross(dFdx(vP),dFdy(vP)));
        vec3 V = normalize(-vP);
        float d = max(dot(n,vL),0.);
        float wrap = .5+.5*dot(n,vL);
        float fr = pow(1.-abs(dot(n,V)),uPow);
        vec3 c = uColor*(.16+.55*d+.3*wrap*wrap)*uInt + uRim*fr*(.55+.8*d)*uInt;
        c += uHot*uHotAmt*(.35+.65*fr+.3*d);
        gl_FragColor = vec4(c,uAlpha);
      }`,
  });
}

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

/** unit-height tapered limb segment: y in [0,1], radius 1 at bottom (y=0), `taper` at top */
export function taperGeo(taper = 0.7, seg = 14) {
  const g = new THREE.CylinderGeometry(taper, 1, 1, seg, 1, false);
  g.translate(0, 0.5, 0);
  return g;
}

/** place a unit-height (y 0..1) mesh from a to b with radius r (bottom). */
export function seg(m: THREE.Object3D | null, a: THREE.Vector3, b: THREE.Vector3, r: number) {
  if (!m) return;
  _d.subVectors(b, a);
  const L = _d.length();
  m.position.copy(a);
  m.scale.set(r, Math.max(L, 1e-4), r);
  if (L > 1e-5) m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / L));
}

const _dir = new THREE.Vector3(), _perp = new THREE.Vector3();
/** two-bone IK: writes elbow position. pole = direction the elbow should bend toward. */
export function ik(S: THREE.Vector3, T: THREE.Vector3, a: number, b: number, pole: THREE.Vector3, out: THREE.Vector3) {
  _dir.subVectors(T, S);
  let d = _dir.length();
  d = Math.min(Math.max(d, Math.abs(a - b) + 1e-3), a + b - 1e-3);
  _dir.normalize();
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  _perp.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_perp.lengthSq() < 1e-6) _perp.set(0, 1, 0);
  _perp.normalize();
  return out.copy(S).addScaledVector(_dir, x).addScaledVector(_perp, h);
}
