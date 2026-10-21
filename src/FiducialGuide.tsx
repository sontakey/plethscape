import { useMemo } from "react";
import { analyzePulse, FIDUCIALS, type FiducialId } from "./fiducials";
import { sampleBeat, type Physiology, type SiteId } from "./simulation";

type Props = {
  physiology: Physiology;
  site: SiteId;
  selected: FiducialId;
  onSelect: (id: FiducialId) => void;
};
export default function FiducialGuide({
  physiology,
  site,
  selected,
  onSelect,
}: Props) {
  const analysis = useMemo(
    () =>
      analyzePulse(
        Float32Array.from({ length: 1025 }, (_, i) =>
          sampleBeat(i / 1024, physiology, site),
        ),
      ),
    [physiology, site],
  );
  const point = analysis.points.find((p) => p.id === selected);
  const duration = 60000 / physiology.heartRate;
  const ms = (phase: number | null) =>
    phase === null ? "—" : `${Math.round(phase * duration)} ms`;
  return (
    <section className="fiducial-guide" aria-label="Pulse landmarks">
      <div className="fiducial-heading">
        <h3>Meet the pulse</h3>
        <span>Fiducial points</span>
      </div>
      <p className="fiducial-intro">
        Choose a landmark to find it on the pulse trace.
      </p>
      <div className="fiducial-options">
        {(Object.keys(FIDUCIALS) as FiducialId[]).map((id) => (
          <button
            key={id}
            aria-pressed={id === selected}
            onClick={() => onSelect(id)}
            aria-controls="fiducial-description"
          >
            <span>{FIDUCIALS[id].name}</span>
            {!analysis.points.some((p) => p.id === id) && (
              <small>Not distinct</small>
            )}
          </button>
        ))}
      </div>
      <div
        id="fiducial-description"
        className="fiducial-description"
        aria-live="polite"
        aria-atomic="true"
      >
        <h4>{FIDUCIALS[selected].name}</h4>
        <p>{FIDUCIALS[selected].description}</p>
        <p className="fiducial-reading">
          {point
            ? `${ms(point.phase)} from onset · ${point.amplitude.toFixed(2)} a.u.`
            : "No distinct local landmark in this contour. No marker is drawn; a shoulder is not labeled as a separate peak or notch."}
        </p>
      </div>
      <details className="pulse-measurements">
        <summary>Pulse timing & shape</summary>
        <dl>
          <div>
            <dt>Crest time · on → sp</dt>
            <dd>{ms(analysis.crestPhase)}</dd>
          </div>
          <div>
            <dt>Pulse duration · on → off</dt>
            <dd>{ms(1)}</dd>
          </div>
          <div>
            <dt>Pulse width at 50% amplitude</dt>
            <dd>{ms(analysis.width50Phase)}</dd>
          </div>
          <div>
            <dt>Pulse amplitude · foot → crest</dt>
            <dd>{analysis.amplitude?.toFixed(2) ?? "—"} a.u.</dd>
          </div>
        </dl>
        <p>
          Width spans the first rising and last falling half-amplitude
          crossings. These are measurements of the clean representative pulse,
          not the variable live beat.
        </p>
      </details>
      <p className="fiducial-source">
        Names follow{" "}
        <a
          href="https://doi.org/10.1088/1361-6579/ad33a2"
          target="_blank"
          rel="noreferrer"
        >
          Goda, Charlton & Behar’s pyPPG paper (2024)
        </a>
        . u is a slope landmark; a–f belong to the second derivative and are not
        peaks on this trace. Notch visibility varies, as illustrated in{" "}
        <a
          href="https://www.researchgate.net/figure/Different-classes-of-PPG-pulse-waves-according-to-the-characteristics-of-the-dicrotic_fig3_378959145"
          target="_blank"
          rel="noreferrer"
        >
          the pulse-contour classes
        </a>
        .
      </p>
    </section>
  );
}
