import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "plethscape-appearance";

// index.html resolves the saved choice before CSS or the application loads.
// Reading that same primitive snapshot keeps every canvas and React control in
// sync without mounting a new scene or touching the simulation clock.
let currentTheme: Theme =
  typeof document !== "undefined" &&
  document.documentElement.dataset.theme === "dark"
    ? "dark"
    : "light";
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  return currentTheme;
}

function applyTheme(theme: Theme) {
  const changed = currentTheme !== theme;
  currentTheme = theme;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0d0c0b" : "#fdfdfe");
    document
      .querySelector('meta[name="color-scheme"]')
      ?.setAttribute("content", theme);
  }
  if (changed) listeners.forEach((listener) => listener());
}

export function setTheme(theme: Theme) {
  const next = theme === "dark" ? "dark" : "light";
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // The choice still works for this session when storage is unavailable.
  }
  applyTheme(next);
}

function onStorage(event: StorageEvent) {
  if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
  applyTheme(event.newValue === "dark" ? "dark" : "light");
}

export function subscribeTheme(listener: () => void) {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getTheme,
    () => "light" as const,
  );
  return { theme, setTheme };
}

const chartPalettes = {
  light: {
    background: "#fdfdfe",
    surface: "#f6f8fc",
    text: "#626b7b",
    bright: "#111318",
    grid: "#dce1ea",
    gridMinor: "#edf0f5",
    trace: "#2855ff",
    comparison: "#6950ae",
    cyan: "#13758c",
    muted: "#626b7b",
    border: "#ccd6e7",
    tooltipBackground: "#fdfdfe",
    tooltipBorder: "#9aa9c1",
    annotation: "#1942dd",
    accent: "#2855ff",
    channels: { green: "#237b46", red: "#ba3d43", infrared: "#6950ae" },
    axes: { x: "#a45b17", y: "#13758c", z: "#6950ae" },
  },
  dark: {
    background: "#151412",
    surface: "#1c1a17",
    text: "#b8afa5",
    bright: "#f3ede7",
    grid: "#39322b",
    gridMinor: "#29241f",
    trace: "#efaa70",
    comparison: "#b7a4d1",
    cyan: "#82d9dc",
    muted: "#aaa096",
    border: "#645244",
    tooltipBackground: "#151412",
    tooltipBorder: "#b0a294",
    annotation: "#efaa70",
    accent: "#8eacff",
    channels: { green: "#8de8a3", red: "#ff8470", infrared: "#b6a3ee" },
    axes: { x: "#efaa70", y: "#82d9dc", z: "#b7a4d1" },
  },
};

export function getChartPalette(theme: Theme = getTheme()) {
  return chartPalettes[theme];
}
