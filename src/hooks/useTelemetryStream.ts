import { useEffect, useMemo, useRef, useState } from 'react';
import { RingBuffer } from '../utils/ringBuffer';
import { SENSORS, sampleValue, generateHistory } from '../utils/dataGenerator';

const BUFFER_CAPACITY = 200_000; // per sensor
const HISTORY_BACKFILL_POINTS = 20_000; // per sensor, seeded on mount
const HISTORY_INTERVAL_MS = 50;

interface StreamOptions {
  intervalMs: number;
  pointsPerTick: number;
  running: boolean;
}

export function useTelemetryStream({ intervalMs, pointsPerTick, running }: StreamOptions) {
  const buffers = useMemo(() => {
    const map = new Map<string, RingBuffer>();
    for (const sensor of SENSORS) {
      const buf = new RingBuffer(BUFFER_CAPACITY);
      map.set(sensor.id, buf);
    }
    return map;
  }, []);

  const [totalPoints, setTotalPoints] = useState(0);
  const [tick, setTick] = useState(0); // bumped on every write batch to trigger re-renders
  const seeded = useRef(false);

  // Seed history once so the dashboard doesn't open empty.
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const history = generateHistory(HISTORY_BACKFILL_POINTS, HISTORY_INTERVAL_MS);
    for (const reading of history) {
      buffers.get(reading.sensorId)?.push(reading.t, reading.v);
    }
    setTotalPoints(HISTORY_BACKFILL_POINTS * SENSORS.length);
    setTick((t) => t + 1);
  }, [buffers]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      for (let p = 0; p < pointsPerTick; p++) {
        const t = now - (pointsPerTick - 1 - p) * (intervalMs / pointsPerTick);
        for (const sensor of SENSORS) {
          buffers.get(sensor.id)?.push(t, sampleValue(sensor, t));
        }
      }
      setTotalPoints((prev) => prev + pointsPerTick * SENSORS.length);
      setTick((t) => t + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [buffers, intervalMs, pointsPerTick, running]);

  return { buffers, totalPoints, tick };
}
