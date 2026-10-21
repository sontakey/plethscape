import { useEffect, useMemo, useState, type RefObject } from "react";
import {
  SITES,
  sampleCapturedBeat,
  siteDelay,
  type Physiology,
  type SiteId,
  type CapturedBeat,
} from "./simulation";
import { analyzePulse, FIDUCIALS, type FiducialId } from "./fiducials";
import { OPTICAL_BANDS, type Wavelength } from "./optics";
import { getChartPalette, useTheme } from "./theme";
type Props = {
  clock: RefObject<{ time: number; running: boolean }>;
  physiology: Physiology;
  site: SiteId;
  captured: CapturedBeat;
  end: number;
  running: boolean;
  speed: number;
  view: "sensor" | "body";
  wavelength: Wavelength;
  stage: number;
  onSeek: (time: number) => void;
  onPlay: () => void;
  onSpeed: (speed: number) => void;
  onSite: (site: SiteId) => void;
  onView: (view: "sensor" | "body") => void;
  onWavelength: (w: Wavelength) => void;
  onStage: (stage: number) => void;
  onClose: () => void;
};
const steps = [
  {
    title: "Illuminate",
    text: "The LED sends light into tissue. The paths here are deliberately slowed so you can follow them.",
  },
  {
    title: "Scatter",
    text: "Light scatters through tissue; some is absorbed. More pulsatile blood volume changes how much light reaches the detector.",
  },
  {
    title: "Detect",
    text: "The detector receives modulated light. Our PPG display turns blood-volume increases upward; received light decreases in this simplified view.",
  },
];
export default function SignalStudio(p: Props) {
  const { theme } = useTheme();
  const colors = getChartPalette(theme);
  const [sites, setSites] = useState<SiteId[]>(() =>
    Array.from(new Set([p.site, "finger", "wrist", "ear"] as SiteId[])).slice(
      0,
      4,
    ),
  );
  const [aligned, setAligned] = useState(false),
    [now, setNow] = useState(p.clock.current.time),
    [landmark, setLandmark] = useState<FiducialId | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) setNow(p.clock.current.time);
    }, 33);
    return () => clearInterval(id);
  }, [p.clock]);
  useEffect(() => {
    setSites((current) =>
      current.includes(p.site) ? current : [p.site, ...current].slice(0, 4),
    );
    setLandmark(null);
  }, [p.site]);
  const span = p.end - p.captured.start,
    duration = p.captured.end - p.captured.start;
  const points = useMemo(
    () =>
      analyzePulse(
        Float32Array.from({ length: 1025 }, (_, i) =>
          sampleCapturedBeat(
            p.captured.start + (i / 1024) * duration,
            p.physiology,
            p.site,
            p.captured,
            true,
          ),
        ),
      ).points,
    [p.captured, p.physiology, p.site, duration],
  );
  const rows = useMemo(
    () =>
      sites.map((site) => {
        const delay = siteDelay(p.physiology, site),
          label = SITES.find((s) => s.id === site)!;
        const path = Array.from({ length: 385 }, (_, i) => {
          const value = sampleCapturedBeat(
            p.captured.start + (i / 384) * span,
            p.physiology,
            site,
            p.captured,
            aligned,
          );
          return `${i ? "L" : "M"}${((i / 384) * 320).toFixed(2)},${(86 - (value / 1.7) * 72).toFixed(2)}`;
        }).join(" ");
        return { site, delay, label, path };
      }),
    [sites, p.physiology, p.captured, span, aligned],
  );
  const seek = (value: number) => {
    setLandmark(null);
    p.onSeek(value);
    setNow(value);
  };
  const elapsed = now - p.captured.start;
  const activeRow = rows.find((row) => row.site === p.site) ?? rows[0];
  const activeX = ((elapsed - (aligned ? activeRow.delay : 0)) / span) * 320;
  const activePulse = sampleCapturedBeat(now, p.physiology, p.site, p.captured);
  const playbackControls = (
    <section className="studio-time" aria-label="Heartbeat playback">
      <div className="studio-time-heading">
        <strong>
          {Math.round(elapsed * 1000)} <small>ms</small>
        </strong>
        <span>from ventricular event</span>
      </div>
      <label htmlFor="beat-scrubber">Scrub the heartbeat</label>
      <input
        id="beat-scrubber"
        type="range"
        min="0"
        max="1000"
        step="1"
        value={Math.round(Math.max(0, Math.min(1, elapsed / span)) * 1000)}
        aria-valuetext={`${Math.round(elapsed * 1000)} milliseconds after ventricular event`}
        onChange={(e) =>
          seek(p.captured.start + (Number(e.target.value) / 1000) * span)
        }
      />
      <div className="studio-playback">
        <button
          onClick={() => seek(p.captured.start)}
          aria-label="Restart captured heartbeat"
        >
          ↶ Start
        </button>
        <button className="studio-play" onClick={p.onPlay}>
          {p.running ? "Pause beat" : "Play beat"}
        </button>
        <label>
          Speed
          <select
            aria-label="Heartbeat playback speed"
            value={p.speed}
            onChange={(e) => p.onSpeed(Number(e.target.value))}
          >
            <option value={0.2}>0.2×</option>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
          </select>
        </label>
      </div>
      <p className="studio-small">
        One pulse isolated from its neighbors. The replay includes travel to the
        most distant site.
      </p>
    </section>
  );
  return (
    <aside
      className={`signal-panel studio-panel ${p.view === "body" ? "comparison-view" : ""}`}
      aria-label="Inside the signal workspace"
    >
      <div className="studio-intro">
        <span className="section-overline">ONE CAPTURED HEARTBEAT</span>
        <h2>
          {p.view === "body" ? "One beat, side by side." : "Follow the signal."}
        </h2>
        <p>
          {p.view === "body"
            ? "The same pulse, seen at different locations. Compare up to four sites on shared scales."
            : "Move through time. Connect the heart, the tissue and the pulse."}
        </p>
      </div>
      {p.view === "sensor" && playbackControls}
      {p.view === "sensor" && (
        <section
          className="studio-active-pulse"
          aria-label="Selected captured pulse"
        >
          <div>
            <strong>{activeRow.label.name}</strong>
            <span>{activePulse.toFixed(2)} a.u.</span>
          </div>
          <svg
            viewBox="0 0 320 94"
            role="img"
            aria-label="Selected pulse and replay position"
          >
            {[0, 0.5, 1, 1.5].map((v) => (
              <line
                key={v}
                x1="0"
                x2="320"
                y1={86 - (v / 1.7) * 72}
                y2={86 - (v / 1.7) * 72}
                stroke={colors.grid}
              />
            ))}
            <path
              d={activeRow.path}
              fill="none"
              stroke={colors.trace}
              strokeWidth="2"
            />
            {activeX >= 0 && activeX <= 320 && (
              <g>
                <line
                  x1={activeX}
                  x2={activeX}
                  y1="3"
                  y2="89"
                  stroke={colors.bright}
                  opacity=".5"
                />
                <circle
                  cx={activeX}
                  cy={86 - (activePulse / 1.7) * 72}
                  r="4"
                  fill={colors.trace}
                />
              </g>
            )}
          </svg>
          <p className="studio-small">
            {aligned
              ? "Time since this site’s pulse onset"
              : "Time since ventricular event"}{" "}
            · {Math.round(span * 1000)} ms across · 0–1.7 a.u.
          </p>
        </section>
      )}
      {p.view === "sensor" && (
        <section className="studio-optics" aria-label="Optical exploration">
          <div
            className="studio-bands"
            role="group"
            aria-label="Light wavelength"
          >
            {(Object.keys(OPTICAL_BANDS) as Wavelength[]).map((w) => (
              <button
                key={w}
                aria-pressed={p.wavelength === w}
                onClick={() => p.onWavelength(w)}
              >
                {OPTICAL_BANDS[w].name}
                <small>{OPTICAL_BANDS[w].nm}</small>
              </button>
            ))}
          </div>
          <p className="studio-small">
            {OPTICAL_BANDS[p.wavelength].note} Wavelength changes illustrate
            relative depth and an illustrative site-dependent pulse contour.
          </p>
          <details className="wavelength-evidence">
            <summary>Does wavelength change the pulse shape?</summary>
            <p>
              It can. Different wavelengths sample overlapping tissue depths.
              The measured contour, amplitude and timing also depend on the
              site, skin, contact pressure, LED power and processing. There is
              no single universal green, red or infrared waveform.
            </p>
            <p>
              <b>Green:</b> generally samples more superficial tissue. In a
              12-person hand-motion study, green gave more accurate pulse-rate
              tracking than red or blue.{" "}
              <a
                href="https://pubmed.ncbi.nlm.nih.gov/24110039/"
                target="_blank"
                rel="noreferrer"
              >
                Study ↗
              </a>
            </p>
            <p>
              <b>Red and infrared:</b> generally sample deeper tissue. A
              multi-wavelength fingertip demonstration found small timing and
              contour differences, with green arriving later than infrared in
              that recording. This is an example, not a delay rule for every
              person or site.{" "}
              <a
                href="https://www.cinc.org/archives/2020/pdf/CinC2020-179.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Waveform comparison, figure 3 ↗
              </a>
            </p>
            <p>
              These controls change both the light paths and the teaching
              waveform. Contour and motion coefficients are illustrative, not a
              calibrated optical transfer function. Return to Live stream and
              try walking or running to see stronger red and infrared motion
              contamination.
            </p>
          </details>
          <div
            className="studio-steps"
            role="group"
            aria-label="Optical journey"
          >
            {steps.map((step, i) => (
              <button
                key={step.title}
                aria-pressed={p.stage === i}
                onClick={() => p.onStage(i)}
              >
                <span>0{i + 1}</span>
                {step.title}
              </button>
            ))}
          </div>
          <p className="studio-stage-text" aria-live="polite">
            {steps[p.stage].text}
          </p>
        </section>
      )}
      <section className="studio-sites" aria-label="Synchronized sensing sites">
        <div className="studio-sites-heading">
          <h3>Same beat. Different sites.</h3>
          <details>
            <summary>Choose sites</summary>
            <div>
              {SITES.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={sites.includes(s.id)}
                    disabled={
                      (sites.length === 1 && sites.includes(s.id)) ||
                      (sites.length === 4 && !sites.includes(s.id))
                    }
                    onChange={() => {
                      if (sites.includes(s.id)) {
                        const next = sites.filter((id) => id !== s.id);
                        setSites(next);
                        if (p.site === s.id) p.onSite(next[0]);
                      } else setSites([...sites, s.id]);
                    }}
                  />
                  {s.name}
                </label>
              ))}
              <p>Choose up to four sensing sites.</p>
            </div>
          </details>
        </div>
        <div
          className="studio-alignment"
          role="group"
          aria-label="Site trace alignment"
        >
          <button aria-pressed={!aligned} onClick={() => setAligned(false)}>
            Arrival timing
          </button>
          <button aria-pressed={aligned} onClick={() => setAligned(true)}>
            Align pulse feet
          </button>
        </div>
        <p className="studio-small">
          {aligned
            ? "Travel delays removed from the shapes. Each cursor shows time since that site’s own pulse onset."
            : "Shared time axis. Dashed lines mark the arrival of this same heartbeat at each site."}{" "}
          All traces use the same 0–1.7 a.u. amplitude scale.
        </p>
        {rows.map((row) => {
          const local = elapsed - (aligned ? row.delay : 0),
            x = (local / span) * 320,
            pulse = sampleCapturedBeat(now, p.physiology, row.site, p.captured);
          return (
            <div
              className={`studio-trace ${p.site === row.site ? "selected" : ""}`}
              key={row.site}
            >
              <button
                onClick={() => p.onSite(row.site)}
                aria-pressed={p.site === row.site}
              >
                <strong>{row.label.name}</strong>
                <span>+{Math.round(row.delay * 1000)} ms</span>
              </button>
              <svg
                viewBox="0 0 320 110"
                role="img"
                aria-label={`${row.label.name} captured PPG pulse, ${Math.round(row.delay * 1000)} milliseconds modeled transit, ${aligned ? "aligned by onset" : "shared arrival timeline"}`}
                data-testid={`site-trace-${row.site}`}
                data-cursor-time={local.toFixed(6)}
                fill={colors.text}
              >
                {[0, 0.5, 1, 1.5].map((value) => (
                  <line
                    key={value}
                    x1="0"
                    x2="320"
                    y1={86 - (value / 1.7) * 72}
                    y2={86 - (value / 1.7) * 72}
                    stroke={colors.grid}
                    strokeWidth=".65"
                  />
                ))}
                <line
                  x1={aligned ? 0 : (row.delay / span) * 320}
                  x2={aligned ? 0 : (row.delay / span) * 320}
                  y1="10"
                  y2="87"
                  stroke={colors.annotation}
                  strokeDasharray="3 4"
                />
                <path
                  d={row.path}
                  fill="none"
                  stroke={
                    p.site === row.site ? colors.trace : colors.comparison
                  }
                  strokeWidth="1.8"
                />
                {x >= 0 && x <= 320 && (
                  <g>
                    <line
                      x1={x}
                      x2={x}
                      y1="8"
                      y2="88"
                      stroke={colors.bright}
                      opacity=".45"
                    />
                    <circle
                      cx={x}
                      cy={86 - (pulse / 1.7) * 72}
                      r="3.8"
                      fill={colors.trace}
                      stroke={colors.surface}
                    />
                  </g>
                )}
                <text x="0" y="106">
                  0
                </text>
                <text x="160" y="106" textAnchor="middle">
                  {Math.round(span * 500)}
                </text>
                <text x="320" y="106" textAnchor="end">
                  {Math.round(span * 1000)} ms
                </text>
              </svg>
            </div>
          );
        })}
      </section>
      {p.view === "body" && playbackControls}
      <section className="studio-landmarks" aria-label="Jump to pulse landmark">
        <h3>Jump to a moment</h3>
        <p className="studio-small">
          {SITES.find((s) => s.id === p.site)?.name} · select a point to move
          the entire scene to its arrival.
        </p>
        <div>
          {points.map((point) => (
            <button
              key={point.id}
              title={FIDUCIALS[point.id].name}
              aria-label={`Jump to ${FIDUCIALS[point.id].name}`}
              aria-pressed={landmark === point.id}
              onClick={() => {
                const t =
                  p.captured.start +
                  siteDelay(p.physiology, p.site) +
                  point.phase * duration;
                setLandmark(point.id);
                p.onSeek(t);
                setNow(t);
              }}
            >
              {FIDUCIALS[point.id].name}
            </button>
          ))}
        </div>
        {landmark && (
          <p className="studio-stage-text" aria-live="polite">
            <strong>{FIDUCIALS[landmark].name}.</strong>{" "}
            {FIDUCIALS[landmark].description}
          </p>
        )}
      </section>
      <details className="studio-method">
        <summary>How this view works</summary>
        <p>
          Transit is modeled from a ventricular event, without an ECG
          pre-ejection interval. Alignment subtracts each site’s delay;
          amplitudes stay on a shared scale. Optical paths are illustrative,
          slowed, and not to scale. The cutaway explains reflectance sensing,
          rather than the exact geometry of every wearable.
        </p>
        <p>
          <a
            href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9136485/"
            target="_blank"
            rel="noreferrer"
          >
            Light and PPG sensing ↗
          </a>{" "}
          ·{" "}
          <a
            href="https://peterhcharlton.github.io/bsp-book/background/physiology.html"
            target="_blank"
            rel="noreferrer"
          >
            Pulse propagation ↗
          </a>
        </p>
      </details>
      <button className="studio-return" onClick={p.onClose}>
        Return to live exploration ↗
      </button>
    </aside>
  );
}
