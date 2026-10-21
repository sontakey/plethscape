import * as THREE from "three";
import { WEARABLE_SITES, type WearableSite } from "./devices";
import type { Theme } from "./theme";

/** Seven soft billboards; no particle simulation or geometry updates. */
export function createSensorAuras() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.28, "rgba(255,255,255,0)");
  gradient.addColorStop(0.46, "rgba(255,255,255,.42)");
  gradient.addColorStop(0.6, "rgba(255,255,255,.15)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  const sizes: Record<WearableSite, number> = {
    finger: 0.11,
    wrist: 0.17,
    ear: 0.115,
    forehead: 0.1,
    carotid: 0.12,
    upperarm: 0.19,
    toe: 0.1,
  };
  const sprites = Object.fromEntries(
    WEARABLE_SITES.map((site) => {
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: "#ffae69",
        transparent: true,
        opacity: 0.55,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.name = `${site} soft discovery aura`;
      sprite.scale.setScalar(sizes[site]);
      sprite.renderOrder = 5;
      sprite.raycast = () => {};
      return [site, sprite];
    }),
  ) as Record<WearableSite, THREE.Sprite>;
  let lightTheme = false;
  return {
    sprites,
    setTheme(theme: Theme) {
      lightTheme = theme === "light";
      for (const sprite of Object.values(sprites)) {
        sprite.material.color.set(lightTheme ? "#5277a6" : "#ffae69");
        sprite.material.blending = lightTheme
          ? THREE.NormalBlending
          : THREE.AdditiveBlending;
        sprite.material.needsUpdate = true;
      }
    },
    update(
      time: number,
      selected: string,
      hovered: string | null,
      focused: boolean,
      reducedMotion: boolean,
      cardiacPhase = 0,
    ) {
      for (const [i, site] of WEARABLE_SITES.entries()) {
        const emphasis =
          hovered === site ? 1.1 : selected === site ? 1.05 : 0.24;
        const beat = reducedMotion
          ? 0
          : Math.exp(-Math.pow((cardiacPhase - 0.18) / 0.16, 2));
        const shimmer = reducedMotion
          ? 1
          : 0.9 + 0.1 * Math.sin(time * 1.8 + i * 0.83);
        sprites[site].material.opacity =
          emphasis * shimmer * (focused ? 0.32 : 1) * (lightTheme ? 0.8 : 1);
        sprites[site].scale.setScalar(
          sizes[site] *
            (selected === site ? 1.6 + beat * 0.18 : 1) *
            (reducedMotion ? 1 : 1 + 0.025 * Math.sin(time * 1.5 + i)),
        );
      }
    },
    dispose() {
      texture.dispose();
      Object.values(sprites).forEach((s) => s.material.dispose());
    },
  };
}
