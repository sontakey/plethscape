import * as THREE from "three";
import type { Theme } from "./theme";

/** Decorative atmosphere, kept separate from blood flow and optical sampling. */
export function createSceneAtmosphere() {
  const group = new THREE.Group();
  group.name = "Decorative pulse atmosphere";
  const uniforms = {
    time: { value: 0 },
    pulse: { value: 0 },
    strength: { value: 1 },
    particleColor: { value: new THREE.Vector3(1, 0.62, 0.31) },
    haloColor: { value: new THREE.Vector3(0.73, 0.31, 0.105) },
  };
  // Deterministic seeds; animation stays on the GPU and adds only two draw calls.
  const count = 1800;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  let seed = 73;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (random() - 0.5) * 15;
    positions[i * 3 + 1] = random() * 9 - 2;
    positions[i * 3 + 2] = -1.2 - random() * 5;
    seeds[i] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float time; uniform float pulse; attribute float seed;
      varying float brightness;
      void main() {
        vec3 p = position;
        p.x += sin(time * .055 + seed * 30. + p.y * .5) * .25;
        p.y += sin(time * .075 + seed * 20.) * .3;
        vec4 view = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp((1.2 + seed * 2.8) * 6. / max(1., -view.z), 1., 5.);
        brightness = (.16 + seed * .35) * (1. + pulse * .35);
      }`,
    fragmentShader: `
      uniform float strength; uniform vec3 particleColor; varying float brightness;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.;
        float alpha = exp(-r*r*5.) * (1.-smoothstep(.7, 1., r));
        gl_FragColor = vec4(particleColor, alpha * brightness * strength);
      }`,
  });
  const particles = new THREE.Points(geometry, material);
  // Background renders before the transparent anatomy, never over its details.
  particles.renderOrder = -30;
  group.add(particles);
  const haloGeometry = new THREE.PlaneGeometry(12, 10);
  const haloMaterial = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float pulse; uniform float strength; uniform vec3 haloColor; varying vec2 vUv;
      void main() {
        vec2 p = (vUv-.5)*vec2(1.35,1.);
        float glow = exp(-dot(p,p)*19.);
        float shoulder = exp(-dot(p-vec2(0.,.13),p-vec2(0.,.13))*40.);
        float alpha = (glow*.04 + shoulder*.012) * strength;
        gl_FragColor=vec4(haloColor,alpha);
      }`,
  });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.position.set(0, 2, -2.5);
  halo.renderOrder = -31;
  group.add(halo);
  return {
    group,
    setTheme(theme: Theme) {
      const light = theme === "light";
      uniforms.strength.value = light ? 0.24 : 1;
      if (light) {
        uniforms.particleColor.value.set(0.28, 0.37, 0.5);
        uniforms.haloColor.value.set(0.5, 0.6, 0.74);
      } else {
        uniforms.particleColor.value.set(1, 0.62, 0.31);
        uniforms.haloColor.value.set(0.73, 0.31, 0.105);
      }
      for (const layer of [material, haloMaterial]) {
        layer.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
        layer.needsUpdate = true;
      }
    },
    update(time: number, phase: number, reduced: boolean, enabled: boolean) {
      group.visible = enabled;
      uniforms.time.value = reduced ? 0 : time;
      // Same cardiac phase as the heart and PPG; no independent animation timer.
      uniforms.pulse.value = reduced
        ? 0
        : Math.exp(-Math.pow((phase - 0.12) / 0.13, 2));
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
    },
  };
}
