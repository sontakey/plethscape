import {
  createLocomotionRig,
  bindRigGeometry,
  rigShader,
  DEVICE_JOINTS,
} from "./locomotionRig";
import type { MotionTransition } from "./locomotion";
import {
  groupLungContext,
  lungContextShader,
} from "./lungEmphasis";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { createTissueMaterial, enhanceTissueShader } from "./tissueMaterials";
import { createWearables } from "./wearables";
import { WEARABLE_SITES } from "./devices";
import { createFlowTrails } from "./flowTrails";
import { fitWearablesToSkin, upperSkinGeometry } from "./surfaceFit";
import type { getCardiacState, SiteId } from "./simulation";

export type Presentation = "atlas" | "xray" | "surface";

type Layer =
  | "body"
  | "muscles"
  | "arteries"
  | "veins"
  | "nerves"
  | "skeleton"
  | "lungs"
  | "flow";
type Tissue =
  | Layer
  | "heart"
  | "valves"
  | "diaphragm"
  | "eyes"
  | "gingiva"
  | "airways"
  | "brain"
  | "cartilage"
  | "pulmonaryArteries"
  | "pulmonaryVeins"
  | "coronaryArteries"
  | "coronaryVeins";
type Point = [number, number, number];
type Activity = "rest" | "walk" | "run";
type FlowPath = {
  id: string;
  name?: string;
  points: Point[];
  kind?: string;
  radius?: number;
};
type Metadata = {
  sites?: Record<string, Point | { position: Point }>;
  hotspots?: Record<string, Point>;
  structureCount?: number;
  parts?: unknown[];
  groups?: { sourceIds?: string[] }[];
  flowPaths?: FlowPath[];
};

// Geometry is BodyParts3D 4.0, CC BY 4.0. All positions use one uniform
// source-to-scene transform. This module supplies presentation and animation.
// A localized anatomical window reveals the existing carotid tree; the scan
// remains opaque elsewhere. The device keeps its own depth/stencil occlusion.
const neckWindowShader = `
uniform vec3 atlasNeckPatch;
uniform float atlasNeckReveal;
float neckWindowAt(vec3 p) {
  vec3 center = atlasNeckPatch + vec3(-.025, -.012, -.035);
  float oval = length((p-center)/vec3(.075,.075,.09));
  return (1.-smoothstep(.55,1.,oval))*atlasNeckReveal
    * smoothstep(3.035,3.08,p.y)*(1.-smoothstep(3.23,3.27,p.y));
}
`;
const movement = `uniform float atlasTime;\n${rigShader}`;

const defaults: Record<string, Point> = {
  finger: [0.65, 1.52, 0.08],
  wrist: [0.59, 1.78, 0.07],
  ear: [0.16, 3.38, 0.035],
  forehead: [0.045, 3.52, 0.23],
  carotid: [0.085, 3.12, 0.13],
  upperarm: [0.43, 2.58, 0.05],
  toe: [0.15, 0.065, 0.3],
};

