import PpgLoader from "./PpgLoader";
import { createPortal } from "react-dom";
import SiteSelector from "./SiteSelector";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  ArrowCounterClockwise,
  ArrowsOut,
  Minus,
  Plus,
  Cube,
  ArrowClockwise,
  Heart,
} from "@phosphor-icons/react";
import { createAnatomy } from "./bodyparts";
import type { Presentation } from "./bodyparts";
import { SITES, getCardiacState } from "./simulation";
import type { Physiology, SiteId } from "./simulation";
import { DEVICES, WEARABLE_SITES, isWearableSite } from "./devices";
import { createSceneAtmosphere } from "./sceneAtmosphere";
import { createSensorAuras } from "./sensorAuras";
import { installBodyGestures } from "./bodyGestures";
import type { WearableSite } from "./devices";

export type Layers = {
  body: boolean;
  arteries: boolean;
  veins: boolean;
  nerves: boolean;
  skeleton: boolean;
  lungs: boolean;
  flow: boolean;
  muscles: boolean;
};
interface Props {
  presentation?: "male" | "female";
  hideSelector?: boolean;
  hideSiteCard?: boolean;
  siteSelection?: number;
  demoCamera?: { view: "full" | "wrist" | "ring" | "orbit"; nonce: number } | null;
  inspectRequest?: { site: SiteId; nonce: number } | null;
  active?: boolean;
  inspection?: boolean;
  onSensor?: () => void;
  physiology: Physiology;
  site: SiteId;
  onSite: (id: SiteId) => void;
  layers: Layers;
  clock: RefObject<{ time: number; running: boolean }>;
  running: boolean;
  pulseStart?: number | null;
  onReady?: () => void;
}

