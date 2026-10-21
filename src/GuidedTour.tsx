import { DEFAULT_PHYSIOLOGY, type Physiology, type SiteId } from "./simulation";

export const TOUR_STEPS = [
  {
    label: "Follow",
    title: "Meet the pulse behind the signal.",
    action: "Follow a pulse",
    target: "body",
    before: "Wrist · at rest",
    after: "Heart → arteries → sensor",
    prompt:
      "Follow the amber pulse from the heart to the wrist, then find its rhythm in the trace.",
    result:
      "The highlighted route connects the beating heart to the optical signal. The travel animation is deliberately slowed for learning.",
    why: "PPG senses changes in blood volume in tissue using light. It is an optical signal, rather than a direct recording of the heart’s electrical activity.",
  },
  {
    label: "Location",
    title: "Same heartbeat. A different location.",
    action: "Compare the finger",
    target: "location",
    before: "Wrist · 72 bpm",
    after: "Finger · 72 bpm",
    prompt:
      "A wrist reference is saved. Select the finger and compare the two pulse contours.",
    result:
      "Only location changed. Compare the finger pulse with the dashed wrist reference: look at the relative height and the later rise.",
    why: "Local vessels and tissue shape an optical pulse. These illustrative contours are not a ranking of commercial device accuracy.",
  },
  {
    label: "Age",
    title: "Let one pulse grow older.",
    action: "Try age 70",
    target: "Age",
    before: "Age 25 · finger",
    after: "Age 70 · finger",
    prompt:
      "A young finger pulse is saved. Move age to 70 and watch the later features of the pulse.",
    result:
      "Only age changed. The older contour’s reflected component arrives earlier in this model, making the later rise less distinct.",
    why: "Age and arterial properties influence pulse morphology. Real people vary, so an individual’s age cannot be read directly from a single PPG pulse.",
  },
  {
    label: "Rate",
    title: "Fit more beats into the same window.",
    action: "Try 120 bpm",
    target: "Heart rate",
    before: "Mean 72 bpm",
    after: "Mean 120 bpm",
    prompt:
      "Keep your eye on the five-second window. Increase the mean heart rate to 120 bpm.",
    result:
      "The beats are closer together. At a mean of 120 bpm, about ten beats fit in five seconds; the reference remains at 72 bpm.",
    why: "Heart rate sets average beat spacing. This simulation also includes small timing variations, so individual intervals are not all exactly the same.",
  },
  {
    label: "Breathing",
    title: "Find the rhythm within the rhythm.",
    action: "Try 6 breaths/min",
    target: "Breathing rate",
    before: "16 breaths/min",
    after: "6 breaths/min",
    prompt:
      "Slow breathing to six breaths per minute. Watch the lungs and give the ten-second trace a full breath to develop.",
    result:
      "Watch the next full breath: beat spacing, height and baseline vary slowly. The mean heart rate stays at 72 bpm.",
    why: "Respiratory sinus arrhythmia couples breathing and heart-rate variation. Slower breathing strengthens that coupling in this illustrative model; it does not predict an individual person’s response.",
  },
] as const;

export function tourScenario(step: number) {
  const before: Physiology = {
    ...DEFAULT_PHYSIOLOGY,
    age: step === 2 ? 25 : 32,
    heartRate: 72,
    respiratoryRate: 16,
    activity: "rest",
  };
  const site: SiteId = step === 2 ? "finger" : "wrist";
  const after = {
    ...before,
    ...(step === 2
      ? { age: 70 }
      : step === 3
        ? { heartRate: 120 }
        : step === 4
          ? { respiratoryRate: 6 }
          : {}),
  };
  return {
    before,
    after,
    site,
    afterSite: (step === 1 ? "finger" : site) as SiteId,
    mode: (step === 1 || step === 2 ? "beat" : "stream") as "beat" | "stream",
  };
}

export default function GuidedTour({
  step,
  applied,
  matched,
  ready,
  onApply,
  onStep,
  onExit,
}: {
  step: number;
  applied: boolean;
  matched: boolean;
  ready: boolean;
  onApply: () => void;
  onStep: (step: number) => void;
  onExit: () => void;
}) {
  const complete = step >= TOUR_STEPS.length;
  const current = TOUR_STEPS[Math.min(step, TOUR_STEPS.length - 1)];
  return (
    <section
      className="guided-tour"
      aria-label="Guided experiment"
      tabIndex={-1}
    >
      <div className="tour-topline">
        <span>
          {complete
            ? "EXPLORATION COMPLETE"
            : `GUIDED EXPERIMENT ${step + 1} / ${TOUR_STEPS.length}`}
        </span>
        <button onClick={onExit} aria-label="Exit guided tour">
          Exit ×
        </button>
      </div>
      <div className="tour-progress" aria-label="Tour progress">
        {TOUR_STEPS.map((s, i) => (
          <button
            key={s.label}
            onClick={() => onStep(i)}
            aria-current={step === i ? "step" : undefined}
            aria-label={`Go to ${s.label} experiment`}
          >
            <span>{i + 1}</span>
            {s.label}
          </button>
        ))}
      </div>
      <h3>
        {complete ? "You’ve explored what shapes a pulse." : current.title}
      </h3>
      <p>
        {complete
          ? "Keep trying your own combinations. Your last settings and reference are still available."
          : current.prompt}
      </p>
      {!complete && (
        <>
          <div className="tour-comparison">
            <span>
              <i />
              Before <strong>{current.before}</strong>
            </span>
            <span>
              <i />
              Try <strong>{current.after}</strong>
            </span>
          </div>
          <div className="tour-result" role="status">
            {matched && applied
              ? current.result
              : applied
                ? "You changed the setup. Reapply this experiment to isolate its effect, or keep exploring freely."
                : "Change the highlighted control yourself, or use the button below."}
          </div>
          <details key={step} className="tour-science">
            <summary>Why does this happen?</summary>
            <p>{current.why}</p>
          </details>
        </>
      )}
      <div className="tour-actions">
        <button disabled={step === 0} onClick={() => onStep(step - 1)}>
          ← Back
        </button>
        {!complete && (
          <button className="tour-apply" disabled={!ready} onClick={onApply}>
            {applied ? "Reapply experiment" : current.action}
          </button>
        )}
        <button onClick={() => (complete ? onExit() : onStep(step + 1))}>
          {complete
            ? "Keep exploring →"
            : step === TOUR_STEPS.length - 1
              ? "Finish →"
              : "Next →"}
        </button>
      </div>
    </section>
  );
}
