import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  sampleCapturedBeat,
  SITES,
  type Physiology,
  type SiteId,
  type CapturedBeat,
} from "./simulation";
import { OPTICAL_BANDS, type Wavelength } from "./optics";
import { getChartPalette, getTheme, subscribeTheme } from "./theme";
type Props = {
  clock: RefObject<{ time: number; running: boolean }>;
  physiology: Physiology;
  site: SiteId;
  captured: CapturedBeat;
  wavelength: Wavelength;
  stage: number;
};
export default function SensorCutaway(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(props),
    reset = useRef(() => {});
  current.current = props;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x0e0c0a, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D optical sensor and tissue cutaway",
    );
    renderer.domElement.setAttribute("role", "img");
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const fog = new THREE.FogExp2(0x0e0c0a, 0.034);
    scene.fog = fog;
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(5.3, 3.8, 8);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -0.55, 0);
    controls.enableDamping = true;
    controls.minDistance = 5;
    controls.maxDistance = 28;
    controls.maxPolarAngle = Math.PI * 0.77;
    controls.enablePan = false;
    controls.update();
    const fitView = () => {
      const scale = Math.max(1, 1.05 / camera.aspect);
      camera.position.set(5.3 * scale, -0.55 + 4.35 * scale, 8 * scale);
      controls.target.set(0, -0.55, 0);
      controls.update();
    };
    reset.current = fitView;
    const hemisphere = new THREE.HemisphereLight(0xffe8d4, 0x3e231c, 2.3);
    scene.add(hemisphere);
    const light = new THREE.DirectionalLight(0xffd0a6, 3.4);
    light.position.set(2, 5, 4);
    scene.add(light);
    const back = new THREE.DirectionalLight(0xff9261, 2);
    back.position.set(-4, 1, -3);
    scene.add(back);
    const group = new THREE.Group();
    scene.add(group);
    const tissue = new THREE.MeshPhysicalMaterial({
      color: 0x88513e,
      roughness: 0.84,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: 0xd39972,
      roughness: 0.92,
    });
    const black = new THREE.MeshStandardMaterial({
      color: 0x20221f,
      roughness: 0.48,
      metalness: 0.28,
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xb98e50,
      roughness: 0.38,
      metalness: 0.8,
    });
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      material: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };
    // Open-front tissue block: a thin epidermal roof, dermal sides and a basal layer.
    box(5.5, 0.09, 2.6, 0, 0, 0, skin);
    box(5.5, 1.25, 0.05, 0, -0.7, -1.3, tissue);
    box(0.05, 1.9, 2.6, -2.75, -1, 0, tissue);
    box(0.05, 1.9, 2.6, 2.75, -1, 0, tissue);
    box(
      5.5,
      0.42,
      2.6,
      0,
      -1.85,
      0,
      new THREE.MeshStandardMaterial({ color: 0x9b7241, roughness: 0.9 }),
    );
    for (let i = 0; i < 42; i++) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.13 + (i % 4) * 0.015, 10, 8),
        new THREE.MeshStandardMaterial({
          color: i % 2 ? 0xb78b50 : 0x9e743b,
          roughness: 0.95,
        }),
      );
      sphere.position.set(
        -2.6 + (i % 14) * 0.4,
        -1.58,
        1.22 - Math.floor(i / 14) * 0.7,
      );
      sphere.scale.set(1, 0.65, 1);
      group.add(sphere);
    }
    const outline = new THREE.Shape();
    const w = 3.1,
      d = 1.22,
      r = 0.18;
    outline.moveTo(-w / 2 + r, -d / 2);
    outline.lineTo(w / 2 - r, -d / 2);
    outline.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    outline.lineTo(w / 2, d / 2 - r);
    outline.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    outline.lineTo(-w / 2 + r, d / 2);
    outline.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    outline.lineTo(-w / 2, -d / 2 + r);
    outline.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    const housing = new THREE.Mesh(
      new THREE.ExtrudeGeometry(outline, {
        depth: 0.24,
        bevelEnabled: true,
        bevelSize: 0.045,
        bevelThickness: 0.04,
        bevelSegments: 3,
        steps: 1,
        curveSegments: 12,
      }),
      black,
    );
    housing.rotation.x = -Math.PI / 2;
    housing.position.set(0, 0.13, -0.08);
    group.add(housing);
    box(3.38, 0.07, 1.46, 0, 0.08, -0.08, black);
    for (const x of [-1.43, 1.43]) box(0.12, 0.04, 0.85, x, 0.06, 0, gold);
    const emitterMat = new THREE.MeshStandardMaterial({
      color: 0x8de8a3,
      emissive: 0x8de8a3,
      emissiveIntensity: 2.2,
      roughness: 0.25,
    });
    const detectorMat = new THREE.MeshStandardMaterial({
      color: 0x483d37,
      emissive: 0xffb273,
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.25,
    });
    box(0.5, 0.08, 0.56, -0.9, 0.045, 0.48, emitterMat);
    box(0.64, 0.08, 0.65, 0.9, 0.045, 0.48, detectorMat);
    const vessels = new THREE.Group();
    group.add(vessels);
    const vesselMat = new THREE.MeshStandardMaterial({
      color: 0xb52e32,
      emissive: 0x671918,
      emissiveIntensity: 0.22,
      roughness: 0.38,
    });
    const veinMat = new THREE.MeshStandardMaterial({
      color: 0x744f75,
      roughness: 0.46,
    });
    function tube(
      points: THREE.Vector3[],
      radius: number,
      material: THREE.Material,
      parent = group,
    ) {
      const curve = new THREE.CatmullRomCurve3(points);
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 48, radius, 7, false),
        material,
      );
      parent.add(mesh);
      return mesh;
    }
    for (const [y, z, mat] of [
      [-0.75, 0.9, vesselMat],
      [-1.35, 0.3, veinMat],
    ] as const) {
      tube(
        [
          new THREE.Vector3(-2.75, y, z),
          new THREE.Vector3(-1, y - 0.12, z - 0.16),
          new THREE.Vector3(1, y + 0.06, z),
          new THREE.Vector3(2.75, y, z - 0.15),
        ],
        0.095,
        mat,
        vessels,
      );
      for (let i = 0; i < 11; i++) {
        const x = -2.3 + i * 0.43;
        tube(
          [
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(x - 0.14, y + 0.24, z - 0.05),
            new THREE.Vector3(x - 0.08, -0.22, z),
            new THREE.Vector3(x + 0.08, -0.2, z + 0.06),
            new THREE.Vector3(x + 0.17, y, z + 0.07),
          ],
          0.019,
          mat,
          vessels,
        );
      }
    }
    // Sparse procedural collagen threads provide structure without raster assets.
    const collagen = new THREE.LineBasicMaterial({
      color: 0xc18e74,
      transparent: true,
      opacity: 0.16,
    });
    for (let i = 0; i < 32; i++) {
      const pts = Array.from(
        { length: 12 },
        (_, j) =>
          new THREE.Vector3(
            -2.7 + j * 0.49,
            -0.22 - (i % 8) * 0.17 + Math.sin(j * 1.5 + i) * 0.03,
            0.95 - Math.floor(i / 8) * 0.6,
          ),
      );
      group.add(
        new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), collagen),
      );
    }
    const uniform = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x8de8a3) },
      uLight: { value: 1 },
      uStage: { value: 0 },
      uLightTheme: { value: 0 },
    };
    const photonMat = new THREE.ShaderMaterial({
      uniforms: uniform,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uLight;
        uniform float uStage;
        uniform float uLightTheme;
        void main() {
          float flow=pow(.5+.5*cos(vUv.x*26.-uTime*5.),5.);
          float a=mix(.16+.68*flow,.36+.52*flow,uLightTheme);
          float received=mix(1.,uLight,smoothstep(.35,1.,vUv.x));
          float brightness=mix(1.2+flow,.86+.14*flow,uLightTheme);
          gl_FragColor=vec4(uColor*brightness,a*received);
        }`,
    });
    const photons = new THREE.Group();
    group.add(photons);
    let previousBand = "";
    const rebuild = (band: Wavelength) => {
      for (const child of [...photons.children]) {
        (child as THREE.Mesh).geometry.dispose();
        photons.remove(child);
      }
      const depth = OPTICAL_BANDS[band].depth;
      for (let i = 0; i < 10; i++) {
        const spread = (i - 4.5) * 0.07;
        const points = [
          new THREE.Vector3(-0.9, 0.08, 0.55),
          new THREE.Vector3(-0.8 + spread, -0.2, 0.72),
          new THREE.Vector3(-0.45 + spread, -depth * (0.7 + i * 0.02), 0.82),
          new THREE.Vector3(
            0.1 + spread,
            -depth * (0.85 + (i % 3) * 0.075),
            1.02 + Math.sin(i * 2) * 0.12,
          ),
          new THREE.Vector3(0.62 + spread, -depth * 0.45, 0.8),
          new THREE.Vector3(0.9, 0.06, 0.55),
        ];
        tube(points, 0.012, photonMat, photons);
      }
    };
    const glow = new THREE.PointLight(0x8de8a3, 1.8, 4);
    glow.position.set(-0.9, -0.25, 1);
    group.add(glow);
    let dirty = true;
    const invalidate = () => {
      dirty = true;
    };
    let lightTheme = getTheme() === "light";
    const applyWavelengthAppearance = (wavelength: Wavelength) => {
      const band = OPTICAL_BANDS[wavelength];
      // Share contrast-safe display hues with the plots; optical depth and
      // coefficients continue to come exclusively from optics.ts.
      uniform.uColor.value.set(
        lightTheme ? getChartPalette("light").channels[wavelength] : band.color,
      );
      emitterMat.color.set(band.color);
      emitterMat.emissive.set(band.color);
      glow.color.set(band.color);
    };
    const applyTheme = () => {
      const theme = getTheme();
      lightTheme = theme === "light";
      const background = lightTheme ? 0xf5f7fb : 0x0e0c0a;
      renderer.setClearColor(background, 1);
      fog.color.set(background);
      hemisphere.color.set(lightTheme ? 0xffffff : 0xffe8d4);
      hemisphere.groundColor.set(lightTheme ? 0xbcc4ce : 0x3e231c);
      hemisphere.intensity = lightTheme ? 1.6 : 2.3;
      light.color.set(lightTheme ? 0xfffcf7 : 0xffd0a6);
      light.intensity = lightTheme ? 2.5 : 3.4;
      back.color.set(lightTheme ? 0xdde7f4 : 0xff9261);
      back.intensity = lightTheme ? 1.25 : 2;
      tissue.opacity = lightTheme ? 0.32 : 0.24;
      collagen.color.set(lightTheme ? 0x8d6d60 : 0xc18e74);
      collagen.opacity = lightTheme ? 0.24 : 0.16;
      photonMat.blending = lightTheme
        ? THREE.NormalBlending
        : THREE.AdditiveBlending;
      photonMat.needsUpdate = true;
      uniform.uLightTheme.value = lightTheme ? 1 : 0;
      applyWavelengthAppearance(current.current.wavelength);
      element.dataset.theme = theme;
      invalidate();
    };
    applyTheme();
    const unsubscribeTheme = subscribeTheme(applyTheme);
    controls.addEventListener("change", invalidate);
    const resize = () => {
      dirty = true;
      const { width, height } = element.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      fitView();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let visible = true;
    const intersection = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    intersection.observe(element);
    let frame = 0,
      last = -Infinity;
    let lastTime = NaN;
    let lastProps: typeof props | null = null;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || !visible || now - last < 1000 / 30) return;
      last = now;
      const p = current.current;
      const cameraChanged = controls.update();
      if (
        !dirty &&
        !cameraChanged &&
        lastTime === p.clock.current.time &&
        lastProps === p
      )
        return;
      dirty = false;
      lastTime = p.clock.current.time;
      lastProps = p;
      if (previousBand !== p.wavelength) {
        rebuild(p.wavelength);
        previousBand = p.wavelength;
        applyWavelengthAppearance(p.wavelength);
      }
      const pulse = sampleCapturedBeat(
        p.clock.current.time,
        p.physiology,
        p.site,
        p.captured,
      );
      const detected = 1 - Math.min(1.6, Math.max(0, pulse)) * 0.16;
      uniform.uTime.value = p.clock.current.time;
      uniform.uLight.value = detected;
      uniform.uStage.value = p.stage;
      vessels.scale.y = 1 + Math.max(0, pulse) * 0.028;
      emitterMat.emissiveIntensity =
        (p.stage === 0 ? 3 : 1.4) * (lightTheme ? 0.45 : 1);
      detectorMat.emissiveIntensity =
        (p.stage === 2 ? 1.6 : 0.5) * detected * (lightTheme ? 0.55 : 1);
      glow.intensity = (p.stage === 1 ? 2.6 : 1.2) * (lightTheme ? 0.35 : 1);
      element.dataset.time = String(p.clock.current.time);
      element.dataset.pulse = String(pulse);
      element.dataset.detectedLight = String(detected);
      element.dataset.wavelength = p.wavelength;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      unsubscribeTheme();
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      controls.removeEventListener("change", invalidate);
      controls.dispose();
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) geometries.add(m.geometry);
        if (m.material)
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) =>
            materials.add(x),
          );
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="sensor-cutaway">
      <div className="cutaway-heading">
        <span>INSIDE THE SENSOR</span>
        <h2>Light becomes a pulse.</h2>
        <p>
          {SITES.find((s) => s.id === props.site)?.name} · illustrative
          reflectance geometry
        </p>
      </div>
      <div ref={host} className="optical-host" data-testid="optical-canvas" />
      {failed && (
        <p className="optical-error">
          The 3D cutaway is unavailable on this device. You can still explore
          the body and synchronized traces.
        </p>
      )}
      <div className="optical-labels">
        <span>LED → scattered light → detector</span>
        <span>Epidermis · dermis · subcutaneous tissue</span>
      </div>
      <div className="optical-footer">
        <span>Drag to orbit · pinch to zoom</span>
        <button onClick={() => reset.current()}>Reset view</button>
      </div>
    </div>
  );
}