export default function AnatomyViewer(props: Props) {
  const [viewMenu, setViewMenu] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setViewMenu(document.getElementById("anatomy-view-actions"));
  }, []);
  const renderRevision = useRef(0);
  renderRevision.current++;
  const host = useRef<HTMLDivElement>(null);
  const markers = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = useRef(props);
  current.current = props;
  const actions = useRef<{
    zoom: (factor: number) => void;
    reset: () => void;
    back: () => void;
    chest: () => void;
    heart: () => void;
    device: (id: WearableSite) => void;
    select: (id: WearableSite, notify?: boolean) => void;
    opticalSide: () => void;
    demo: (view: "full" | "wrist" | "ring" | "orbit" | null) => void;
  } | null>(null);
  const atmosphereRef = useRef(true);
  const [atmosphereEnabled, setAtmosphereEnabled] = useState(true);
  const rotateRef = useRef(false);
  const [rotate, setRotate] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [cutaway, setCutaway] = useState(true);
  const [detailedVessels, setDetailedVessels] = useState(false);
  const detailedVesselsRef = useRef(false);
  const cutawayRef = useRef(true);
  const breathLabel = useRef<HTMLSpanElement>(null);
  const journeyLabel = useRef<HTMLDivElement>(null);
  const breathBar = useRef<HTMLSpanElement>(null);
  const [focus, setFocus] = useState(false);
  const [heartDetail, setHeartDetail] = useState(false);
  const heartDetailRef = useRef(false);
  const [back, setBack] = useState(false);
  const [deviceFocus, setDeviceFocus] = useState<WearableSite | null>(null);
  const deviceFocusRef = useRef<WearableSite | null>(null);
  const [isolatedDevice, setIsolatedDevice] = useState(false);
  const isolatedDeviceRef = useRef(false);

  useEffect(() => {
    if (props.inspectRequest && isWearableSite(props.inspectRequest.site))
      actions.current?.device(props.inspectRequest.site);
  }, [props.inspectRequest]);
  useEffect(() => {
    if (!ready || props.pulseStart != null) return;
    if (isWearableSite(props.site)) actions.current?.select(props.site, false);
    else actions.current?.reset();
  }, [props.site, ready, props.siteSelection]);
  const demoCameraActive = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (props.demoCamera) {
      demoCameraActive.current = true;
      actions.current?.demo(props.demoCamera.view);
    } else if (demoCameraActive.current) {
      demoCameraActive.current = false;
      actions.current?.demo(null);
    }
  }, [props.demoCamera, ready]);


  useEffect(() => {
    if (props.pulseStart != null) actions.current?.reset();
  }, [props.pulseStart]);

  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    let renderer: THREE.WebGLRenderer;
    let softwareRenderer = false;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        stencil: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      const gl = renderer.getContext();
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      const rendererName = debugInfo
        ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
        : "";
      softwareRenderer =
        /swiftshader|llvmpipe|software rasterizer/i.test(rendererName) ||
        navigator.hardwareConcurrency <= 2 ||
        navigator.webdriver;
    } catch {
      setError(true);
      // The signal workspace (PPG waveform, controls) does not depend on the
      // 3D body renderer: unlock it even when WebGL is unavailable instead of
      // leaving the app gated behind a failed canvas forever.
      current.current.onReady?.();
      return;
    }
    renderer.setPixelRatio(
      softwareRenderer ? 0.25 : Math.min(window.devicePixelRatio, 1.65),
    );
    // The static CSS floor sits behind the canvas, outside the depth buffer.
    renderer.setClearColor(0x010202, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.info.autoReset = false;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive BodyParts3D anatomical reference, presented without reproductive anatomy. Drag to orbit; pinch or scroll at any body part to zoom; use two fingers or right-drag to pan. Select sensing sites with the labeled controls.",
    );
    element.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(37, 1, 0.05, 40);
    camera.position.set(0.12, 1.87, 6.45);
    const controls = new OrbitControls(camera, element);
    controls.target.set(0, 1.82, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.minDistance = 0.1;
    controls.maxDistance = 8.5;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI - 0.3;
    controls.autoRotateSpeed = 0.7;
    controls.update();
    const env = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(env, 0.03);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.32;
    env.dispose();
    pmrem.dispose();
    const hemisphere = new THREE.HemisphereLight(0xf4eee2, 0x17212b, 0.65);
    scene.add(hemisphere);
    const key = new THREE.DirectionalLight(0xfff5e7, 2.1);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb7d5ed, 1.35);
    rim.position.set(3, 3, -3);
    scene.add(rim);
    const red = new THREE.PointLight(0xf59c83, 1.2, 7);
    red.position.set(-2, 2, 2);
    scene.add(red);
    const inspectionLight = new THREE.DirectionalLight(0xeaf2ff, 0);
    inspectionLight.visible = false;
    scene.add(inspectionLight, inspectionLight.target);
    const anatomy = createAnatomy(props.presentation);
    scene.add(anatomy.group);
    const atmosphere = createSceneAtmosphere();
    scene.add(atmosphere.group);
    const auras = createSensorAuras();
    scene.add(...Object.values(auras.sprites));
    let hoveredDevice: string | null = null;
    let lastHoverTime = 0;
    const ground = new THREE.Group();
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0x4d4640,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (const radius of [0.63, 0.79, 1.05]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius, radius + 0.003, 100),
        groundMat,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.035;
      ground.add(ring);
    }
    scene.add(ground);
    // Render anatomy directly into one antialiased buffer. Scene-wide bloom
    // would amplify moving specular/flow highlights across the body.
    let sceneVisible = true;
    let sceneDirty = true;
    const invalidateScene = () => {
      sceneDirty = true;
    };
    controls.addEventListener("change", invalidateScene);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      sceneVisible = entry.isIntersecting;
      if (sceneVisible) sceneDirty = true;
    });
    visibilityObserver.observe(element);
    let pendingResize = true;
    let renderWidth = 0;
    let renderHeight = 0;
    const resize = () => {
      // ResizeObserver must not clear the visible canvas between animation frames.
      pendingResize = true;
      sceneDirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let cameraFlight: {
      from: THREE.Vector3;
      to: THREE.Vector3;
      targetFrom: THREE.Vector3;
      targetTo: THREE.Vector3;
      elapsed: number;
    } | null = null;
    let demoOrbit: { elapsed: number; angle: number } | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onOrbitStart = () => {
      demoOrbit = null;
      cameraFlight = null;
    };
    controls.addEventListener("start", onOrbitStart);
    const clearDeviceFocus = () => {
      cameraFlight = null;
      deviceFocusRef.current = null;
      setDeviceFocus(null);
      isolatedDeviceRef.current = false;
      setIsolatedDevice(false);
    };
    const deviceCenter = new THREE.Vector3();
    const previousDeviceCenter = new THREE.Vector3();
    const cameraShift = new THREE.Vector3();
    const locateDevice = (id: WearableSite) => {
      anatomy.wearables.devices[id].getWorldPosition(deviceCenter);
      if (id === "ear") deviceCenter.y -= 0.02;
      // Leave clear space for the inspection card on a narrow touch viewport.
      if (element.clientWidth < 500)
        deviceCenter.y -= id === "wrist" ? 0.035 : 0.022;
    };
    actions.current = {
      demo: (view) => {
        demoOrbit = null;
        if (!view) { cameraFlight = null; return; }
        if (view === "wrist" || view === "ring") { actions.current?.select(view === "ring" ? "finger" : "wrist", false); return; }
        clearDeviceFocus();
        setFocus(false); setHeartDetail(false); heartDetailRef.current = false;
        rotateRef.current = false; setRotate(false);
        cameraFlight = { from: camera.position.clone(), to: new THREE.Vector3(.12, 1.87, 6.45), targetFrom: controls.target.clone(), targetTo: new THREE.Vector3(0, 1.82, 0), elapsed: 0 };
        if (view === "orbit") demoOrbit = { elapsed: 0, angle: Math.atan2(.12, 6.45) };
        sceneDirty = true;
      },
      zoom: (factor) => {
        cameraFlight = null;
        camera.position
          .sub(controls.target)
          .multiplyScalar(factor)
          .add(controls.target);
        controls.update();
      },
      reset: () => {
        clearDeviceFocus();
        camera.position.set(0.12, 1.87, 6.45);
        controls.target.set(0, 1.82, 0);
        controls.update();
        setBack(false);
        setFocus(false);
        heartDetailRef.current = false;
        setHeartDetail(false);
      },
      back: () => {
        cameraFlight = null;
        const offset = camera.position.clone().sub(controls.target);
        offset.x *= -1;
        offset.z *= -1;
        camera.position.copy(controls.target).add(offset);
        controls.update();
        setBack((b) => !b);
      },
      chest: () => {
        clearDeviceFocus();
        camera.position
          .set(0.16, 2.76, 1.72)
          .multiplyScalar(anatomy.group.scale.y);
        controls.target
          .set(0.025, 2.72, 0)
          .multiplyScalar(anatomy.group.scale.y);
        controls.update();
        setBack(false);
        setFocus(true);
        heartDetailRef.current = false;
        setHeartDetail(false);
        cutawayRef.current = true;
        setCutaway(true);
      },
      heart: () => {
        clearDeviceFocus();
        const center = anatomy.group.localToWorld(anatomy.heartCenter.clone());
        const distance = Math.max(0.67, 0.45 / camera.aspect);
        camera.position
          .copy(center)
          .add(new THREE.Vector3(0.25, 0.065, distance));
        controls.target.copy(center);
        controls.update();
        setBack(false);
        setFocus(true);
        heartDetailRef.current = true;
        setHeartDetail(true);
        cutawayRef.current = true;
        setCutaway(true);
      },
      select: (id, notify = true) => {
        clearDeviceFocus();
        if (notify) current.current.onSite(id);
        if (!anatomy.group.userData.bodyLoaded) return;
        heartDetailRef.current = false;
        setHeartDetail(false);
        setFocus(false);
        setBack(false);
        rotateRef.current = false;
        setRotate(false);
        anatomy.group.updateMatrixWorld(true);
        locateDevice(id);
        // Center the wearable itself while retaining the surrounding body region.
        const target = deviceCenter.clone();
        const wideStage = element.clientWidth >= 1100;
        const regionalDistance = id === "upperarm" ? 1.7 : id === "wrist" && element.clientWidth <= 700 ? 1.05 : 1.4;
        const distance =
          (wideStage ? regionalDistance * 1.6 : regionalDistance) *
          Math.max(1, 0.55 / camera.aspect) / 1.5;
        // View the sensor-bearing side of the head; the face points left on screen.
        const sideView = id === "ear" || id === "forehead";
        const angle = sideView ? Math.PI * 0.39 : 0.06;
        const destination = target.clone().add(new THREE.Vector3(
          Math.sin(angle) * distance,
          0.04,
          Math.cos(angle) * distance,
        ));
        if (reducedMotion.matches && !demoCameraActive.current) {
          camera.position.copy(destination);
          controls.target.copy(target);
          controls.update();
        } else {
          cameraFlight = {
            from: camera.position.clone(),
            to: destination,
            targetFrom: controls.target.clone(),
            targetTo: target,
            elapsed: 0,
          };
        }
        element.dataset.regionFocus = id;
        sceneDirty = true;
      },
      device: (id) => {
        if (!anatomy.group.userData.bodyLoaded) return;
        if (current.current.site !== id) current.current.onSite(id);
        deviceFocusRef.current = id;
        setDeviceFocus(id);
        isolatedDeviceRef.current = false;
        setIsolatedDevice(false);
        heartDetailRef.current = false;
        setHeartDetail(false);
        setFocus(false);
        setBack(false);
        rotateRef.current = false;
        setRotate(false);
        anatomy.group.updateMatrixWorld(true);
        locateDevice(id);
        const offsets: Record<WearableSite, [number, number, number]> = {
          wrist: [0.13, 0.045, 0.37],
          finger: [0.11, 0.025, 0.24],
          ear: [0.045, 0.02, 0.16],
          forehead: [0.045, 0.035, 0.46],
          carotid: [0.09, 0.03, 0.35],
          upperarm: [0.14, 0.045, 0.48],
          toe: [0.07, -0.16, 0.2],
        };
        const offset = new THREE.Vector3(...offsets[id]);
        if (id !== "finger")
          offset.applyQuaternion(
            anatomy.wearables.devices[id].getWorldQuaternion(
              new THREE.Quaternion(),
            ),
          );
        offset.multiplyScalar(Math.max(1, 0.8 / camera.aspect));
        const destination = deviceCenter.clone().add(offset);
        if (reducedMotion.matches) {
          cameraFlight = null;
          camera.position.copy(destination);
          controls.target.copy(deviceCenter);
        } else {
          cameraFlight = {
            from: camera.position.clone(),
            to: destination,
            targetFrom: controls.target.clone(),
            targetTo: deviceCenter.clone(),
            elapsed: 0,
          };
        }
        previousDeviceCenter.copy(deviceCenter);
        controls.update();
        sceneDirty = true;
      },
      opticalSide: () => {
        const id = deviceFocusRef.current;
        if (!id) return;
        isolatedDeviceRef.current = true;
        setIsolatedDevice(true);
        const device = anatomy.wearables.devices[id];
        locateDevice(id);
        const distance = {
          wrist: 0.35,
          finger: 0.2,
          ear: 0.14,
          forehead: 0.19,
          carotid: 0.2,
          upperarm: 0.5,
          toe: 0.2,
        }[id];
        const offset = new THREE.Vector3(
          distance * 0.28,
          distance * 0.38,
          -distance,
        )
          .applyQuaternion(device.getWorldQuaternion(new THREE.Quaternion()))
          .multiplyScalar(Math.max(1, 0.8 / camera.aspect));
        const destination = deviceCenter.clone().add(offset);
        if (reducedMotion.matches) {
          cameraFlight = null;
          camera.position.copy(destination);
          controls.target.copy(deviceCenter);
        } else {
          cameraFlight = {
            from: camera.position.clone(),
            to: destination,
            targetFrom: controls.target.clone(),
            targetTo: deviceCenter.clone(),
            elapsed: 0,
          };
        }
        previousDeviceCenter.copy(deviceCenter);
        sceneDirty = true;
      },
    };
    // Picking only the compact device meshes keeps clicks inexpensive. A drag
    // or a multi-touch orbit must never become an accidental selection.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const activePointers = new Set<number>();
    let pointerStart: {
      x: number;
      y: number;
      id: number;
      dragged: boolean;
    } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        (event.target !== renderer.domElement && event.pointerType !== "touch")
      )
        return;
      activePointers.add(event.pointerId);
      if (activePointers.size > 1) {
        pointerStart = null;
        return;
      }
      pointerStart = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
        dragged: false,
      };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (
        event.pointerType === "mouse" &&
        activePointers.size === 0 &&
        performance.now() - lastHoverTime > 90
      ) {
        lastHoverTime = performance.now();
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(
          anatomy.wearables.group.children.filter((d) => d.visible),
          true,
        )[0];
        hoveredDevice =
          hit && isWearableSite(hit.object.userData.site)
            ? hit.object.userData.site
            : null;
      }

      if (
        pointerStart &&
        Math.hypot(
          event.clientX - pointerStart.x,
          event.clientY - pointerStart.y,
        ) > 6
      )
        pointerStart.dragged = true;
    };
    const onPointerUp = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      if (
        !pointerStart ||
        pointerStart.id !== event.pointerId ||
        pointerStart.dragged ||
        heartDetailRef.current
      ) {
        pointerStart = null;
        return;
      }
      pointerStart = null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(
        anatomy.wearables.group.children.filter((device) => device.visible),
        true,
      )[0];
      if (hit && isWearableSite(hit.object.userData.site)) {
        element.dataset.lastPickedDevice = hit.object.userData.site;
        if (deviceFocusRef.current === hit.object.userData.site)
          current.current.onSite(hit.object.userData.site);
        else actions.current?.select(hit.object.userData.site);
      }
    };
    const onPointerCancel = (event: PointerEvent) => {
      activePointers.delete(event.pointerId);
      pointerStart = null;
    };
    const gestures = installBodyGestures(
      element,
      camera,
      controls,
      () => {
        anatomy.group.updateMatrixWorld(true);
        return isolatedDeviceRef.current
          ? [anatomy.wearables.group]
          : [anatomy.layers.body, anatomy.heart, anatomy.wearables.group];
      },
      () => {
        cameraFlight = null;
        pointerStart = null;
        hoveredDevice = null;
      },
      () => {
        sceneDirty = true;
      },
    );
    // Preserve normal left-click activation on marker buttons. Right-drag and
    // wheel gestures still reach the shared orbit surface behind the markers.
    const preserveMarkerClick = (event: PointerEvent) => {
      if (
        event.button === 0 &&
        event.pointerType !== "touch" &&
        event.target instanceof Element &&
        event.target.closest("button")
      )
        event.stopPropagation();
    };
    element.addEventListener("pointerdown", preserveMarkerClick, true);
    const clearHover = () => {
      hoveredDevice = null;
    };
    element.addEventListener("pointerleave", clearHover);
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerCancel);
    const projected = new THREE.Vector3();
    const occlusionRay = new THREE.Raycaster();
    const markerWorld = new THREE.Vector3();
    const headSiteHidden: Record<string, boolean> = {};
    let lastOcclusion = 0;
    const pickPoints: Record<WearableSite, THREE.Vector3> = {
      finger: new THREE.Vector3(0, 0, 0.0288),
      wrist: new THREE.Vector3(0, 0, 0.084),
      ear: new THREE.Vector3(0, -0.033, 0.001),
      forehead: new THREE.Vector3(0, 0, 0.012),
      carotid: new THREE.Vector3(0, 0, 0.006),
      upperarm: new THREE.Vector3(0, 0, 0.151),
      toe: new THREE.Vector3(0, 0, 0.031),
    };
    let last = 0;
    let lastRenderedRevision = -1;
    let lastRenderedTime = NaN;
    let lastRenderedHover: string | null = null;
    let lastSoftwareFrame = -Infinity;
    let previousPresentation: Presentation = "atlas";
    let disposed = false;
    let loaded = false;
    let progress = 0;
    const onLost = (event: Event) => {
      event.preventDefault();
      setError(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    renderer.setAnimationLoop((now) => {
      if (disposed) return;
      // Loading must finish even when the anatomy starts below the fold.
      const p = current.current;
      if (!loaded) {
        const nextProgress = Math.round(
          Number(anatomy.group.userData.loadProgress ?? 0) * 100,
        );
        if (nextProgress !== progress) {
          progress = nextProgress;
          setLoadProgress(progress);
        }
        if (anatomy.group.userData.bodyLoaded) {
          loaded = true;
          sceneDirty = true;
          setReady(true);
          p.onReady?.();
        }
        if (anatomy.group.userData.loadError) setError(true);
      }
      if (
        disposed ||
        current.current.active === false ||
        document.hidden ||
        !loaded ||
        (!sceneVisible && !sceneDirty)
      ) {
        last = now;
        return;
      }
      // Software WebGL can monopolize a small CI or fallback CPU at 60 fps.
      // A bounded cadence keeps controls, camera motion, and simulation
      // rendering live while leaving enough main-thread time for interaction.
      if (softwareRenderer && now - lastSoftwareFrame < 250) return;
      if (pendingResize) {
        const bounds = element.getBoundingClientRect();
        const width = Math.round(bounds.width);
        const height = Math.round(bounds.height);
        if (width < 1 || height < 1) return;
        pendingResize = false;
        if (width !== renderWidth || height !== renderHeight) {
          renderWidth = width;
          renderHeight = height;
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          sceneDirty = true;
        }
      }
      const delta = Math.min(
        (now - last) / 1000,
        softwareRenderer ? 0.25 : 0.05,
      );
      last = now;
      controls.autoRotate =
        rotateRef.current && p.clock.current.running && !gestures.active;
      const cameraChanged = !gestures.active && controls.update(delta);
      // A paused scene only needs another GPU frame after an interaction or state change.
      // Keep controls ticking so damping can settle before sleeping the expensive work.
      if (
        loaded &&
        !sceneDirty &&
        !cameraFlight &&
        !cameraChanged &&
        !gestures.active &&
        lastRenderedTime === p.clock.current.time &&
        lastRenderedRevision === renderRevision.current &&
        lastRenderedHover === hoveredDevice
      )
        return;
      anatomy.setCutaway(deviceFocusRef.current ? false : cutawayRef.current);
      anatomy.setDetailedVessels(detailedVesselsRef.current);
      anatomy.setGlow("amber");
      anatomy.setAge(p.physiology.age);
      element.dataset.hairGray = String(anatomy.group.userData.hairGray);
      const journeyProgress =
        p.pulseStart == null ? -1 : (p.clock.current.time - p.pulseStart) / 8;
      anatomy.setJourney(
        journeyProgress >= 0 && journeyProgress <= 1 ? journeyProgress : -1,
      );
      element.dataset.journeyProgress = String(journeyProgress);
      const journeyActive = journeyProgress >= 0 && journeyProgress < 1;
      if (element.parentElement)
        element.parentElement.dataset.pulseActive = String(journeyActive);
      if (journeyLabel.current) {
        journeyLabel.current.hidden = !journeyActive;
        const label =
          journeyProgress < 0.25
            ? "01 · A heartbeat begins the journey"
            : journeyProgress < 0.75
              ? "02 · Follow the pulse through the arm"
              : "03 · Light detects the pulse at the wrist";
        if (journeyLabel.current.textContent !== label)
          journeyLabel.current.textContent = label;
      }
      anatomy.setHeartFocus(heartDetailRef.current);
      const effectivePresentation: Presentation = "atlas";
      hemisphere.intensity = isolatedDeviceRef.current ? 0.8 : 0.85;
      scene.environmentIntensity = isolatedDeviceRef.current ? 0.8 : 0.42;
      key.intensity = 2.0;
      rim.intensity = 1.25;
      rim.color.set(0xffbd83);
      red.intensity = 0.65;
      if (previousPresentation !== effectivePresentation) {
        anatomy.setPresentation(effectivePresentation);
        previousPresentation = effectivePresentation;
      }
      Object.entries(p.layers).forEach(([layer, value]) => {
        anatomy.layers[layer as keyof Layers].visible =
          value && !isolatedDeviceRef.current;
      });
      anatomy.heart.visible = !isolatedDeviceRef.current;
      const cardiac = getCardiacState(p.clock.current.time, p.physiology);
      atmosphere.update(
        p.clock.current.time,
        cardiac.phase,
        reducedMotion.matches,
        atmosphereRef.current && !isolatedDeviceRef.current,
      );
      element.dataset.atmosphere = atmosphereRef.current ? "on" : "off";
      anatomy.animate(
        p.clock.current.time,
        cardiac.heartRate,
        p.physiology.activity,
        cardiac,
        p.inspection,
        p.physiology.motionHistory,
      );
      const respiratoryPhase = cardiac.breathPhase;
      const expansion = cardiac.breathExpansion;
      element.dataset.gaitPhase = String(anatomy.group.userData.gaitPhase ?? 0);
      element.dataset.stepCadence = String(
        anatomy.group.userData.stepCadence ?? 0,
      );
      element.dataset.rigJoints = String(anatomy.group.userData.rigJoints ?? 0);
      element.dataset.cardiacPhase = String(cardiac.phase);
      element.dataset.liveHeartRate = String(cardiac.heartRate);
      element.dataset.simulationTime = String(p.clock.current.time);
      if (breathLabel.current) {
        const label = respiratoryPhase < 0.5 ? "Breathing in" : "Breathing out";
        if (breathLabel.current.textContent !== label)
          breathLabel.current.textContent = label;
      }
      if (breathBar.current)
        breathBar.current.style.transform = `scaleX(${0.08 + expansion * 0.92})`;
      element.dataset.breathExpansion = String(expansion);
      anatomy.wearables.group.visible = loaded && !heartDetailRef.current;
      for (const id of WEARABLE_SITES)
        anatomy.wearables.devices[id].visible =
          !isolatedDeviceRef.current || id === deviceFocusRef.current;
      anatomy.wearables.setSelected(p.site);
      anatomy.setFlowFocus(
        p.site,
        !isolatedDeviceRef.current && !heartDetailRef.current,
      );
      element.dataset.flowFocus = p.site;
      anatomy.group.updateMatrixWorld(true);
      cameraShift.set(0, 0, 0);
      if (deviceFocusRef.current) {
        locateDevice(deviceFocusRef.current);
        cameraShift.subVectors(deviceCenter, previousDeviceCenter);
        camera.position.add(cameraShift);
        controls.target.add(cameraShift);
        previousDeviceCenter.copy(deviceCenter);
      }
      if (demoOrbit && !cameraFlight) {
        demoOrbit.elapsed = Math.min(1, demoOrbit.elapsed + delta / 2.0);
        const t = demoOrbit.elapsed;
        const angle = demoOrbit.angle + Math.PI * 2 * (t * t * (3 - 2 * t));
        camera.position.set(Math.sin(angle) * 6.45, 1.87, Math.cos(angle) * 6.45);
        controls.target.set(0, 1.82, 0);
        controls.update();
        if (t >= 1) demoOrbit = null;
      }
      const flying = Boolean(cameraFlight);
      if (cameraFlight) {
        cameraFlight.from.add(cameraShift);
        cameraFlight.to.add(cameraShift);
        cameraFlight.targetFrom.add(cameraShift);
        cameraFlight.targetTo.add(cameraShift);
        cameraFlight.elapsed = Math.min(
          1,
          cameraFlight.elapsed + delta / (deviceFocusRef.current ? 0.45 : 0.85),
        );
        const t = cameraFlight.elapsed;
        const eased = t * t * (3 - 2 * t);
        camera.position.lerpVectors(cameraFlight.from, cameraFlight.to, eased);
        controls.target.lerpVectors(
          cameraFlight.targetFrom,
          cameraFlight.targetTo,
          eased,
        );
        if (t >= 1) cameraFlight = null;
      }

      if (flying && !gestures.active) controls.update(delta);
      inspectionLight.intensity = isolatedDeviceRef.current ? 2.2 : 0;
      inspectionLight.visible = isolatedDeviceRef.current;
      inspectionLight.position.copy(camera.position);
      inspectionLight.position.y += 0.3;
      inspectionLight.target.position.copy(controls.target);
      anatomy.group.updateMatrixWorld(true);
      auras.update(
        p.clock.current.time,
        p.site,
        hoveredDevice,
        Boolean(deviceFocusRef.current),
        reducedMotion.matches,
        cardiac.phase,
      );
      const checkOcclusion = now - lastOcclusion > 120;
      for (const id of WEARABLE_SITES) {
        const sprite = auras.sprites[id];
        markerWorld.copy(anatomy.sites[id]);
        anatomy.group.localToWorld(markerWorld);
        sprite.position.copy(markerWorld);
        sprite.visible =
          loaded && !heartDetailRef.current && !isolatedDeviceRef.current;
        if (checkOcclusion && ["ear", "forehead", "carotid"].includes(id)) {
          const direction = markerWorld.clone().sub(camera.position);
          occlusionRay.set(camera.position, direction.clone().normalize());
          occlusionRay.far = direction.length() - 0.003;
          headSiteHidden[id] =
            p.layers.body &&
            occlusionRay.intersectObjects(anatomy.headOccluders, false).length >
              0;
        }
      }
      if (checkOcclusion) lastOcclusion = now;
      for (const site of SITES) {
        const marker = markers.current[site.id];
        if (!marker || !anatomy.sites[site.id]) continue;
        if (isWearableSite(site.id)) {
          projected.copy(pickPoints[site.id]);
          anatomy.wearables.devices[site.id].localToWorld(projected);
          projected.project(camera);
          marker.dataset.meshX = String(
            (projected.x * 0.5 + 0.5) * element.clientWidth,
          );
          marker.dataset.meshY = String(
            (-projected.y * 0.5 + 0.5) * element.clientHeight,
          );
        }
        projected.copy(anatomy.sites[site.id]);
        anatomy.group.localToWorld(projected);
        projected.project(camera);
        marker.style.left = `${Math.round(
          (projected.x * 0.5 + 0.5) * element.clientWidth,
        )}px`;
        marker.style.top = `${Math.round(
          (-projected.y * 0.5 + 0.5) * element.clientHeight,
        )}px`;
        marker.dataset.align = projected.x > 0.2 ? "left" : "right";
        marker.style.visibility =
          Boolean(deviceFocusRef.current) ||
          heartDetailRef.current ||
          headSiteHidden[site.id] ||
          projected.z > 1 ||
          Math.abs(projected.x) > 1.1 ||
          Math.abs(projected.y) > 1.1
            ? "hidden"
            : "visible";
      }
      renderer.info.reset();
      renderer.render(scene, camera);
      if (softwareRenderer) lastSoftwareFrame = performance.now();
      sceneDirty = false;
      lastRenderedTime = p.clock.current.time;
      lastRenderedRevision = renderRevision.current;
      lastRenderedHover = hoveredDevice;
      element.dataset.cameraDistance = String(
        camera.position.distanceTo(controls.target),
      );
      element.dataset.cameraTarget = controls.target.toArray().join(",");
      element.dataset.cameraPosition = camera.position.toArray().join(",");
      element.dataset.drawCalls = String(renderer.info.render.calls);
      element.dataset.triangles = String(renderer.info.render.triangles);
      element.dataset.heartFocus = String(heartDetailRef.current);
      element.dataset.deviceFocus = deviceFocusRef.current ?? "none";
      element.dataset.deviceIsolated = String(isolatedDeviceRef.current);
      element.dataset.bodyLoaded = String(
        Boolean(anatomy.group.userData.bodyLoaded),
      );
      element.dataset.neckPatchHeight = String(
        anatomy.group.userData.neckPatchHeight ?? 0,
      );
      element.dataset.neckReveal = String(
        anatomy.group.userData.neckReveal ?? 0,
      );
      element.dataset.headSource = String(
        anatomy.group.userData.headSource ?? "loading",
      );
      element.dataset.anatomySource = String(
        anatomy.group.userData.source ?? "loading",
      );
    });
    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      visibilityObserver.disconnect();
      controls.removeEventListener("start", onOrbitStart);
      controls.removeEventListener("change", invalidateScene);
      gestures.dispose();
      element.removeEventListener("pointerdown", preserveMarkerClick, true);
      atmosphere.dispose();
      auras.dispose();
      controls.dispose();
      anatomy.dispose();
      ground.children.forEach((o) => (o as THREE.Mesh).geometry.dispose());
      groundMat.dispose();
      envTarget.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      element.removeEventListener("pointerleave", clearHover);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerCancel);
      renderer.dispose();
      renderer.domElement.remove();
      actions.current = null;
    };
  }, []);

  return (
    <div
      hidden={props.active === false}
      data-moving={props.physiology.activity !== "rest"}
      className={`anatomy-viewer ${deviceFocus ? "inspecting-device" : ""}`}
    >
      <div
        className="pulse-narration"
        ref={journeyLabel}
        hidden
        aria-live="polite"
      />
      <div className="view-orientation">
        <span className="view-dot" />
        {back ? "Posterior" : "Anterior"}
        <button
          onClick={() => actions.current?.back()}
          title="Switch front and back view"
          aria-label="Switch front and back view"
        >
          <Cube size={16} />
        </button>
      </div>
      {viewMenu &&
        createPortal(
          <>
            <button
              disabled={!ready}
              aria-pressed={cutaway}
              onClick={() => {
                cutawayRef.current = !cutaway;
                setCutaway(!cutaway);
              }}
            >
              <span className="cutaway-indicator" /> Chest cutaway
            </button>
            <button
              disabled={!ready}
              aria-pressed={detailedVessels}
              onClick={() => {
                detailedVesselsRef.current = !detailedVessels;
                setDetailedVessels(!detailedVessels);
              }}
            >
              <span className="cutaway-indicator" /> Detailed vessels
            </button>
            <button disabled={!ready} onClick={() => actions.current?.chest()}>
              <Heart size={13} />
              Heart & lungs
              <ArrowsOut size={11} />
            </button>
            <button
              aria-pressed={heartDetail}
              disabled={!ready}
              onClick={() => actions.current?.heart()}
            >
              <Heart size={12} weight="fill" /> Heart detail
            </button>
          </>,
          viewMenu,
        )}
      <div
        ref={host}
        className="three-host"
        data-testid="anatomy-canvas"
        style={{ visibility: ready && !error ? "visible" : "hidden" }}
        aria-hidden={!ready || error}
      >
        {ready &&
          SITES.map((s) => (
            <button
              key={s.id}
              ref={(el) => {
                markers.current[s.id] = el;
              }}
              aria-label={`Select ${s.name} on body`}
              title={s.name}
              aria-pressed={props.site === s.id}
              onClick={() =>
                isWearableSite(s.id)
                  ? actions.current?.select(s.id)
                  : props.onSite(s.id)
              }
              className={`body-hotspot ${isWearableSite(s.id) ? "wearable-hotspot" : ""} ${props.site === s.id ? "selected" : ""}`}
            >
              <span className="hotspot-core" />
              {props.site === s.id && (
                <span className="hotspot-label">
                  <b>{isWearableSite(s.id) ? DEVICES[s.id].name : s.name}</b>
                  <small>
                    {isWearableSite(s.id)
                      ? props.running
                        ? "Selected · simulated PPG"
                        : "Selected · paused"
                      : s.mode === "reference"
                        ? "Pulse reference"
                        : "PPG sensing site"}
                  </small>
                </span>
              )}
            </button>
          ))}
      </div>
      {!props.hideSelector && (
        <SiteSelector
          physiology={props.physiology}
          site={props.site}
          ready={ready}
          onSelect={(id) => actions.current?.select(id)}
        />
      )}
      {!props.hideSiteCard &&
        !deviceFocus &&
        !heartDetail &&
        isWearableSite(props.site) && (
          <div className="selected-device-card" aria-live="polite">
            <span className="selected-device-status">
              <i /> READING THIS SITE
            </span>
            <div className="selected-device-details">
              <strong>{SITES.find((s) => s.id === props.site)?.name}</strong>
              <span>
                {DEVICES[props.site].name} ·{" "}
                {props.running ? "Simulated PPG" : "Paused"}
              </span>
            </div>
            <div className="selected-device-actions">
              <button
                onClick={() =>
                  isWearableSite(props.site) &&
                  actions.current?.device(props.site)
                }
              >
                Inspect device <ArrowsOut size={16} />
              </button>
              {!props.inspection && (
                <button onClick={props.onSensor}>Light & tissue ↗</button>
              )}
            </div>
          </div>
        )}
      {deviceFocus && (
        <div className="device-inspector" aria-live="polite">
          <div className="device-inspector-top">
            <span>OPTICAL SENSOR DISCOVERED</span>
            <button
              onClick={() => actions.current?.reset()}
              aria-label="Return to full body"
            >
              Full body <ArrowCounterClockwise size={13} />
            </button>
          </div>
          <h3>{DEVICES[deviceFocus].name}</h3>
          <small>{DEVICES[deviceFocus].detail}</small>
          <div
            className="device-view-modes"
            role="group"
            aria-label="Device inspection view"
          >
            <button
              aria-pressed={!isolatedDevice}
              onClick={() => actions.current?.device(deviceFocus)}
            >
              On body
            </button>
            <button
              aria-pressed={isolatedDevice}
              onClick={() => actions.current?.opticalSide()}
            >
              Optical side <ArrowsOut size={11} />
            </button>
          </div>
          <details className="device-principle">
            <summary>How the optical sensor works</summary>
            <p>{DEVICES[deviceFocus].principle}</p>
          </details>
          <div className="device-signal-status">
            <i />
            {props.running ? "Simulated stream" : "Simulation paused"}
            <span>
              Mean {props.physiology.heartRate} bpm ·{" "}
              {SITES.find((s) => s.id === deviceFocus)!.name}
            </span>
          </div>
        </div>
      )}
      {!ready && !error && (
        <div className="scene-loading" role="status" aria-live="polite">
          <PpgLoader />
          <span>
            {loadProgress >= 100 ? "Preparing the 3D anatomy…" : loadProgress > 0 ? `Downloading anatomy · ${loadProgress}%` : "Downloading the 3D anatomy…"}
          </span>
          <small className="loading-explanation">The tour starts when the model is ready. First visits can take a little longer.</small>
        </div>
      )}
      {error && (
        <div className="scene-error">
          <Cube size={35} />
          <b>The anatomy could not load</b>
          <p>
            Reload to retry the anatomy download and start the simulation,
            and use a browser with WebGL hardware acceleration.
          </p>
          <button onClick={() => window.location.reload()}>
            Reload anatomy
          </button>
        </div>
      )}
      <div className="anatomy-caption">
        <span className="caption-line" />
        <div>
          {heartDetail
            ? "Inside the heartbeat."
            : focus
              ? "The double pump."
              : "Anatomy, in detail."}
          <br />
          <span>
            {heartDetail
              ? "Change the heart rate. Watch it respond."
              : focus
                ? "Two circuits. One heartbeat."
                : "Explore the structures within."}
          </span>
        </div>
      </div>
      <div className="oxygen-legend" aria-label="Vessel coloring">
        <span>
          <i className="oxygenated" /> Oxygen-rich
        </span>
        <span>
          <i className="deoxygenated" /> Oxygen-poor
        </span>
        <small>Illustrative vessel colors</small>
      </div>
      {focus && !heartDetail && !deviceFocus && (
        <div
          className="breathing-cue"
          aria-label="Illustrative breathing cycle"
        >
          <span ref={breathLabel}>Breathing in</span>
          <span className="breathing-track">
            <span ref={breathBar} />
          </span>
        </div>
      )}
      <div className="scene-bottom">
        <div className="scene-hint">
          <ArrowsOut size={14} />
          <span>
            Drag to orbit <i>·</i> Pinch / scroll to zoom <i>·</i> Two fingers
            to pan
          </span>
        </div>
        <div className="scene-toolbar">
          <button
            className="atmosphere-toggle"
            aria-label="Decorative atmosphere"
            aria-pressed={atmosphereEnabled}
            title="Toggle decorative particles and heartbeat glow"
            onClick={() => {
              atmosphereRef.current = !atmosphereEnabled;
              setAtmosphereEnabled(!atmosphereEnabled);
            }}
          >
            ✧
          </button>
          <button
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => actions.current?.zoom(0.82)}
          >
            <Plus size={17} />
          </button>
          <button
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => actions.current?.zoom(1.22)}
          >
            <Minus size={17} />
          </button>
          <span />
          <button
            aria-label="Reset camera"
            title="Reset camera"
            onClick={() => actions.current?.reset()}
          >
            <ArrowCounterClockwise size={17} />
          </button>
          <button
            aria-label="Auto rotate anatomy"
            aria-pressed={rotate}
            title="Auto rotate"
            className={rotate ? "active" : ""}
            onClick={() => {
              rotateRef.current = !rotate;
              setRotate(!rotate);
            }}
          >
            <ArrowClockwise size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
