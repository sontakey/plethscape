import { useEffect, useMemo, useState, type RefObject } from "react";
import { getChartPalette, useTheme } from "./theme";
import {
  captureBeat,
  sampleCapturedBeat,
  siteDelay,
  type Physiology,
  type SiteId,
} from "./simulation";

/** Compare actual completed simulated pulses without normalizing amplitude. */
export default function RecentBeats(p: {
  clock: RefObject<{ time: number; running: boolean }>;
  physiology: Physiology;
  site: SiteId;
}) {
  const { theme } = useTheme();
  const colors = getChartPalette(theme);
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(p.clock.current.time);
  useEffect(() => {
    if (!open) return;
    setTime(p.clock.current.time);
    const timer = window.setInterval(() => {
      if (!document.hidden) setTime(p.clock.current.time);
    }, 250);
    return () => clearInterval(timer);
  }, [open, p.clock]);
  const current = captureBeat(
    time - siteDelay(p.physiology, p.site),
    p.physiology,
  );
  const start = current.start;
  const rows = useMemo(() => {
    if (!open) return [];
    let end = start;
    return Array.from({ length: 5 }, () => {
      const captured = captureBeat(end - 1e-5, p.physiology);
      end = captured.start;
      const duration = captured.end - captured.start;
      const values = Array.from({ length: 257 }, (_, i) =>
        sampleCapturedBeat(
          captured.start + (i / 256) * duration,
          p.physiology,
          p.site,
          captured,
          true,
        ),
      );
      return { duration, values, peak: Math.max(...values) };
    });
  }, [open, start, p.physiology, p.site]);
  const span = Math.max(...rows.map((row) => row.duration), 0.1);
  return (
    <details
      className="recent-beats"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>See beat-to-beat changes</summary>
      {open && (
        <>
          <p>
            Last five completed pulses, aligned at onset. The bold trace is the
            newest. Heights keep their original scale; width shows the pulse
            interval.
          </p>
          <svg
            viewBox="0 0 320 150"
            role="img"
            aria-label="Five recent simulated pulses with original amplitudes and durations"
            data-testid="recent-beats"
            data-event={start}
            fill={colors.text}
          >
            {[0, 0.5, 1, 1.5].map((v) => (
              <g key={v}>
                <line
                  x1="27"
                  x2="316"
                  y1={125 - (v / 1.7) * 112}
                  y2={125 - (v / 1.7) * 112}
                  stroke={colors.grid}
                />
                <text x="0" y={129 - (v / 1.7) * 112}>
                  {v.toFixed(1)}
                </text>
              </g>
            ))}
            {[...rows].reverse().map((row, i) => (
              <path
                key={i}
                d={row.values
                  .map(
                    (value, j) =>
                      `${j ? "L" : "M"}${27 + (((j / 256) * row.duration) / span) * 289},${125 - (value / 1.7) * 112}`,
                  )
                  .join(" ")}
                fill="none"
                stroke={i === 4 ? colors.trace : colors.comparison}
                opacity={
                  i === 4
                    ? 1
                    : theme === "light"
                      ? 0.6 + i * 0.08
                      : 0.28 + i * 0.12
                }
                strokeWidth={i === 4 ? 2 : 1.2}
              />
            ))}
            <text x="27" y="146">
              0 ms
            </text>
            <text x="316" y="146" textAnchor="end">
              {Math.round(span * 1000)} ms
            </text>
          </svg>
          <div className="recent-beat-stats">
            <span>
              Pulse intervals
              <strong>
                {Math.round(Math.min(...rows.map((r) => r.duration)) * 1000)}–
                {Math.round(span * 1000)} ms
              </strong>
            </span>
            <span>
              Peak heights
              <strong>
                {Math.min(...rows.map((r) => r.peak)).toFixed(3)}–
                {Math.max(...rows.map((r) => r.peak)).toFixed(3)} a.u.
              </strong>
            </span>
          </div>
          <p>
            Clean modeled pulses; sensor noise and baseline drift are excluded.
            Small resting differences are expected. Try slower breathing, a
            different site, or an irregular rhythm.
          </p>
        </>
      )}
    </details>
  );
}
