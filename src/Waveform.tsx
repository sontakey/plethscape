import { OPTICAL_BANDS } from "./optics";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import {
  samplePPG,
  PPG_DISPLAY_RANGE,
  sampleBeat,
  sampleAccelerometer,
  type Physiology,
  type SiteId,
} from "./simulation";

import { analyzePulse, FIDUCIALS, type FiducialId } from "./fiducials";
import { getRhythm, RHYTHMS } from "./rhythm";
import { getChartPalette, getTheme, subscribeTheme } from "./theme";

type WaveformProps = {
  physiology: Physiology;
  site: SiteId;
  clock: RefObject<{ time: number; running: boolean }>;
  compare?: { physiology: Physiology; site: SiteId } | null;
  mode?: "stream" | "beat" | "accelerometer";
  annotate?: boolean;
  windowSeconds?: number;
  selectedFiducial?: FiducialId;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function Waveform(props: WaveformProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestRef = useRef(props);
  const revisionRef = useRef(0);

  useLayoutEffect(() => {
    latestRef.current = props;
    revisionRef.current++;
  });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 640;
    let height = 240;
    let dpr = 1;
    let frame = 0;
    let lastFrame = -Infinity;
    let lastTime = NaN;
    let lastRevision = -1;
    let dirty = true;
    let visible = true;
    let displayTime = latestRef.current.clock.current?.time ?? 0;
    let hover: { x: number; y: number } | null = null;

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(150, bounds.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      dirty = true;
    };

    const draw = () => {
      const theme = getTheme();
      const colors = getChartPalette(theme);
      const {
        physiology,
        site,
        compare,
        mode = "stream",
        annotate = false,
      } = latestRef.current;
      const time = displayTime;
      canvas.dataset.windowSeconds = String(
        latestRef.current.windowSeconds ??
          (getRhythm(physiology.rhythm) !== "sinus" ? 10 : 5),
      );
      const beat = mode === "beat";
      const accelerometer = mode === "accelerometer";
      const pad = {
        left: width < 420 ? 32 : 39,
        right: 14,
        top: annotate && beat ? (width < 480 ? 102 : 76) : 22,
        bottom: 30,
      };
      const plotWidth = Math.max(1, width - pad.left - pad.right);
      const plotHeight = Math.max(1, height - pad.top - pad.bottom);
      const streamSpan =
        latestRef.current.windowSeconds ??
        (!accelerometer && getRhythm(physiology.rhythm) !== "sinus" ? 10 : 5);
      // Keep at least 125 samples/s in a stream, even on narrow screens.
      const count = Math.max(
        beat ? 1025 : Math.ceil(streamSpan * 125) + 1,
        Math.min(1000, Math.ceil(plotWidth * 1.3)),
      );
      const minY = accelerometer ? -2 : beat ? -0.1 : PPG_DISPLAY_RANGE.min;
      const maxY = accelerometer ? 2 : beat ? 1.8 : PPG_DISPLAY_RANGE.max;
      const mapY = (value: number) =>
        pad.top + ((maxY - value) / (maxY - minY)) * plotHeight;
      const mapX = (index: number) =>
        pad.left + (index / (count - 1)) * plotWidth;
      const span = beat ? 60 / Math.max(1, physiology.heartRate) : streamSpan;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.font = '12px "DM Sans Variable", "DM Sans", system-ui, sans-serif';
      ctx.textBaseline = "middle";

      // The vertical scale stays fixed as physiology changes, preserving amplitude.
      const ticks = accelerometer
        ? [-2, -1, 0, 1, 2]
        : beat
          ? [0, 0.5, 1, 1.5]
          : [-1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
      ctx.setLineDash([]);
      for (const tick of ticks) {
        const y = mapY(tick);
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        ctx.fillStyle = colors.text;
        ctx.textAlign = "right";
        ctx.fillText(tick.toFixed(accelerometer ? 0 : 1), pad.left - 9, y);
      }

      const divisions = width < 400 ? 4 : 5;
      for (let i = 0; i <= divisions * 4; i++) {
        const major = i % 4 === 0;
        const x = pad.left + (i / (divisions * 4)) * plotWidth;
        ctx.strokeStyle = major ? colors.grid : colors.gridMinor;
        ctx.lineWidth = major ? 0.65 : 0.35;
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, height - pad.bottom);
        ctx.stroke();
        if (!major) continue;
        ctx.fillStyle = colors.text;
        ctx.textAlign =
          i === 0 ? "left" : i === divisions * 4 ? "right" : "center";
        const fraction = i / (divisions * 4);
        const label = beat
          ? `${Math.round(fraction * 100)}${i === divisions * 4 ? "%" : ""}`
          : i === divisions * 4
            ? "now"
            : `−${((1 - fraction) * span).toFixed(fraction === 0 && Number.isInteger(span) ? 0 : 1)}s`;
        ctx.fillText(label, x, height - 12);
      }

      ctx.textAlign = "left";
      ctx.fillStyle = colors.text;
      ctx.fillText(accelerometer ? "g" : "a.u.", 3, 10);
      if (!beat) {
        ctx.textAlign = "right";
        if (accelerometer) {
          const axes = [
            { label: "X", color: colors.axes.x },
            { label: "Y", color: colors.axes.y },
            { label: "Z", color: colors.axes.z },
          ];
          axes.forEach((axis, index) => {
            ctx.fillStyle = axis.color;
            ctx.fillText(axis.label, width - pad.right - (2 - index) * 27, 10);
          });
        } else ctx.fillText(`${streamSpan} s window`, width - pad.right, 10);
      }

      const samples = new Float32Array(count);
      const comparison =
        compare && !accelerometer ? new Float32Array(count) : null;
      const axisY = accelerometer ? new Float32Array(count) : null;
      const axisZ = accelerometer ? new Float32Array(count) : null;
      for (let i = 0; i < count; i++) {
        const phase = i / (count - 1);
        const t = time - span + phase * span;
        if (accelerometer) {
          const acceleration = sampleAccelerometer(t, physiology);
          samples[i] = acceleration.x;
          axisY![i] = acceleration.y;
          axisZ![i] = acceleration.z;
        } else {
          samples[i] = beat
            ? sampleBeat(phase, physiology, site)
            : samplePPG(t, physiology, site);
          if (comparison && compare) {
            comparison[i] = beat
              ? sampleBeat(phase, compare.physiology, compare.site)
              : samplePPG(t, compare.physiology, compare.site);
          }
        }
      }

      const path = (values: Float32Array) => {
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const x = mapX(i);
          const y = mapY(Number.isFinite(values[i]) ? values[i] : 0);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      };
      const stroke = (
        values: Float32Array,
        color: string,
        glow = false,
        dashed = false,
      ) => {
        path(values);
        ctx.strokeStyle = color;
        ctx.lineWidth = glow ? 1.8 : 1.3;
        ctx.setLineDash(dashed ? [5, 5] : []);
        ctx.shadowBlur = glow && theme === "dark" ? 7 : 0;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
      };

      const traceColor = accelerometer
        ? colors.axes.x
        : colors.channels[physiology.wavelength ?? "green"];
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad.left, pad.top - 2, plotWidth, plotHeight + 4);
      ctx.clip();
      if (!accelerometer) {
        path(samples);
        ctx.lineTo(width - pad.right, mapY(0));
        ctx.lineTo(pad.left, mapY(0));
        ctx.closePath();
        const fill = ctx.createLinearGradient(
          0,
          pad.top,
          0,
          height - pad.bottom,
        );
        fill.addColorStop(0, `${traceColor}1a`);
        fill.addColorStop(1, `${traceColor}01`);
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (comparison) stroke(comparison, colors.comparison, false, true);
      if (axisY && axisZ) {
        stroke(axisZ, colors.axes.z);
        stroke(axisY, colors.axes.y);
      }
      stroke(samples, traceColor, !accelerometer);

      if (!beat && !accelerometer) {
        const endpointY = mapY(samples[count - 1]);
        ctx.fillStyle = traceColor;
        ctx.shadowColor = traceColor;
        ctx.shadowBlur = theme === "dark" ? 12 : 0;
        ctx.beginPath();
        ctx.arc(width - pad.right, endpointY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      if (beat && annotate) {
        const landmarks = analyzePulse(samples).points.map((point) => ({
          ...point,
          label: FIDUCIALS[point.id].name.replace(/ \(.*\)/, ""),
          color:
            point.id === latestRef.current.selectedFiducial
              ? colors.bright
              : colors.annotation,
        }));
        ctx.font = '13px "DM Sans Variable", "DM Sans", system-ui, sans-serif';
        const columns = width < 480 ? 2 : 3;
        const rows = Math.ceil(landmarks.length / columns);
        const cellWidth = (width - 16) / columns;
        const labels = landmarks.map((landmark, index) => ({
          ...landmark,
          labelX: 8 + cellWidth * (Math.floor(index / rows) + 0.5),
          labelY: 14 + (index % rows) * 27,
        }));
        for (const landmark of labels) {
          const x = mapX(landmark.index);
          const y = mapY(samples[landmark.index]);
          ctx.strokeStyle = landmark.color;
          ctx.globalAlpha = 0.4;
          ctx.lineWidth = 0.8;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(landmark.labelX, landmark.labelY + 10);
          ctx.lineTo(landmark.labelX, pad.top - 9);
          ctx.lineTo(x, y - 7);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.fillStyle = colors.surface;
          ctx.beginPath();
          ctx.arc(
            x,
            y,
            landmark.id === latestRef.current.selectedFiducial ? 5.5 : 3.5,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = landmark.color;
          ctx.textAlign = "center";
          ctx.fillStyle = colors.surface;
          ctx.fillRect(
            landmark.labelX - ctx.measureText(landmark.label).width / 2 - 4,
            landmark.labelY - 9,
            ctx.measureText(landmark.label).width + 8,
            18,
          );
          ctx.fillStyle = landmark.color;
          ctx.fillText(landmark.label, landmark.labelX, landmark.labelY);
        }
        if (!landmarks.some((point) => point.id === "dn") && width > 290) {
          ctx.textAlign = "right";
          ctx.fillStyle = colors.text;
          ctx.fillText(
            "No distinct notch",
            width - pad.right,
            height - pad.bottom - 11,
          );
        }
      }

      if (
        hover &&
        hover.x >= pad.left &&
        hover.x <= width - pad.right &&
        hover.y <= height - pad.bottom
      ) {
        const fraction = clamp((hover.x - pad.left) / plotWidth, 0, 1);
        const index = Math.round(fraction * (count - 1));
        const x = mapX(index);
        const y = mapY(samples[index]);
        ctx.strokeStyle = colors.muted;
        ctx.lineWidth = 0.75;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, height - pad.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = traceColor;
        ctx.beginPath();
        ctx.arc(x, clamp(y, pad.top, height - pad.bottom), 3, 0, Math.PI * 2);
        ctx.fill();

        const timeText = beat
          ? `${Math.round(fraction * 100)}% cycle`
          : `−${((1 - fraction) * span).toFixed(2)} s`;
        const valueText = accelerometer
          ? `X ${samples[index].toFixed(2)}  Y ${axisY![index].toFixed(2)}  Z ${axisZ![index].toFixed(2)} g`
          : `${samples[index].toFixed(3)} a.u.`;
        const text = `${timeText}  ·  ${valueText}`;
        const boxWidth = Math.min(width - 12, ctx.measureText(text).width + 20);
        const boxX = clamp(x - boxWidth / 2, 6, width - boxWidth - 6);
        const boxY = clamp(
          y > height / 2 ? y - 40 : y + 16,
          pad.top + 4,
          height - pad.bottom - 29,
        );
        ctx.fillStyle = colors.tooltipBackground;
        ctx.strokeStyle = colors.tooltipBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, 26, 5);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = colors.bright;
        ctx.fillText(text, boxX + boxWidth / 2, boxY + 13, boxWidth - 14);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      hover = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      dirty = true;
    };
    const onPointerLeave = () => {
      hover = null;
      dirty = true;
    };
    const onFocus = () => {
      hover = { x: width / 2, y: height / 2 };
      dirty = true;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "Escape"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Escape") hover = null;
      else
        hover = {
          x: clamp(
            (hover?.x ?? width / 2) + (event.key === "ArrowLeft" ? -1 : 1) * 8,
            40,
            width - 15,
          ),
          y: height / 2,
        };
      dirty = true;
    };

    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      if (document.hidden || now - lastFrame < 1000 / 30) return;
      // Resizing clears the backing bitmap. Paint a fresh static frame even if
      // this plot is offscreen, then suspend its continuous animation again.
      if (!visible && !dirty && revisionRef.current === lastRevision) return;
      const current = latestRef.current;
      const currentClock = current.clock.current;
      if (currentClock?.running) displayTime = currentClock.time;
      const timeChanged = displayTime !== lastTime && current.mode !== "beat";
      if (!dirty && !timeChanged && revisionRef.current === lastRevision)
        return;
      lastFrame = now;
      lastTime = displayTime;
      lastRevision = revisionRef.current;
      dirty = false;
      draw();
    };

    const unsubscribeTheme = subscribeTheme(() => {
      // Theme changes repaint paused plots without changing their sampled time.
      dirty = true;
    });
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) dirty = true;
    });
    intersectionObserver.observe(host);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("focus", onFocus);
    canvas.addEventListener("blur", onPointerLeave);
    canvas.addEventListener("keydown", onKeyDown);
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribeTheme();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("focus", onFocus);
      canvas.removeEventListener("blur", onPointerLeave);
      canvas.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const accessibleLabel =
    props.mode === "accelerometer"
      ? "Simulated three-axis accelerometer data in g. Orange: X, teal: Y, purple: Z. Use left and right arrow keys to inspect values."
      : `Synthetic ${props.mode === "beat" ? "single-cycle" : "streaming"} PPG waveform at the ${props.site === "forehead" ? "temple" : String(props.site).replaceAll("_", " ")}. ${OPTICAL_BANDS[props.physiology.wavelength ?? "green"].name} light, ${OPTICAL_BANDS[props.physiology.wavelength ?? "green"].nm}.${props.physiology.wavelength === "infrared" ? " Invisible infrared is shown in violet false color." : ""} Amplitude is in arbitrary units. ${RHYTHMS[getRhythm(props.physiology.rhythm)].name} teaching setting.${props.compare ? " Dashed purple trace shows the saved comparison." : ""} Use left and right arrow keys to inspect values.`;

  return (
    <div
      ref={hostRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 150,
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={accessibleLabel}
        tabIndex={0}
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          width: "100%",
          height: "100%",
          minHeight: 150,
          touchAction: "pan-y",
        }}
      />
    </div>
  );
}
