export type SensorMetric = 'temperature' | 'vibration' | 'pressure';

export interface SensorConfig {
  id: string;
  label: string;
  metric: SensorMetric;
  unit: string;
  color: string;
  baseline: number;
  amplitude: number;
  noise: number;
  warnThreshold: number;
}

export interface Reading {
  t: number; // epoch ms
  v: number; // value
  sensorId: string;
}

export interface DownsampleRequest {
  key: string; // e.g. sensor id, so multiple series can share one worker
  requestId: number; // monotonically increasing per key, for staleness checks
  points: { t: number; v: number }[];
  threshold: number;
}

export interface DownsampleResponse {
  key: string;
  requestId: number;
  points: { t: number; v: number }[];
}
