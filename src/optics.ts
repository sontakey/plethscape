export type Wavelength = "green" | "red" | "infrared";
export const OPTICAL_BANDS = {
  green: {
    name: "Green",
    nm: "530 nm",
    color: 0x8de8a3,
    depth: 0.68,
    note: "Green light emphasizes shallower tissue in this illustration.",
  },
  red: {
    name: "Red",
    nm: "660 nm",
    color: 0xff8470,
    depth: 1.15,
    note: "Red light illustrates a deeper sampling region than green.",
  },
  infrared: {
    name: "Infrared",
    nm: "940 nm",
    color: 0xa994e6,
    depth: 1.65,
    note: "Infrared is invisible to us; violet false color makes its deeper paths visible here.",
  },
};

// Educational coefficients, not measured optical transfer functions or depth in mm.
// Site differences retain the base anatomy model. See docs/WAVELENGTHS.md.
export function opticalProfile(site: string, band: Wavelength) {
  const tissue =
    (
      {
        finger: 0.85,
        wrist: 1,
        ear: 0.45,
        forehead: 0.65,
        carotid: 0.6,
        upperarm: 0.9,
        toe: 1.1,
      } as Record<string, number>
    )[site] ?? 1;
  const spectral = band === "green" ? 0 : band === "red" ? 0.65 : 1;
  return {
    width: 1 - 0.12 * spectral * tissue,
    reflectionDelay: 0.035 * spectral * tissue,
    reflectionWidth: 1 - 0.2 * spectral * tissue,
    notch: 1 + 1.8 * spectral * tissue,
    notchWidth: 1 + 0.35 * spectral * tissue,
    reflection: 1 + 0.65 * spectral * tissue,
    gain: 1 - 0.18 * spectral * tissue,
    motion: 1 + 1.4 * spectral * tissue,
    depth: OPTICAL_BANDS[band].depth,
  };
}