export function createAnatomy(presentation: "male" | "female" = "male") {
  const group = new THREE.Group();
  group.name = "BodyParts3D reference anatomy";
  group.scale.setScalar(presentation === "female" ? 0.94 : 1);
  group.userData.bodyLoaded = false;
  group.userData.loadProgress = 0;
  const heart = new THREE.Group();
  const layers = Object.fromEntries(
    (
      [
        "body",
        "muscles",
        "arteries",
        "veins",
        "nerves",
        "skeleton",
        "lungs",
        "flow",
      ] as Layer[]
    ).map((name) => {
      const layer = new THREE.Group();
      layer.name = name;
      group.add(layer);
      return [name, layer];
    }),
  ) as Record<Layer, THREE.Group>;
  group.add(heart);
  const headOccluders: THREE.Mesh[] = [];
  const headTextures = new Set<THREE.Texture>();
  const wearables = createWearables();
  group.add(wearables.group);
  // Fitted to the source skin and left proximal index phalanx (FJ3313).
  // These are rigid wearable attachments, not additional anatomical structures.
  const attachmentPoses = {
    finger: {
      position: new THREE.Vector3(0.629, 1.658, 0.107),
      axis: new THREE.Vector3(-0.3, 0.83, -0.47),
      rotation: 0,
    },
    wrist: {
      position: new THREE.Vector3(0.532, 1.935, 0.018),
      axis: new THREE.Vector3(-0.2, 0.946, -0.26),
      // The optical pod rests on the dorsal (back) side of the wrist.
      rotation: Math.PI,
    },
    ear: {
      // Piercing anchor on the lower anterior lobe of the visible neutral skin.
      position: new THREE.Vector3(
        presentation === "female" ? 0.153 : 0.160,
        presentation === "female" ? 3.351 : 3.335,
        presentation === "female" ? -0.042 : -0.048,
      ),
      axis: new THREE.Vector3(0, 1, 0),
      rotation: Math.PI / 2,
    },
    forehead: {
      position: new THREE.Vector3(0, 3.435, 0.025),
      axis: new THREE.Vector3(0, 1, 0),
      rotation: 0,
    },
    carotid: {
      position: new THREE.Vector3(0.085, 3.145, 0.08),
      axis: new THREE.Vector3(0, 1, 0),
      rotation: 0.65,
    },
    upperarm: {
      position: new THREE.Vector3(0.438, 2.53, -0.08),
      axis: new THREE.Vector3(-0.1, 0.99, -0.05),
      rotation: 0,
    },
    toe: {
      position: new THREE.Vector3(0.217, 0.038, 0.218),
      axis: new THREE.Vector3(-0.48, 0.03, -0.88),
      rotation: 0,
    },
  };
  const attachmentUp = new THREE.Vector3(0, 1, 0);
  const attachmentTurns = Object.fromEntries(
    WEARABLE_SITES.map((id) => [
      id,
      new THREE.Quaternion()
        .setFromUnitVectors(attachmentUp, attachmentPoses[id].axis.normalize())
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            attachmentUp,
            attachmentPoses[id].rotation,
          ),
        ),
    ]),
  ) as Record<(typeof WEARABLE_SITES)[number], THREE.Quaternion>;
  const rig = createLocomotionRig(presentation);
  const rigidDetails: {
    object: THREE.Object3D;
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    joint: number;
  }[] = [];
  const baseSites = Object.fromEntries(
    Object.entries(defaults).map(([key, p]) => [key, new THREE.Vector3(...p)]),
  );
  const sites = Object.fromEntries(
    Object.entries(baseSites).map(([key, p]) => [key, p.clone()]),
  );
  function registerThoracicVessel(point: THREE.Vector3) {
    const weight = (1 - THREE.MathUtils.smoothstep(Math.abs(point.x), 0.18, 0.34))
      * THREE.MathUtils.smoothstep(point.y, 2.40, 2.63)
      * (1 - THREE.MathUtils.smoothstep(point.y, 2.86, 3.06));
    point.y -= 0.065 * weight;
    return point;
  }
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  let disposed = false;
  let priorTime: number | null = null;
  let flowTime = 0;
  let flowTrails: ReturnType<typeof createFlowTrails> | null = null;
  let mode: Presentation = "atlas";
  let heartFocus = false;
  const shared = {
    atlasTime: { value: 0 },
    atlasJourney: { value: -1 },
    atlasFlowFocus: { value: new THREE.Vector3() },
    atlasFlowFocusRadius: { value: 0.5 },
    atlasFlowFocusStrength: { value: 0 },
    atlasJoints: { value: rig.matrices },
    atlasReal: { value: rig.real },
    atlasDual: { value: rig.dual },
    atlasCutaway: { value: 1 },
    atlasXray: { value: 0 },
    atlasSurface: { value: 0 },
    atlasHeartFocus: { value: 0 },
    atlasHairGray: { value: 0 },
    atlasContraction: { value: 0 },
    atlasBreath: { value: 0 },
    atlasLungEmphasis: { value: 1 },
    atlasDetailedVessels: { value: 0 },
    atlasOrganEmphasis: { value: 1 },
    atlasFlow: { value: 0 },
    atlasBeat: { value: 0 },
    atlasFlowEnabled: { value: 1 },
    atlasHeart: { value: new THREE.Vector3(0.11, 2.64, 0.1) },
    atlasGlowColor: { value: new THREE.Color("#ff933f") },
    atlasNeckPatch: { value: new THREE.Vector3(0, 3.145, 0) },
    atlasNeckReveal: { value: 0 },
  };
  const tissueMaterials: {
    material: THREE.MeshStandardMaterial;
    tissue: Tissue;
    lungContext: boolean;
  }[] = [];
  const colors: Record<Tissue, string> = {
    body: "#cfb59e",
    muscles: "#965046",
    arteries: "#bd303b",
    veins: "#497faa",
    nerves: "#d7b971",
    skeleton: "#756e61",
    lungs: "#bd7d88",
    heart: "#b92540",
    airways: "#d6baa7",
    brain: "#bdab9c",
    cartilage: "#77786e",
    flow: "#ffa888",
    pulmonaryArteries: "#44698d",
    pulmonaryVeins: "#b02e32",
    coronaryArteries: "#b42d31",
    coronaryVeins: "#44698d",
    valves: "#c8b4a0",
    diaphragm: "#a66359",
    eyes: "#d5cdc0",
    gingiva: "#9b625d",
  };

  function materialFor(
    tissue: Tissue,
    center: THREE.Vector3,
    lungContext = false,
  ) {
    const external =
      tissue === "body" ||
      tissue === "muscles" ||
      tissue === "skeleton" ||
      tissue === "cartilage";
    const isFlow = tissue === "flow";
    const material = createTissueMaterial(
      tissue,
      tissue === "body" ? "#80949e" : colors[tissue],
    );
    material.setValues({
      transparent: tissue === "body" || isFlow,
      opacity: tissue === "body" ? 0.12 : 1,
      depthWrite: tissue !== "body" && !isFlow,
      side: THREE.DoubleSide,
      emissive: isFlow
        ? "#ff9971"
        : tissue === "heart"
          ? "#5b0915"
          : tissue === "arteries"
            ? "#6e0907"
            : "#000000",
      emissiveIntensity: isFlow ? 0.8 : tissue === "heart" ? 0.16 : 0.04,
      polygonOffset: isFlow,
      polygonOffsetFactor: isFlow ? -2 : 0,
    });
    material.forceSinglePass = true;
    material.userData.tissue = tissue;
    material.onBeforeCompile = (shader, renderer) => {
      Object.assign(shader.uniforms, shared, {
        atlasOrganCenter: { value: center },
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
        ${movement}
        uniform float atlasContraction;
        uniform float atlasBreath;
        uniform vec3 atlasOrganCenter;
        uniform vec3 atlasHeart;
        varying vec3 atlasPosition;
      `,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
        atlasPosition = position;
        ${
          tissue === "heart" || tissue === "valves"
            ? `
          vec3 offset = transformed-atlasOrganCenter;
          float apex = clamp((atlasOrganCenter.y+.15-transformed.y)/.32,0.,1.);
          float squeeze = atlasContraction*(.035+.065*apex);
          offset *= vec3(1.-squeeze,1.-squeeze*.4,1.-squeeze*.8);
          float twist = atlasContraction*.038*apex;
          offset.xz = mat2(cos(twist),-sin(twist),sin(twist),cos(twist))*offset.xz;
          transformed = atlasOrganCenter+offset;
        `
            : ""
        }
        ${
          tissue === "lungs"
            ? `
          vec3 offset = transformed-atlasOrganCenter;
          transformed = atlasOrganCenter + offset*vec3(1.+atlasBreath*.10,1.+atlasBreath*.055,1.+atlasBreath*.13);
          transformed.y -= atlasBreath*.016;
        `
            : ""
        }
        ${tissue === "diaphragm" ? "transformed.y -= atlasBreath*.038;" : ""}
        ${
          [
            "arteries",
            "veins",
            "pulmonaryArteries",
            "pulmonaryVeins",
            "coronaryArteries",
            "coronaryVeins",
          ].includes(tissue)
            ? `
          float cardiac = 1.-smoothstep(.11,.25,distance(transformed,atlasHeart));
          transformed -= (transformed-atlasHeart)*atlasContraction*.04*cardiac;
        `
            : ""
        }
        ${
          ["body", "muscles", "skeleton", "cartilage"].includes(tissue)
            ? `
          float thorax = smoothstep(2.18,2.40,position.y)*(1.-smoothstep(2.98,3.10,position.y))
            *(1.-smoothstep(.28,.38,abs(position.x)));
          transformed.x *= 1.+atlasBreath*.055*thorax;
          transformed.z += (position.z+.12)*atlasBreath*.085*thorax;
          transformed.y += atlasBreath*.008*thorax;
        `
            : ""
        }
        transformed = atlasGait(transformed);
      `,
        );
      if (tissue === "lungs") {
        shader.vertexShader = shader.vertexShader.replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
          objectNormal = normalize(objectNormal / vec3(1.+atlasBreath*.10,1.+atlasBreath*.055,1.+atlasBreath*.13));
        `,
        );
      }
      if (tissue === "heart" || tissue === "valves") {
        shader.vertexShader = shader.vertexShader.replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
          float normalApex = clamp((atlasOrganCenter.y+.15-position.y)/.32,0.,1.);
          float normalSqueeze = atlasContraction*(.035+.065*normalApex);
          objectNormal /= vec3(1.-normalSqueeze,1.-normalSqueeze*.4,1.-normalSqueeze*.8);
          float normalTwist = atlasContraction*.038*normalApex;
          objectNormal.xz = mat2(cos(normalTwist),-sin(normalTwist),sin(normalTwist),cos(normalTwist))*objectNormal.xz;
          objectNormal = normalize(objectNormal);
          `,
        );
      }
      shader.vertexShader = shader.vertexShader.replace(
        "#include <defaultnormal_vertex>",
        "objectNormal = normalize(mat3(atlasSkinMatrix()) * objectNormal);\n#include <defaultnormal_vertex>",
      );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
        ${neckWindowShader}
        uniform float atlasCutaway;
        uniform float atlasXray;
        uniform float atlasSurface;
        uniform float atlasHeartFocus;
        uniform float atlasLungEmphasis;
        uniform float atlasDetailedVessels;
        uniform float atlasOrganEmphasis;
        uniform float atlasFlow;
        uniform vec3 atlasHeart;
        varying vec3 atlasPosition;
      `,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        if (atlasPosition.y > ${tissue === "arteries" ? "3.30" : "3.100"}) discard;
        ${
          tissue === "eyes"
            ? "discard;"
            : tissue !== "body"
              ? "if (atlasPosition.y > 3.27 && atlasHeartFocus < .5) discard;"
              : ""
        }
        ${
          external
            ? `
          vec2 windowPosition = vec2(atlasPosition.x/.365,(atlasPosition.y-2.62)/.48);
          if (atlasCutaway>.5 && dot(windowPosition,windowPosition)<1. && atlasPosition.z>.015) discard;
        `
            : ""
        }
        ${
          ["arteries", "veins", "pulmonaryArteries", "pulmonaryVeins"].includes(
            tissue,
          )
            ? "if (atlasHeartFocus>.5 && (distance(atlasPosition,atlasHeart)>.20 || atlasPosition.y<atlasHeart.y+.065 || abs(atlasPosition.x-atlasHeart.x)>.14)) discard;"
            : ""
        }
        ${
          !["body", "eyes", "gingiva"].includes(tissue)
            ? `
          if (atlasSurface>.5) {
            vec2 surfaceWindow = vec2(atlasPosition.x/.365,(atlasPosition.y-2.62)/.48);
            if (atlasCutaway<.5 || dot(surfaceWindow,surfaceWindow)>1.) discard;
          }
        `
            : ""
        }
      `,
        );
      if (tissue === "airways") {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          if (atlasDetailedVessels < .5 && atlasLungEmphasis > .5
            && atlasPosition.y < 2.98 && abs(atlasPosition.x) > .045) discard;`,
        );
      }
      if (["arteries", "veins", "pulmonaryArteries", "pulmonaryVeins"].includes(tissue)) {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          const float atlasSystemicContext = ${tissue === "arteries" || tissue === "veins" ? "1." : "0."};
          ${lungContextShader}`,
        );
      }
      if (tissue === "body") {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "uniform float atlasFlow;",
            "uniform float atlasFlow;\nuniform vec3 atlasGlowColor;",
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            float rim = pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.1);
            diffuseColor.a = mix(.012+rim*.42,1.,atlasSurface)*(1.-atlasHeartFocus);
            totalEmissiveRadiance = atlasGlowColor*(.035+pow(rim,1.5)*2.1)*(1.-atlasSurface)*(1.-atlasHeartFocus);
            float gentleHead = smoothstep(3.0,3.10,atlasPosition.y);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.32,.21,.145), gentleHead);
            diffuseColor.a = mix(diffuseColor.a, .40*(1.-atlasHeartFocus), gentleHead);
            totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(.018,.009,.006)+atlasGlowColor*pow(rim,2.)*.12, gentleHead);
            float patchSkin = 1.-smoothstep(.038,.073,distance(atlasPosition,atlasNeckPatch));
            diffuseColor.a = max(diffuseColor.a,patchSkin*.42*(1.-atlasHeartFocus));
            diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.32,.21,.145),patchSkin*.65);
            diffuseColor.a *= 1.-.78*neckWindowAt(atlasPosition);

          `,
          );
      }
      if (
        [
          "arteries",
          "pulmonaryArteries",
          "pulmonaryVeins",
          "coronaryArteries",
        ].includes(tissue)
      ) {
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "uniform float atlasFlow;",
            "uniform float atlasFlow;\nuniform float atlasContraction;\nuniform float atlasFlowEnabled;",
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            totalEmissiveRadiance += diffuseColor.rgb * atlasFlowEnabled * (.035 + .16 * atlasContraction);
            totalEmissiveRadiance += diffuseColor.rgb * neckWindowAt(atlasPosition) * (.18 + .4 * atlasContraction);
          `,
          );
      }
      enhanceTissueShader(shader, tissue);
    };
    material.customProgramCacheKey = () =>
      `bodyparts-${tissue}-physical-v3-${lungContext}`;
    materials.add(material);
    tissueMaterials.push({ material, tissue, lungContext });
    return material;
  }

  function setPresentation(next: Presentation) {
    mode = next;
    shared.atlasXray.value = next === "xray" ? 1 : 0;
    shared.atlasSurface.value = next === "surface" && !heartFocus ? 1 : 0;
    for (const { material, tissue, lungContext } of tissueMaterials) {
      let transparent = [
        "body",
        "flow",
        "muscles",
        "skeleton",
        "cartilage",
        "brain",
        "lungs",
      ].includes(tissue);
      if (tissue === "lungs" && next === "atlas" && !heartFocus)
        transparent = false;
      if (lungContext) transparent = true;
      // Keep native lung surfaces opaque and depth sorted in the atlas view.
      material.alphaToCoverage = false;
      if (tissue === "lungs" || lungContext) material.side = THREE.FrontSide;
      if (tissue === "body" && next === "surface" && !heartFocus)
        transparent = false;
      if (tissue === "nerves" || tissue === "airways")
        transparent = true;
      if (
        heartFocus &&
        ["arteries", "veins", "pulmonaryArteries", "pulmonaryVeins"].includes(
          tissue,
        )
      )
        transparent = true;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.depthWrite = !transparent;
      // Opaque anatomy in front of a device clears that device's stencil mark.
      material.stencilWrite = !transparent;
      material.stencilRef = 0;
      material.stencilZPass = THREE.ReplaceStencilOp;
      if (tissue === "body") {
        material.color.set(
          next === "surface" && !heartFocus ? "#a6775e" : "#80949e",
        );
        material.side = THREE.FrontSide;
      }
      material.opacity =
        tissue === "body"
          ? 0.12
          : tissue === "muscles"
            ? mode === "atlas"
              ? 0.035
              : 0.025
            : tissue === "skeleton"
              ? mode === "atlas"
                ? 0.14
                : 0.22
              : tissue === "cartilage"
                ? mode === "atlas"
                  ? 0.1
                  : 0.12
                : tissue === "lungs"
                  ? mode === "atlas"
                    ? 1
                    : 0.22
                  : tissue === "brain"
                    ? mode === "atlas"
                      ? 0.12
                      : 0.25
                    : 1;
      if (tissue === "nerves") material.opacity = 0.22;
      if (tissue === "airways") material.opacity = 0.58;
      if (tissue === "diaphragm") {
        material.opacity = 1;
        material.side = THREE.FrontSide;
      }
      if (heartFocus) {
        if (
          ["arteries", "veins", "pulmonaryArteries", "pulmonaryVeins"].includes(
            tissue,
          )
        )
          material.opacity = 0.5;
        if (tissue === "lungs") material.opacity = 0.055;
        else if (["muscles", "skeleton", "cartilage", "brain"].includes(tissue))
          material.opacity = 0.025;
        else if (tissue === "nerves") {
          material.opacity = 0.05;
        }
      }
    }
    for (const name of [
      "body",
      "muscles",
      "skeleton",
      "nerves",
      "lungs",
    ] as Layer[]) {
      for (const child of layers[name].children) child.visible = !heartFocus;
    }
    if (flowTrails) flowTrails.visible = !heartFocus;
  }

  function tissueOf(mesh: THREE.Mesh): Tissue {
    const layer =
      `${mesh.userData.tissue ?? ""} ${mesh.userData.layer ?? ""} ${mesh.name}`.toLowerCase();
    if (/pulmonary/.test(layer) && /arter/.test(layer))
      return "pulmonaryArteries";
    if (/pulmonary/.test(layer) && /vein|venous/.test(layer))
      return "pulmonaryVeins";
    if (/coronary/.test(layer) && /arter/.test(layer))
      return "coronaryArteries";
    if (/coronary/.test(layer) && /vein|venous/.test(layer))
      return "coronaryVeins";
    if (/valve/.test(layer)) return "valves";
    if (/diaphragm/.test(layer)) return "diaphragm";
    if (/\beye/.test(layer)) return "eyes";
    if (/gingiva/.test(layer)) return "gingiva";
    if (/heart|cardiac/.test(layer)) return "heart";
    if (/airway|bronch|trache/.test(layer)) return "airways";
    if (/lung|pulmonary_lobe/.test(layer)) return "lungs";
    if (/brain|cereb/.test(layer)) return "brain";
    if (/cartilage/.test(layer)) return "cartilage";
    if (/arter/.test(layer)) return "arteries";
    if (/vein|venous/.test(layer)) return "veins";
    if (/nerv|neural/.test(layer)) return "nerves";
    if (/skelet|bone/.test(layer)) return "skeleton";
    if (/musc/.test(layer)) return "muscles";
    return "body";
  }

  const draco = new DRACOLoader()
    .setDecoderPath(import.meta.env.BASE_URL + "models/draco/")
    .setWorkerLimit(2);
  const loader = new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .setDRACOLoader(draco);
  Promise.all([
    loader.loadAsync(
      import.meta.env.BASE_URL + "models/bodyparts-atlas.glb",
      (event) => {
        if (!disposed && event.total)
          group.userData.loadProgress = event.loaded / event.total;
      },
    ),
    fetch(
      import.meta.env.BASE_URL + "models/bodyparts-atlas-metadata.json",
    ).then((r) => {
      if (!r.ok) throw new Error("Anatomy metadata unavailable");
      return r.json() as Promise<Metadata>;
    }),
    loader.loadAsync(import.meta.env.BASE_URL + "models/neutral-skin.glb"),
    loader.loadAsync(
      import.meta.env.BASE_URL +
        (presentation === "female"
          ? "models/scanned-head-female.glb"
          : "models/scanned-head.glb"),
    ),
  ])
    .then(async ([gltf, metadata, skin, scanned]) => {
      if (disposed) {
        for (const source of [gltf, skin, scanned])
          source.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.geometry.dispose();
              (Array.isArray(o.material) ? o.material : [o.material]).forEach(
                (m) => m.dispose(),
              );
            }
          });
        return;
      }
      gltf.scene.updateMatrixWorld(true);
      skin.scene.updateMatrixWorld(true);
      scanned.scene.updateMatrixWorld(true);
      let scannedHead: THREE.Mesh | undefined;
      scanned.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const geometry = object.geometry;
        for (const name of ["position", "normal"]) {
          const attribute = geometry.getAttribute(name);
          if (!attribute) continue;
          const unpacked = new Float32Array(attribute.count * 3);
          for (let i = 0; i < attribute.count; i++) {
            unpacked[i * 3] = attribute.getX(i);
            unpacked[i * 3 + 1] = attribute.getY(i);
            unpacked[i * 3 + 2] = attribute.getZ(i);
          }
          geometry.setAttribute(name, new THREE.BufferAttribute(unpacked, 3));
        }
        geometry.applyMatrix4(object.matrixWorld);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const material = object.material as THREE.MeshStandardMaterial;
        material.roughness = 0.7;
        material.vertexColors = false;
        material.transparent = true;
        material.depthWrite = true;
        material.emissive.setRGB(0.018, 0.009, 0.006);
        material.side = THREE.FrontSide;
        material.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, shared);
          shader.vertexShader = shader.vertexShader
            .replace(
              "#include <common>",
              `#include <common>\nvarying float headHeight; varying vec3 headRestPosition; attribute vec3 color; varying float hairWeight;\n${movement}`,
            )
            .replace(
              "#include <begin_vertex>",
              "#include <begin_vertex>\nheadHeight = position.y; headRestPosition = position; hairWeight = color.r; transformed = atlasGait(transformed);",
            )
            .replace(
              "#include <defaultnormal_vertex>",
              "vec3 neckRadial = normalize(vec3(position.x, .025, position.z + .025)); objectNormal = normalize(mix(objectNormal, neckRadial, (1.-color.r)*smoothstep(3.10,3.135,position.y)*(1.-smoothstep(3.20,3.30,position.y)))); objectNormal = normalize(mat3(atlasSkinMatrix()) * objectNormal);\n#include <defaultnormal_vertex>",
            );
          shader.fragmentShader = shader.fragmentShader
            .replace(
              "#include <common>",
              `#include <common>\nvarying float headHeight; varying vec3 headRestPosition; varying float hairWeight; uniform float atlasHairGray; uniform float atlasHeartFocus; ${neckWindowShader}`,
            )
            .replace(
              "#include <color_fragment>",
              "#include <color_fragment>\nif(atlasHeartFocus > .5) discard; diffuseColor.rgb = mix(vec3(.32,.21,.145), diffuseColor.rgb, smoothstep(3.26,3.34,headHeight)); diffuseColor.a *= mix(.40,1.,smoothstep(3.18,3.30,headHeight))*(1.-.50*neckWindowAt(headRestPosition));",
            );
        };
        const headFinish = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          headFinish.call(material, shader, renderer);
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <normal_fragment_maps>",
            "vec3 neckNormal = normal;\n#include <normal_fragment_maps>\nnormal = normalize(mix(neckNormal,normal,smoothstep(3.26,3.34,headHeight)));",
          );
        };
        const coveredHeadFinish = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          coveredHeadFinish.call(material, shader, renderer);
          // Keep the local anatomical window's coverage instead of Three's
          // opaque-material alpha override. All other head pixels remain opaque.
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <opaque_fragment>",
            "gl_FragColor = vec4(outgoingLight, diffuseColor.a);",
          );
        };
        if (presentation === "female") {
          const finish = material.onBeforeCompile;
          material.onBeforeCompile = (shader, renderer) => {
            finish.call(material, shader, renderer);
            shader.fragmentShader = shader.fragmentShader.replaceAll(
              "smoothstep(3.26,3.34,headHeight)",
              "smoothstep(3.215,3.285,headHeight)",
            );
          };
        }
        const neckBlendFinish = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          neckBlendFinish.call(material, shader, renderer);
          shader.fragmentShader = shader.fragmentShader.replaceAll(
            "headHeight)",
            "headHeight + max(0.,headRestPosition.z-.02)*.8 + hairWeight)",
          );
        };
        const ageFinish = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
          ageFinish.call(material, shader, renderer);
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            float hairLuma = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));
            float hairline = mix(3.34,3.57,smoothstep(-.10,.15,headRestPosition.z));
            float scalpHair = smoothstep(hairline-.06,hairline+.025,headRestPosition.y);
            vec3 earOffset = (vec3(abs(headRestPosition.x),headRestPosition.y,headRestPosition.z) - vec3(.165,3.375,-.045)) / vec3(.065,.058,.043);
            float outsideEar = smoothstep(.95,1.45,length(earOffset));
            float hairRegion = max(hairWeight, scalpHair) * outsideEar;
            float hairPigment = 1.-smoothstep(.18,.30,hairLuma);
            vec3 silverHair = vec3(.92,.95,1.) * (.07 + 1.35 * sqrt(max(0.,hairLuma)));
            diffuseColor.rgb = mix(diffuseColor.rgb, silverHair, atlasHairGray * hairRegion * hairPigment);`,
          );
        };
        material.customProgramCacheKey = () =>
          `scanned-head-age-v9-${presentation}`;
        for (const texture of [material.map, material.normalMap])
          if (texture) {
            texture.anisotropy = 4;
            headTextures.add(texture);
          }
        geometries.add(geometry);
        materials.add(material);
        bindRigGeometry(geometry);
        scannedHead = new THREE.Mesh(geometry, material);
        const headVertex = scannedHead.getVertexPosition.bind(scannedHead);
        scannedHead.getVertexPosition = (index, target) => {
          headVertex(index, target);
          return rig.transformVertex(geometry, index, target);
        };
        scannedHead.name = "Scanned presentation head";
        scannedHead.userData.tissue = "presentationHead";
        scannedHead.frustumCulled = false;
        scannedHead.renderOrder = 4;
        layers.body.add(scannedHead);
        // The color pass writes its own depth. A duplicate depth prepass can
        // disagree at grazing angles on the skinned neck and create hard patches.
        headOccluders.push(scannedHead);
      });
      if (!scannedHead)
        throw new Error("Scanned presentation head unavailable");
      group.userData.headSource =
        presentation === "female"
          ? "Renderpeople Claudia Rigged 002"
          : "Renderpeople Eric Rigged 001";
      let presentationSkin: THREE.Mesh | undefined;
      skin.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) presentationSkin = o;
      });
      if (!presentationSkin)
        throw new Error("Neutral presentation skin unavailable");
      let fittingSkin: THREE.Mesh | undefined;
      const heartBounds = new THREE.Box3();
      const heartMaterials: THREE.MeshStandardMaterial[] = [];
      const prepareObject = (object: THREE.Object3D) => {
        if (!(object instanceof THREE.Mesh)) return;
        const tissue = tissueOf(object);
        const bakedSkin = object.name === "body";
        const sourceMesh = bakedSkin ? presentationSkin! : object;
        const geometry = sourceMesh.geometry;
        if (bakedSkin) object.geometry.dispose();
        // Expand normalized quantized attributes before baking the common glTF
        // transform. Applying matrices to normalized integer storage clamps it.
        for (const name of ["position", "normal"]) {
          const attribute = geometry.getAttribute(name);
          if (!attribute) continue;
          const unpacked = new Float32Array(attribute.count * 3);
          for (let i = 0; i < attribute.count; i++) {
            unpacked[i * 3] = attribute.getX(i);
            unpacked[i * 3 + 1] = attribute.getY(i);
            unpacked[i * 3 + 2] = attribute.getZ(i);
          }
          geometry.setAttribute(name, new THREE.BufferAttribute(unpacked, 3));
        }
        geometry.applyMatrix4(sourceMesh.matrixWorld);
        const positions = geometry.getAttribute("position");
        const point = new THREE.Vector3();
        if (bakedSkin) {
          // Remove the original head from rendering AND surface picking.
          const indices = geometry.getIndex()!;
          const kept: number[] = [];
          for (let i = 0; i < indices.count; i += 3) {
            const a = indices.getX(i),
              b = indices.getX(i + 1),
              c = indices.getX(i + 2);
            if (
              Math.min(
                positions.getY(a),
                positions.getY(b),
                positions.getY(c),
              ) <= 3.1
            )
              kept.push(a, b, c);
          }
          geometry.setIndex(kept);
        }
        // Display registration between the separate HRA lungs and BP3D heart.
        // Lower the cardiac assembly as one unit; keep its coronary vessels attached.
        if (["heart", "valves", "coronaryArteries", "coronaryVeins"].includes(tissue)) {
          geometry.translate(0, -0.065, 0);
        } else if (tissue === "lungs") {
          geometry.translate(object.name === "lung_left" ? 0.018 : -0.012, 0, -0.025);
        } else if (tissue === "diaphragm") {
          geometry.translate(0, -0.065, 0);
        } else if (["arteries", "veins", "pulmonaryArteries", "pulmonaryVeins"].includes(tissue)
          && object.name !== "portal_veins") {
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i);
            registerThoracicVessel(point);
            positions.setXYZ(i, point.x, point.y, point.z);
          }
          geometry.computeVertexNormals();
        }
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
        geometries.add(geometry);
        const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
        const material = materialFor(tissue, center);
        if (object.name === "face_details") {
          const finish = material.onBeforeCompile;
          material.onBeforeCompile = (shader, renderer) => {
            finish.call(material, shader, renderer);
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <color_fragment>",
              "#include <color_fragment>\nif (abs(atlasPosition.x)<.13 && atlasPosition.z>.06) discard;",
            );
          };
          material.customProgramCacheKey = () => "external-ears-calm-face-v1";
        }
        // Preserve peripheral depth occlusion; only thoracic vessel triangles
        // blend into context so the beating heart and breathing lungs read clearly.
        const contextMaterial =
          (tissue === "arteries" || tissue === "veins") &&
          groupLungContext(geometry)
            ? materialFor(tissue, center, true)
            : null;
        bindRigGeometry(
          geometry,
          tissue === "skeleton" || tissue === "cartilage",
        );
        const mesh = new THREE.Mesh(
          geometry,
          contextMaterial ? [material, contextMaterial] : material,
        );
        // Keep surface picking consistent with GPU skinning during locomotion.
        const originalVertex = mesh.getVertexPosition.bind(mesh);
        mesh.getVertexPosition = (index, target) => {
          originalVertex(index, target);
          return rig.transformVertex(geometry, index, target);
        };
        mesh.frustumCulled = false;
        mesh.name = object.name;
        mesh.userData = { ...object.userData, tissue };
        if (tissue === "body") mesh.renderOrder = 4;
        else if (tissue === "lungs") mesh.renderOrder = 2;
        else if (/arteries|veins|nerves/i.test(tissue)) mesh.renderOrder = 1;
        const layer =
          tissue === "heart" || tissue === "valves"
            ? heart
            : tissue === "brain"
              ? layers.nerves
              : tissue === "airways" || tissue === "diaphragm"
                ? layers.lungs
                : tissue === "cartilage"
                  ? layers.skeleton
                  : tissue === "eyes" || tissue === "gingiva"
                    ? layers.body
                    : tissue.endsWith("Arteries")
                      ? layers.arteries
                      : tissue.endsWith("Veins")
                        ? layers.veins
                        : layers[tissue as Layer];
        layer.add(mesh);
        if (bakedSkin) {
          const samplingGeometry = upperSkinGeometry(geometry, 3);
          const samplingMaterial = new THREE.MeshBasicMaterial({
            side: THREE.FrontSide,
          });
          geometries.add(samplingGeometry);
          materials.add(samplingMaterial);
          fittingSkin = new THREE.Mesh(samplingGeometry, samplingMaterial);
          fittingSkin.updateMatrixWorld(true);
        }
        if (tissue === "heart" || tissue === "valves") {
          heartBounds.union(geometry.boundingBox!);
          heartMaterials.push(material);
        }
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).forEach((m) => m.dispose());
      };
      const sourceObjects: THREE.Object3D[] = [];
      gltf.scene.traverse(object => sourceObjects.push(object));
      let sliceStart = performance.now();
      for (const object of sourceObjects) {
        prepareObject(object);
        if (performance.now() - sliceStart > 8) {
          await new Promise<void>(resolve => setTimeout(resolve, 0));
          if (disposed) return;
          sliceStart = performance.now();
        }
      }
      (Array.isArray(presentationSkin.material)
        ? presentationSkin.material
        : [presentationSkin.material]
      ).forEach((m) => m.dispose());
      if (!fittingSkin)
        throw new Error("Skin surface unavailable for wearable fitting");
      // Fit the temple against the new head, while retaining the original neck surface.
      const fitParts = [fittingSkin.geometry, scannedHead.geometry].map(
        (source) => {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", source.getAttribute("position"));
          geometry.setIndex(source.getIndex());
          return geometry;
        },
      );
      const fittedGeometry = mergeGeometries(fitParts)!;
      fittedGeometry.computeVertexNormals();
      fittedGeometry.computeBoundingBox();
      fittedGeometry.computeBoundingSphere();
      geometries.add(fittedGeometry);
      fittingSkin.geometry = fittedGeometry;
      fitParts.forEach((geometry) => geometry.dispose());
      wearables.devices.forehead.traverse((part) => {
        if (part instanceof THREE.Mesh) part.geometry.scale(0.86, 0.86, 1);
      });
      const fitted = fitWearablesToSkin(
        fittingSkin,
        wearables.devices.forehead,
        wearables.devices.carotid,
        attachmentPoses.forehead.position,
      );
      attachmentPoses.forehead.position.copy(fitted.temple.position);
      attachmentTurns.forehead.copy(fitted.temple.quaternion);
      attachmentPoses.carotid.position.copy(fitted.neck.position);
      shared.atlasNeckPatch.value.copy(fitted.neck.position);
      group.userData.neckPatchHeight = fitted.neck.position.y;
      attachmentTurns.carotid.copy(fitted.neck.quaternion);
      if (!heartBounds.isEmpty()) {
        shared.atlasHeart.value.copy(
          heartBounds.getCenter(new THREE.Vector3()),
        );
        for (const mat of heartMaterials) {
          // All cardiac substructures contract around the same source heart.
          const original = mat.onBeforeCompile;
          mat.onBeforeCompile = (shader, renderer) => {
            original.call(mat, shader, renderer);
            shader.uniforms.atlasOrganCenter = shared.atlasHeart;
          };
        }
      }
      for (const [key, value] of Object.entries(
        metadata.sites ?? metadata.hotspots ?? {},
      )) {
        const point = Array.isArray(value) ? value : value.position;
        if (Array.isArray(point) && point.length === 3 && baseSites[key])
          baseSites[key].set(...point);
      }
      // Device markers follow the fitted sensor, rather than the original
      // fingertip pad / radial landmark used for bare anatomical hotspots.
      for (const id of WEARABLE_SITES) {
        baseSites[id]
          .set(
            0,
            id === "ear" ? -0.012 : 0,
            {
              finger: 0.031,
              wrist: 0.088,
              ear: 0.0022,
              forehead: 0.012,
              carotid: 0.006,
              upperarm: 0.151,
              toe: 0.031,
            }[id],
          )
          .applyQuaternion(attachmentTurns[id])
          .add(attachmentPoses[id].position);
      }
      group.userData.structureCount =
        metadata.structureCount ??
        metadata.parts?.length ??
        metadata.groups?.reduce(
          (sum, g) => sum + (g.sourceIds?.length ?? 0),
          0,
        ) ??
        0;
      group.userData.source = "BodyParts3D 4.0";
      flowTrails = createFlowTrails(
        (metadata.flowPaths ?? []).map((route) => ({
          ...route,
          points: route.points.map((p) => registerThoracicVessel(new THREE.Vector3(...p))),
        })),
        shared,
        movement,
      );
      bindRigGeometry(flowTrails.geometry);
      geometries.add(flowTrails.geometry);
      materials.add(flowTrails.material);
      layers.flow.add(flowTrails);
      group.userData.flowStyle = "luminous-trails";
      group.userData.flowTriangles = flowTrails.geometry.index!.count / 3;
      setPresentation(mode);
      // Conservative animated bounds avoid ray-test rejection in a wide stride.
      for (const geometry of geometries) {
        geometry.boundingBox?.expandByScalar(0.9);
        if (geometry.boundingSphere) geometry.boundingSphere.radius += 0.9;
      }
      group.userData.bodyLoaded = true;
      group.userData.loadProgress = 1;
    })
    .catch((error) => {
      if (!disposed) {
        group.userData.loadError = String(error);
        console.error("BodyParts3D anatomy could not load", error);
      }
    });

  function animate(
    time: number,
    heartRate: number,
    activity: Activity,
    cardiac: ReturnType<typeof getCardiacState>,
    inspection = false,
    motionHistory?: readonly MotionTransition[],
  ) {
    const elapsed =
      priorTime === null ? 0 : THREE.MathUtils.clamp(time - priorTime, 0, 0.06);
    priorTime = time;
    shared.atlasTime.value = time;
    const motion = rig.pose(time, activity, motionHistory);
    group.userData.gaitPhase = motion.phase;
    group.userData.stepCadence = motion.cadence;
    group.userData.rigJoints = rig.bones.length;
    const phase = cardiac.phase;
    shared.atlasContraction.value = Math.exp(
      -Math.pow((phase - 0.16) / 0.115, 2),
    );
    shared.atlasBreath.value = cardiac.breathExpansion;
    shared.atlasOrganEmphasis.value = mode === "atlas" && !heartFocus ? 1 : 0;
    shared.atlasLungEmphasis.value =
      layers.lungs.visible && mode === "atlas" && !heartFocus ? 1 : 0;
    flowTime +=
      elapsed *
      0.7 *
      Math.sqrt(heartRate / 72) *
      (0.8 + shared.atlasContraction.value * 0.5);
    shared.atlasFlow.value = inspection ? time * 0.7 : flowTime;
    shared.atlasBeat.value = cardiac.cycles;
    shared.atlasFlowEnabled.value = layers.flow.visible && !heartFocus ? 1 : 0;
    group.position.y = 0;
    for (const id of WEARABLE_SITES) {
      rig.transformPoint(baseSites[id], sites[id], DEVICE_JOINTS[id]);
      rig.attach(
        wearables.devices[id],
        attachmentPoses[id].position,
        attachmentTurns[id],
        DEVICE_JOINTS[id],
      );
    }
    for (const detail of rigidDetails)
      rig.attach(
        detail.object,
        detail.position,
        detail.quaternion,
        detail.joint,
      );
  }

  function dispose() {
    disposed = true;
    draco.dispose();
    rig.dispose();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    headTextures.forEach((texture) => texture.dispose());
    wearables.dispose();
    group.clear();
  }
  return {
    group,
    heart,
    layers,
    sites,
    wearables,
    headOccluders,
    animate,
    setPresentation,
    setDetailedVessels: (enabled: boolean) => {
      shared.atlasDetailedVessels.value = enabled ? 1 : 0;
      group.userData.detailedVessels = enabled;
    },
    setAge: (age: number) => {
      const amount = THREE.MathUtils.smoothstep(age, 35, 75);
      shared.atlasHairGray.value = amount;
      group.userData.hairGray = amount;
    },
    heartCenter: shared.atlasHeart.value,
    setHeartFocus: (enabled: boolean) => {
      if (enabled === heartFocus) return;
      heartFocus = enabled;
      shared.atlasHeartFocus.value = enabled ? 1 : 0;
      setPresentation(mode);
    },
    setFlowFocus: (site: SiteId, enabled: boolean) => {
      shared.atlasNeckReveal.value = site === "carotid" && enabled ? 1 : 0;
      shared.atlasFlowFocus.value.copy(sites[site]);
      group.userData.neckReveal = shared.atlasNeckReveal.value;
      shared.atlasFlowFocusRadius.value =
        site === "ear" || site === "forehead"
          ? 0.65
          : site === "upperarm"
            ? 0.6
            : 0.48;
      shared.atlasFlowFocusStrength.value = enabled ? 1 : 0;
    },
    setJourney: (progress: number) => {
      shared.atlasJourney.value = progress;
    },
    setGlow: (color: "blue" | "amber") => {
      shared.atlasGlowColor.value.set(color === "blue" ? "#5babff" : "#ff933f");
    },
    setCutaway: (enabled: boolean) => {
      shared.atlasCutaway.value = enabled ? 1 : 0;
    },
    dispose,
  };
}
