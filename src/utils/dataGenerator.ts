import type { SensorConfig, Reading } from '../types';

export const SENSORS: SensorConfig[] = [
  {
    id: 'temp-01',
    label: 'Furnace Core Temp',
    metric: 'temperature',
    unit: '°C',
    color: '#E2962B',
    baseline: 620,
    amplitude: 18,
    noise: 4,
    warnThreshold: 655,
  },
  {
    id: 'vib-02',
    label: 'Spindle Vibration',
    metric: 'vibration',
    unit: 'mm/s',
    color: '#4F8C88',
    baseline: 2.4,
    amplitude: 1.1,
    noise: 0.35,
    warnThreshold: 4.2,
  },
  {
    id: 'pres-03',
    label: 'Line Pressure',
    metric: 'pressure',
    unit: 'bar',
    color: '#16333F',
    baseline: 8.1,
    amplitude: 0.6,
    noise: 0.15,
    warnThreshold: 9.3,
  },
  {
    id: 'temp-04',
    label: 'Coolant Loop Temp',
    metric: 'temperature',
    unit: '°C',
    color: '#A0522D',
    baseline: 42,
    amplitude: 5,
    noise: 1.2,
    warnThreshold: 55,
  },
];

let seedCounter = 1;
function seededRandom() {
  // deterministic-ish PRNG so history backfill is stable across renders
  seedCounter = (seedCounter * 9301 + 49297) % 233280;
  return seedCounter / 233280;
}

/**
 * Produces one synthetic reading for a sensor at a given timestamp.
 * Combines a slow sine drift with jitter noise and occasional spikes
 * so the chart has realistic-looking texture at any zoom level.
 */
export function sampleValue(sensor: SensorConfig, t: number): number {
  const driftPeriodMs = 45_000;
  const drift = Math.sin((t / driftPeriodMs) * Math.PI * 2) * sensor.amplitude;
  const jitter = (seededRandom() - 0.5) * 2 * sensor.noise;
  const spike = seededRandom() > 0.997 ? sensor.amplitude * 1.8 : 0;
  return sensor.baseline + drift + jitter + spike;
}

/**
 * Backfills `count` historical readings ending at `endTime`, spaced
 * `intervalMs` apart, for every sensor in SENSORS.
 */
export function generateHistory(
  count: number,
  intervalMs: number,
  endTime = Date.now()
): Reading[] {
  const readings: Reading[] = [];
  const startTime = endTime - count * intervalMs;
  for (let i = 0; i < count; i++) {
    const t = startTime + i * intervalMs;
    for (const sensor of SENSORS) {
      readings.push({ t, v: sampleValue(sensor, t), sensorId: sensor.id });
    }
  }
  return readings;
}
