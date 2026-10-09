import * as THREE from 'three';

/** Stone / flake material. Lit, warm-keyed "skin/stone" material: readable body (not just a rim) + fresnel edge + optional hot glow. Not additive. */
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
