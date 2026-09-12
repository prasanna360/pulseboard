import { useCallback, useEffect, useRef, useState, type WheelEvent, type MouseEvent } from 'react';
import type { RingBuffer } from '../utils/ringBuffer';
import type { SensorConfig } from '../types';
import { useDownsampleWorker } from '../hooks/useDownsampleWorker';

interface ChartProps {
  buffers: Map<string, RingBuffer>;
  sensors: SensorConfig[];
  visibleIds: Set<string>;
  tick: number;
  live: boolean;
  onLiveChange: (live: boolean) => void;
}

const DEFAULT_SPAN_MS = 30_000;
const MIN_SPAN_MS = 1_000;
const MAX_SPAN_MS = 15 * 60_000;
const DOWNSAMPLE_THRESHOLD = 1400;

export default function Chart({ buffers, sensors, visibleIds, tick, live, onLiveChange }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ width: 800, height: 360 });

  const [viewEnd, setViewEnd] = useState(() => Date.now());
  const [viewSpan, setViewSpan] = useState(DEFAULT_SPAN_MS);
  const viewRef = useRef({ start: viewEnd - viewSpan, end: viewEnd });

  const dragRef = useRef<{ startX: number; startViewStart: number; startViewEnd: number } | null>(
    null
  );

  const { results, submit } = useDownsampleWorker();
  const pointsRef = useRef<Map<string, { t: number; v: number }[]>>(new Map());

  const [fps, setFps] = useState(0);
  const [renderMs, setRenderMs] = useState(0);
  const [visiblePointCount, setVisiblePointCount] = useState(0);

  const visibleSensors = sensors.filter((s) => visibleIds.has(s.id));

  // Keep the live edge glued to "now" while in live mode.
  useEffect(() => {
    if (!live) return;
    const now = Date.now();
    setViewEnd(now);
  }, [live, tick]);

  useEffect(() => {
    viewRef.current = { start: viewEnd - viewSpan, end: viewEnd };
  }, [viewEnd, viewSpan]);

  // Resize handling: keep canvas backing-store crisp on any DPR.
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      sizeRef.current = { width, height };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ask the worker to downsample whenever the visible range or data changes.
  useEffect(() => {
    const { start, end } = viewRef.current;
    let totalRaw = 0;
    for (const sensor of visibleSensors) {
      const buf = buffers.get(sensor.id);
      if (!buf) continue;
      const padding = viewSpan * 0.05;
      const raw = buf.toOrderedPointsInRange(start - padding, end + padding);
      totalRaw += raw.length;
      submit(sensor.id, raw, DOWNSAMPLE_THRESHOLD);
    }
    setVisiblePointCount(totalRaw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, viewEnd, viewSpan, visibleIds, buffers]);

  // Merge fresh worker results into the ref the draw loop reads from.
  useEffect(() => {
    for (const [key, points] of results) {
      pointsRef.current.set(key, points);
    }
  }, [results]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return;
    const { start, end } = viewRef.current;
    const span = Math.max(end - start, 1);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#151E22';
    ctx.fillRect(0, 0, width, height);

    // fine vertical grid, like graph paper — helps read time position at a glance
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    const gridStep = width / 24;
    for (let gx = 0; gx <= width; gx += gridStep) {
      ctx.beginPath();
      ctx.moveTo(Math.round(gx) + 0.5, 0);
      ctx.lineTo(Math.round(gx) + 0.5, height);
      ctx.stroke();
    }

    const n = Math.max(visibleSensors.length, 1);
    const bandHeight = height / n;

    visibleSensors.forEach((sensor, i) => {
      const points = pointsRef.current.get(sensor.id) ?? [];
      const bandTop = i * bandHeight;
      const padTop = 20;
      const padBottom = 6;
      const plotTop = bandTop + padTop;
      const plotHeight = Math.max(bandHeight - padTop - padBottom, 1);

      let min = Infinity;
      let max = -Infinity;
      for (const p of points) {
        if (p.v < min) min = p.v;
        if (p.v > max) max = p.v;
      }
      if (!isFinite(min)) {
        min = sensor.baseline - sensor.amplitude;
        max = sensor.baseline + sensor.amplitude;
      }
      if (min === max) {
        min -= 1;
        max += 1;
      }
      const pad = (max - min) * 0.15;
      min -= pad;
      max += pad;
      const yRange = max - min;

      // band separator
      if (i > 0) {
        ctx.strokeStyle = '#2C3A3E';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, bandTop);
        ctx.lineTo(width, bandTop);
        ctx.stroke();
      }

      // warn threshold line
      if (sensor.warnThreshold >= min && sensor.warnThreshold <= max) {
        const y = plotTop + plotHeight * (1 - (sensor.warnThreshold - min) / yRange);
        ctx.strokeStyle = 'rgba(242,168,61,0.45)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // series line — soft phosphor-style glow, like a scope trace
      if (points.length > 1) {
        ctx.save();
        ctx.shadowColor = sensor.color;
        ctx.shadowBlur = 6;
        ctx.strokeStyle = sensor.color;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((p, idx) => {
          const x = ((p.t - start) / span) * width;
          const y = plotTop + plotHeight * (1 - (p.v - min) / yRange);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.restore();
      }

      // label + live value
      ctx.fillStyle = '#EAF0EF';
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(sensor.label, 10, bandTop + 14);

      const latest = points[points.length - 1];
      if (latest) {
        const isWarn = latest.v >= sensor.warnThreshold;
        ctx.fillStyle = isWarn ? '#F2A83D' : '#EAF0EF';
        ctx.font = '500 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${latest.v.toFixed(2)} ${sensor.unit}`, width - 10, bandTop + 14);
        ctx.textAlign = 'left';
      }
    });

    // x-axis time labels
    ctx.fillStyle = '#7F9498';
    ctx.font = '400 10px "IBM Plex Mono", monospace';
    const numTicks = width > 500 ? 6 : 3;
    for (let i = 0; i <= numTicks; i++) {
      const t = start + (i / numTicks) * span;
      const x = (i / numTicks) * width;
      const label = new Date(t).toLocaleTimeString([], { hour12: false });
      const clampedX = Math.min(Math.max(x, 24), width - 44);
      ctx.fillText(label, clampedX, height - 4);
    }
  }, [visibleSensors]);

  // Continuous draw loop, independent of React state updates, so the
  // canvas stays smooth even between downsample results.
  useEffect(() => {
    let raf = 0;
    let frameCount = 0;
    let lastFpsSample = performance.now();

    const loop = () => {
      const start = performance.now();
      draw();
      const elapsed = performance.now() - start;

      frameCount++;
      const now = performance.now();
      if (now - lastFpsSample >= 500) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsSample)));
        setRenderMs(Number(elapsed.toFixed(2)));
        frameCount = 0;
        lastFpsSample = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  const handleWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const offsetX = e.clientX - rect.left;
    const { start, end } = viewRef.current;
    const span = end - start;
    const anchorT = start + (offsetX / rect.width) * span;
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    const newSpan = Math.min(Math.max(span * factor, MIN_SPAN_MS), MAX_SPAN_MS);
    const newStart = anchorT - (offsetX / rect.width) * newSpan;
    onLiveChange(false);
    setViewSpan(newSpan);
    setViewEnd(newStart + newSpan);
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      startX: e.clientX,
      startViewStart: viewRef.current.start,
      startViewEnd: viewRef.current.end,
    };
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - dragRef.current.startX;
    const span = dragRef.current.startViewEnd - dragRef.current.startViewStart;
    const deltaT = -(dx / rect.width) * span;
    onLiveChange(false);
    setViewEnd(dragRef.current.startViewEnd + deltaT);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const jumpToLive = () => {
    onLiveChange(true);
    setViewSpan(DEFAULT_SPAN_MS);
    setViewEnd(Date.now());
  };

  return (
    <section className="panel chart-panel">
      <header className="panel-header">
        <div className="panel-header-left">
          <h2>Live Trace</h2>
          <span className="hint">drag to pan, scroll to zoom, double-click to reset</span>
        </div>
        <div className="panel-header-right">
          <span className="metric-inline">
            <span className="metric-label">fps</span>
            <span className="metric-value">{fps}</span>
          </span>
          <span className="metric-inline">
            <span className="metric-label">render</span>
            <span className="metric-value">{renderMs}ms</span>
          </span>
          <span className="metric-inline">
            <span className="metric-label">points in view</span>
            <span className="metric-value">{visiblePointCount.toLocaleString()}</span>
          </span>
          <button
            className={`live-badge ${live ? 'is-live' : ''}`}
            onClick={jumpToLive}
            title="Jump back to the live edge"
          >
            {live ? '● LIVE' : 'Jump to live'}
          </button>
        </div>
      </header>
      <div className="chart-canvas-wrap" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onDoubleClick={jumpToLive}
        />
      </div>
    </section>
  );
}
